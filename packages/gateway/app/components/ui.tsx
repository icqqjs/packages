"use client";

import { clsx } from "clsx";
import { useState } from "react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type ButtonSize = "sm" | "md";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-xl font-medium transition-all duration-300 outline-none",
        "focus-visible:ring-2 focus-visible:ring-brand-500/50 disabled:pointer-events-none disabled:opacity-50",
        size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm",
        variant === "primary" &&
          "bg-brand-600 text-white shadow-sm shadow-brand-600/25 hover:bg-brand-500 active:scale-[0.98]",
        variant === "secondary" &&
          "surface-2 text-[var(--text)] border border-[var(--border)] hover:border-brand-400/60",
        variant === "ghost" &&
          "bg-transparent text-muted hover:surface-2 hover:text-[var(--text)]",
        variant === "outline" &&
          "border border-brand-500/40 text-brand-600 hover:bg-brand-500/10",
        variant === "danger" &&
          "bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white",
        className,
      )}
      {...props}
    />
  );
}

export function Input({
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={clsx(
        "w-full rounded-xl border border-[var(--border)] surface px-3.5 py-2.5 text-sm text-[var(--text)]",
        "placeholder:text-muted outline-none transition",
        "focus:border-brand-400 focus:ring-4 focus:ring-brand-500/10",
        className,
      )}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-muted">{label}</span>
      {children}
      {hint ? <span className="block text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

export function Card({
  children,
  className,
  padded = true,
}: {
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <div
      className={clsx(
        "surface rounded-2xl border border-[var(--border)] shadow-lg shadow-black/[0.04]",
        padded && "p-5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "brand" | "green" | "amber";
}) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        tone === "neutral" && "surface-2 text-muted ring-[var(--border)]",
        tone === "brand" && "bg-brand-500/10 text-brand-600 ring-brand-500/20",
        tone === "green" &&
          "bg-emerald-500/10 text-emerald-600 ring-emerald-500/20",
        tone === "amber" && "bg-amber-500/10 text-amber-600 ring-amber-500/20",
      )}
    >
      {children}
    </span>
  );
}

function CopyIcon({ done }: { done: boolean }) {
  return done ? (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 6L9 17l-5-5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ) : (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect
        x="9"
        y="9"
        width="11"
        height="11"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M5 15V5a2 2 0 012-2h10"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function CopyButton({
  value,
  label = "复制",
  className,
}: {
  value: string;
  label?: string;
  className?: string;
}) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(value).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        });
      }}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium",
        "text-muted transition hover:surface-2 hover:text-[var(--text)]",
        className,
      )}
    >
      <CopyIcon done={done} />
      {done ? "已复制" : label}
    </button>
  );
}

export function CodeBlock({
  code,
  lang,
}: {
  code: string;
  lang?: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-[var(--border)] surface-2">
      {lang ? (
        <div className="flex items-center justify-between border-b border-[var(--border)] px-3 py-1.5">
          <span className="text-xs font-medium text-muted">{lang}</span>
          <CopyButton value={code} />
        </div>
      ) : (
        <div className="absolute right-2 top-2 opacity-0 transition group-hover:opacity-100">
          <CopyButton value={code} />
        </div>
      )}
      <pre className="overflow-x-auto p-4 text-[13px] leading-relaxed">
        <code className="font-mono text-[var(--text)]">{code}</code>
      </pre>
    </div>
  );
}
