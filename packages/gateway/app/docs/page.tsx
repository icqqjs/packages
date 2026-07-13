"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { Badge, Button, Card, CodeBlock } from "../components/ui";
import { TopBar } from "../components/nav";

const SECTIONS: { id: string; title: string }[] = [
  { id: "overview", title: "概览" },
  { id: "init", title: "初始化" },
  { id: "service", title: "运行与服务" },
  { id: "register", title: "注册与登录" },
  { id: "hosts", title: "主机与配对" },
  { id: "instances", title: "Bot 实例" },
  { id: "local", title: "建号与登录" },
  { id: "shell", title: "Web Shell" },
  { id: "tokens", title: "API 密钥" },
  { id: "mcp", title: "MCP 接入" },
  { id: "rpc", title: "RPC 接入" },
  { id: "faq", title: "常见问题" },
];

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      {children}
    </section>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="text-sm leading-7 text-muted">{children}</p>;
}

function Code({ children }: { children: ReactNode }) {
  return (
    <code className="rounded bg-brand-500/10 px-1.5 py-0.5 font-mono text-[13px] text-brand-600">
      {children}
    </code>
  );
}

export default function DocsPage() {
  return (
    <div className="min-h-screen">
      <TopBar
        right={
          <Link href="/hosts">
            <Button variant="ghost" size="sm">
              返回控制台
            </Button>
          </Link>
        }
      />

      <div className="mx-auto max-w-5xl gap-8 px-5 py-8 lg:grid lg:grid-cols-[200px_1fr]">
        <aside className="hidden lg:block">
          <nav className="sticky top-24 space-y-1">
            <p className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-muted">
              文档目录
            </p>
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="block rounded-lg px-3 py-1.5 text-sm text-muted transition hover:surface-2 hover:text-[var(--text)]"
              >
                {s.title}
              </a>
            ))}
          </nav>
        </aside>

        <div className="min-w-0 space-y-12">
          <header className="space-y-3">
            <Badge tone="brand">使用文档</Badge>
            <h1 className="text-3xl font-semibold tracking-tight">
              icqq gateway 使用指南
            </h1>
            <P>
              icqq gateway 通过 <Code>@icqqjs/sdk</Code> 与 icqq 主仓集成；数据在{" "}
              <Code>~/.icqq-gateway/</Code>，与 bot runtime（<Code>~/.icqq</Code>）分离。
              使用独立 CLI <Code>icqq-gateway</Code>，主 CLI 不再包含 gateway 子命令。
            </P>
          </header>

          <Section id="overview" title="概览">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  t: "Owner 隔离",
                  d: "每个用户只见自己的主机、实例与密钥；admin 也仅管理系统，不查看他人数据。",
                },
                {
                  t: "主机模型",
                  d: "本机与远程 gateway 均可作为 Host，经 host-agent 统一发现、建号、登录与 Shell。",
                },
                {
                  t: "安全存储",
                  d: "SQLite 落库，host/RPC token 加密存储，密码与 API token 经 scrypt 派生。",
                },
              ].map((c) => (
                <Card key={c.t} className="space-y-1.5">
                  <p className="text-sm font-medium">{c.t}</p>
                  <p className="text-xs leading-6 text-muted">{c.d}</p>
                </Card>
              ))}
            </div>
            <P>
              数据存放在 <Code>~/.icqq-gateway/gateway.sqlite</Code>，主密钥位于{" "}
              <Code>~/.icqq-gateway/gateway.key</Code>（权限 0600）。要求 Node ≥ 22。
            </P>
          </Section>

          <Section id="init" title="初始化">
            <P>
              首次使用需初始化数据库与默认管理员。<Code>--migrate</Code>{" "}
              会把现有本地 icqq 账号登记为归属管理员的实例。
            </P>
            <CodeBlock
              lang="bash"
              code={`pnpm install && pnpm build && pnpm --filter @icqqjs/sdk build && pnpm --filter @icqqjs/gateway build

icqq-gateway init --migrate
# 或：icqq-gateway init -U admin -P 'your-strong-pw' --migrate`}
            />
            <P>
              命令输出会显示一个默认 API Token，<strong>仅显示一次</strong>
              ，请立即保存。主密钥来源优先级：<Code>--master-key</Code> ＞ 环境变量{" "}
              <Code>GATEWAY_MASTER_KEY</Code> ＞ 自动生成的{" "}
              <Code>gateway.key</Code>。
            </P>
          </Section>

          <Section id="service" title="运行与服务">
            <P>
              调试可前台运行；正式环境建议安装为系统服务（macOS launchd /
              Linux systemd），随开机自启并自动拉起。
            </P>
            <CodeBlock
              lang="bash"
              code={`icqq-gateway start
icqq-gateway service install
icqq-gateway service status
icqq-gateway service stop
icqq-gateway service uninstall`}
            />
            <P>
              监听地址/端口在 <Code>init</Code> 时写入（默认{" "}
              <Code>127.0.0.1:8787</Code>）。端口被占用时启动直接失败，不会自动漂移。
            </P>
          </Section>

          <Section id="register" title="注册与登录">
            <P>
              注册默认关闭；init 未提供密码时会自动生成并打印，首次登录须修改密码。登录后进入{" "}
              <Code>/hosts</Code> 管理主机。
            </P>
          </Section>

          <Section id="hosts" title="主机与配对">
            <P>
              在「我的主机」可查看本机与已配对的远程机器。添加远程主机时，主控生成短期配对码，在远程机器执行：
            </P>
            <CodeBlock
              lang="bash"
              code={`icqq-gateway host approve http://主控IP:8787 <配对码>

# 或远程管理员登录后打开 /pair 页面`}
            />
            <P>
              配对成功后，在主控点击「同步发现」即可拉取远程 <Code>~/.icqq</Code>{" "}
              中的账号列表。每台主机可独立建号、恢复登录、查看日志与打开 Shell。
            </P>
          </Section>

          <Section id="instances" title="Bot 实例">
            <P>
              实例归属于某个 Host 与 Owner。在主机详情页可添加本地实例、同步发现、恢复登录与查看状态。
              UIN 全局唯一——同一 QQ 号不能同时挂在多台 host。
            </P>
            <P>
              <strong>数据面说明</strong>：远程 host 默认不暴露 MCP/RPC；在主机详情可开启{" "}
              <Code>proxy_data_plane</Code> 后主控代理访问。
            </P>
          </Section>

          <Section id="local" title="建号与登录">
            <P>
              在主机详情页点击「添加实例」，填写 UIN（及可选的平台、签名 API），host-agent
              会写入账号配置并拉起 daemon，随后进入登录向导：
            </P>
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                { t: "扫码登录", d: "向导内直接显示二维码，用手机 QQ 扫码确认即可上线。" },
                { t: "滑块验证", d: "打开链接完成滑块后，把 ticket 粘贴回向导提交。" },
                { t: "设备锁 / 短信", d: "一键发送短信验证码并提交，或完成网页验证后继续。" },
                { t: "恢复登录", d: "离线实例可点「恢复登录」；spawn 失败时会展示错误与日志片段。" },
              ].map((c) => (
                <Card key={c.t} className="space-y-1.5">
                  <p className="text-sm font-medium">{c.t}</p>
                  <p className="text-xs leading-6 text-muted">{c.d}</p>
                </Card>
              ))}
            </div>
            <P>
              实例状态包括 <Code>在线</Code> / <Code>登录中</Code> / <Code>离线</Code> /{" "}
              <Code>daemon_down</Code> / <Code>config_missing</Code>，在线时还会展示昵称。
            </P>
          </Section>

          <Section id="shell" title="Web Shell">
            <P>
              主机卡片或详情页的「Shell」打开基于 xterm 的完整 PTY 终端，仅 host owner
              可访问。本机经进程内 host-agent 直连 OS shell；远程经 host-agent WebSocket
              代理。
            </P>
          </Section>

          <Section id="tokens" title="API 密钥">
            <P>
              顶栏「密钥」进入独立的密钥管理页。密钥以 <Code>tk-</Code>{" "}
              开头，<strong>仅在创建时完整显示一次</strong>并提供快捷复制；此后列表只显示掩码（
              <Code>tk-••••••••后四位</Code>）。不再使用的密钥可随时销毁，销毁后立即失效且不可恢复。
            </P>
          </Section>

          <Section id="mcp" title="MCP 接入">
            <P>
              以 API Token 作为 <Code>Bearer</Code>，URL 中的 UIN
              决定目标实例。网关内置 <Code>icqq_invoke</Code> 与{" "}
              <Code>icqq_list_actions</Code> 两个工具，转发到对应 daemon。
            </P>
            <CodeBlock
              lang="bash"
              code={`curl -X POST http://127.0.0.1:8787/12345/mcp \\
  -H "Authorization: Bearer <API_TOKEN>" \\
  -H "Content-Type: application/json" \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`}
            />
            <P>在支持 MCP 的客户端中，将其配置为 Streamable HTTP 服务端：</P>
            <CodeBlock
              lang="json"
              code={`{
  "mcpServers": {
    "icqq-12345": {
      "url": "http://127.0.0.1:8787/12345/mcp",
      "headers": { "Authorization": "Bearer <API_TOKEN>" }
    }
  }
}`}
            />
          </Section>

          <Section id="rpc" title="RPC 接入">
            <P>
              RPC 通过 WebSocket 桥接到 daemon。Token 可放在{" "}
              <Code>Authorization</Code> 头或 <Code>?token=</Code>{" "}
              查询参数（浏览器场景常用后者）。
            </P>
            <CodeBlock
              lang="typescript"
              code={`const ws = new WebSocket(
  "ws://127.0.0.1:8787/12345/rpc?token=<API_TOKEN>",
);

ws.onopen = () =>
  ws.send(JSON.stringify({ id: "1", action: "list_friends", params: {} }));

ws.onmessage = (e) => console.log(JSON.parse(e.data));`}
            />
            <P>
              发送格式为 <Code>{`{ id, action, params }`}</Code>
              ，网关会回传对应响应；daemon 主动推送的事件也会经此连接下发。
            </P>
          </Section>

          <Section id="faq" title="常见问题">
            <div className="space-y-3">
              <Card className="space-y-1">
                <p className="text-sm font-medium">
                  启动时出现 ExperimentalWarning: SQLite？
                </p>
                <p className="text-sm leading-6 text-muted">
                  正常现象。<Code>node:sqlite</Code> 目前是 Node
                  实验特性，仅提示一次，不影响使用。
                </p>
              </Card>
              <Card className="space-y-1">
                <p className="text-sm font-medium">端口被占用启动失败？</p>
                <p className="text-sm leading-6 text-muted">
                  网关不会自动更换端口。请释放端口，或重新{" "}
                  <Code>init</Code> 指定新的 <Code>--port</Code>。
                </p>
              </Card>
              <Card className="space-y-1">
                <p className="text-sm font-medium">忘记保存 API Token？</p>
                <p className="text-sm leading-6 text-muted">
                  Token 仅在创建时显示一次且以哈希存储，无法找回。请在控制台重新「新建
                  API Token」。
                </p>
              </Card>
            </div>
          </Section>

          <footer className="border-t border-[var(--border)] pt-6 text-xs text-muted">
            更多命令参数与架构说明见仓库 <Code>README.md</Code>。
          </footer>
        </div>
      </div>
    </div>
  );
}
