import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GatewayStore } from "./db/store.js";
import { GatewayRuntime } from "./gateway.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 尝试加载 Next 请求处理器；未构建 UI 时返回 undefined */
async function tryCreateUiHandler(
  host: string,
  port: number,
): Promise<
  ((req: http.IncomingMessage, res: http.ServerResponse) => void) | undefined
> {
  try {
    const { default: next } = (await import("next")) as unknown as {
      default: (opts: {
        dev: boolean;
        dir: string;
        hostname: string;
        port: number;
      }) => {
        prepare: () => Promise<void>;
        getRequestHandler: () => (
          req: http.IncomingMessage,
          res: http.ServerResponse,
        ) => void;
      };
    };
    const dir = path.resolve(__dirname, "..");
    const app = next({ dev: false, dir, hostname: host, port });
    await app.prepare();
    return app.getRequestHandler();
  } catch (err) {
    console.error(
      "[gateway] Next UI 未就绪，仅提供 API/MCP/RPC:",
      err instanceof Error ? err.message : err,
    );
    return undefined;
  }
}

export async function startGateway(): Promise<GatewayRuntime> {
  const store = await GatewayStore.open();
  if (!store.isInitialized()) {
    throw new Error("gateway 尚未初始化，请先执行 icqq-gateway init");
  }
  const settings = store.getSettings();
  const uiHandler = await tryCreateUiHandler(settings.httpHost, settings.httpPort);
  const runtime = new GatewayRuntime({
    store,
    host: settings.httpHost,
    port: settings.httpPort,
    uiHandler,
  });
  await runtime.start();
  return runtime;
}

async function main() {
  const runtime = await startGateway();
  const shutdown = () => {
    void runtime.stop().then(() => process.exit(0));
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

const isMain =
  typeof process.argv[1] === "string" &&
  fileURLToPath(import.meta.url) === process.argv[1];

if (isMain) {
  main().catch((err) => {
    console.error("[gateway] 启动失败:", err instanceof Error ? err.message : err);
    process.exit(1);
  });
}
