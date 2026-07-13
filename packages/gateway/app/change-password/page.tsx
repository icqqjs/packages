"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { changePassword } from "../lib/api";
import { AuthLayout } from "../components/auth-layout";
import { Button, Field, Input } from "../components/ui";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (newPassword.length < 6) {
      setErr("新密码至少 6 位");
      return;
    }
    if (newPassword !== confirm) {
      setErr("两次输入的新密码不一致");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      await changePassword(currentPassword, newPassword);
      router.push("/hosts");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="首次登录需修改密码"
      subtitle="系统已为管理员生成临时密码，请设置你自己的强密码后继续。"
      footer={
        <Link href="/" className="font-medium text-brand-600 hover:underline">
          返回登录
        </Link>
      }
    >
      <div className="space-y-5">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">修改密码</h2>
          <p className="mt-1 text-sm text-muted">修改完成后将进入控制台</p>
        </div>
        <Field label="当前密码">
          <Input
            type="password"
            autoFocus
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </Field>
        <Field label="新密码">
          <Input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
          />
        </Field>
        <Field label="确认新密码">
          <Input
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
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
          disabled={busy || !currentPassword || !newPassword || !confirm}
          onClick={() => void submit()}
        >
          {busy ? "保存中…" : "保存并继续"}
        </Button>
      </div>
    </AuthLayout>
  );
}
