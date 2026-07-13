import { createHmac } from "node:crypto";
import type {
  AlertKind,
  AlertProvider,
  AlertProviderConfig,
  DaemonAlertPayload,
  FormattedAlert,
} from "./types.js";
import { buildAlertContent, providerUsesMarkdown } from "./format.js";
import { sendPeerAlert } from "@/lib/alert-peer-send.js";

async function postJson(url: string, body: unknown): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
}

function dingtalkSignedUrl(webhook: string, secret?: string): string {
  if (!secret) return webhook;
  const ts = Date.now();
  const stringToSign = `${ts}\n${secret}`;
  const sign = encodeURIComponent(
    createHmac("sha256", secret).update(stringToSign).digest("base64"),
  );
  const sep = webhook.includes("?") ? "&" : "?";
  return `${webhook}${sep}timestamp=${ts}&sign=${sign}`;
}

function feishuSignedBody(secret: string | undefined, body: Record<string, unknown>) {
  if (!secret) return body;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const stringToSign = `${timestamp}\n${secret}`;
  const sign = createHmac("sha256", stringToSign).update("").digest("base64");
  return { timestamp, sign, ...body };
}

function createProvider(config: AlertProviderConfig): AlertProvider {
  switch (config.type) {
    case "bark":
      return {
        type: "bark",
        async send(formatted) {
          const base = (config.server ?? "https://api.day.app").replace(/\/$/, "");
          const url = `${base}/${encodeURIComponent(config.deviceKey)}/${encodeURIComponent(formatted.title)}/${encodeURIComponent(formatted.body)}`;
          const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
          if (!res.ok) throw new Error(`Bark HTTP ${res.status}`);
        },
      };
    case "wecom":
      return {
        type: "wecom",
        async send(formatted) {
          await postJson(
            `https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=${config.webhookKey}`,
            {
              msgtype: "markdown",
              markdown: { content: formatted.markdown ?? formatted.body },
            },
          );
        },
      };
    case "dingtalk":
      return {
        type: "dingtalk",
        async send(formatted) {
          await postJson(dingtalkSignedUrl(config.webhook, config.secret), {
            msgtype: "markdown",
            markdown: { title: formatted.title, text: formatted.markdown ?? formatted.body },
          });
        },
      };
    case "feishu":
      return {
        type: "feishu",
        async send(formatted) {
          const body = feishuSignedBody(config.secret, {
            msg_type: "interactive",
            card: {
              header: { title: { tag: "plain_text", content: formatted.title } },
              elements: [
                {
                  tag: "div",
                  text: { tag: "plain_text", content: formatted.body },
                },
              ],
            },
          });
          await postJson(config.webhook, body);
        },
      };
    case "telegram":
      return {
        type: "telegram",
        async send(formatted) {
          await postJson(
            `https://api.telegram.org/bot${config.botToken}/sendMessage`,
            {
              chat_id: config.chatId,
              text: `*${formatted.title}*\n\n${formatted.body}`,
              parse_mode: "Markdown",
            },
          );
        },
      };
    case "pushdeer":
      return {
        type: "pushdeer",
        async send(formatted) {
          const base = (config.server ?? "https://api2.pushdeer.com").replace(/\/$/, "");
          await postJson(`${base}/message/push`, {
            pushkey: config.pushkey,
            text: formatted.title,
            desp: formatted.body,
            type: "markdown",
          });
        },
      };
    case "serverchan":
      return {
        type: "serverchan",
        async send(formatted) {
          await postJson(`https://sctapi.ftqq.com/${config.sendkey}.send`, {
            title: formatted.title,
            desp: formatted.body,
          });
        },
      };
    case "generic":
      return {
        type: "generic",
        async send(formatted, payload, kind) {
          await postJson(config.url, {
            type: kind,
            uin: payload.uin,
            ts: payload.ts,
            title: formatted.title,
            body: formatted.body,
            reason: payload.reason,
            loginUrl: payload.loginUrl,
            suggestedCli: payload.suggestedCli,
          });
        },
      };
    case "peer":
      return {
        type: "peer",
        async send(formatted) {
          await sendPeerAlert(
            {
              host: config.host,
              port: config.port,
              token: config.token,
              userId: config.userId,
              groupId: config.groupId,
            },
            formatted.title,
            formatted.body,
          );
        },
      };
    default:
      throw new Error("unknown provider");
  }
}

export function buildProviders(configs: AlertProviderConfig[]): AlertProvider[] {
  return configs
    .filter((c) => c.enabled !== false)
    .map((c) => createProvider(c));
}

export function formatForProvider(
  kind: AlertKind,
  payload: DaemonAlertPayload,
  type: AlertProvider["type"],
): FormattedAlert {
  const formatted = buildAlertContent(kind, payload);
  if (!providerUsesMarkdown(type)) {
    return { title: formatted.title, body: formatted.body };
  }
  return formatted;
}
