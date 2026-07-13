import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { renderQrcodeAscii } from "../src/lib/render-qrcode.js";

describe("renderQrcodeAscii", () => {
  it("renders a checkerboard PNG into ANSI lines", () => {
    const size = 96;
    const png = new PNG({ width: size, height: size });
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (size * y + x) << 2;
        const v = (x + y) % 2 === 0 ? 0 : 255;
        png.data[idx] = v;
        png.data[idx + 1] = v;
        png.data[idx + 2] = v;
        png.data[idx + 3] = 255;
      }
    }
    const buf = PNG.sync.write(png);
    const lines = renderQrcodeAscii(buf);
    expect(lines.length).toBeGreaterThan(1);
    expect(lines.some((line) => line.includes("\u2584"))).toBe(true);
    expect(lines.at(-1)).toContain("手机QQ");
  });
});
