/** 校验 Webhook URL；通过返回 null，失败返回错误信息 */
export function validateWebhookUrl(url: string): string | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return "无效的 Webhook URL";
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return "Webhook URL 仅支持 http/https 协议";
  }

  const hostname = parsed.hostname;
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname === "0.0.0.0" ||
    hostname.startsWith("169.254.") ||
    hostname.startsWith("10.") ||
    hostname.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(hostname)
  ) {
    return "不允许使用内网或元数据地址作为 Webhook";
  }

  return null;
}
