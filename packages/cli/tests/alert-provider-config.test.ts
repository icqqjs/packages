import { describe, it, expect } from "vitest";
import {
  flattenAlertProviders,
  getAlertProvidersMap,
} from "../src/lib/alert-provider-config.js";
import type { IcqqConfig } from "../src/lib/config.js";

describe("alert-provider-config", () => {
  it("flattens map with required fields only", () => {
    const list = flattenAlertProviders({
      bark: { deviceKey: "k", server: "https://bark.example.com" },
      wecom: { webhookKey: "w" },
      telegram: { botToken: "t" },
      generic: { url: "https://hooks.example.com" },
    });
    expect(list.map((p) => p.type)).toEqual(["bark", "wecom", "generic"]);
  });

  it("skips disabled providers", () => {
    const list = flattenAlertProviders({
      bark: { deviceKey: "k", enabled: false },
      wecom: { webhookKey: "w", enabled: true },
    });
    expect(list).toEqual([{ type: "wecom", webhookKey: "w" }]);
  });

  it("reads map from config", () => {
    const config: IcqqConfig = {
      accounts: {},
      alerts: {
        providers: { serverchan: { sendkey: "SCT" } },
      },
    };
    expect(getAlertProvidersMap(config).serverchan?.sendkey).toBe("SCT");
    expect(flattenAlertProviders(config.alerts?.providers)).toEqual([
      { type: "serverchan", sendkey: "SCT" },
    ]);
  });

  it("flattens peer with private and group targets", () => {
    const list = flattenAlertProviders({
      peer: {
        host: "10.0.0.1",
        port: 9100,
        token: "tok",
        userId: 100,
        groupId: 200,
      },
    });
    expect(list).toEqual([
      {
        type: "peer",
        host: "10.0.0.1",
        port: 9100,
        token: "tok",
        userId: 100,
        groupId: 200,
      },
    ]);
  });

  it("skips peer without host or without userId/groupId", () => {
    expect(
      flattenAlertProviders({
        peer: { port: 9100, token: "t", userId: 1 },
      }),
    ).toEqual([]);
    expect(
      flattenAlertProviders({
        peer: { host: "h", port: 1, token: "t" },
      }),
    ).toEqual([]);
  });
});
