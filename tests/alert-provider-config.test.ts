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
});
