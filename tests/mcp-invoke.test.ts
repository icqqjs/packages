import { describe, it, expect, vi, beforeEach } from "vitest";
import { Actions } from "../src/daemon/protocol.js";
import {
  getActionMeta,
  MCP_BLOCKED_ACTIONS,
} from "../src/daemon/action-meta.js";
import {
  formatMcpActionResult,
  getMcpActionContract,
  isPilotMcpAction,
  listMcpDiscoverableActions,
} from "../src/mcp/action-contract.js";
import { validateAction, invokeAction } from "../src/mcp/invoke-action.js";

const mockClient = {} as import("@icqqjs/icqq").Client;

describe("validateAction", () => {
  it("rejects logout", () => {
    expect(validateAction(Actions.LOGOUT)).toMatch(/禁止/);
    expect(MCP_BLOCKED_ACTIONS.has(Actions.LOGOUT)).toBe(true);
  });

  it("rejects unknown action", () => {
    expect(validateAction("not_a_real_action")).toMatch(/未知/);
  });

  it("accepts send_private_msg", () => {
    expect(validateAction(Actions.SEND_PRIVATE_MSG)).toBeNull();
  });

  it("uses the shared action meta source for pilot actions", () => {
    expect(getActionMeta(Actions.GET_STATUS)?.description).toBe("获取当前在线状态");
    expect(getMcpActionContract(Actions.GET_STATUS)?.description).toBe("获取当前在线状态");
    expect(isPilotMcpAction(Actions.GET_STATUS)).toBe(true);
    expect(validateAction(Actions.GET_STATUS)).toBeNull();
  });

  it("lists pilot actions from the same MCP-facing contract used for invocation", () => {
    const list = listMcpDiscoverableActions();
    expect(list).toContainEqual({
      action: Actions.GET_STATUS,
      description: "获取当前在线状态",
      paramsHint: "无",
    });
    expect(list).toContainEqual({
      action: Actions.LIST_FRIENDS,
      description: "获取好友列表",
      paramsHint: "无",
    });
  });
});

describe("invokeAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns data on success", async () => {
    const result = await invokeAction(
      {
        gl: new Map([
          [1, { group_id: 1, group_name: "群", member_count: 2, max_member_count: 200, owner_id: 9 }],
        ]),
      } as unknown as import("@icqqjs/icqq").Client,
      Actions.LIST_GROUPS,
      {},
    );
    expect(result).toEqual({
      ok: true,
      data: [
        { group_id: 1, group_name: "群", member_count: 2, max_member_count: 200, owner_id: 9 },
      ],
    });
  });

  it("returns normalized errors from the catalog-backed action contract", async () => {
    const result = await invokeAction(mockClient, Actions.LIST_GROUP_MEMBERS, {});
    expect(result).toEqual({ ok: false, error: "无效的 group_id" });
  });

  it("invokes migrated message actions through the catalog-backed MCP contract", async () => {
    const sendMsg = vi.fn(async () => ({ message_id: "msg-1" }));
    const client = {
      pickFriend: vi.fn(() => ({ sendMsg })),
    } as unknown as import("@icqqjs/icqq").Client;

    const result = await invokeAction(client, Actions.SEND_PRIVATE_MSG, {
      user_id: 7,
      message: "hello",
    });

    expect(result).toEqual({ ok: true, data: { message_id: "msg-1" } });
    expect(sendMsg).toHaveBeenCalledWith("hello");
  });

  it("blocks logout without calling handler", async () => {
    const result = await invokeAction(mockClient, Actions.LOGOUT, {});
    expect(result.ok).toBe(false);
  });

  it("formats MCP discovery and invocation results consistently", () => {
    expect(formatMcpActionResult({ ok: true })).toBe(JSON.stringify({ ok: true }, null, 2));
  });
});
