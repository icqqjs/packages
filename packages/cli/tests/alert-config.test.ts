import { afterEach, describe, it, expect, vi } from "vitest";
import {
  buildLoginPublicUrl,
  mergeAlertsFromEnv,
  resolveAlertsConfig,
  resolveLoginConfig,
} from "../src/lib/alert-config.js";

describe("alert-config", () => {
  const env = { ...process.env };

  afterEach(() => {
    process.env = { ...env };
  });

  it("resolves defaults", () => {
    expect(resolveAlertsConfig({ accounts: {} })).toEqual({
      enabled: false,
      cooldownMs: 15 * 60 * 1000,
      providers: [],
    });
    expect(resolveLoginConfig({ accounts: {} }).http.host).toBe("127.0.0.1");
    expect(resolveLoginConfig({ accounts: {} }).waitingTimeoutMs).toBe(86_400_000);
  });

  it("mergeAlertsFromEnv populates provider map", () => {
    process.env.ICQQ_ALERTS_ENABLED = "true";
    process.env.ICQQ_ALERT_BARK_KEY = "bark-key";
    process.env.ICQQ_ALERT_BARK_SERVER = "https://bark.example.com";
    process.env.ICQQ_ALERT_WECOM_WEBHOOK_KEY = "wecom";
    process.env.ICQQ_ALERT_DINGTALK_WEBHOOK = "https://ding.example.com";
    process.env.ICQQ_ALERT_DINGTALK_SECRET = "sec";
    process.env.ICQQ_ALERT_FEISHU_WEBHOOK = "https://feishu.example.com";
    process.env.ICQQ_ALERT_FEISHU_SECRET = "fsec";
    process.env.ICQQ_ALERT_TELEGRAM_BOT_TOKEN = "bot";
    process.env.ICQQ_ALERT_TELEGRAM_CHAT_ID = "chat";
    process.env.ICQQ_ALERT_PUSHDEER_KEY = "pd";
    process.env.ICQQ_ALERT_PUSHDEER_SERVER = "https://pd.example.com";
    process.env.ICQQ_ALERT_SERVERCHAN_KEY = "sct";
    process.env.ICQQ_ALERT_WEBHOOK_URL = "https://hooks.example.com";

    const config = { accounts: {} };
    mergeAlertsFromEnv(config);

    expect(config.alerts?.enabled).toBe(true);
    expect(config.alerts?.providers).toMatchObject({
      bark: { deviceKey: "bark-key", server: "https://bark.example.com" },
      wecom: { webhookKey: "wecom" },
      dingtalk: { webhook: "https://ding.example.com", secret: "sec" },
      feishu: { webhook: "https://feishu.example.com", secret: "fsec" },
      telegram: { botToken: "bot", chatId: "chat" },
      pushdeer: { pushkey: "pd", server: "https://pd.example.com" },
      serverchan: { sendkey: "sct" },
      generic: { url: "https://hooks.example.com" },
    });
    expect(resolveAlertsConfig(config).providers).toHaveLength(8);
  });

  it("mergeAlertsFromEnv populates peer provider", () => {
    process.env.ICQQ_ALERT_PEER_HOST = "10.0.0.3";
    process.env.ICQQ_ALERT_PEER_PORT = "9100";
    process.env.ICQQ_ALERT_PEER_TOKEN = "tok";
    process.env.ICQQ_ALERT_PEER_USER_ID = "111";
    process.env.ICQQ_ALERT_PEER_GROUP_ID = "222";

    const config = { accounts: {} };
    mergeAlertsFromEnv(config);

    expect(config.alerts?.providers?.peer).toMatchObject({
      host: "10.0.0.3",
      port: 9100,
      token: "tok",
      userId: 111,
      groupId: 222,
    });
    const resolved = resolveAlertsConfig(config);
    expect(resolved.providers).toEqual([
      expect.objectContaining({
        type: "peer",
        host: "10.0.0.3",
        userId: 111,
        groupId: 222,
      }),
    ]);
  });

  it("buildLoginPublicUrl prefers publicUrl", () => {
    expect(
      buildLoginPublicUrl(
        { accounts: {}, login: { http: { publicUrl: "https://qq.example.com/" } } },
        0,
      ),
    ).toBe("https://qq.example.com/login");
    expect(buildLoginPublicUrl({ accounts: {} }, 3920)).toBe(
      "http://127.0.0.1:3920/login",
    );
    expect(
      buildLoginPublicUrl(
        { accounts: {}, login: { http: { host: "0.0.0.0", port: 3920 } } },
        3920,
      ),
    ).toBeUndefined();
  });
});
