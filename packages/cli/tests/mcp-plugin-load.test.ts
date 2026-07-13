import { describe, expect, it, vi } from "vitest";
import { createMcpPluginContext } from "../src/mcp/exposure-contract.js";
import { loadMcpPlugins } from "../src/mcp/plugins/load.js";

describe("loadMcpPlugins", () => {
  it("composes plugins with the canonical MCP plugin context", async () => {
    const register = vi.fn(async () => undefined);
    const resolver = vi.fn(async () => ({
      default: {
        name: "demo-plugin",
        register,
      },
    }));
    const server = { registerTool: vi.fn() };
    const ctx = createMcpPluginContext({
      server: server as never,
      client: {
        gl: new Map(),
      } as never,
      uin: 123,
    });

    await loadMcpPlugins(ctx, ["demo"], resolver);

    expect(resolver).toHaveBeenCalledWith("demo");
    expect(register).toHaveBeenCalledTimes(1);

    const pluginCtx = register.mock.calls[0]?.[0];
    expect(pluginCtx.listActions()).toEqual(
      expect.arrayContaining([expect.objectContaining({ action: "ping" })]),
    );
    expect(pluginCtx.formatResult({ ok: true })).toBe(JSON.stringify({ ok: true }, null, 2));
    expect(pluginCtx.ok({ value: 1 })).toEqual({
      content: [{ type: "text", text: JSON.stringify({ value: 1 }, null, 2) }],
    });
    expect(pluginCtx.error("失败")).toEqual({
      content: [{ type: "text", text: "失败" }],
      isError: true,
    });
  });
});