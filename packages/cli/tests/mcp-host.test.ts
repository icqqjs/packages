import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import http from "node:http";
import { Actions } from "../src/daemon/protocol.js";
import { McpHost } from "../src/mcp/server.js";
import { validateMcpAction } from "../src/mcp/policy.js";
import { createStubDaemonContext } from "./helpers/daemon-test-context.js";

vi.mock("../src/mcp/create-server.js", () => ({
  createMcpServer: vi.fn(async () => ({
    connect: vi.fn(),
    close: vi.fn(),
  })),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    writeFile: vi.fn().mockResolvedValue(undefined),
    unlink: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("McpHost HTTP", () => {
  const mockClient = {} as import("@icqqjs/icqq").Client;
  const mockCtx = createStubDaemonContext(mockClient);

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ICQQ_MCP_HTTP_TOKEN;
  });

  afterEach(async () => {
    delete process.env.ICQQ_MCP_HTTP_TOKEN;
  });

  it("rejects POST without Bearer when token is configured", async () => {
    const host = new McpHost(mockClient, 12345, {
      http: { host: "127.0.0.1", port: 0, token: "secret-token" },
      plugins: [],
    }, mockCtx);

    await host.start();
    const url = host.getEndpointUrl();
    expect(url).toBeTruthy();

    const status = await new Promise<number>((resolve, reject) => {
      const req = http.request(
        url!,
        { method: "POST", headers: { "content-type": "application/json" } },
        (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        },
      );
      req.on("error", reject);
      req.write(JSON.stringify({ jsonrpc: "2.0", method: "tools/list", id: 1 }));
      req.end();
    });

    await host.stop();
    expect(status).toBe(401);
  });

  it("allows GET only as method-not-allowed on /mcp", async () => {
    const host = new McpHost(mockClient, 12345, {
      http: { host: "127.0.0.1", port: 0 },
      plugins: [],
    }, mockCtx);

    await host.start();
    const url = host.getEndpointUrl()!;

    const status = await new Promise<number>((resolve, reject) => {
      http.get(url, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      }).on("error", reject);
    });

    await host.stop();
    expect(status).toBe(405);
  });
});

describe("McpHost policy", () => {
  it("blocks destructive actions at policy layer", () => {
    expect(validateMcpAction(Actions.LOGOUT)).toMatch(/禁止/);
    expect(validateMcpAction(Actions.SET_WEBHOOK)).toMatch(/禁止/);
    expect(validateMcpAction(Actions.SEND_PRIVATE_MSG)).toBeNull();
  });
});
