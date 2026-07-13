import type { AlertKind, AlertProviderType, DaemonAlertPayload, FormattedAlert } from "./types.js";

const KIND_TITLES: Record<AlertKind, string> = {
  daemon_ready: "守护进程已就绪",
  login_waiting: "需要重新登录",
  offline_network: "网络掉线",
  offline_kickoff: "被踢下线",
  online: "账号已上线",
};

export function buildAlertContent(
  kind: AlertKind,
  payload: DaemonAlertPayload,
): FormattedAlert {
  const title = `icqq ${payload.uin} · ${KIND_TITLES[kind]}`;
  const lines: string[] = [];

  if (payload.reason) lines.push(`原因: ${payload.reason}`);
  if (payload.phase) lines.push(`阶段: ${payload.phase}`);
  if (payload.message) lines.push(payload.message);
  if (payload.loginUrl && kind === "login_waiting") {
    lines.push(`Login Web: ${payload.loginUrl}`);
    lines.push("鉴权: /login/auth 粘贴 daemon.token 或 Bearer Header");
  } else if (kind === "login_waiting" && !payload.loginUrl) {
    lines.push("提示: 请配置 login.http.publicUrl 以获取可点击链接");
  }
  lines.push(`CLI: ${payload.suggestedCli}`);

  const body = lines.join("\n");
  const markdown = `### ${title}\n\n${lines.map((l) => `- ${l}`).join("\n")}`;
  return { title, body, markdown };
}

export function providerUsesMarkdown(type: AlertProviderType): boolean {
  return type === "wecom" || type === "dingtalk" || type === "feishu";
}
