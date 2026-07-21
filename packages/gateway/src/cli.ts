/**
 * icqq-gateway 独立 CLI（init / start / service / host approve）
 */
import { runGatewayInit } from "./init.js";
import { startGateway } from "./entry.js";
import { GatewayStore } from "./db/store.js";
import { runPairApprove } from "./host-agent/pairing.js";
import {
  installGatewayService,
  queryGatewayService,
  startGatewayService,
  stopGatewayService,
  uninstallGatewayService,
} from "./service-supervisor.js";

type Parsed = { positionals: string[]; flags: Record<string, string | boolean> };

function parseArgv(argv: string[]): Parsed {
  const positionals: string[] = [];
  const flags: Record<string, string | boolean> = {};
  const alias: Record<string, string> = {
    U: "username",
    P: "password",
    b: "remote-base",
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;
    if (arg === "--") {
      positionals.push(...argv.slice(i + 1));
      break;
    }
    if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      if (eq > 0) {
        flags[arg.slice(2, eq)] = arg.slice(eq + 1);
        continue;
      }
      const key = arg.slice(2);
      const next = argv[i + 1];
      if (next && !next.startsWith("-")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
      continue;
    }
    if (arg.startsWith("-") && arg.length === 2) {
      const key = alias[arg[1]!] ?? arg.slice(1);
      const next = argv[i + 1];
      if (next && !next.startsWith("-")) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
      continue;
    }
    positionals.push(arg);
  }
  return { positionals, flags };
}

function flagStr(flags: Record<string, string | boolean>, key: string): string | undefined {
  const v = flags[key];
  return typeof v === "string" ? v : undefined;
}

function flagBool(flags: Record<string, string | boolean>, key: string): boolean {
  return flags[key] === true || flags[key] === "true";
}

function printHelp(): void {
  console.log(`icqq-gateway — icqq 多 Bot 网关独立 CLI

用法:
  icqq-gateway init [选项]          初始化 gateway（~/.icqq-gateway）
  icqq-gateway start                前台启动 gateway
  icqq-gateway service <子命令>     系统服务管理
  icqq-gateway host approve <主控URL> <配对码> [选项]

init 选项:
  -U, --username <名>     管理员用户名（默认 OS 用户名）
  -P, --password <密码>   密码（省略则自动生成并打印）
      --host <地址>       监听地址（默认 127.0.0.1）
      --port <端口>       监听端口（默认 8787）
      --migrate           迁移本地 icqq 账号为实例
      --master-key <key>  主密钥
      --registration-enabled  开启自助注册（默认关闭）

service 子命令:
  install | uninstall | start | stop | status

host approve 选项:
  -b, --remote-base <URL>  本机对外 URL（经反代暴露时填域名，如 https://gw-remote.example.com）
      --name <名称>        主机显示名称
`);
}

async function cmdInit(flags: Record<string, string | boolean>): Promise<void> {
  const result = await runGatewayInit({
    adminUsername: flagStr(flags, "username"),
    adminPassword: flagStr(flags, "password"),
    httpHost: flagStr(flags, "host"),
    httpPort: flagStr(flags, "port") ? Number(flagStr(flags, "port")) : undefined,
    migrateLocal: flagBool(flags, "migrate"),
    masterKey: flagStr(flags, "master-key"),
    registrationEnabled: flagBool(flags, "registration-enabled") || undefined,
  });

  if (result.alreadyInitialized) {
    console.log("gateway 已初始化，跳过。");
    return;
  }

  console.log("✔ gateway 初始化完成");
  if (result.initialPassword) {
    console.log(`初始密码（仅显示一次）: ${result.initialPassword}`);
    console.log("首次登录后请立即修改密码");
  }
  if (result.apiToken) {
    console.log(`默认 API Token（仅显示一次）: ${result.apiToken}`);
  }
  if (result.migratedUins.length > 0) {
    console.log(`已迁移本地账号: ${result.migratedUins.join(", ")}`);
  }
  console.log("下一步: icqq-gateway service install");
}

async function cmdStart(): Promise<void> {
  const runtime = await startGateway();
  const shutdown = () => {
    void runtime.stop().then(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
  console.log("✔ gateway 已启动（前台运行，Ctrl+C 退出）");
}

async function cmdService(sub: string): Promise<void> {
  const log = (s: string) => console.log(s);
  switch (sub) {
    case "install":
      await installGatewayService(log);
      console.log("✔ gateway 服务已安装并启动");
      return;
    case "uninstall":
      await uninstallGatewayService(log);
      console.log("✔ gateway 服务已卸载");
      return;
    case "start":
      await startGatewayService(log);
      console.log("✔ gateway 服务已启动");
      return;
    case "stop":
      await stopGatewayService(log);
      console.log("✔ gateway 服务已停止");
      return;
    case "status": {
      const state = await queryGatewayService();
      console.log(
        JSON.stringify(
          {
            installed: state.installed,
            running: state.running,
            pid: state.pid,
            filePath: state.filePath,
          },
          null,
          2,
        ),
      );
      return;
    }
    default:
      throw new Error(`未知 service 子命令: ${sub ?? "(缺失)"}`);
  }
}

async function cmdHostApprove(
  positionals: string[],
  flags: Record<string, string | boolean>,
): Promise<void> {
  const [, , masterUrl, code] = positionals;
  if (!masterUrl || !code) {
    throw new Error("用法: icqq-gateway host approve <主控URL> <配对码>");
  }
  const store = await GatewayStore.open();
  try {
    if (!store.isInitialized()) {
      throw new Error("gateway 尚未初始化，请先执行 icqq-gateway init");
    }
    const result = await runPairApprove(store, {
      masterUrl,
      code,
      remoteBaseUrl: flagStr(flags, "remote-base"),
      name: flagStr(flags, "name"),
    });
    console.log("✔ 配对成功");
    console.log(`本机对外 URL: ${result.remoteBaseUrl}`);
  } finally {
    store.close();
  }
}

async function main(): Promise<void> {
  const { positionals, flags } = parseArgv(process.argv.slice(2));
  const [cmd, sub] = positionals;

  if (!cmd || cmd === "help" || flags.help === true) {
    printHelp();
    return;
  }

  if (process.platform !== "darwin" && process.platform !== "linux" && cmd === "service") {
    throw new Error(`不支持当前平台: ${process.platform}。service 仅支持 macOS 和 Linux。`);
  }

  switch (cmd) {
    case "init":
      await cmdInit(flags);
      return;
    case "start":
      await cmdStart();
      return;
    case "service":
      await cmdService(sub ?? "");
      return;
    case "host":
      if (sub === "approve") {
        await cmdHostApprove(positionals, flags);
        return;
      }
      throw new Error(`未知 host 子命令: ${sub ?? "(缺失)"}`);
    default:
      throw new Error(`未知命令: ${cmd}`);
  }
}

const isMain =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("/cli.js") || process.argv[1].endsWith("/cli.ts"));

if (isMain) {
  main().catch((err) => {
    console.error("✖", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
