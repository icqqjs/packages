import { describe, expect, it, vi } from "vitest";
import {
  createMcpPluginContext,
  errorMcpResponse,
  normalizeInvokeMcpResult,
  okMcpResponse,
  registerCoreMcpTools,
} from "../src/mcp/exposure-contract.js";

function createServerHarness() {
  const tools = new Map<string, (input: any) => Promise<any>>();
  return {
    server: {
      registerTool: vi.fn((name: string, _meta: unknown, handler: (input: any) => Promise<any>) => {
        tools.set(name, handler);
      }),
    },
    getTool(name: string) {
      const tool = tools.get(name);
      if (!tool) throw new Error(`tool not found: ${name}`);
      return tool;
    },
  };
}

describe("MCP exposure contract", () => {
  it("normalizes success and error payloads", () => {
    expect(okMcpResponse({ ok: true })).toEqual({
      content: [{ type: "text", text: JSON.stringify({ ok: true }, null, 2) }],
    });
    expect(errorMcpResponse("失败")).toEqual({
      content: [{ type: "text", text: "失败" }],
      isError: true,
    });
    expect(normalizeInvokeMcpResult({ ok: false, error: "错误" })).toEqual({
      content: [{ type: "text", text: "错误" }],
      isError: true,
    });
  });

  it("registers core MCP tools behind the canonical exposure seam", async () => {
    const harness = createServerHarness();
    const ctx = createMcpPluginContext({
      server: harness.server as never,
      client: {
        gl: new Map([
          [1, { group_id: 1, group_name: "群", member_count: 2, max_member_count: 200, owner_id: 9 }],
        ]),
      } as never,
      uin: 123,
    });

    registerCoreMcpTools(harness.server as never, ctx);

    const listResponse = await harness.getTool("icqq_list_actions")({});
    expect(listResponse.isError).toBeUndefined();
    expect(JSON.parse(listResponse.content[0].text)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ action: "send_private_msg" }),
        expect.objectContaining({ action: "list_groups" }),
      ]),
    );

    const invokeSuccess = await harness.getTool("icqq_invoke")({
      action: "list_groups",
      params: {},
    });
    expect(invokeSuccess).toEqual({
      content: [{ type: "text", text: JSON.stringify([
        { group_id: 1, group_name: "群", member_count: 2, max_member_count: 200, owner_id: 9 },
      ], null, 2) }],
    });

    const invokeError = await harness.getTool("icqq_invoke")({
      action: "list_group_members",
      params: {},
    });
    expect(invokeError).toEqual({
      content: [{ type: "text", text: "无效的 group_id" }],
      isError: true,
    });
  });
});