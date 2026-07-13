import path from "node:path";

/** Extract group_id from params (accepts both group_id and gid) */
export function gid(p: Record<string, unknown>): number {
  const v = Number(p.group_id ?? p.gid);
  if (!Number.isFinite(v) || v <= 0) throw new Error("无效的 group_id");
  return v;
}

/** Extract user_id from params (accepts both user_id and uid) */
export function uid(p: Record<string, unknown>): number {
  const v = Number(p.user_id ?? p.uid);
  if (!Number.isFinite(v) || v <= 0) throw new Error("无效的 user_id");
  return v;
}

/** Extract message_id from params */
export function msgid(p: Record<string, unknown>): string {
  const v = p.message_id ?? p.msgid;
  if (typeof v !== "string" || !v) throw new Error("无效的 message_id");
  return v;
}

/** Validate that a string param is present */
export function requireString(p: Record<string, unknown>, key: string): string {
  const v = p[key];
  if (typeof v !== "string" || !v) throw new Error(`缺少参数: ${key}`);
  return v;
}

/** Validate file path: must be a non-empty string, no null bytes, path traversal, or absolute paths */
export function safeFilePath(p: Record<string, unknown>, key = "file"): string {
  const v = requireString(p, key);
  if (v.includes("\0") || v.includes("..")) throw new Error("无效的文件路径");
  if (path.isAbsolute(v)) throw new Error("不允许使用绝对路径");
  return v;
}

/** Extract an optional string param (returns undefined if missing, throws if wrong type) */
export function optionalString(
  p: Record<string, unknown>,
  key: string,
): string | undefined {
  const v = p[key];
  if (v === undefined || v === null) return undefined;
  if (typeof v !== "string") throw new Error(`参数 ${key} 类型错误，应为字符串`);
  return v;
}
