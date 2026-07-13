"use client";

import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";
import * as Dialog from "@radix-ui/react-dialog";
import {
  createToken,
  deleteToken,
  fetcher,
  listTokens,
  type ApiToken,
  type Me,
} from "../lib/api";
import { Badge, Button, Card, CopyButton, Field, Input } from "../components/ui";
import { TopBar } from "../components/nav";

export default function TokensPage() {
  const { data: me, error } = useSWR<Me>("/api/me", fetcher, {
    shouldRetryOnError: false,
  });

  if (error)
    return (
      <div className="grid min-h-screen place-items-center gap-3 text-center">
        <p className="text-sm text-muted">请先登录</p>
        <Link href="/">
          <Button>去登录</Button>
        </Link>
      </div>
    );
  if (!me)
    return (
      <div className="grid min-h-screen place-items-center text-sm text-muted">
        加载中…
      </div>
    );

  return <TokensView />;
}

function TokensView() {
  const { data: tokens, mutate } = useSWR<ApiToken[]>("/api/tokens", () =>
    listTokens(),
  );

  return (
    <div className="min-h-screen">
      <TopBar
        right={
          <>
            <Link href="/hosts">
              <Button variant="ghost" size="sm">
                主机
              </Button>
            </Link>
            <Link href="/docs">
              <Button variant="ghost" size="sm">
                文档
              </Button>
            </Link>
          </>
        }
      />

      <main className="mx-auto max-w-3xl space-y-6 px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">API 密钥</h1>
            <p className="mt-1 text-sm text-muted">
              用于 MCP 与 RPC 鉴权。密钥仅在创建时完整显示一次，之后只保留掩码。
            </p>
          </div>
          <CreateTokenDialog onDone={() => void mutate()} />
        </div>

        <Card padded={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-muted">
                  <th className="px-5 py-3 font-medium">密钥</th>
                  <th className="px-5 py-3 font-medium">备注</th>
                  <th className="px-5 py-3 font-medium">创建时间</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {(tokens ?? []).map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-[var(--border)] last:border-0 transition hover:surface-2"
                  >
                    <td className="px-5 py-3.5 font-mono">{t.masked}</td>
                    <td className="px-5 py-3.5 text-muted">{t.label ?? "—"}</td>
                    <td className="px-5 py-3.5 text-xs text-muted">
                      {new Date(t.created_at).toLocaleString()}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={async () => {
                          if (!confirm(`销毁密钥 ${t.masked}？此操作不可撤销。`))
                            return;
                          await deleteToken(t.id);
                          void mutate();
                        }}
                      >
                        销毁
                      </Button>
                    </td>
                  </tr>
                ))}
                {tokens && tokens.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-16 text-center">
                      <p className="text-sm font-medium">还没有密钥</p>
                      <p className="mt-1 text-xs text-muted">
                        点击右上角「新建密钥」生成第一个。
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </div>
  );
}

function CreateTokenDialog({ onDone }: { onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [created, setCreated] = useState<string | null>(null);
  const [err, setErr] = useState("");

  const reset = () => {
    setLabel("");
    setCreated(null);
    setErr("");
  };

  const submit = async () => {
    setErr("");
    try {
      const { token } = await createToken(label || undefined);
      setCreated(token);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) reset();
      }}
    >
      <Dialog.Trigger asChild>
        <Button>新建密钥</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="surface fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 space-y-4 rounded-2xl border border-[var(--border)] p-6 shadow-2xl">
          <Dialog.Title className="text-lg font-semibold tracking-tight">
            新建 API 密钥
          </Dialog.Title>

          {!created ? (
            <>
              <Field label="备注（可选）" hint="用于区分用途，例如 “n8n 集成”。">
                <Input
                  placeholder="例如：本地脚本"
                  value={label}
                  autoFocus
                  onChange={(e) => setLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void submit()}
                />
              </Field>
              {err && (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
                  {err}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <Dialog.Close asChild>
                  <Button variant="ghost">取消</Button>
                </Dialog.Close>
                <Button onClick={() => void submit()}>生成</Button>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <p className="flex items-center gap-2 text-sm">
                密钥已生成 <Badge tone="amber">仅显示一次</Badge>
              </p>
              <div className="flex items-center gap-2 rounded-lg surface-2 p-3">
                <code className="min-w-0 flex-1 break-all font-mono text-sm">
                  {created}
                </code>
                <CopyButton value={created} className="shrink-0" />
              </div>
              <p className="text-xs text-muted">
                请立即复制并妥善保存，关闭后将无法再次查看完整密钥。
              </p>
              <div className="flex justify-end">
                <Dialog.Close asChild>
                  <Button>完成</Button>
                </Dialog.Close>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
