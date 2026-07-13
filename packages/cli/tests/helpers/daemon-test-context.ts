import { vi } from "vitest";
import type { Client } from "@icqqjs/icqq";
import { DaemonContext } from "../../src/daemon/daemon-context.js";

export function createMockDaemonContext(
  client: Client,
  overrides: {
    uin?: number;
    webhookUrl?: string;
    notifyEnabled?: boolean;
  } = {},
): DaemonContext {
  const ctx = new DaemonContext(client, overrides.uin ?? 123456, {
    notifyEnabled: overrides.notifyEnabled ?? false,
    webhookUrl: overrides.webhookUrl ?? "",
  });
  return ctx;
}

export function createStubDaemonContext(client: Client): DaemonContext {
  return createMockDaemonContext(client);
}

/** Minimal client stub for action catalog tests */
export function createBaseClient() {
  return {
    uin: 123,
    nickname: "bot",
    isOnline: () => true,
    sex: "male",
    age: 18,
    fl: new Map(),
    gl: new Map(),
    blacklist: new Set(),
    pickFriend: vi.fn(() => ({
      sendMsg: vi.fn(async () => ({ message_id: "m1" })),
      getChatHistory: vi.fn(async () => []),
    })),
    pickGroup: vi.fn(() => ({
      sendMsg: vi.fn(async () => ({ message_id: "g1" })),
      getChatHistory: vi.fn(async () => []),
      uploadLongMsg: vi.fn(async () => ({ type: "long" })),
    })),
    pickUser: vi.fn(() => ({
      getChatHistory: vi.fn(async () => []),
      uploadLongMsg: vi.fn(async () => ({ type: "long" })),
      sendMsg: vi.fn(async () => ({ message_id: "l1" })),
    })),
    sendTempMsg: vi.fn(async () => ({ message_id: "t1" })),
    deleteMsg: vi.fn(async () => ({ ok: true })),
    getMsg: vi.fn(async () => ({ message_id: "x" })),
    reportReaded: vi.fn(async () => undefined),
    getChatHistory: vi.fn(async () => []),
  } as unknown as Client;
}
