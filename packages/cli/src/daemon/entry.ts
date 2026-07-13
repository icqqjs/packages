import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { createIcqqClient } from "@/lib/client.js";
import { awaitLoginOutcome } from "@/lib/account-bootstrap.js";
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
import { McpHost } from "@/mcp/server.js";
import { DaemonContext } from "./daemon-context.js";
import { cleanupDaemonStartupArtifacts } from "./entry-cleanup.js";
import { ManagedRuntime } from "./managed-runtime.js";
import { DaemonServer } from "./server.js";
import { initIcqqMessageIdBuilders } from "@/lib/icqq-message-id.js";
import {
  isInteractiveLoginRequired,
  runLoginWaitingRuntime,
} from "./login-waiting-runtime.js";
import { sendDaemonAlert } from "./alert/dispatcher.js";
import { createLifecycleNotifications } from "./lifecycle-notifications.js";

export async function runDaemonEntry(uin: number): Promise<ManagedRuntime> {
  let started = false;
  let ipcToken = "";
  let client: Awaited<ReturnType<typeof createIcqqClient>> | null = null;

  try {
    const config = await loadConfig();
    const account = getAccountConfig(config, uin);
    if (!account) {
      throw new Error(`[daemon] 未找到账号 ${uin} 的配置`);
    }

    const portConflict = preflightDaemonNetworkPorts(config, uin);
    if (portConflict) {
      throw new Error(`[daemon] 网络端口冲突: ${portConflict}`);
    }

    await fs.mkdir(getAccountDir(uin), { recursive: true, mode: 0o700 });
    await fs.writeFile(getPidPath(uin), String(process.pid), { mode: 0o600 });

    ipcToken = randomBytes(32).toString("hex");
    await fs.writeFile(getTokenPath(uin), ipcToken, { mode: 0o600 });

    client = await createIcqqClient(uin, account);

    try {
      await awaitLoginOutcome(client, "reject", () => client!.login(uin), {
        errorVariant: "daemon",
      });
    } catch (loginError) {
      if (!isInteractiveLoginRequired(loginError)) {
        throw loginError;
      }
      let readySent = false;
      await runLoginWaitingRuntime({
        client,
        uin,
        ipcToken,
        config,
        reason: loginError instanceof Error ? loginError.message : String(loginError),
        onReady: () => {
          if (!readySent && process.send) {
            process.send("ready");
            readySent = true;
          }
        },
      });
    }

    await initIcqqMessageIdBuilders();

    const rpcConfig = resolveRpcConfigForUin(config, uin);
    const ctx = await DaemonContext.fromClient(client, uin);
    const server = new DaemonServer(ctx, ipcToken, rpcConfig);

    const mcpConfig = resolveMcpConfigForUin(config, uin);
    let mcpHost: McpHost | null = null;
    if (mcpConfig.enabled) {
      mcpHost = new McpHost(client, uin, mcpConfig, ctx);
    }

    const managedRuntime = new ManagedRuntime({
      uin,
      socketPath: getSocketPath(uin),
      client,
      server,
      rpcConfig,
      mcpHost,
      config,
      ipcToken,
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

    managedRuntime.notifyReady();
    await sendDaemonAlert("daemon_ready", { uin, reason: "守护进程已上线" }, { config });
    managedRuntime.attachSignalHandlers();
    managedRuntime.attachLifecycleHandlers(
      createLifecycleNotifications(uin, config, ctx.notifications),
    );

    return managedRuntime;
  } catch (e) {
    if (!started) {
      await cleanupDaemonStartupArtifacts(uin);
    }
    throw e;
  }
}

async function main() {
  const uin = Number(process.argv[2]);
  if (!uin || Number.isNaN(uin)) {
    console.error("Usage: node entry.js <uin>");
    process.exit(1);
  }

  process.on("unhandledRejection", (reason) => {
    console.error(
      "[daemon] 未处理的 Promise 拒绝:",
      reason instanceof Error ? reason.message : reason,
    );
  });

  try {
    await runDaemonEntry(uin);
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }
}

const isEntryMain =
  typeof process.argv[1] === "string" &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isEntryMain) {
  main().catch((e) => {
    console.error("[daemon] 致命错误:", e);
    process.exit(1);
  });
}
