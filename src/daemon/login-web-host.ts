import type { Server } from "node:http";
import fs from "node:fs/promises";
import { randomBytes, timingSafeEqual } from "node:crypto";
import express from "express";
import type { Client } from "@icqqjs/icqq";
import type { ResolvedLoginConfig } from "@/lib/alert-config.js";
import { getLoginEndpointPath, getAccountDir } from "@/lib/paths.js";
import { LoginActions } from "@/daemon/login-actions.js";
import { executeLoginAction } from "@/daemon/executors/login.js";
import type { LoginSession } from "@/daemon/login-session.js";
import type { IpcRequest } from "@/daemon/protocol.js";

const sessions = new Map<string, { token: string; expires: number }>();
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function createSession(token: string): string {
  const id = randomBytes(24).toString("hex");
  sessions.set(id, { token, expires: Date.now() + SESSION_TTL_MS });
  return id;
}

function getCookie(req: express.Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === name) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

function resolveAuthToken(req: express.Request, ipcToken: string): boolean {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7);
    return token.length === ipcToken.length && timingSafeEqual(Buffer.from(token), Buffer.from(ipcToken));
  }
  const sid = getCookie(req, "icqq_login");
  if (!sid) return false;
  const entry = sessions.get(sid);
  if (!entry || entry.expires < Date.now()) return false;
  return (
    entry.token.length === ipcToken.length &&
    timingSafeEqual(Buffer.from(entry.token), Buffer.from(ipcToken))
  );
}

export class LoginWebHost {
  private httpServer: Server | null = null;
  private port = 0;

  constructor(
    private readonly client: Client,
    private readonly uin: number,
    private readonly ipcToken: string,
    private readonly loginSession: LoginSession,
    private readonly loginConfig: ResolvedLoginConfig,
  ) {}

  getPort(): number {
    return this.port;
  }

  async start(): Promise<void> {
    const app = express();
    app.use(express.urlencoded({ extended: true }));
    app.use(express.json({ limit: "64kb" }));

    app.get("/login/auth", (_req, res) => {
      res.type("html").send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>icqq login</title></head><body>
<h1>icqq 账号 ${this.uin} 登录鉴权</h1>
<p>请粘贴 <code>~/.icqq/${this.uin}/daemon.token</code> 内容：</p>
<form method="POST" action="/login/auth">
<input name="token" style="width:100%" autocomplete="off" />
<button type="submit">继续</button>
</form></body></html>`);
    });

    app.post("/login/auth", (req, res) => {
      const token = String(req.body?.token ?? "").trim();
      if (
        !token ||
        token.length !== this.ipcToken.length ||
        !timingSafeEqual(Buffer.from(token), Buffer.from(this.ipcToken))
      ) {
        res.status(401).type("html").send("<p>token 无效</p><a href=\"/login/auth\">重试</a>");
        return;
      }
      const sid = createSession(token);
      res.setHeader(
        "Set-Cookie",
        `icqq_login=${sid}; HttpOnly; Path=/login; SameSite=Strict`,
      );
      res.redirect("/login");
    });

    app.use("/login", (req, res, next) => {
      if (req.path === "/auth" || (req.method === "POST" && req.path === "/auth")) {
        return next();
      }
      if (!resolveAuthToken(req, this.ipcToken)) {
        res.redirect("/login/auth");
        return;
      }
      next();
    });

    app.get("/login", (_req, res) => {
      res.type("html").send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>icqq login</title></head><body>
<h1>icqq 账号 ${this.uin}</h1>
<div id="state">加载中…</div>
<form id="submitForm" style="margin-top:1em">
<input name="value" id="value" placeholder="ticket / 验证码" style="width:70%" />
<button type="submit">提交</button>
</form>
<script>
const stateEl = document.getElementById('state');
const es = new EventSource('/login/api/state');
es.onmessage = (e) => {
  const s = JSON.parse(e.data);
  stateEl.textContent = JSON.stringify(s, null, 2);
};
document.getElementById('submitForm').onsubmit = async (ev) => {
  ev.preventDefault();
  const value = document.getElementById('value').value;
  const s = JSON.parse(stateEl.textContent || '{}');
  let kind = 'continue';
  if (s.phase === 'slider') kind = 'slider';
  else if (s.phase === 'device') kind = 'sms';
  await fetch('/login/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, value }),
  });
};
</script></body></html>`);
    });

    app.get("/login/api/state", (req, res) => {
      if (!resolveAuthToken(req, this.ipcToken)) {
        res.status(401).end();
        return;
      }
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.flushHeaders();
      const unsub = this.loginSession.subscribe((state) => {
        res.write(`data: ${JSON.stringify(state)}\n\n`);
      });
      req.on("close", () => unsub());
    });

    app.post("/login/api/submit", async (req, res) => {
      if (!resolveAuthToken(req, this.ipcToken)) {
        res.status(401).json({ ok: false });
        return;
      }
      const kind = String(req.body?.kind ?? "continue");
      const value = req.body?.value != null ? String(req.body.value) : "";
      const ipcReq: IpcRequest = {
        id: randomBytes(8).toString("hex"),
        action: kind === "send_sms" ? LoginActions.LOGIN_SEND_SMS : LoginActions.LOGIN_SUBMIT,
        params: kind === "send_sms" ? {} : { kind, value },
      };
      const result = await executeLoginAction(this.client, ipcReq, this.loginSession);
      res.json(result);
    });

    if (this.loginConfig.http.host === "0.0.0.0") {
      console.warn("[login-web] 正在监听 0.0.0.0，请确保已配置反代与 token 保护");
    }

    await new Promise<void>((resolve, reject) => {
      const tryListen = (port: number, retried: boolean) => {
        const server = app.listen(port, this.loginConfig.http.host, () => {
          this.httpServer = server;
          const addr = server.address();
          this.port =
            typeof addr === "object" && addr ? addr.port : this.loginConfig.http.port;
          resolve();
        });
        server.on("error", (err: NodeJS.ErrnoException) => {
          server.close();
          if (!retried && err.code === "EADDRINUSE" && port !== 0) {
            tryListen(0, true);
            return;
          }
          reject(err);
        });
      };
      tryListen(this.loginConfig.http.port, false);
    });

    await fs.mkdir(getAccountDir(this.uin), { recursive: true, mode: 0o700 });
    await fs.writeFile(
      getLoginEndpointPath(this.uin),
      JSON.stringify({
        host: this.loginConfig.http.host,
        port: this.port,
        basePath: "/login",
      }, null, 2),
      { mode: 0o600 },
    );
  }

  async stop(): Promise<void> {
    if (this.httpServer) {
      await new Promise<void>((resolve, reject) => {
        this.httpServer!.close((err) => (err ? reject(err) : resolve()));
      });
      this.httpServer = null;
    }
    try {
      await fs.unlink(getLoginEndpointPath(this.uin));
    } catch {
      /* ignore */
    }
  }
}
