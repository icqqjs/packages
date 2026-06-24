/** 向导/流程共用的键盘输入纯函数（便于单测） */

export type InkLikeKey = {
  return?: boolean;
  backspace?: boolean;
  delete?: boolean;
  ctrl?: boolean;
  meta?: boolean;
};

export type TextInputKeyResult =
  | { type: "noop" }
  | { type: "append"; value: string }
  | { type: "backspace"; value: string }
  | { type: "submit"; value: string };

export function applyTextInputKey(
  current: string,
  input: string,
  key: InkLikeKey,
): TextInputKeyResult {
  if (key.return) return { type: "submit", value: current };
  if (key.backspace || key.delete) {
    return { type: "backspace", value: current.slice(0, -1) };
  }
  if (input && !key.ctrl && !key.meta) {
    return { type: "append", value: current + input };
  }
  return { type: "noop" };
}

export function toggleBinaryIndex(current: number): number {
  return current === 0 ? 1 : 0;
}

export function moveSelectIndex(
  current: number,
  direction: "up" | "down",
  maxIndex: number,
): number {
  if (direction === "up") return Math.max(0, current - 1);
  return Math.min(maxIndex, current + 1);
}
