import { describe, it, expect } from "vitest";
import {
  getConfigDisplayValue,
  isConfigGetGroup,
  isConfigGetKey,
  listAllConfigEntries,
  listGroupConfigEntries,
} from "../src/lib/config-get.js";
import type { IcqqConfig } from "../src/lib/config.js";

describe("config-get", () => {
  const config: IcqqConfig = {
    accounts: { "12345": { platform: 1, signApiUrl: "" } },
    mcp: { enabled: true, http: { host: "0.0.0.0", port: 3920, token: "secret" } },
    rpc: { enabled: true, port: 9100 },
  };

  it("recognizes mcp dot keys and group", () => {
    expect(isConfigGetKey("mcp.enabled")).toBe(true);
    expect(isConfigGetKey("mcp.http.port")).toBe(true);
    expect(isConfigGetGroup("mcp")).toBe(true);
  });

  it("lists mcp entries in full output", () => {
    const keys = listAllConfigEntries(config).map(([k]) => k);
    expect(keys).toContain("mcp.enabled");
    expect(keys).toContain("mcp.http.token");
  });

  it("lists only mcp group", () => {
    const entries = listGroupConfigEntries(config, "mcp");
    expect(entries).toHaveLength(5);
    expect(entries.find(([k]) => k === "mcp.enabled")?.[1]).toBe("true");
    expect(entries.find(([k]) => k === "mcp.http.port")?.[1]).toBe("3920");
  });

  it("gets resolved mcp.http.host with defaults", () => {
    const empty: IcqqConfig = { accounts: {} };
    expect(getConfigDisplayValue(empty, "mcp.http.host")).toBe("127.0.0.1");
    expect(getConfigDisplayValue(empty, "mcp.http.port")).toBe("0 (自动分配)");
  });
});
