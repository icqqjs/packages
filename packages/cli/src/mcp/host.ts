/**
 * 守护进程内嵌 MCP HTTP 服务。
 */
import type { Server } from "node:http";
import fs from "node:fs/promises";
import type { Client } from "@icqqjs/icqq";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { timingSafeEqual } from "node:crypto";
import express from "express";
import type { ResolvedMcpConfig } from "@/lib/config.js";
import type { DaemonContext } from "@/daemon/daemon-context.js";
import { getMcpEndpointPath } from "@/lib/paths.js";
import { createMcpServer } from "./create-server.js";

export type McpEndpointInfo = {
  host: string;
  port: number;
  basePath: string;
};

export class McpHost {
  private mcpServer: McpServer | null = null;
  private httpServer: Server | null = null;
  private endpoint: McpEndpointInfo | null = null;

  constructor(
    private client: Client,
    private uin: number,
    private config: ResolvedMcpConfig,
    private daemonContext: DaemonContext,
  ) {}

  getEndpoint(): McpEndpointInfo | null {
    return this.endpoint;
  }

  getEndpointUrl(): string | null {
    if (!this.endpoint) return null;
    const { host, port, basePath } = this.endpoint;
    return `http://${host}:${port}${basePath}`;
  }

  async start(): Promise<void> {
    const token = this.resolveToken();
    if (!token) {
      console.warn(
        "[mcp] 未配置 mcp.http.token，HTTP 无 Bearer 鉴权，仅限本机可信环境",
      );
    }
    if (this.config.http.host === "0.0.0.0") {
      console.warn(
        "[mcp] 正在监听 0.0.0.0，请确保已设置 token 并做好防火墙",
      );
    }

    this.mcpServer = await createMcpServer(
      this.client,
      this.uin,
      this.config,
      this.daemonContext,
    );

    const basePath = "/mcp";
    const app = createMcpExpressApp({ host: this.config.http.host });
    app.use(express.json({ limit: "4mb" }));

    if (token) {
      app.use(basePath, (req, res, next) => {
        const auth = req.headers.authorization;
        const expected = `Bearer ${token}`;
        if (
          !auth ||
          auth.length !== expected.length ||
          !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))
        ) {
          res.status(401).json({ error: "Unauthorized" });
          return;
        }
        next();
      });
    }

    const mcpServer = this.mcpServer;

    app.post(basePath, async (req, res) => {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      try {
        await mcpServer.connect(transport);
        await transport.handleRequest(req, res, req.body);
        res.on("close", () => {
          void transport.close();
        });
      } catch (error) {
        console.error("[mcp] 请求处理失败:", error);
        void transport.close();
        if (!res.headersSent) {
          res.status(500).json({
            jsonrpc: "2.0",
            error: { code: -32603, message: "Internal server error" },
            id: null,
          });
        }
      }
    });

    app.get(basePath, (_req, res) => {
      res.status(405).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed." },
        id: null,
      });
    });

    app.delete(basePath, (_req, res) => {
      res.status(405).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Method not allowed." },
        id: null,
      });
    });

    await new Promise<void>((resolve, reject) => {
      const tryListen = (port: number, retried: boolean) => {
        const server = app.listen(port, this.config.http.host, () => {
          this.httpServer = server;
          resolve();
        });
        server.on("error", (err: NodeJS.ErrnoException) => {
          server.close();
          if (
            !retried &&
            err.code === "EADDRINUSE" &&
            port !== 0 &&
            this.config.http.port !== 0
          ) {
            console.warn(
              `[mcp] 端口 ${port} 已被占用，改为自动分配端口（多账号建议 mcp.http.port=0）`,
            );
            tryListen(0, true);
            return;
          }
          reject(err);
        });
      };
      tryListen(this.config.http.port, false);
    });

    const addr = this.httpServer!.address();
    const port =
      typeof addr === "object" && addr
        ? addr.port
        : this.config.http.port;
    this.endpoint = {
      host: this.config.http.host,
      port,
      basePath,
    };

    await fs.writeFile(
      getMcpEndpointPath(this.uin),
      JSON.stringify(this.endpoint, null, 2),
      { mode: 0o600 },
    );

    console.log(`[mcp] HTTP 已监听 ${this.getEndpointUrl()}`);
  }

  async stop(): Promise<void> {
    if (this.mcpServer) {
      await this.mcpServer.close();
      this.mcpServer = null;
    }
    if (this.httpServer) {
      await new Promise<void>((resolve, reject) => {
        this.httpServer!.close((err) => (err ? reject(err) : resolve()));
      });
      this.httpServer = null;
    }
    this.endpoint = null;
    try {
      await fs.unlink(getMcpEndpointPath(this.uin));
    } catch {
      /* ignore */
    }
  }

  private resolveToken(): string | undefined {
    const fromEnv = process.env.ICQQ_MCP_HTTP_TOKEN?.trim();
    const fromConfig = this.config.http.token?.trim();
    return fromConfig || fromEnv || undefined;
  }
}
