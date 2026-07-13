"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { login } from "./lib/api";
import { AuthLayout } from "./components/auth-layout";
import { Button, Field, Input } from "./components/ui";

export default function Page() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setErr("");
    try {
      const me = await login(username, password);
      router.push(me.mustChangePassword ? "/change-password" : "/hosts");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="多机 Bot，一处掌控"
      subtitle="跨主机发现、建号与登录向导。本机与远程 gateway 统一控制面，MCP 与 RPC 集中暴露。"
      footer={
        <span className="text-sm text-muted">
          默认关闭自助注册，请联系管理员开通账号
        </span>
      }
    >
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">登录控制台</h2>
          <p className="mt-1 text-sm text-muted">管理你的主机与 Bot 实例</p>
        </div>
        <Field label="用户名">
          <Input
            value={username}
            autoFocus
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && void submit()}
          />
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
          disabled={busy || !username || !password}
          onClick={() => void submit()}
        >
          {busy ? "登录中…" : "进入控制台"}
        </Button>
      </div>
    </AuthLayout>
  );
}
