import React from "react";
import { Text, Box } from "ink";

/** Check if a Unicode code point is a CJK/fullwidth character (display width = 2) */
function isCJK(code: number): boolean {
  return (
    (code >= 0x1100 && code <= 0x115f) ||  // Hangul Jamo
    (code >= 0x2e80 && code <= 0x303e) ||  // CJK Radicals, Kangxi, Symbols
    (code >= 0x3040 && code <= 0x33bf) ||  // Hiragana, Katakana, CJK compat
    (code >= 0x3400 && code <= 0x4dbf) ||  // CJK Ext-A
    (code >= 0x4e00 && code <= 0xa4cf) ||  // CJK Unified, Yi
    (code >= 0xac00 && code <= 0xd7af) ||  // Hangul Syllables
    (code >= 0xf900 && code <= 0xfaff) ||  // CJK Compat Ideographs
    (code >= 0xfe30 && code <= 0xfe6f) ||  // CJK Compat Forms
    (code >= 0xff01 && code <= 0xff60) ||  // Fullwidth Forms
    (code >= 0xffe0 && code <= 0xffe6) ||  // Fullwidth Signs
    (code >= 0x20000 && code <= 0x2fa1f)   // CJK Ext-B..F, Compat Supplement
  );
}

/** Calculate display width accounting for CJK fullwidth characters */
function stringWidth(str: string): number {
  let width = 0;
  for (const char of str) {
    width += isCJK(char.codePointAt(0)!) ? 2 : 1;
  }
  return width;
}

type Column = {
  key: string;
  header: string;
  width?: number;
};

/** Truncate string to fit within maxWidth display columns, appending … if clipped */
function truncate(str: string, maxWidth: number): string {
  if (maxWidth <= 0) return "";
  const chars = [...str];
  let w = 0;
  for (let i = 0; i < chars.length; i++) {
    const cw = isCJK(chars[i]!.codePointAt(0)!) ? 2 : 1;
    if (w + cw > maxWidth - 1 && i < chars.length - 1) {
      return chars.slice(0, i).join("") + "…";
    }
    w += cw;
    if (w >= maxWidth && i < chars.length - 1) {
      return chars.slice(0, i + 1).join("") + "…";
    }
  }
  return str;
}

type Props = {
  columns: Column[];
  data: Record<string, unknown>[];
};

export function Table({ columns, data }: Props) {
  const widths = columns.map((col) => {
    const maxData = data.reduce((max, row) => {
      const val = String(row[col.key] ?? "");
      return Math.max(max, stringWidth(val));
    }, stringWidth(col.header));
    return col.width ?? Math.min(maxData + 2, 50);
  });

  return (
    <Box flexDirection="column">
      <Box>
        {columns.map((col, i) => (
          <Box key={col.key} width={widths[i]} marginRight={1}>
            <Text bold color="cyan">
              {col.header}
            </Text>
          </Box>
        ))}
      </Box>
      <Box>
        {columns.map((col, i) => (
          <Box key={col.key} width={widths[i]} marginRight={1}>
            <Text dimColor>{"─".repeat(Math.max(widths[i]! - 1, 1))}</Text>
          </Box>
        ))}
      </Box>
      {data.map((row, rowIdx) => (
        <Box key={rowIdx}>
          {columns.map((col, i) => (
            <Box key={col.key} width={widths[i]} marginRight={1}>
              <Text>{truncate(String(row[col.key] ?? ""), widths[i]! - 1)}</Text>
            </Box>
          ))}
        </Box>
      ))}
      <Box marginTop={1}>
        <Text dimColor>共 {data.length} 条</Text>
      </Box>
    </Box>
  );
}
