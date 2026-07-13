"use client";

import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useRef } from "react";

gsap.registerPlugin(ScrollTrigger);

const ITEMS = [
  "Host-Agent",
  "跨机配对",
  "Web Shell",
  "MCP 路由",
  "扫码登录",
  "实例同步",
  "Owner 隔离",
  "RPC 桥接",
];

export function CapabilityMarquee() {
  const trackRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    if (!trackRef.current) return;
    gsap.to(trackRef.current, {
      xPercent: -50,
      ease: "none",
      duration: 28,
      repeat: -1,
    });
  });

  const row = [...ITEMS, ...ITEMS];

  return (
    <section className="overflow-hidden border-y border-[var(--border)] py-10">
      <div ref={trackRef} className="flex w-max gap-12 whitespace-nowrap">
        {row.map((item, i) => (
          <span
            key={`${item}-${i}`}
            className="text-2xl font-medium tracking-tight text-muted md:text-3xl"
          >
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}

const FEATURES = [
  {
    title: "跨机控制面",
    body: "本机与远程 gateway 经 host-agent 统一发现、建号、恢复登录与日志 tail。",
    span: "col-span-2 row-span-2",
    image: "https://picsum.photos/seed/control-plane/900/900",
  },
  {
    title: "配对即上线",
    body: "主控生成短期码，远程 approve 回推 token，无需手填 RPC。",
    span: "col-span-2 row-span-1",
    image: "https://picsum.photos/seed/pairing/800/400",
  },
  {
    title: "Web Shell",
    body: "完整 PTY，本机与远程一致体验。",
    span: "col-span-1 row-span-1",
    image: "https://picsum.photos/seed/shell/500/500",
  },
  {
    title: "MCP / RPC",
    body: "本机 bot 集中暴露统一端点。",
    span: "col-span-1 row-span-1",
    image: "https://picsum.photos/seed/mcp-rpc/500/500",
  },
];

export function FeatureBento() {
  const sectionRef = useRef<HTMLElement>(null);
  const pinRef = useRef<HTMLDivElement>(null);
  const galleryRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      ScrollTrigger.create({
        trigger: sectionRef.current,
        start: "top top",
        end: "+=120%",
        pin: pinRef.current,
        pinSpacing: true,
      });

      galleryRef.current?.querySelectorAll("[data-bento-card]").forEach((card) => {
        gsap.fromTo(
          card,
          { scale: 0.88, opacity: 0.35 },
          {
            scale: 1,
            opacity: 1,
            scrollTrigger: {
              trigger: card,
              start: "top 85%",
              end: "top 35%",
              scrub: 0.6,
            },
          },
        );
      });
    },
    { scope: sectionRef },
  );

  return (
    <section ref={sectionRef} className="py-32 md:py-48">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <div ref={pinRef} className="lg:pt-8">
          <h2 className="display-title max-w-xl text-[var(--text)]">
            为运维而生的
            <span
              className="mx-2 inline-block h-10 w-24 translate-y-1 rounded-full bg-cover bg-center align-middle"
              style={{
                backgroundImage: "url(https://picsum.photos/seed/ops/200/80)",
                filter: "grayscale(40%) contrast(120%)",
              }}
            />
            能力矩阵
          </h2>
          <p className="mt-6 max-w-md text-base leading-relaxed text-muted">
            控制面跨机，数据面本机集中。每一格能力都对应真实 API，不是演示幻灯片。
          </p>
        </div>

        <div
          ref={galleryRef}
          className="grid auto-rows-[minmax(140px,auto)] grid-flow-dense grid-cols-4 gap-4"
        >
          {FEATURES.map((f) => (
            <article
              key={f.title}
              data-bento-card
              className={`group relative overflow-hidden rounded-2xl border border-[var(--border)] surface ${f.span}`}
            >
              <div
                className="absolute inset-0 bg-cover bg-center opacity-30 transition-transform duration-700 ease-out group-hover:scale-105"
                style={{
                  backgroundImage: `url(${f.image})`,
                  filter: "grayscale(50%) contrast(125%)",
                }}
              />
              <div className="relative flex h-full min-h-[140px] flex-col justify-end p-5">
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-muted">{f.body}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
