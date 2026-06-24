import fs from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { createIcqqClient } from "@/lib/client.js";
import {
  loadConfig,
  getAccountConfig,
  resolveRpcConfigForUin,
  resolveMcpConfigForUin,
} from "@/lib/config.js";
import { preflightDaemonNetworkPorts } from "@/lib/login-network-setup.js";
import {
  getAccountDir,
  getPidPath,
  getSocketPath,
  getTokenPath,
  getRpcPortPath,
  getMcpEndpointPath,
  getDaemonStoppedPath,
} from "@/lib/paths.js";
import { McpHost } from "@/mcp/host.js";
import {
  DaemonContext,
  initDaemonContext,
} from "./daemon-context.js";
import { cleanupDaemonStartupArtifacts } from "./entry-cleanup.js";
import { ManagedRuntime } from "./managed-runtime.js";
import { DaemonServer } from "./server.js";
import { initIcqqMessageIdBuilders } from "@/lib/icqq-message-id.js";

async function main() {
  const uin = Number(process.argv[2]);
  if (!uin || Number.isNaN(uin)) {
    console.error("Usage: node entry.js <uin>");
    process.exit(1);
  }

  let started = false;

  try {
    const config = await loadConfig();
    const account = getAccountConfig(config, uin);
    if (!account) {
      console.error(`[daemon] 未找到账号 ${uin} 的配置`);
      process.exit(1);
    }

    const portConflict = preflightDaemonNetworkPorts(config, uin);
    if (portConflict) {
      console.error(`[daemon] 网络端口冲突: ${portConflict}`);
      process.exit(1);
    }

    await fs.mkdir(getAccountDir(uin), { recursive: true, mode: 0o700 });
    await fs.writeFile(getPidPath(uin), String(process.pid), { mode: 0o600 });

    // Generate IPC auth token
    const ipcToken = randomBytes(32).toString("hex");
    await fs.writeFile(getTokenPath(uin), ipcToken, { mode: 0o600 });

    const client = await createIcqqClient(uin, account);

    // Login with cached token
    await new Promise<void>((resolve, reject) => {
      let settled = false;
      const settle = (fn: () => void) => { if (!settled) { settled = true; fn(); } };

      client.once("system.online", () => settle(resolve));

      client.once("system.login.error", (e: { message: string }) => {
        settle(() => reject(new Error(e.message)));
      });

      // If interactive verification is required, daemon cannot handle it
      client.once("system.login.qrcode", () => {
        settle(() => reject(new Error("Token 过期，需要扫码。请重新执行 icqq login")));
      });
      client.once("system.login.slider", () => {
        settle(() => reject(new Error("需要滑块验证。请重新执行 icqq login")));
      });
      client.once("system.login.device", () => {
        settle(() => reject(new Error("需要设备验证。请重新执行 icqq login")));
      });

      client.login(uin).catch((e: unknown) => settle(() => reject(e)));
    });

    await initIcqqMessageIdBuilders();

    // Start IPC + optional RPC server
    const rpcConfig = resolveRpcConfigForUin(config, uin);
    const ctx = await DaemonContext.fromClient(client, uin);
    initDaemonContext(ctx);
    const server = new DaemonServer(ctx, ipcToken, rpcConfig);

    const mcpConfig = resolveMcpConfigForUin(config, uin);
    let mcpHost: McpHost | null = null;
    if (mcpConfig.enabled) {
      mcpHost = new McpHost(client, uin, mcpConfig);
    }

    const managedRuntime = new ManagedRuntime({
      uin,
      socketPath: getSocketPath(uin),
      client,
      server,
      rpcConfig,
      mcpHost,
    cleanupPaths: [
      getPidPath(uin),
      getSocketPath(uin),
      getTokenPath(uin),
      getRpcPortPath(uin),
      getMcpEndpointPath(uin),
    ],
    stoppedFlagPath: getDaemonStoppedPath(uin),
  });
    const managedStart = await managedRuntime.start();
    started = true;
    console.log(
      `[daemon] 账号 ${uin} 已上线, socket: ${managedStart.socketPath}`,
    );
    if (managedStart.rpcAddress) {
      console.log(`[daemon] RPC TCP 已启用: ${managedStart.rpcAddress}`);
    }
    if (managedStart.mcpUrl) {
      console.log(`[daemon] MCP 已启用: ${managedStart.mcpUrl}`);
    }

    // Notify parent process
    managedRuntime.notifyReady();
    managedRuntime.attachSignalHandlers();
    managedRuntime.attachLifecycleHandlers(ctx.notifications);

    client.on("request.friend.add", (e: { nickname: string; user_id: number; comment?: string }) => {
      ctx.notifications.notifyFriendRequest(e);
    });
    client.on("request.group.invite", (e: { nickname?: string; user_id: number; group_name?: string; group_id: number }) => {
      ctx.notifications.notifyGroupInvite(e);
    });
    client.on("request.group.add", (e: { nickname?: string; user_id: number; group_name?: string; group_id: number; comment?: string }) => {
      ctx.notifications.notifyGroupJoinRequest(e);
    });
  } catch (e) {
    if (!started) {
      await cleanupDaemonStartupArtifacts(uin);
    }
    throw e;
  }
}

main().catch((e) => {
  console.error("[daemon] 致命错误:", e);
  process.exit(1);
});
