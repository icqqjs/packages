# Changelog

## [1.5.7](https://github.com/icqqjs/cli/compare/v1.5.6...v1.5.7) (2026-05-29)


### Bug Fixes

* simplify IPC connection handling and update chat components to use new connection logic ([99b73f9](https://github.com/icqqjs/cli/commit/99b73f95b9421419203afe25194b6bc7cf45b160))

## [1.5.6](https://github.com/icqqjs/cli/compare/v1.5.5...v1.5.6) (2026-05-29)


### Bug Fixes

* update version to 1.5.6 and add @inkjs/ui dependency ([736c3b7](https://github.com/icqqjs/cli/commit/736c3b7965db3b4fa0a6fafe27c54cf9fb5e30c4))

## [1.5.5](https://github.com/icqqjs/cli/compare/v1.5.4...v1.5.5) (2026-05-28)


### Bug Fixes

* update authentication logging and improve error handling for GitHub Packages installation ([3dd220a](https://github.com/icqqjs/cli/commit/3dd220a64ca363504f8339d6901c31d89551f786))

## [1.5.4](https://github.com/icqqjs/cli/compare/v1.5.3...v1.5.4) (2026-05-28)


### Bug Fixes

* enhance GitHub install command with environment logging and improved error handling ([9bb1b97](https://github.com/icqqjs/cli/commit/9bb1b97fcbc35a315b2781853363bbf89bdcbf12))

## [1.5.3](https://github.com/icqqjs/cli/compare/v1.5.2...v1.5.3) (2026-05-28)


### Bug Fixes

* 更新setup 优化 ([046ba6f](https://github.com/icqqjs/cli/commit/046ba6fd0253aba436de3041daccf377603c9fd3))

## [1.5.2](https://github.com/icqqjs/cli/compare/v1.5.1...v1.5.2) (2026-05-22)


### Bug Fixes

* for build ([c35fdce](https://github.com/icqqjs/cli/commit/c35fdceb1fd429f54161db333a77c3d01a4bdf53))

## [1.5.1](https://github.com/icqqjs/cli/compare/v1.5.0...v1.5.1) (2026-05-18)


### Bug Fixes

* publish error ([b96e6eb](https://github.com/icqqjs/cli/commit/b96e6ebd1f18c623c55e86019c1168e8912f0aa9))

## [1.5.0](https://github.com/icqqjs/cli/compare/v1.4.5...v1.5.0) (2026-05-18)


### Features

* enhance service management with global supervisor support ([a0f5324](https://github.com/icqqjs/cli/commit/a0f53246756acf19047cbdaaffa6d751ffb4942f))

## [1.4.5](https://github.com/icqqjs/cli/compare/v1.4.4...v1.4.5) (2026-04-14)


### Bug Fixes

* implement service management commands for daemon ([48101f1](https://github.com/icqqjs/cli/commit/48101f13e8bcb6357cfa435e0024030ac9ad9e10))
* 更新 README 文档，添加登出和系统服务相关命令 ([068b6a6](https://github.com/icqqjs/cli/commit/068b6a68a7ed219f70cfe6d055d73cbc6da38f59))

## [1.4.4](https://github.com/icqqjs/cli/compare/v1.4.3...v1.4.4) (2026-04-12)


### Bug Fixes

* 更新子项目引用以保持依赖一致性 ([7fa35dd](https://github.com/icqqjs/cli/commit/7fa35ddf6f52c32cdac09bf46be1ae46bac535e5))
* 添加 RPC TCP 远程连接支持，优化守护进程与客户端通信 ([a73ce38](https://github.com/icqqjs/cli/commit/a73ce387d49bb7341af3294ed85682d210dcedbd))

## [1.4.3](https://github.com/icqqjs/cli/compare/v1.4.2...v1.4.3) (2026-04-10)


### Bug Fixes

* 更新多个命令以支持生成可点击的链接，优化消息显示逻辑 ([c5f5b78](https://github.com/icqqjs/cli/commit/c5f5b78bd8ae1d14e1b27032fdabd06aaed35314))

## [1.4.2](https://github.com/icqqjs/cli/compare/v1.4.1...v1.4.2) (2026-04-09)


### Bug Fixes

* 增强安装流程，支持检测并使用不同的包管理器，新增获取 icqq 安装路径功能 ([66b1f02](https://github.com/icqqjs/cli/commit/66b1f029b8d5071ba8f7c6d9aeb84b42c5701729))

## [1.4.1](https://github.com/icqqjs/cli/compare/v1.4.0...v1.4.1) (2026-04-09)


### Bug Fixes

* 更新登录向导，新增协议版本步骤，优化平台选择和密码登录逻辑 ([b391454](https://github.com/icqqjs/cli/commit/b3914548997b3d757260d70aab9a78556a984a11))

## [1.4.0](https://github.com/icqqjs/cli/compare/v1.3.1...v1.4.0) (2026-04-09)


### Features

* 更新 CI/CD 配置，支持 Node.js 24，添加测试步骤；重构依赖管理，支持从 npm 安装；新增子频道相关命令 ([1a0acc0](https://github.com/icqqjs/cli/commit/1a0acc0cc95f81253a4b042d01076e92d9abc50b))

## [1.3.1](https://github.com/icqqjs/cli/compare/v1.3.0...v1.3.1) (2026-04-09)


### Bug Fixes

* 删除频道相关命令，包括查看子频道、生成帖子分享URL、撤回消息、发送消息及分享功能 ([3966a7a](https://github.com/icqqjs/cli/commit/3966a7aabdc69f2612baa04dfbd111e855f83961))

## [1.3.0](https://github.com/icqqjs/cli/compare/v1.2.0...v1.3.0) (2026-04-09)


### Features

* 优化表情模式的显示，添加表情搜索和分页功能 ([e83b750](https://github.com/icqqjs/cli/commit/e83b750248877bab72251ab899bf99b0d6bea961))

## [1.2.0](https://github.com/icqqjs/cli/compare/v1.1.0...v1.2.0) (2026-04-09)


### Features

* 添加子频道聊天功能及相关命令，优化频道管理 ([154ddb0](https://github.com/icqqjs/cli/commit/154ddb0536e0533fe5ea977169dab77bf59ffd11))
* 添加频道相关命令，包括查看子频道、生成帖子分享URL、撤回消息、发送消息及分享功能 ([8647e76](https://github.com/icqqjs/cli/commit/8647e76a7199de966bffe76f56b86084ae974f7b))

## [1.1.0](https://github.com/icqqjs/cli/compare/v1.0.1...v1.1.0) (2026-04-09)


### Features

* add completion command for shell auto-completion scripts ([e5b5eed](https://github.com/icqqjs/cli/commit/e5b5eedb6a67700bff894ccab43aaf5f9c6f6eaa))
* add config get and set commands for managing configuration ([05a37a9](https://github.com/icqqjs/cli/commit/05a37a9902b138ce786cbd3566123a5335307cb1))
* add GET_PIC_URL and GET_PTT_URL handlers ([d8ca9a7](https://github.com/icqqjs/cli/commit/d8ca9a79990895532d4a16f78dc57392c1481978))
* add JSON mode utility for output formatting ([e5b5eed](https://github.com/icqqjs/cli/commit/e5b5eedb6a67700bff894ccab43aaf5f9c6f6eaa))
* add missing apis ([8304994](https://github.com/icqqjs/cli/commit/8304994a89c441c0b36a9dd79bce5830372e4a4e))
* add system notification support and file transfer actions ([00d4644](https://github.com/icqqjs/cli/commit/00d4644c8105eba78ad08f06ffd58e215d25a3dd))
* create switch command for changing active account ([e5b5eed](https://github.com/icqqjs/cli/commit/e5b5eedb6a67700bff894ccab43aaf5f9c6f6eaa))
* enhance status command to display all instances and their statuses ([05a37a9](https://github.com/icqqjs/cli/commit/05a37a9902b138ce786cbd3566123a5335307cb1))
* implement chat modes for [@mentions](https://github.com/mentions), emojis, and file selection ([e5b5eed](https://github.com/icqqjs/cli/commit/e5b5eedb6a67700bff894ccab43aaf5f9c6f6eaa))
* introduce friend and group message sending commands ([05a37a9](https://github.com/icqqjs/cli/commit/05a37a9902b138ce786cbd3566123a5335307cb1))
* introduce ListSelector component for displaying selectable lists ([e5b5eed](https://github.com/icqqjs/cli/commit/e5b5eedb6a67700bff894ccab43aaf5f9c6f6eaa))
* restore friend/send and group/send as backwards-compat aliases ([03b95e4](https://github.com/icqqjs/cli/commit/03b95e4ed5a0097183b66596ce5d118b9002b9b9))
* 新增 19 个缺失 API 命令 ([4858586](https://github.com/icqqjs/cli/commit/4858586ce40ef39adb8bb5c99a2597c6a426a2f6))
* 新增 P0 直通型命令 (stranger/view, msg/get, msg/mark-read, group/set/anonymous, group/muted-list, group/at-all-remain, friend/class/*, reload/*) ([ed0ceb8](https://github.com/icqqjs/cli/commit/ed0ceb86e63e1c2a85470e693fb57e34946c8bba))
* 新增 P1 简单型命令 (gfs/move,download,stat, group/set/join-type,rate-limit, group/mute-anon,anon-info,share, friend/add, cache/clean, stamp/*, send temp) 及对应 handler ([c0cd25c](https://github.com/icqqjs/cli/commit/c0cd25cec753779261d03f4c255913e093e39ad1))
* 新增 P2 中等型命令 (friend/send-file,recall-file, gfs/upload, group/reaction/add,remove, forward/get) 及对应 handler ([d11150d](https://github.com/icqqjs/cli/commit/d11150db86f765b71d5497ba1bcac9518f9e20f8))
* 新增 P3 频道系统命令 (guild/list,info,channels,members,send,recall) 及对应 handler ([718e4c1](https://github.com/icqqjs/cli/commit/718e4c102936adbe7da7b686e57729cc461030e3))
* 添加 skills 子模块 ([54b593d](https://github.com/icqqjs/cli/commit/54b593dfc36123e1822af106392b104ff081d542))
* 添加多个命令描述，优化黑名单和Webhook配置的实现 ([f0c3dfa](https://github.com/icqqjs/cli/commit/f0c3dfafaaee8b61c74f1c3771c97e98843ed044))


### Bug Fixes

* address code review issues in protocol.ts and handlers.ts ([9427636](https://github.com/icqqjs/cli/commit/94276365ec8a2765e714317726f1307a1fb5aa4d))
* correct environment variable for installation token in CI workflow ([89b22a5](https://github.com/icqqjs/cli/commit/89b22a525c94f9311cc79b53a47abada735a929e))
* GFS info 命令使用错误的 Action (GFS_STAT → GFS_INFO) 并修正字段名 ([cf445f7](https://github.com/icqqjs/cli/commit/cf445f79bcbe0c124e82cdb0438024a26372c1b8))
* improve error messages and loading indicators across commands ([05a37a9](https://github.com/icqqjs/cli/commit/05a37a9902b138ce786cbd3566123a5335307cb1))
* remove duplicate Action definitions in protocol.ts ([1e5c6ff](https://github.com/icqqjs/cli/commit/1e5c6ff5820a9fe22fd1fa5afeca7904b8c30f59))
* scripts.prepublishOnly ([56f57c2](https://github.com/icqqjs/cli/commit/56f57c231ee33f63494444e0becd452045b79cd8))
* update command files to use correct Action names after alias removal ([cb07dbf](https://github.com/icqqjs/cli/commit/cb07dbf6a2f4725c615026374081ed4bc157f5ff))
* use !== undefined check for duration in GROUP_MUTE_ANONY handler ([42bf250](https://github.com/icqqjs/cli/commit/42bf25026e48b9bd1107a5544d8d428d0b06c08e))
* 更新子项目提交状态 ([8fe3ca4](https://github.com/icqqjs/cli/commit/8fe3ca4a60afc527c753065ef7660c2abb391ad9))
* 更新子项目提交状态为 dirty ([c205043](https://github.com/icqqjs/cli/commit/c205043cb3c863b73fce1af6553bef3265136d23))
* 更新鉴权流程 ([1ec2027](https://github.com/icqqjs/cli/commit/1ec20275dcb014a909040ea29a37fe80f6484741))

## [1.0.1](https://github.com/icqqjs/cli/compare/v1.0.0...v1.0.1) (2026-04-08)


### Bug Fixes

* 修复发布工作流中的 GITHUB_TOKEN 环境变量配置 ([2b036d8](https://github.com/icqqjs/cli/commit/2b036d8eeb8cc02d5255ec8e397fe12f9106085b))
* 更新发布工作流中的认证令牌配置 ([bce3bbf](https://github.com/icqqjs/cli/commit/bce3bbfd22bec3f232cf414350335297a1724a7c))

## 1.0.0 (2026-04-08)


### Features

* add changeset configuration and initial release workflow ([8701e76](https://github.com/icqqjs/cli/commit/8701e763d7decccc0cd937630d78b8e78c131680))
* 切换到 release-please，移除 changesets ([b2d10af](https://github.com/icqqjs/cli/commit/b2d10afa34c7ad94bf41fb262391350c5ffc03f0))
* 更新 CI 和发布工作流中的 actions 版本至 v5，并添加环境变量配置 ([3e437a7](https://github.com/icqqjs/cli/commit/3e437a7e28dba104542c8f7bf4eb9bd0fd94e0e0))
* 更新 pnpm/action-setup 版本至 v5，移除不必要的环境变量配置 ([5373315](https://github.com/icqqjs/cli/commit/5373315ae9ddb39476728ff5254313af29435bd7))
* 更新版本至 0.0.2，移除 changelog 配置和不必要的依赖 ([624b222](https://github.com/icqqjs/cli/commit/624b2226a582054a22137310316da15dafa2e300))
* 添加作者信息和引擎要求到 package.json，新增 README.md 文件 ([0ef4331](https://github.com/icqqjs/cli/commit/0ef43314d01add53968f038a743cdff63c7ceedb))


### Bug Fixes

* 首次发版 ([f9acc59](https://github.com/icqqjs/cli/commit/f9acc59a5480602de5c93a0961778612a39b9ca8))
