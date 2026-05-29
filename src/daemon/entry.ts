import fs from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { createIcqqClient } from "@/lib/client.js";
import {
  loadConfig,
  getAccountConfig,
  resolveRpcConfig,
  resolveMcpConfig,
} from "@/lib/config.js";
import {
  getAccountDir,
  getPidPath,
  getSocketPath,
  getTokenPath,
  getRpcPortPath,
  getMcpEndpointPath,
} from "@/lib/paths.js";
import { McpHost } from "@/mcp/host.js";
import {
  DaemonContext,
  initDaemonContext,
} from "./daemon-context.js";
import { DaemonServer } from "./server.js";

async function main() {
  const uin = Number(process.argv[2]);
  if (!uin || Number.isNaN(uin)) {
    console.error("Usage: node entry.js <uin>");
    process.exit(1);
  }

  const config = await loadConfig();
  const account = getAccountConfig(config, uin);
  if (!account) {
    console.error(`[daemon] 未找到账号 ${uin} 的配置`);
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

  // Start IPC + optional RPC server
  const rpcConfig = resolveRpcConfig(config.rpc);
  const ctx = await DaemonContext.fromClient(client, uin);
  initDaemonContext(ctx);
  const server = new DaemonServer(ctx, ipcToken, rpcConfig);
  await server.start();
  console.log(
    `[daemon] 账号 ${uin} 已上线, socket: ${getSocketPath(uin)}`,
  );
  if (rpcConfig.enabled) {
    console.log(
      `[daemon] RPC TCP 已启用: ${rpcConfig.host}:${server.getRpcPort()}`,
    );
  }

  const mcpConfig = resolveMcpConfig(config.mcp);
  let mcpHost: McpHost | null = null;
  if (mcpConfig.enabled) {
    mcpHost = new McpHost(client, uin, mcpConfig);
    await mcpHost.start();
    const mcpUrl = mcpHost.getEndpointUrl();
    if (mcpUrl) {
      console.log(`[daemon] MCP 已启用: ${mcpUrl}`);
    }
  }

  // Notify parent process
  if (process.send) {
    process.send("ready");
    if (process.connected) process.disconnect?.();
  }

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    console.log(`[daemon] 收到 ${signal}，正在关闭…`);
    if (mcpHost) {
      await mcpHost.stop();
      mcpHost = null;
    }
    await server.stop();
    // 若 IPC LOGOUT handler 已完成 logout，跳过此步骤避免重复调用
    const alreadyLoggedOut = (process as NodeJS.Process & { _icqqLogoutDone?: boolean })._icqqLogoutDone === true;
    if (!alreadyLoggedOut) {
      try {
        await client.logout();
      } catch {
        /* ignore */
      }
    }
    client.terminate();
    try {
      await fs.unlink(getPidPath(uin));
    } catch {
      /* ignore */
    }
    try {
      await fs.unlink(getSocketPath(uin));
    } catch {
      /* ignore */
    }
    try {
      await fs.unlink(getTokenPath(uin));
    } catch {
      /* ignore */
    }
    try {
      await fs.unlink(getRpcPortPath(uin));
    } catch {
      /* ignore */
    }
    try {
      await fs.unlink(getMcpEndpointPath(uin));
    } catch {
      /* ignore */
    }
    process.exit(0);
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  // Offline events — auto reconnect on network loss
  let reconnecting = false;
  const autoReconnect = async () => {
    if (reconnecting) return;
    reconnecting = true;
    const maxRetries = 5;
    const delays = [5, 10, 30, 60, 120]; // seconds
    for (let i = 0; i < maxRetries; i++) {
      const delay = delays[i]!;
      console.log(`[daemon] ${delay}s 后尝试第 ${i + 1} 次重连…`);
      await new Promise((r) => setTimeout(r, delay * 1000));
      try {
        await client.login(uin);
        await new Promise<void>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error("重连超时")), 15000);
          client.once("system.online", () => { clearTimeout(timer); resolve(); });
          client.once("system.login.error", (e: { message: string }) => { clearTimeout(timer); reject(new Error(e.message)); });
        });
        console.log(`[daemon] 重连成功`);
        ctx.notifications.notifyReconnectSuccess();
        reconnecting = false;
        return;
      } catch (e) {
        console.log(`[daemon] 第 ${i + 1} 次重连失败: ${e instanceof Error ? e.message : e}`);
      }
    }
    console.log(`[daemon] ${maxRetries} 次重连均失败，放弃重连`);
    ctx.notifications.notifyReconnectFailed();
    reconnecting = false;
  };

  client.on("system.offline.network", (e: { message: string }) => {
    console.log("[daemon] 网络掉线:", e.message);
    ctx.notifications.notifyOfflineNetwork(e.message);
    void autoReconnect();
  });
  client.on("system.offline.kickoff", (e: { message: string }) => {
    console.log("[daemon] 被踢下线:", e.message);
    ctx.notifications.notifyOfflineKickoff(e.message);
  });

  client.on("request.friend.add", (e: { nickname: string; user_id: number; comment?: string }) => {
    ctx.notifications.notifyFriendRequest(e);
  });
  client.on("request.group.invite", (e: { nickname?: string; user_id: number; group_name?: string; group_id: number }) => {
    ctx.notifications.notifyGroupInvite(e);
  });
  client.on("request.group.add", (e: { nickname?: string; user_id: number; group_name?: string; group_id: number; comment?: string }) => {
    ctx.notifications.notifyGroupJoinRequest(e);
  });
}

main().catch((e) => {
  console.error("[daemon] 致命错误:", e);
  process.exit(1);
});
