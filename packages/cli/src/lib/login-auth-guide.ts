/** 浏览器控制台注入 deviceInfo 的脚本（237 验证用） */
export const AUTH_DEVICE_INJECT_SCRIPT = `(function() {
'use strict';
let device;
const input = prompt("输入设备信息");
try {
device = new Function(\`return \${input};\`)();
} catch(e) {
}

if (device?.guid) {
window.__INITIAL_STATE__.deviceInfo = device;
alert("设备信息设置成功！");
} else {
alert("设备信息设置失败！");
}
})();`;

export const AUTH_DEVICE_STEPS = [
  "打开上方验证链接，正常完成验证流程，直到发送完验证码，不要点击「我已发送」",
  "复制下方 JS，打开浏览器开发者工具（F12）→ Console，粘贴并回车",
  "在弹窗中粘贴设备信息 JSON 并确认（可使用下方单行 JSON）",
  "回到验证页点击「我已发送」，完成 237 验证后回到终端按回车",
] as const;

export const AUTH_DEVICE_FILENAME = "auth-device.json";

export function formatAuthDeviceJson(device: unknown): string {
  return JSON.stringify(device ?? {}, null, 2);
}

/** 供浏览器 prompt 粘贴的单行 JSON */
export function formatAuthDeviceOneLine(device: unknown): string {
  return JSON.stringify(device ?? {});
}
