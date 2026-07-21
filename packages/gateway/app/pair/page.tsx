"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { approvePairingRemote, fetcher, type Me } from "../lib/api";
import {
  Button,
  Card,
  ErrorText,
  Field,
  Input,
  Skeleton,
} from "../components/ui";
import { Logo } from "../components/nav";

/** 远程 gateway 配对页（需管理员登录） */
export default function PairPage() {
  const router = useRouter();
  const { data: me, error } = useSWR<Me>("/api/me", fetcher, {
    shouldRetryOnError: false,
  });
  const [masterUrl, setMasterUrl] = useState("");
  const [code, setCode] = useState("");
  const [remoteBase, setRemoteBase] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (error) router.replace("/");
  }, [error, router]);

  if (error) return null;
  if (!me) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <Skeleton className="h-8 w-40" />
      </div>
    );
  }
  if (me.role !== "admin") {
    return (
      <div className="grid min-h-dvh place-items-center p-4">
        <Card className="w-full max-w-md p-6 text-center text-sm text-red-500">
          需要管理员权限才能接受主机配对
        </Card>
      </div>
    );
  }

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      await approvePairingRemote({
        master_url: masterUrl,
        code: code.toUpperCase(),
        remote_base_url: remoteBase || undefined,
        name: name || undefined,
      });
      setDone(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-dvh place-items-center p-4">
      <Card className="glass-pill w-full max-w-md space-y-5 rounded-3xl p-8">
        <div className="flex items-center gap-3">
          <Logo size={38} />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">
              接受主机配对
            </h1>
            <p className="mt-0.5 text-xs text-muted">
              将本机注册到主控 gateway
            </p>
          </div>
        </div>
        {done ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <div className="grid size-11 place-items-center rounded-full bg-emerald-500/10 text-emerald-600">
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M20 6L9 17l-5-5" />
              </svg>
            </div>
            <p className="text-sm font-medium">配对成功</p>
            <p className="text-xs leading-5 text-muted">
              主控已登记本机，可关闭此页面。
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Field
              label="主控 URL"
              hint="主控经反向代理暴露时填域名，如 https://gw.example.com"
            >
              <Input
                placeholder="http://192.168.1.10:8787"
                inputMode="url"
                autoFocus
                value={masterUrl}
                onChange={(e) => setMasterUrl(e.target.value)}
              />
            </Field>
            <Field label="配对码">
              <Input
                placeholder="A1B2C3D4"
                className="font-mono uppercase tracking-[0.3em]"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && void submit()}
              />
            </Field>
            <Field
              label="本机对外 URL（可选）"
              hint="主控访问本机 host-agent 的地址；本机经反代暴露时填域名，留空则按本机监听地址上报"
            >
              <Input
                placeholder="http://本机IP:8787"
                inputMode="url"
                value={remoteBase}
                onChange={(e) => setRemoteBase(e.target.value)}
              />
            </Field>
            <Field label="主机名称（可选）">
              <Input
                placeholder="例如：家里 NAS"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </Field>
            {err && <ErrorText>{err}</ErrorText>}
            <Button
              className="w-full py-2.5"
              disabled={busy || !masterUrl || !code}
              onClick={() => void submit()}
            >
              {busy ? "配对中…" : "确认配对"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
