"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { approvePairingRemote, fetcher, type Me } from "../lib/api";
import { Button, Card, Field, Input } from "../components/ui";
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
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (error) router.replace("/");
  }, [error, router]);

  if (error) return null;
  if (!me) {
    return (
      <div className="grid min-h-screen place-items-center text-muted">
        加载中…
      </div>
    );
  }
  if (me.role !== "admin") {
    return (
      <div className="grid min-h-screen place-items-center p-4">
        <Card className="w-full max-w-md p-6 text-center text-sm text-red-500">
          需要管理员权限才能接受主机配对
        </Card>
      </div>
    );
  }

  const submit = async () => {
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
    }
  };

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <Card className="w-full max-w-md space-y-4">
        <div className="flex items-center gap-3">
          <Logo />
          <div>
            <h1 className="font-semibold">接受主机配对</h1>
            <p className="text-xs text-muted">将本机注册到主控 gateway</p>
          </div>
        </div>
        {done ? (
          <p className="text-sm text-emerald-600">配对成功，可关闭此页面。</p>
        ) : (
          <>
            <Field label="主控 URL">
              <Input
                placeholder="http://192.168.1.10:8787"
                value={masterUrl}
                onChange={(e) => setMasterUrl(e.target.value)}
              />
            </Field>
            <Field label="配对码">
              <Input
                placeholder="A1B2C3D4"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </Field>
            <Field label="本机对外 URL（可选）" hint="主控访问本机 host-agent 的地址">
              <Input
                placeholder="http://本机IP:8787"
                value={remoteBase}
                onChange={(e) => setRemoteBase(e.target.value)}
              />
            </Field>
            <Field label="主机名称（可选）">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            {err && (
              <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
                {err}
              </p>
            )}
            <Button className="w-full" onClick={() => void submit()}>
              确认配对
            </Button>
          </>
        )}
      </Card>
    </div>
  );
}
