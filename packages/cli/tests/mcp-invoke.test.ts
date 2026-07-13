import { describe, it, expect, vi, beforeEach } from "vitest";
import { Actions } from "../src/daemon/protocol.js";
import { LoginActions } from "../src/daemon/login-actions.js";
import {
  MCP_BLOCKED_ACTIONS,
} from "../src/mcp/policy.js";
import {
  formatMcpActionResult,
  getMcpActionContract,
  invokeMcpAction,
  isPilotMcpAction,
  listMcpDiscoverableActions,
  validateMcpAction,
} from "../src/mcp/server.js";
import { getActionMeta } from "../src/daemon/action-meta.js";
import { createStubDaemonContext } from "./helpers/daemon-test-context.js";

const mockClient = {} as import("@icqqjs/icqq").Client;
const mockCtx = createStubDaemonContext(mockClient);

describe("validateMcpAction", () => {
  it("rejects logout", () => {
    expect(validateMcpAction(Actions.LOGOUT)).toMatch(/禁止/);
    expect(MCP_BLOCKED_ACTIONS.has(Actions.LOGOUT)).toBe(true);
  });

  it("rejects login IPC actions", () => {
    expect(validateMcpAction(LoginActions.LOGIN_GET_STATE)).toMatch(/禁止/);
    expect(validateMcpAction(LoginActions.LOGIN_SUBMIT)).toMatch(/禁止/);
    expect(MCP_BLOCKED_ACTIONS.has(LoginActions.LOGIN_SEND_SMS)).toBe(true);
  });

  it("rejects unknown action", () => {
    expect(validateMcpAction("not_a_real_action")).toMatch(/未知/);
  });

  it("accepts send_private_msg", () => {
    expect(validateMcpAction(Actions.SEND_PRIVATE_MSG)).toBeNull();
  });

  it("uses the shared action meta source for pilot actions", () => {
    expect(getActionMeta(Actions.GET_STATUS)?.description).toBe("获取当前在线状态");
    expect(getMcpActionContract(Actions.GET_STATUS)?.description).toBe("获取当前在线状态");
    expect(isPilotMcpAction(Actions.GET_STATUS)).toBe(true);
    expect(validateMcpAction(Actions.GET_STATUS)).toBeNull();
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

describe("invokeMcpAction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns data on success", async () => {
    const client = {
      gl: new Map([
        [1, { group_id: 1, group_name: "群", member_count: 2, max_member_count: 200, owner_id: 9 }],
      ]),
    } as unknown as import("@icqqjs/icqq").Client;
    const ctx = createStubDaemonContext(client);
    const result = await invokeMcpAction(
      client,
      Actions.LIST_GROUPS,
      {},
      ctx,
    );
    expect(result).toEqual({
      ok: true,
      data: [
        { group_id: 1, group_name: "群", member_count: 2, max_member_count: 200, owner_id: 9 },
      ],
    });
  });

  it("returns normalized errors from the catalog-backed action contract", async () => {
    const result = await invokeMcpAction(mockClient, Actions.LIST_GROUP_MEMBERS, {}, mockCtx);
    expect(result).toEqual({ ok: false, error: "无效的 group_id" });
  });

  it("invokes migrated message actions through the catalog-backed MCP contract", async () => {
    const sendMsg = vi.fn(async () => ({ message_id: "msg-1" }));
    const client = {
      pickFriend: vi.fn(() => ({ sendMsg })),
    } as unknown as import("@icqqjs/icqq").Client;
    const ctx = createStubDaemonContext(client);

    const result = await invokeMcpAction(client, Actions.SEND_PRIVATE_MSG, {
      user_id: 7,
      message: "hello",
    }, ctx);

    expect(result).toEqual({ ok: true, data: { message_id: "msg-1" } });
    expect(sendMsg).toHaveBeenCalledWith("hello");
  });

  it("blocks logout without calling handler", async () => {
    const result = await invokeMcpAction(mockClient, Actions.LOGOUT, {}, mockCtx);
    expect(result.ok).toBe(false);
  });

  it("formats MCP discovery and invocation results consistently", () => {
    expect(formatMcpActionResult({ ok: true })).toBe(JSON.stringify({ ok: true }, null, 2));
  });
});
