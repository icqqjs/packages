import type { Client } from "@icqqjs/icqq";
import fs from "node:fs/promises";
import path from "node:path";
import {
  bindInteractiveLoginHandlers,
  LOGIN_INTERACTIVE_ERRORS,
} from "@/lib/account-bootstrap.js";
import { getAccountDir } from "@/lib/paths.js";
import { renderQrcodeAscii } from "@/lib/render-qrcode.js";

export type LoginPhase =
  | "connecting"
  | "qrcode"
  | "slider"
  | "device"
  | "auth"
  | "online"
  | "error";

export type LoginSessionState = {
  phase: LoginPhase;
  detail?: string;
  qrcodePath?: string;
  qrcodeAscii?: string;
  sliderUrl?: string;
  deviceUrl?: string;
  devicePhone?: string;
  authUrl?: string;
  lastError?: string;
};

type RateLimitState = { windowStart: number; count: number };

export class LoginSession {
  private active = false;
  private state: LoginSessionState = { phase: "connecting" };
  private disposeHandlers: (() => void) | null = null;
  private onlineResolve: (() => void) | null = null;
  private onlinePromise: Promise<void> | null = null;
  private rateLimit: RateLimitState = { windowStart: 0, count: 0 };
  private readonly listeners = new Set<(state: LoginSessionState) => void>();

  constructor(
    private readonly client: Client,
    private readonly uin: number,
    private readonly rateLimitWindowMs: number,
    private readonly rateLimitMax: number,
  ) {}

  isActive(): boolean {
    return this.active;
  }

  getState(): LoginSessionState {
    return { ...this.state };
  }

  subscribe(listener: (state: LoginSessionState) => void): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => this.listeners.delete(listener);
  }

  private emit(): void {
    const snap = this.getState();
    for (const l of this.listeners) l(snap);
  }

  private setState(patch: Partial<LoginSessionState>): void {
    this.state = { ...this.state, ...patch };
    this.emit();
  }

  checkSubmitRateLimit(): string | null {
    const now = Date.now();
    if (now - this.rateLimit.windowStart > this.rateLimitWindowMs) {
      this.rateLimit = { windowStart: now, count: 0 };
    }
    if (this.rateLimit.count >= this.rateLimitMax) {
      return "提交过于频繁，请稍后再试";
    }
    this.rateLimit.count++;
    return null;
  }

  start(): void {
    if (this.active) return;
    this.active = true;
    this.onlinePromise = new Promise<void>((resolve) => {
      this.onlineResolve = resolve;
    });

    this.disposeHandlers = bindInteractiveLoginHandlers(this.client, {
      onOnline: () => {
        this.setState({ phase: "online", lastError: undefined });
        this.active = false;
        this.onlineResolve?.();
      },
      onLoginError: (e) => {
        this.setState({
          phase: "error",
          lastError: e.message,
          detail: e.message,
        });
      },
      onQrcode: async (event: unknown) => {
        const data = event as { image?: Buffer };
        const accountDir = getAccountDir(this.uin);
        const qrPath = path.join(accountDir, "qrcode.png");
        if (data?.image) {
          await fs.writeFile(qrPath, data.image);
        }
        let qrcodeAscii: string | undefined;
        if (data?.image) {
          try {
            qrcodeAscii = (await renderQrcodeAscii(data.image)).join("\n");
          } catch {
            /* ignore */
          }
        }
        this.setState({
          phase: "qrcode",
          qrcodePath: qrPath,
          qrcodeAscii,
          detail: "请扫码并在手机上确认",
        });
      },
      onSlider: (e) => {
        this.setState({
          phase: "slider",
          sliderUrl: e.url,
          detail: "请完成滑块验证并提交 ticket",
        });
      },
      onDevice: (e) => {
        this.setState({
          phase: "device",
          deviceUrl: e.url,
          devicePhone: e.phone,
          detail: "请选择设备验证方式",
        });
      },
      onAuth: (e) => {
        this.setState({
          phase: "auth",
          authUrl: e.url,
          detail: LOGIN_INTERACTIVE_ERRORS.daemon.auth,
        });
      },
    });
    this.emit();
  }

  async waitForOnline(): Promise<void> {
    if (!this.onlinePromise) throw new Error("LoginSession not started");
    await this.onlinePromise;
  }

  stop(): void {
    this.active = false;
    this.disposeHandlers?.();
    this.disposeHandlers = null;
    this.listeners.clear();
  }
}
