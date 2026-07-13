import { describe, expect, it } from "vitest";
import * as gateway from "../src/gateway/index.js";
import * as daemon from "../src/daemon/index.js";
import * as protocol from "../src/protocol/index.js";
import * as bot from "../src/bot/index.js";
import {
  SDK_VERSION,
  capabilities,
  assertSdkCompatible,
} from "../src/capabilities.js";

describe("@icqqjs/sdk public exports", () => {
  it("exports capability metadata", () => {
    expect(SDK_VERSION).toBe("0.1.0");
    expect(capabilities()).toContain("ipc.client");
    expect(() => assertSdkCompatible({ capabilities: ["daemon.lifecycle"] })).not.toThrow();
  });

  it("re-exports gateway/daemon/protocol/bot symbols", () => {
    expect(typeof gateway.loadConfig).toBe("function");
    expect(typeof gateway.spawnDaemon).toBe("function");
    expect(typeof daemon.getIcqqHome).toBe("function");
    expect(typeof protocol.IpcClient).toBe("function");
    expect(typeof bot.listMcpDiscoverableActions).toBe("function");
  });
});
