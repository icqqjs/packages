"use client";

import Link from "next/link";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import type { ReactNode } from "react";
import { useRef } from "react";
import { FloatingNav } from "./nav";
import { Button } from "./ui";

type AuthLayoutProps = {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
};

export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const formRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.from(heroRef.current, { opacity: 0, x: -48, duration: 1 })
        .from(
          imageRef.current,
          { opacity: 0, scale: 0.82, y: 40, duration: 1.1 },
          "-=0.7",
        )
        .from(formRef.current, { opacity: 0, y: 28, duration: 0.85 }, "-=0.55");
    },
    { scope: rootRef },
  );

  return (
    <main
      ref={rootRef}
      className="relative min-h-screen w-full max-w-full overflow-x-hidden"
    >
      <FloatingNav
        right={
          <>
            <Link href="/docs">
              <Button variant="ghost" size="sm">
                文档
              </Button>
            </Link>
          </>
        }
      />

      <section className="relative mx-auto flex min-h-screen max-w-7xl flex-col gap-12 px-5 pb-20 pt-28 lg:flex-row lg:items-center lg:gap-16 lg:pb-0 lg:pt-24">
        <div ref={heroRef} className="relative z-10 flex-1 lg:max-w-3xl">
          <h1 className="display-title max-w-6xl text-[var(--text)]">
            {title}
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
            {subtitle}
          </p>
        </div>

        <div
          ref={imageRef}
          className="pointer-events-none absolute bottom-0 right-0 z-0 hidden h-[min(52vh,520px)] w-[min(46vw,520px)] overflow-hidden rounded-[2rem] opacity-90 lg:block"
          aria-hidden
        >
          <div
            className="h-full w-full scale-100 bg-cover bg-center transition-transform duration-700 ease-out"
            style={{
              backgroundImage:
                "url(https://picsum.photos/seed/icqq-gateway/1200/1400)",
              filter: "grayscale(35%) contrast(125%)",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[var(--bg)] via-transparent to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent to-[var(--bg)]/40" />
        </div>

        <div ref={formRef} className="relative z-20 w-full max-w-md shrink-0 lg:mr-4">
          <div className="glass-pill rounded-3xl p-8 shadow-2xl shadow-brand-600/10">
            {children}
          </div>
          <div className="mt-5 text-center text-sm text-muted">{footer}</div>
        </div>
      </section>
    </main>
  );
}
