import type { IpcMessage } from "@/daemon/protocol.js";
import { icqqEventJsonReplacer } from "@/lib/serialize-icqq-event.js";

/** 将新数据追加到缓冲区并拆出完整的 newline 分隔行 */
export function appendAndSplitLines(
  buffer: string,
  chunk: string,
): { remainder: string; lines: string[] } {
  const combined = buffer + chunk;
  const parts = combined.split("\n");
  const remainder = parts.pop() ?? "";
  const lines = parts.filter((line) => line.trim().length > 0);
  return { remainder, lines };
}

export function formatJsonLine(
  value: unknown,
  replacer?: (key: string, value: unknown) => unknown,
): string {
  return `${JSON.stringify(value, replacer as never)}\n`;
}

export function formatIpcMessageLine(msg: IpcMessage): string {
  return formatJsonLine(msg, icqqEventJsonReplacer);
}

export function parseJsonLine<T>(line: string): T {
  return JSON.parse(line) as T;
}
