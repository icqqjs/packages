import type { GatewayStore, UserRow } from "../db/store.js";

export const SESSION_COOKIE = "icqq_gw_session";

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function extractBearer(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const prefix = "Bearer ";
  if (!authHeader.startsWith(prefix)) return null;
  return authHeader.slice(prefix.length).trim() || null;
}

/** 从 session cookie 解析管理后台用户 */
export function resolveSessionUser(
  store: GatewayStore,
  cookieHeader: string | undefined,
): UserRow | null {
  const cookies = parseCookies(cookieHeader);
  const sid = cookies[SESSION_COOKIE];
  if (!sid) return null;
  return store.findUserBySession(sid);
}

/** 从 Bearer API token 解析调用用户 */
export function resolveApiUser(
  store: GatewayStore,
  authHeader: string | undefined,
): UserRow | null {
  const token = extractBearer(authHeader);
  if (!token) return null;
  return store.findUserByApiToken(token);
}
