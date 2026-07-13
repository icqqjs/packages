"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, type ChangeEvent } from "react";
import useSWR from "swr";
import * as Dialog from "@radix-ui/react-dialog";
import {
  createLocalOnHost,
  deleteInstance,
  fetcher,
  getInstanceStatus,
  listHosts,
  reloginInstance,
  setHostProxyDataPlane,
  syncHost,
  type Host,
  type Instance,
  type LoginStateView,
  type Me,
} from "../../lib/api";
import { Badge, Button, Card, CopyButton, Field, Input } from "../../components/ui";
import { TopBar } from "../../components/nav";
import { LoginFlowPanel } from "../../components/login-flow";

export default function HostDetailPage() {
  const params = useParams();
  const hostId = String(params.id);
  const { data: me, error } = useSWR<Me>("/api/me", fetcher, {
    shouldRetryOnError: false,
  });
  const { data: hosts } = useSWR<Host[]>("/api/hosts", () => listHosts());
  const host = hosts?.find((h) => h.id === hostId);
  const { data: instances, mutate } = useSWR<Instance[]>(
    "/api/instances",
    fetcher,
  );
  const hostInstances = (instances ?? []).filter((i) => i.host_id === hostId);

  if (error)
    return (
      <div className="p-8 text-center">
        <Link href="/">去登录</Link>
      </div>
    );
  if (!me || !host)
    return <div className="p-8 text-center text-muted">加载中…</div>;

  const origin = typeof window !== "undefined" ? window.location.origin : "";

  return (
    <div className="min-h-screen">
      <TopBar
        right={
          <Link href="/hosts">
            <Button variant="ghost" size="sm">
              返回主机列表
            </Button>
          </Link>
        }
      />
      <main className="mx-auto max-w-5xl space-y-6 px-5 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {host.name}
              {host.is_local && (
                <Badge tone="brand">
                  本机
                </Badge>
              )}
            </h1>
            <p className="mt-1 font-mono text-xs text-muted">{host.base_url}</p>
            {!host.is_local && (
              <label className="mt-3 flex items-center gap-2 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={Boolean(host.proxy_data_plane)}
                  onChange={async (e) => {
                    await setHostProxyDataPlane(hostId, e.target.checked);
                    window.location.reload();
                  }}
                />
                启用远程 MCP/RPC 数据面代理（默认关闭，开启后主控可代理访问）
              </label>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                await syncHost(hostId);
                void mutate();
              }}
            >
              同步发现
            </Button>
            <AddLocalDialog hostId={hostId} onDone={() => void mutate()} />
            <Link href={`/hosts/${hostId}/shell`}>
              <Button variant="outline">打开 Shell</Button>
            </Link>
          </div>
        </div>

        <Card padded={false}>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-muted">
                <th className="px-5 py-3">UIN</th>
                <th className="px-5 py-3">状态</th>
                <th className="px-5 py-3">备注</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody>
              {hostInstances.map((i) => (
                <tr key={i.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-5 py-3 font-mono">{i.uin}</td>
                  <td className="px-5 py-3">
                    <StatusCell instance={i} />
                  </td>
                  <td className="px-5 py-3 text-muted">{i.label ?? "—"}</td>
                  <td className="px-5 py-3 text-right">
                    <div className="flex justify-end gap-1">
                      {host.is_local && (
                        <>
                          <CopyButton label="MCP" value={`${origin}/${i.uin}/mcp`} />
                          <CopyButton
                            label="RPC"
                            value={`${origin.replace(/^http/, "ws")}/${i.uin}/rpc`}
                          />
                        </>
                      )}
                      <ReloginDialog instance={i} onDone={() => void mutate()} />
                      <Button
                        variant="danger"
                        size="sm"
                        onClick={async () => {
                          await deleteInstance(i.id);
                          void mutate();
                        }}
                      >
                        删除
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
              {hostInstances.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-12 text-center text-muted">
                    暂无实例，点击「添加本地实例」或「同步发现」
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      </main>
    </div>
  );
}

function StatusCell({ instance }: { instance: Instance }) {
  const { data } = useSWR<LoginStateView>(
    `status:${instance.id}`,
    () => getInstanceStatus(instance.id),
    { refreshInterval: 5000 },
  );
  if (!data) return <span className="text-muted">…</span>;
  if (data.state === "online")
    return (
      <span className="text-emerald-600">
        在线{data.nickname ? ` · ${data.nickname}` : ""}
      </span>
    );
  if (data.state === "login_waiting")
    return <span className="text-amber-600">登录中</span>;
  if (data.state === "daemon_down")
    return <span className="text-red-500">daemon 异常</span>;
  return <span className="text-muted">{data.state}</span>;
}

function ReloginDialog({
  instance,
  onDone,
}: {
  instance: Instance;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [started, setStarted] = useState(false);
  const [err, setErr] = useState("");
  const [boot, setBoot] = useState<LoginStateView | null>(null);

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button variant="outline" size="sm">
          恢复登录
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="surface fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto space-y-4 rounded-2xl border border-[var(--border)] p-6 shadow-2xl">
          <Dialog.Title className="text-lg font-semibold">
            恢复登录 · {instance.uin}
          </Dialog.Title>
          {!started ? (
            <>
              <p className="text-sm text-muted">
                重新拉起 daemon；有有效登录态将自动恢复，否则进入验证流程。
              </p>
              {err && (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
                  {err}
                </p>
              )}
              <Button
                onClick={async () => {
                  setErr("");
                  try {
                    const r = await reloginInstance(instance.id);
                    setBoot(r);
                    if (r.state === "daemon_down" || r.error) {
                      setErr(r.error ?? "daemon 启动失败");
                    } else {
                      setStarted(true);
                    }
                  } catch (e) {
                    setErr(e instanceof Error ? e.message : String(e));
                  }
                }}
              >
                开始恢复
              </Button>
              {boot?.logTail && (
                <pre className="max-h-40 overflow-auto rounded-lg surface-2 p-3 text-xs">
                  {boot.logTail}
                </pre>
              )}
            </>
          ) : (
            <LoginFlowPanel instanceId={instance.id} onOnline={onDone} />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function AddLocalDialog({
  hostId,
  onDone,
}: {
  hostId: string;
  onDone: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [uin, setUin] = useState("");
  const [platform, setPlatform] = useState("1");
  const [label, setLabel] = useState("");
  const [instanceId, setInstanceId] = useState<string | null>(null);
  const [err, setErr] = useState("");
  const [bootErr, setBootErr] = useState<LoginStateView | null>(null);

  const create = async () => {
    setErr("");
    setBootErr(null);
    try {
      const r = await createLocalOnHost(hostId, {
        uin: Number(uin),
        platform: Number(platform),
        label: label || undefined,
      });
      if (r.state === "daemon_down" || r.error) {
        setBootErr(r);
        setErr(r.error ?? "daemon 启动失败");
        return;
      }
      setInstanceId(r.id);
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button>添加本地实例</Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
        <Dialog.Content className="surface fixed left-1/2 top-1/2 z-50 max-h-[90vh] w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto space-y-4 rounded-2xl border border-[var(--border)] p-6 shadow-2xl">
          <Dialog.Title className="text-lg font-semibold">添加本地实例</Dialog.Title>
          {!instanceId ? (
            <div className="space-y-3">
              <Field label="UIN">
                <Input value={uin} onChange={(e: ChangeEvent<HTMLInputElement>) => setUin(e.target.value)} />
              </Field>
              <Field label="平台">
                <Input value={platform} onChange={(e: ChangeEvent<HTMLInputElement>) => setPlatform(e.target.value)} />
              </Field>
              <Field label="备注">
                <Input value={label} onChange={(e: ChangeEvent<HTMLInputElement>) => setLabel(e.target.value)} />
              </Field>
              {err && (
                <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
                  {err}
                </p>
              )}
              {bootErr?.logTail && (
                <pre className="max-h-40 overflow-auto rounded-lg surface-2 p-3 text-xs">
                  {bootErr.logTail}
                </pre>
              )}
              <Button onClick={() => void create()} disabled={!uin}>
                创建并登录
              </Button>
            </div>
          ) : (
            <LoginFlowPanel instanceId={instanceId} onOnline={onDone} />
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
