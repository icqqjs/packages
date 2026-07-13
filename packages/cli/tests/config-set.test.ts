import { describe, it, expect } from "vitest";
import {
  applyConfigSet,
  parseConfigSetValue,
  isConfigSetKey,
} from "../src/lib/config-set.js";
import type { IcqqConfig } from "../src/lib/config.js";

describe("config-set", () => {
  it("parses mcp.enabled", () => {
    expect(parseConfigSetValue("mcp.enabled", "true")).toBe(true);
    expect(parseConfigSetValue("rpc.enabled", "0")).toBe(false);
    expect(isConfigSetKey("mcp.enabled")).toBe(true);
  });

  it("parses number and string keys", () => {
    expect(parseConfigSetValue("currentUin", "12345")).toBe(12345);
    expect(parseConfigSetValue("mcp.http.port", "3920")).toBe(3920);
    expect(parseConfigSetValue("rpc.port", "9100")).toBe(9100);
    expect(parseConfigSetValue("webhookUrl", "https://example.com")).toBe(
      "https://example.com",
    );
    expect(parseConfigSetValue("rpc.host", "0.0.0.0")).toBe("0.0.0.0");
  });

  it("rejects invalid bool, port, and uin", () => {
    expect(() => parseConfigSetValue("notifyEnabled", "yes")).toThrow("布尔值必须");
    expect(() => parseConfigSetValue("mcp.http.port", "70000")).toThrow("端口必须");
    expect(() => parseConfigSetValue("currentUin", "0")).toThrow("currentUin 必须为正整数");
  });

  it("applies nested mcp.http.port", () => {
    const config: IcqqConfig = { accounts: {} };
    applyConfigSet(config, "mcp.http.port", 3920);
    expect(config.mcp?.http?.port).toBe(3920);
  });

  it("applies alerts provider fields via dotted keys", () => {
    const config: IcqqConfig = { accounts: {} };
    applyConfigSet(config, "alerts.enabled", true);
    applyConfigSet(config, "login.http.publicUrl", "https://qq.example.com");
    applyConfigSet(config, "alerts.providers.bark.deviceKey", "bark-key");
    applyConfigSet(config, "alerts.providers.bark.server", "https://bark.l2cl.link");
    applyConfigSet(config, "alerts.providers.wecom.webhookKey", "wecom-key");
    expect(config.alerts?.enabled).toBe(true);
    expect(config.login?.http?.publicUrl).toBe("https://qq.example.com");
    expect(config.alerts?.providers).toEqual({
      bark: { deviceKey: "bark-key", server: "https://bark.l2cl.link" },
      wecom: { webhookKey: "wecom-key" },
    });
    expect(isConfigSetKey("alerts.providers.bark.deviceKey")).toBe(true);
    expect(parseConfigSetValue("alerts.providers.bark.enabled", "false")).toBe(false);
  });

  it("applies account-scoped mcp/rpc when uin is provided", () => {
    const config: IcqqConfig = {
      mcp: { enabled: true, http: { host: "127.0.0.1", port: 61500 } },
      rpc: { enabled: false, host: "127.0.0.1", port: 0 },
      accounts: {
        "210723495": { platform: 3, signApiUrl: "https://sign.example.com" },
      },
    };

    applyConfigSet(config, "mcp.http.port", 61501, 210723495);
    applyConfigSet(config, "rpc.enabled", true, 210723495);

    expect(config.mcp?.http?.port).toBe(61500);
    expect(config.accounts["210723495"]?.mcp?.http?.port).toBe(61501);
    expect(config.accounts["210723495"]?.rpc?.enabled).toBe(true);
  });

  it("rejects global-only keys with uin scope", () => {
    const config: IcqqConfig = { accounts: {} };
    expect(() => applyConfigSet(config, "currentUin", 1, 123)).toThrow("全局配置");
  });

  it("applies all top-level and nested config keys", () => {
    const config: IcqqConfig = { accounts: {} };

    applyConfigSet(config, "currentUin", 12345);
    applyConfigSet(config, "webhookUrl", "https://example.com/hook");
    applyConfigSet(config, "notifyEnabled", true);
    applyConfigSet(config, "mcp.enabled", true);
    applyConfigSet(config, "mcp.http.host", "0.0.0.0");
    applyConfigSet(config, "mcp.http.token", "secret");
    applyConfigSet(config, "rpc.enabled", true);
    applyConfigSet(config, "rpc.host", "0.0.0.0");
    applyConfigSet(config, "rpc.port", 9100);

    expect(config.currentUin).toBe(12345);
    expect(config.webhookUrl).toBe("https://example.com/hook");
    expect(config.notifyEnabled).toBe(true);
    expect(config.mcp).toEqual({
      enabled: true,
      http: {
        host: "0.0.0.0",
        port: 0,
        token: "secret",
      },
    });
    expect(config.rpc).toEqual({
      enabled: true,
      host: "0.0.0.0",
      port: 9100,
    });
  });

  it("recognizes only supported keys", () => {
    expect(isConfigSetKey("rpc.port")).toBe(true);
    expect(isConfigSetKey("alerts.providers.telegram.chatId")).toBe(true);
    expect(isConfigSetKey("alerts.providers")).toBe(false);
    expect(isConfigSetKey("accounts")).toBe(false);
  });

  it("applies remaining login and alerts keys", () => {
    const config: IcqqConfig = { accounts: {} };
    applyConfigSet(config, "alerts.cooldownMs", 45_000);
    applyConfigSet(config, "login.http.host", "127.0.0.1");
    applyConfigSet(config, "login.http.port", 8800);
    applyConfigSet(config, "login.waitingTimeoutMs", 90_000);
    applyConfigSet(config, "login.submitRateLimit.windowMs", 10_000);
    applyConfigSet(config, "login.submitRateLimit.maxAttempts", 5);

    expect(config.alerts?.cooldownMs).toBe(45_000);
    expect(config.login).toEqual({
      http: { host: "127.0.0.1", port: 8800 },
      waitingTimeoutMs: 90_000,
      submitRateLimit: { windowMs: 10_000, maxAttempts: 5 },
    });
    expect(parseConfigSetValue("alerts.cooldownMs", "60000")).toBe(60_000);
    expect(parseConfigSetValue("login.waitingTimeoutMs", "120000")).toBe(120_000);
    expect(parseConfigSetValue("alerts.providers.peer.port", "9100")).toBe(9100);
    expect(parseConfigSetValue("alerts.providers.peer.userId", "12345")).toBe(12345);
    expect(parseConfigSetValue("alerts.providers.peer.groupId", "67890")).toBe(67890);
  });

  it("rejects alert provider keys with account scope", () => {
    const config: IcqqConfig = { accounts: {} };
    expect(() =>
      applyConfigSet(config, "alerts.providers.bark.deviceKey", "k", 123),
    ).toThrow("全局配置");
  });

  it("rejects unknown keys", () => {
    const config: IcqqConfig = { accounts: {} };
    expect(() => applyConfigSet(config, "not.a.key", "x")).toThrow("未知配置项");
  });
});
