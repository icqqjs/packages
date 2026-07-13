"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { isRegistrationEnabled, register } from "../lib/api";
import { AuthLayout } from "../components/auth-layout";
import { Button, Field, Input } from "../components/ui";

export default function RegisterPage() {
  const router = useRouter();
  const { data: reg } = useSWR("register-enabled", () => isRegistrationEnabled());
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (reg && !reg.enabled) {
      setErr("注册已关闭，请联系管理员");
    }
  }, [reg]);

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      await register(username, password);
      router.push("/hosts");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="为你的 Bot 舰队开港"
      subtitle="管理员开启注册后，可按 owner 隔离主机与实例。"
      footer={
        <>
          已有账号？{" "}
          <Link href="/" className="font-medium text-brand-600 hover:underline">
            去登录
          </Link>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">创建账号</h2>
          <p className="mt-1 text-sm text-muted">密码至少 6 位</p>
        </div>
        <Field label="用户名">
          <Input value={username} onChange={(e) => setUsername(e.target.value)} />
        </Field>
        <Field label="密码">
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
          />
        </Field>
        {err && (
          <p className="rounded-xl bg-red-500/10 px-3 py-2.5 text-sm text-red-500">
            {err}
          </p>
        )}
        <Button
          className="w-full rounded-xl py-2.5"
          disabled={busy || !username || password.length < 6 || reg?.enabled === false}
          onClick={() => void submit()}
        >
          {busy ? "注册中…" : "创建并进入"}
        </Button>
      </div>
    </AuthLayout>
  );
}
