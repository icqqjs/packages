import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";
import { buildAlertContent } from "../src/daemon/alert/format.js";
import {
  buildProviders,
  formatForProvider,
} from "../src/daemon/alert/providers.js";
import type {
  AlertKind,
  AlertProviderConfig,
  DaemonAlertPayload,
} from "../src/daemon/alert/types.js";

const sendPeerAlertMock = vi.fn(async () => {});

vi.mock("../src/lib/alert-peer-send.js", () => ({
  sendPeerAlert: (...args: unknown[]) => sendPeerAlertMock(...args),
}));

const fetchMock = vi.fn();

const basePayload: DaemonAlertPayload = {
  uin: 12345,
  ts: 1_700_000_000_000,
  reason: "需要滑块验证",
  loginUrl: "https://qq.example.com/login",
  suggestedCli: "icqq login -q 12345",
};

async function invokeProvider(
  config: AlertProviderConfig,
  kind: AlertKind = "login_waiting",
  payload: DaemonAlertPayload = basePayload,
) {
  const [provider] = buildProviders([config]);
  expect(provider).toBeDefined();
  const formatted = formatForProvider(kind, payload, provider!.type);
  await provider!.send(formatted, payload, kind);
  return fetchMock.mock.calls.at(-1)!;
}

function lastPostBody(): unknown {
  const call = fetchMock.mock.calls.at(-1)!;
  return JSON.parse(String(call[1]?.body));
}

describe("buildAlertContent", () => {
  it("includes login URL and auth hint for login_waiting", () => {
    const content = buildAlertContent("login_waiting", basePayload);
    expect(content.title).toContain("需要重新登录");
    expect(content.body).toContain("https://qq.example.com/login");
    expect(content.body).toContain("/login/auth");
    expect(content.markdown).toContain("###");
  });

  it("warns when login_waiting without publicUrl", () => {
    const content = buildAlertContent("login_waiting", {
      ...basePayload,
      loginUrl: undefined,
    });
    expect(content.body).toContain("login.http.publicUrl");
  });

  it.each([
    ["daemon_ready", "守护进程已就绪"],
    ["offline_network", "网络掉线"],
    ["offline_kickoff", "被踢下线"],
    ["online", "账号已上线"],
  ] as const)("builds title for %s", (kind, label) => {
    const content = buildAlertContent(kind, basePayload);
    expect(content.title).toContain(label);
    expect(content.body).toContain("icqq login -q 12345");
  });
});

describe("buildProviders", () => {
  it("skips providers with enabled: false", () => {
    const providers = buildProviders([
      { type: "generic", url: "https://hooks.example.com/a", enabled: false },
      { type: "generic", url: "https://hooks.example.com/b" },
    ]);
    expect(providers).toHaveLength(1);
    expect(providers[0]!.type).toBe("generic");
  });
});

describe("formatForProvider", () => {
  it("keeps markdown for wecom/dingtalk/feishu", () => {
    const formatted = formatForProvider("online", basePayload, "wecom");
    expect(formatted.markdown).toBeDefined();
  });

  it("strips markdown for bark and telegram", () => {
    const bark = formatForProvider("online", basePayload, "bark");
    const tg = formatForProvider("online", basePayload, "telegram");
    expect(bark.markdown).toBeUndefined();
    expect(tg.markdown).toBeUndefined();
    expect(bark.title).toContain("账号已上线");
  });
});

describe("alert providers HTTP contract", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    sendPeerAlertMock.mockClear();
    fetchMock.mockResolvedValue({ ok: true, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);
  });

  it("bark: GET default server with encoded path segments", async () => {
    await invokeProvider({ type: "bark", deviceKey: "my-device-key" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(init?.method).toBeUndefined();
    expect(url).toMatch(/^https:\/\/api\.day\.app\/my-device-key\//);
    const decoded = decodeURIComponent(String(url));
    expect(decoded).toContain("需要重新登录");
    expect(decoded).toContain("需要滑块验证");
  });

  it("bark: uses custom server base", async () => {
    await invokeProvider({
      type: "bark",
      deviceKey: "key",
      server: "https://bark.example.com/",
    });
    expect(String(fetchMock.mock.calls[0]![0])).toMatch(/^https:\/\/bark\.example\.com\/key\//);
  });

  it("wecom: POST markdown webhook payload", async () => {
    await invokeProvider({ type: "wecom", webhookKey: "abc-123" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      "https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=abc-123",
    );
    expect(init?.method).toBe("POST");
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      msgtype: "markdown",
      markdown: { content: expect.stringContaining("需要重新登录") },
    });
  });

  it("dingtalk: POST to webhook without secret", async () => {
    const webhook = "https://oapi.dingtalk.com/robot/send?access_token=TOKEN";
    await invokeProvider({ type: "dingtalk", webhook });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(webhook);
    const body = JSON.parse(String(init?.body));
    expect(body.msgtype).toBe("markdown");
    expect(body.markdown.title).toContain("需要重新登录");
    expect(body.markdown.text).toContain("需要滑块验证");
  });

  it("dingtalk: appends signed query when secret is set", async () => {
    const webhook = "https://oapi.dingtalk.com/robot/send?access_token=TOKEN";
    const secret = "SEC123";
    await invokeProvider({ type: "dingtalk", webhook, secret });
    const url = String(fetchMock.mock.calls[0]![0]);
    expect(url).toContain("timestamp=");
    expect(url).toContain("sign=");
    const parsed = new URL(url);
    const ts = parsed.searchParams.get("timestamp")!;
    const sign = decodeURIComponent(parsed.searchParams.get("sign")!);
    const expected = createHmac("sha256", secret)
      .update(`${ts}\n${secret}`)
      .digest("base64");
    expect(sign).toBe(expected);
  });

  it("feishu: POST interactive card", async () => {
    const webhook = "https://open.feishu.cn/open-apis/bot/v2/hook/xxx";
    await invokeProvider({ type: "feishu", webhook });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(webhook);
    const body = JSON.parse(String(init?.body));
    expect(body.msg_type).toBe("interactive");
    expect(body.card.header.title.content).toContain("需要重新登录");
    expect(body.card.elements[0].text.content).toContain("需要滑块验证");
    expect(body.timestamp).toBeUndefined();
  });

  it("feishu: includes signature when secret is set", async () => {
    const secret = "feishu-secret";
    await invokeProvider({
      type: "feishu",
      webhook: "https://open.feishu.cn/open-apis/bot/v2/hook/yyy",
      secret,
    });
    const body = lastPostBody() as Record<string, string>;
    expect(body.timestamp).toMatch(/^\d+$/);
    const expected = createHmac("sha256", `${body.timestamp}\n${secret}`)
      .update("")
      .digest("base64");
    expect(body.sign).toBe(expected);
  });

  it("telegram: POST sendMessage with Markdown", async () => {
    await invokeProvider({
      type: "telegram",
      botToken: "123:ABC",
      chatId: "-100999",
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api.telegram.org/bot123:ABC/sendMessage");
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      chat_id: "-100999",
      text: expect.stringContaining("*icqq 12345"),
      parse_mode: "Markdown",
    });
    expect(body.text).toContain("需要滑块验证");
  });

  it("pushdeer: POST default server message", async () => {
    await invokeProvider({ type: "pushdeer", pushkey: "PK-xyz" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://api2.pushdeer.com/message/push");
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      pushkey: "PK-xyz",
      text: expect.stringContaining("需要重新登录"),
      desp: expect.stringContaining("需要滑块验证"),
      type: "markdown",
    });
  });

  it("pushdeer: uses custom server", async () => {
    await invokeProvider({
      type: "pushdeer",
      pushkey: "PK",
      server: "https://pushdeer.example.com",
    });
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      "https://pushdeer.example.com/message/push",
    );
  });

  it("serverchan: POST turbo send API", async () => {
    await invokeProvider({ type: "serverchan", sendkey: "SCT123" });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://sctapi.ftqq.com/SCT123.send");
    const body = JSON.parse(String(init?.body));
    expect(body.title).toContain("需要重新登录");
    expect(body.desp).toContain("需要滑块验证");
    expect(init?.method).toBe("POST");
  });

  it("generic: POST unified envelope", async () => {
    await invokeProvider({
      type: "generic",
      url: "https://hooks.example.com/icqq",
    });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe("https://hooks.example.com/icqq");
    const body = JSON.parse(String(init?.body));
    expect(body).toEqual({
      type: "login_waiting",
      uin: 12345,
      ts: 1_700_000_000_000,
      title: expect.stringContaining("需要重新登录"),
      body: expect.stringContaining("需要滑块验证"),
      reason: "需要滑块验证",
      loginUrl: "https://qq.example.com/login",
      suggestedCli: "icqq login -q 12345",
    });
  });

  it("propagates HTTP errors", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: async () => "server error",
    });
    const [provider] = buildProviders([
      { type: "generic", url: "https://hooks.example.com/icqq" },
    ]);
    const formatted = formatForProvider("online", basePayload, "generic");
    await expect(
      provider!.send(formatted, basePayload, "online"),
    ).rejects.toThrow("HTTP 500");
  });

  it("broadcasts all 8 provider types in one dispatch", async () => {
    const configs: AlertProviderConfig[] = [
      { type: "bark", deviceKey: "k" },
      { type: "wecom", webhookKey: "w" },
      { type: "dingtalk", webhook: "https://ding.example.com/hook" },
      { type: "feishu", webhook: "https://feishu.example.com/hook" },
      { type: "telegram", botToken: "t", chatId: "c" },
      { type: "pushdeer", pushkey: "p" },
      { type: "serverchan", sendkey: "s" },
      { type: "generic", url: "https://hooks.example.com/icqq" },
    ];
    const providers = buildProviders(configs);
    expect(providers).toHaveLength(8);

    for (const provider of providers) {
      const formatted = formatForProvider("daemon_ready", {
        ...basePayload,
        reason: "IPC 已就绪",
      }, provider.type);
      await provider.send(formatted, { ...basePayload, reason: "IPC 已就绪" }, "daemon_ready");
    }
    expect(fetchMock).toHaveBeenCalledTimes(8);
  });

  it("peer: delegates to sendPeerAlert with rpc target and formatted text", async () => {
    await invokeProvider({
      type: "peer",
      host: "192.168.1.5",
      port: 9200,
      token: "peer-tok",
      userId: 99,
      groupId: 88,
    });
    expect(sendPeerAlertMock).toHaveBeenCalledWith(
      {
        host: "192.168.1.5",
        port: 9200,
        token: "peer-tok",
        userId: 99,
        groupId: 88,
      },
      expect.stringContaining("需要重新登录"),
      expect.stringContaining("需要滑块验证"),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
