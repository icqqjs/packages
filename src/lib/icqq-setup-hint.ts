/** 非交互场景下的简要指引（如 resolveIcqq 报错） */

export const ICQQ_SETUP_HINT = `
缺少 @icqqjs/icqq，请运行：

  icqq setup

将引导你安装（不会修改 ~/.npmrc）。
`.trim();

/** 交互输入 Token 时的获取指引 */
export const TOKEN_HELP = {
  title: "如何获取 GitHub Personal Access Token",
  intro: "@icqqjs/icqq 发布在 GitHub Packages，安装时需要 PAT 认证。",
  steps: [
    "在浏览器打开（需已登录 GitHub）：",
    "  https://github.com/settings/tokens/new",
    "点击 Generate new token → Generate new token (classic)",
    "Note 随意填写；Expiration 按需选择",
    "勾选权限：read:packages（必选）",
    "  若仍无法安装，可再勾选 repo",
    "点击 Generate token，复制以 ghp_ 开头的字符串",
    "回到此处粘贴，按回车确认（输入不回显）",
  ],
  alt: "也可跳过交互：icqq setup --token <PAT>  或  export GITHUB_TOKEN=<PAT>",
} as const;
