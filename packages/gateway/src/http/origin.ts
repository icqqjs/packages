import type { Request } from "express";

/**
 * 取多值头的第一个值（X-Forwarded-* 可能是逗号分隔列表）。
 */
function firstHeader(value: string | string[] | undefined): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const first = raw?.split(",")[0]?.trim();
  return first || undefined;
}

/**
 * 从请求推导对外 origin，兼容反向代理场景：
 * 优先 X-Forwarded-Proto/Host，其次 Host 头，最后回退到监听地址。
 * 用于生成给第三方（远程 host）回调的 URL，例如配对码的 master_url。
 */
export function requestOrigin(req: Request, fallback: string): string {
  const host =
    firstHeader(req.headers["x-forwarded-host"]) ??
    firstHeader(req.headers.host);
  if (!host) return fallback;
  const proto = firstHeader(req.headers["x-forwarded-proto"]) ?? "http";
  return `${proto}://${host}`;
}

/** 主控无法连通的回推地址：loopback 与通配监听地址 */
const UNREACHABLE_HOSTNAMES = new Set([
  "127.0.0.1",
  "localhost",
  "0.0.0.0",
  "::1",
  "[::1]",
  "[::]",
]);

/**
 * 远程 approve 回推的 base_url 指向 loopback/通配地址时（远程默认取本机监听
 * 地址，如 http://127.0.0.1:8787），主控无法连通。此时用配对请求的对端 IP
 * 替换 host 部分（保留 scheme 与端口）。
 * 无法解析或本身就是可达地址（含反代域名）时原样返回。
 */
export function sanitizeReportedBaseUrl(
  baseUrl: string,
  peerAddress: string | undefined,
): string {
  const peer = peerAddress?.replace(/^::ffff:/, "");
  if (!peer) return baseUrl;
  let url: URL;
  try {
    url = new URL(baseUrl);
  } catch {
    return baseUrl;
  }
  if (!UNREACHABLE_HOSTNAMES.has(url.hostname)) return baseUrl;
  url.hostname = peer.includes(":") ? `[${peer}]` : peer;
  return url.toString().replace(/\/$/, "");
}
