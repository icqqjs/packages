import http from "node:http";
import { URL } from "node:url";
import express from "express";
import { WebSocketServer } from "ws";
import type { GatewayStore } from "./db/store.js";
import { createApiRouter } from "./http/api.js";
import { handleMcpRequest } from "./http/mcp-route.js";
import { bridgeRpcWebSocket } from "./http/rpc-ws.js";
import { createHostAgentRouter } from "./host-agent/router.js";
import { extractBearer } from "./http/auth.js";
import {
  handleHostAgentShellWebSocket,
  handleHostShellWebSocket,
} from "./http/shell-ws.js";

export type GatewayRuntimeOptions = {
  store: GatewayStore;
  host: string;
  port: number;
  /** 可选：Next 请求处理器（UI）；未提供时根路径返回占位信息 */
  uiHandler?: (req: http.IncomingMessage, res: http.ServerResponse) => void;
  logger?: Pick<Console, "log" | "error">;
};

const UIN_MCP = /^\/(\d+)\/mcp$/;
const UIN_RPC = /^\/(\d+)\/rpc$/;
const HOST_SHELL = /^\/api\/hosts\/([^/]+)\/shell$/;
const AGENT_SHELL = /^\/host-agent\/shell$/;

export class GatewayRuntime {
  private readonly store: GatewayStore;
  private readonly host: string;
  private readonly port: number;
  private readonly logger: Pick<Console, "log" | "error">;
  private readonly uiHandler?: GatewayRuntimeOptions["uiHandler"];
  private server: http.Server | null = null;
  private wss: WebSocketServer | null = null;

  constructor(options: GatewayRuntimeOptions) {
    this.store = options.store;
    this.host = options.host;
    this.port = options.port;
    this.logger = options.logger ?? console;
    this.uiHandler = options.uiHandler;
  }

  async start(): Promise<{ host: string; port: number }> {
    const app = express();
    app.use("/api", createApiRouter(this.store));
    app.use("/host-agent", createHostAgentRouter(this.store));

    app.post(UIN_MCP, express.json({ limit: "4mb" }), (req, res) => {
      const uin = Number(req.params[0]);
      void handleMcpRequest(this.store, uin, req, res);
    });

    app.get(UIN_MCP, (_req, res) => {
      res.status(405).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed." },
        id: null,
      });
    });

    if (this.uiHandler) {
      const ui = this.uiHandler;
      app.use((req, res) => ui(req, res));
    } else {
      app.get("/", (_req, res) => {
        res.type("text/plain").send("icqq-gateway is running");
      });
    }

    const server = http.createServer(app);
    this.server = server;

    const wss = new WebSocketServer({ noServer: true });
    this.wss = wss;

    server.on("upgrade", (req, socket, head) => {
      const url = new URL(req.url ?? "/", `http://${req.headers.host}`);
      const hostShell = url.pathname.match(HOST_SHELL);
      if (hostShell) {
        wss.handleUpgrade(req, socket, head, (ws) => {
          void handleHostShellWebSocket(this.store, hostShell[1]!, req, ws);
        });
        return;
      }
      const agentShell = url.pathname.match(AGENT_SHELL);
      if (agentShell) {
        const token =
          extractBearer(req.headers.authorization) ??
          url.searchParams.get("token");
        wss.handleUpgrade(req, socket, head, (ws) => {
          void handleHostAgentShellWebSocket(this.store, token, ws);
        });
        return;
      }
      const match = url.pathname.match(UIN_RPC);
      if (!match) {
        socket.destroy();
        return;
      }
      const uin = Number(match[1]);
      const token =
        extractBearer(req.headers.authorization) ??
        url.searchParams.get("token") ??
        undefined;
      const user = token ? this.store.findUserByApiToken(token) : null;
      if (!user || !this.store.userOwnsUin(user.id, uin)) {
        socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
        socket.destroy();
        return;
      }
      const instance = this.store.getInstanceByUin(uin);
      if (!instance) {
        socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
        socket.destroy();
        return;
      }
      if (instance.host_id) {
        const host = this.store.getHostById(instance.host_id);
        if (host && !host.is_local && !host.proxy_data_plane) {
          socket.write("HTTP/1.1 400 Bad Request\r\n\r\n");
          socket.destroy();
          return;
        }
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        void bridgeRpcWebSocket(ws, this.store, instance);
      });
    });

    await new Promise<void>((resolve, reject) => {
      const onError = (err: NodeJS.ErrnoException) => {
        server.removeListener("error", onError);
        if (err.code === "EADDRINUSE") {
          reject(
            new Error(
              `端口 ${this.port} 已被占用。请释放端口或在 gateway 配置中更换端口（不自动漂移）。`,
            ),
          );
          return;
        }
        reject(err);
      };
      server.once("error", onError);
      server.listen(this.port, this.host, () => {
        server.removeListener("error", onError);
        this.logger.log(
          `[gateway] HTTP 已监听 http://${this.host}:${this.port}`,
        );
        resolve();
      });
    });

    return { host: this.host, port: this.port };
  }

  async stop(): Promise<void> {
    if (this.wss) {
      for (const client of this.wss.clients) client.terminate();
      await new Promise<void>((resolve) => this.wss!.close(() => resolve()));
      this.wss = null;
    }
    if (this.server) {
      await new Promise<void>((resolve) => this.server!.close(() => resolve()));
      this.server = null;
    }
  }
}
