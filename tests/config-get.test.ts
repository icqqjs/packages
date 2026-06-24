import { describe, it, expect } from "vitest";
import {
  availableConfigGetKeysHint,
  getConfigDisplayValue,
  isConfigGetGroup,
  isConfigGetKey,
  isConfigGetQuery,
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

  it("formats empty values and accounts view", () => {
    const empty: IcqqConfig = { accounts: {} };
    expect(getConfigDisplayValue(empty, "currentUin")).toBe("(未设置)");
    expect(getConfigDisplayValue(empty, "webhookUrl")).toBe("(未设置)");
    expect(getConfigDisplayValue(empty, "accounts")).toBe("(无)");
    expect(getConfigDisplayValue(empty, "mcp.plugins")).toBe("(无)");
    expect(getConfigDisplayValue(empty, "mcp.http.token")).toBe("(未设置)");
  });

  it("formats configured accounts and plugins", () => {
    const rich: IcqqConfig = {
      accounts: {
        "10001": { platform: 1, signApiUrl: "https://a.example.com" },
        "10002": { platform: 2, signApiUrl: "https://b.example.com" },
      },
      mcp: { plugins: ["plugin-a", "plugin-b"] },
    };
    expect(getConfigDisplayValue(rich, "accounts")).toContain("10001");
    expect(getConfigDisplayValue(rich, "mcp.plugins")).toBe("plugin-a, plugin-b");
  });

  it("gets alert provider field values", () => {
    const withAlerts: IcqqConfig = {
      accounts: {},
      alerts: {
        enabled: true,
        providers: {
          bark: { deviceKey: "key", server: "https://bark.example.com" },
        },
      },
    };
    expect(getConfigDisplayValue(withAlerts, "alerts.providers.bark.deviceKey")).toBe("key");
    expect(getConfigDisplayValue(withAlerts, "alerts.providers.bark.enabled")).toBe("(未设置)");
    expect(isConfigGetKey("alerts.providers.wecom.webhookKey")).toBe(true);
    const entries = listGroupConfigEntries(withAlerts, "alerts");
    expect(entries.some(([k]) => k === "alerts.providers.bark.deviceKey")).toBe(true);
  });

  it("supports query helpers and hint list", () => {
    expect(isConfigGetQuery("rpc")).toBe(true);
    expect(isConfigGetQuery("rpc.port")).toBe(true);
    expect(isConfigGetQuery("login")).toBe(true);
    expect(isConfigGetQuery("not-real")).toBe(false);
    expect(availableConfigGetKeysHint()).toContain("mcp.http.port");
    expect(availableConfigGetKeysHint()).toContain("alerts.providers.bark.deviceKey");
    expect(availableConfigGetKeysHint()).toContain("rpc");
    expect(availableConfigGetKeysHint()).toContain("login.http.host");
  });

  it("formats login and alerts keys", () => {
    const withLogin: IcqqConfig = {
      accounts: {},
      alerts: { enabled: true, cooldownMs: 30_000 },
      login: {
        http: { host: "0.0.0.0", port: 8080, publicUrl: "https://qq.example.com" },
        waitingTimeoutMs: 120_000,
        submitRateLimit: { windowMs: 5_000, maxAttempts: 3 },
      },
    };
    expect(getConfigDisplayValue(withLogin, "alerts.enabled")).toBe("true");
    expect(getConfigDisplayValue(withLogin, "alerts.cooldownMs")).toBe("30000");
    expect(getConfigDisplayValue(withLogin, "login.http.host")).toBe("0.0.0.0");
    expect(getConfigDisplayValue(withLogin, "login.http.port")).toBe("8080");
    expect(getConfigDisplayValue(withLogin, "login.http.publicUrl")).toBe(
      "https://qq.example.com",
    );
    expect(getConfigDisplayValue(withLogin, "login.waitingTimeoutMs")).toBe("120000");
    expect(getConfigDisplayValue(withLogin, "login.submitRateLimit.windowMs")).toBe("5000");
    expect(getConfigDisplayValue(withLogin, "login.submitRateLimit.maxAttempts")).toBe("3");

    const loginGroup = listGroupConfigEntries(withLogin, "login");
    expect(loginGroup.some(([k]) => k === "login.http.publicUrl")).toBe(true);
    const alertsGroup = listGroupConfigEntries(withLogin, "alerts");
    expect(alertsGroup.some(([k]) => k === "alerts.cooldownMs")).toBe(true);
  });

  it("formats rpc keys and account override notes", () => {
    const scoped: IcqqConfig = {
      accounts: {
        "210723495": {
          platform: 1,
          signApiUrl: "",
          mcp: { http: { port: 61501 } },
          rpc: { enabled: true, port: 9200 },
        },
      },
      mcp: { enabled: true, http: { host: "127.0.0.1", port: 61500 } },
      rpc: { enabled: false, host: "127.0.0.1", port: 0 },
    };
    expect(getConfigDisplayValue(scoped, "rpc.enabled", 210723495)).toContain("true");
    expect(getConfigDisplayValue(scoped, "rpc.enabled", 210723495)).toContain("[账号覆盖]");
    expect(getConfigDisplayValue(scoped, "rpc.port", 210723495)).toBe("9200 [账号覆盖]");
    expect(getConfigDisplayValue(scoped, "mcp.http.port", 210723495)).toBe("61501 [账号覆盖]");
    expect(getConfigDisplayValue(scoped, "notifyEnabled")).toBe("false");
    expect(getConfigDisplayValue(scoped, "currentUin", 210723495)).toBe("(未设置)");

    const all = listAllConfigEntries(scoped, 210723495);
    expect(all[0]?.[0]).toBe("scope");
    const rpcGroup = listGroupConfigEntries(scoped, "rpc", 210723495);
    expect(rpcGroup.find(([k]) => k === "rpc.port")?.[1]).toContain("9200");
    expect(getConfigDisplayValue(scoped, "mcp.enabled", 210723495)).toBe("true");
    expect(getConfigDisplayValue(scoped, "rpc.host", 210723495)).toBe("127.0.0.1");
    expect(getConfigDisplayValue(scoped, "mcp.plugins")).toBe("(无)");
    expect(getConfigDisplayValue(scoped, "not-in-switch" as never)).toBe("");
  });
});
