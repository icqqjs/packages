import { PNG } from "pngjs";

/** 将 QQ 登录二维码 PNG 渲染为终端 ANSI 半块字符行（与 icqq logQrcode 一致） */
export function renderQrcodeAscii(img: Buffer): string[] {
  const png = PNG.sync.read(img);
  const reset = "\x1b[0m";
  const fgBlk = "\x1b[30m";
  const bgBlk = "\x1b[40m";
  const fgWht = "\x1b[37m";
  const bgWht = "\x1b[47m";
  const lines: string[] = [];

  for (let i = 36; i < png.height * 4 - 36; i += 24) {
    let line = "";
    for (let j = 36; j < png.width * 4 - 36; j += 12) {
      const r0 = png.data[i * png.width + j];
      const r1 = png.data[i * png.width + j + png.width * 4 * 3];
      const bgcolor = r0 === 255 ? bgWht : bgBlk;
      const fgcolor = r1 === 255 ? fgWht : fgBlk;
      line += `${fgcolor}${bgcolor}\u2584`;
    }
    lines.push(line + reset);
  }

  lines.push(`${fgBlk}${bgWht}       请使用 手机QQ 扫描二维码        ${reset}`);
  return lines;
}
