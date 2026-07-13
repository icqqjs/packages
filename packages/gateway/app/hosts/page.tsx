"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import * as Dialog from "@radix-ui/react-dialog";
import {
  createPairing,
  deleteHost,
  fetcher,
  listHosts,
  logout,
  type Host,
  type Me,
} from "../lib/api";
import { CapabilityMarquee, FeatureBento } from "../components/feature-bento";
import { TopBar } from "../components/nav";
import { Badge, Button, Card } from "../components/ui";

export default function HostsPage() {
  const router = useRouter();
  const { data: me, error, mutate } = useSWR<Me>("/api/me", fetcher, {
    shouldRetryOnError: false,
  });

  useEffect(() => {
    if (me?.mustChangePassword) router.replace("/change-password");
  }, [me, router]);

  if (error)
    return (
      <main className="grid min-h-screen w-full max-w-full place-items-center overflow-x-hidden p-6">
        <Card className="glass-pill w-full max-w-md space-y-4 rounded-3xl p-8 text-center">
          <p className="text-muted">请先登录以管理主机</p>
          <Link href="/">
            <Button className="w-full rounded-xl py-2.5">去登录</Button>
          </Link>
          <Link href="/register" className="block text-sm text-brand-600 hover:underline">
            注册账号
          </Link>
        </Card>
      </main>
    );

  if (!me)
    return (
      <div className="grid min-h-screen place-items-center text-muted">
        加载中…
      </div>
    );

  return (
    <HostsView
      me={me}
      onLogout={() => {
        void mutate();
        router.push("/");
      }}
    />
  );
}

function HostsView({ me, onLogout }: { me: Me; onLogout: () => void }) {
  const { data: hosts, mutate } = useSWR<Host[]>("/api/hosts", () => listHosts());

  return (
    <main className="w-full max-w-full overflow-x-hidden">
      <TopBar
        right={
          <>
            <Link href="/tokens">
              <Button variant="ghost" size="sm">
                密钥
              </Button>
            </Link>
            <Link href="/docs">
              <Button variant="ghost" size="sm">
                文档
              </Button>
            </Link>
            <span className="hidden px-2 text-sm text-muted sm:inline">
              {me.username}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={async () => {
                await logout();
                onLogout();
              }}
            >
              退出
            </Button>
          </>
        }
      />

      <section className="mx-auto max-w-6xl px-5 pb-16 pt-12 md:pt-16">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="display-title max-w-6xl text-[var(--text)]">我的主机</h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed text-muted">
              每台主机承载多个 Bot。本机由管理员持有，远程经配对码接入后一键同步发现。
            </p>
          </div>
          <AddRemoteDialog onDone={() => void mutate()} />
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2">
          {(hosts ?? []).map((h) => (
            <HostCard key={h.id} host={h} onDelete={() => void mutate()} />
          ))}
          {hosts && hosts.length === 0 && (
            <Card className="glass-pill col-span-full rounded-3xl py-20 text-center">
              <p className="text-lg text-muted">暂无远程主机</p>
              <p className="mt-2 text-sm text-muted">
                点击「添加远程主机」生成配对码，在远程 gateway 完成 approve。
              </p>
            </Card>
          )}
        </div>
      </section>

      <CapabilityMarquee />
      <FeatureBento />

      <footer className="border-t border-[var(--border)] py-32 md:py-40">
        <div className="mx-auto max-w-6xl px-5 text-center">
          <h2 className="display-title max-w-5xl mx-auto text-[var(--text)]">
            准备好扩展你的 Bot 舰队了吗
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted">
            配对一台远程 gateway，同步账号，即刻在统一控制台管理登录与 Shell。
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <AddRemoteDialog onDone={() => void mutate()} triggerLabel="添加远程主机" />
            <Link href="/docs">
              <Button variant="secondary" className="rounded-xl px-6 py-2.5">
                阅读文档
              </Button>
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

function HostCard({
  host: h,
  onDelete,
}: {
  host: Host;
  onDelete: () => void;
}) {
  return (
    <Card
      padded={false}
      className="group glass-pill overflow-hidden rounded-3xl transition-transform duration-500 hover:-translate-y-1"
    >
      <div className="relative overflow-hidden p-6">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.12] transition-transform duration-700 ease-out group-hover:scale-105"
          style={{
            backgroundImage: `url(https://picsum.photos/seed/host-${h.id}/800/600)`,
            filter: "grayscale(60%) contrast(120%)",
          }}
        />
        <div className="relative space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight">{h.name}</h2>
                {h.is_local && <Badge tone="brand">本机</Badge>}
                <HostStatusBadge status={h.status} />
              </div>
              <p className="mt-2 font-mono text-xs text-muted">{h.base_url}</p>
            </div>
            {!h.is_local && (
              <Button
                variant="danger"
                size="sm"
                onClick={async () => {
                  if (!confirm(`删除主机 ${h.name}？`)) return;
                  await deleteHost(h.id);
                  onDelete();
                }}
              >
                删除
              </Button>
            )}
          </div>
          <p className="text-sm text-muted">{h.instance_count} 个 Bot 实例</p>
          <div className="flex gap-2">
            <Link href={`/hosts/${h.id}`}>
              <Button size="sm" className="rounded-lg">
                管理实例
              </Button>
            </Link>
            <Link href={`/hosts/${h.id}/shell`}>
              <Button variant="secondary" size="sm" className="rounded-lg">
                Shell
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </Card>
  );
}

function HostStatusBadge({ status }: { status: Host["status"] }) {
  if (status === "online") return <Badge tone="green">在线</Badge>;
  if (status === "offline") return <Badge tone="neutral">离线</Badge>;
  return <Badge tone="neutral">未知</Badge>;
}

function AddRemoteDialog({
  onDone,
  triggerLabel = "添加远程主机",
}: {
  onDone: () => void;
  triggerLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pairing, setPairing] = useState<{
    code: string;
    master_url: string;
    expires_at: string;
  } | null>(null);

  const start = async () => {
    setPairing(await createPairing());
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) void start();
        else setPairing(null);
      }}
    >
      <Dialog.Trigger asChild>
        <Button className="rounded-xl px-5 py-2.5">{triggerLabel}</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/60 backdrop-blur-md" />
        <Dialog.Content className="glass-pill fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 space-y-5 rounded-3xl p-8 shadow-2xl">
          <Dialog.Title className="text-xl font-semibold tracking-tight">
            配对远程主机
          </Dialog.Title>
          {pairing ? (
            <div className="space-y-4 text-sm">
              <p className="text-muted">在远程机器执行（需已 init gateway）：</p>
              <code className="block rounded-xl surface-2 p-4 font-mono text-xs leading-relaxed">
                icqq-gateway host approve {pairing.master_url} {pairing.code}
              </code>
              <p className="text-muted">
                或让远程管理员登录后打开{" "}
                <Link href="/pair" className="font-medium text-brand-600 underline">
                  /pair
                </Link>{" "}
                页面。
              </p>
              <p className="text-xs text-muted">
                配对码{" "}
                <strong className="font-mono text-[var(--text)]">
                  {pairing.code}
                </strong>
                ，过期 {new Date(pairing.expires_at).toLocaleString()}
              </p>
              <Button
                className="w-full rounded-xl py-2.5"
                onClick={() => {
                  onDone();
                  setOpen(false);
                }}
              >
                我已在远程完成配对
              </Button>
            </div>
          ) : (
            <p className="text-muted">生成配对码中…</p>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
