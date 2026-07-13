"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  getLoginState,
  sendLoginSms,
  submitLogin,
  type LoginStateView,
} from "../lib/api";
import { Badge, Button, Input } from "./ui";

function Spinner() {
  return (
    <span className="inline-block size-4 animate-spin rounded-full border-2 border-brand-500/30 border-t-brand-500" />
  );
}

/**
 * 轮询某个本地实例的登录态并渲染对应的交互（扫码/滑块/短信/设备锁）。
 * 上线后回调 onOnline。
 */
export function LoginFlowPanel({
  instanceId,
  onOnline,
}: {
  instanceId: string;
  onOnline?: () => void;
}) {
  const { data, mutate } = useSWR<LoginStateView>(
    `login:${instanceId}`,
    () => getLoginState(instanceId),
    { refreshInterval: 2000, revalidateOnFocus: true },
  );
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  if (!data) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-muted">
        <Spinner /> 正在读取登录状态…
      </div>
    );
  }

  if (data.state === "online" || data.phase === "online") {
    onOnline?.();
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <div className="grid size-11 place-items-center rounded-full bg-emerald-500/10 text-emerald-600">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path
              d="M20 6L9 17l-5-5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <p className="text-sm font-medium">登录成功{data.nickname ? `：${data.nickname}` : ""}</p>
      </div>
    );
  }

  if (data.state === "offline" || data.state === "daemon_down") {
    return (
      <div className="space-y-3 py-4">
        <p className="text-sm text-muted">
          {data.error ?? "daemon 未运行或已退出。可尝试恢复登录。"}
        </p>
        {data.logTail ? (
          <pre className="max-h-48 overflow-auto rounded-lg surface-2 p-3 text-xs">
            {data.logTail}
          </pre>
        ) : null}
      </div>
    );
  }

  const doSubmit = async (kind: string, v?: string) => {
    setBusy(true);
    setErr("");
    try {
      const r = await submitLogin(instanceId, kind, v);
      if (!r.ok) setErr(r.error ?? "提交失败");
      setValue("");
      await mutate();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <PhaseBadge phase={data.phase} />
        {data.detail ? (
          <span className="text-xs text-muted">{data.detail}</span>
        ) : null}
      </div>

      {data.phase === "qrcode" && (
        <div className="flex flex-col items-center gap-3">
          {data.qrcodeDataUrl ? (
            <img
              src={data.qrcodeDataUrl}
              alt="登录二维码"
              className="size-48 rounded-xl border border-[var(--border)] bg-white p-2"
            />
          ) : (
            <div className="flex size-48 items-center justify-center rounded-xl border border-[var(--border)] surface-2">
              <Spinner />
            </div>
          )}
          <p className="text-sm text-muted">请用手机 QQ 扫码并确认登录</p>
        </div>
      )}

      {data.phase === "slider" && (
        <div className="space-y-2">
          <p className="text-sm text-muted">
            需要滑块验证。打开链接完成验证后，把返回的 ticket 粘贴到下方。
          </p>
          {data.sliderUrl && (
            <a
              href={data.sliderUrl}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-sm text-brand-600 underline"
            >
              {data.sliderUrl}
            </a>
          )}
          <Input
            placeholder="粘贴 ticket"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
          <Button
            disabled={busy || !value}
            onClick={() => void doSubmit("slider", value)}
          >
            提交 ticket
          </Button>
        </div>
      )}

      {data.phase === "device" && (
        <div className="space-y-2">
          <p className="text-sm text-muted">
            需要设备锁验证{data.devicePhone ? `（手机尾号 ${data.devicePhone}）` : ""}。
          </p>
          {data.deviceUrl && (
            <a
              href={data.deviceUrl}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-sm text-brand-600 underline"
            >
              {data.deviceUrl}
            </a>
          )}
          <div className="flex gap-2">
            <Input
              placeholder="短信验证码"
              value={value}
              onChange={(e) => setValue(e.target.value)}
            />
            <Button
              variant="secondary"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await sendLoginSms(instanceId);
                } finally {
                  setBusy(false);
                }
              }}
            >
              发送短信
            </Button>
          </div>
          <div className="flex gap-2">
            <Button
              disabled={busy || !value}
              onClick={() => void doSubmit("sms", value)}
            >
              提交验证码
            </Button>
            <Button
              variant="ghost"
              disabled={busy}
              onClick={() => void doSubmit("continue")}
            >
              我已完成网页验证
            </Button>
          </div>
        </div>
      )}

      {data.phase === "auth" && (
        <div className="space-y-2">
          <p className="text-sm text-muted">需要设备/账号验证，请打开链接完成后继续。</p>
          {data.authUrl && (
            <a
              href={data.authUrl}
              target="_blank"
              rel="noreferrer"
              className="block truncate text-sm text-brand-600 underline"
            >
              {data.authUrl}
            </a>
          )}
          <Button disabled={busy} onClick={() => void doSubmit("auth")}>
            我已完成验证
          </Button>
        </div>
      )}

      {(data.phase === "connecting" || !data.phase) && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted">
          <Spinner /> 正在连接服务器…
        </div>
      )}

      {data.phase === "error" && (
        <div className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {data.lastError ?? "登录失败"}
        </div>
      )}

      {err && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">
          {err}
        </p>
      )}
    </div>
  );
}

function PhaseBadge({ phase }: { phase?: string }) {
  const map: Record<string, { tone: "brand" | "amber" | "green"; label: string }> = {
    connecting: { tone: "brand", label: "连接中" },
    qrcode: { tone: "brand", label: "待扫码" },
    slider: { tone: "amber", label: "滑块验证" },
    device: { tone: "amber", label: "设备锁" },
    auth: { tone: "amber", label: "需验证" },
    online: { tone: "green", label: "已上线" },
  };
  const m = phase ? map[phase] : undefined;
  return <Badge tone={m?.tone ?? "neutral"}>{m?.label ?? "登录中"}</Badge>;
}
