"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export function Logo({ size = 30 }: { size?: number }) {
  return (
    <span
      className="grid place-items-center rounded-xl bg-brand-600 text-white shadow-lg shadow-brand-600/35"
      style={{ width: size, height: size }}
    >
      <svg
        width={size * 0.6}
        height={size * 0.6}
        viewBox="0 0 24 24"
        fill="none"
        aria-hidden
      >
        <path
          d="M12 2.5c-4.7 0-8 3-8 7.2 0 2.3 1.1 4.2 2.9 5.5-.2 1-.7 2.1-1.6 3.1-.3.3-.1.9.4.8 1.7-.3 3-.9 3.9-1.6.8.2 1.6.3 2.4.3 4.7 0 8-3 8-7.2S16.7 2.5 12 2.5z"
          fill="currentColor"
        />
        <circle cx="9" cy="9.6" r="1.1" fill="var(--color-brand-600)" />
        <circle cx="15" cy="9.6" r="1.1" fill="var(--color-brand-600)" />
      </svg>
    </span>
  );
}

export function FloatingNav({ right }: { right?: ReactNode }) {
  return (
    <header className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-5">
      <div className="glass-pill flex w-full max-w-5xl items-center justify-between gap-3 rounded-2xl px-4 py-2.5">
        <Link href="/hosts" className="flex items-center gap-2.5">
          <Logo size={34} />
          <span className="hidden flex-col leading-none sm:flex">
            <span className="text-sm font-semibold tracking-tight">icqq gateway</span>
            <span className="text-[11px] text-muted">多 Bot 共享网关</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1">{right}</nav>
      </div>
    </header>
  );
}

export function TopBar({ right }: { right?: ReactNode }) {
  return (
    <header className="sticky top-0 z-30 px-4 pt-4">
      <div className="glass-pill mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 rounded-2xl px-4">
        <Link href="/hosts" className="flex items-center gap-2.5">
          <Logo />
          <span className="flex flex-col leading-none">
            <span className="text-sm font-semibold tracking-tight">icqq gateway</span>
            <span className="text-[11px] text-muted">多 Bot 共享网关</span>
          </span>
        </Link>
        <nav className="flex items-center gap-1">{right}</nav>
      </div>
    </header>
  );
}
