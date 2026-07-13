/** 统一 CLI 错误文案 */

export function formatDaemonNotRunning(uin?: number): string {
  const hint = uin
    ? `请先运行: icqq login -q ${uin}`
  : "请先运行: icqq login";
  return `守护进程未运行\n  ${hint}`;
}

export function formatCliError(message: string): string {
  return `✖ ${message}`;
}

export function formatServiceError(message: string): string {
  return `错误: ${message}`;
}
