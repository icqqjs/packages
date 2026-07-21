import express, { type Request, type Response, type Router } from "express";
import type { GatewayStore, HostRow, InstanceRow, UserRow } from "../db/store.js";
import { resolveHostAgent, probeHostHealth } from "../hosts/executor.js";
import { resolveSessionUser, SESSION_COOKIE } from "./auth.js";
import { requestOrigin, sanitizeReportedBaseUrl } from "./origin.js";

type AuthedRequest = Request & { user?: UserRow };

function requireUser(store: GatewayStore) {
  return (req: AuthedRequest, res: Response, next: () => void) => {
    const user = resolveSessionUser(store, req.headers.cookie);
    if (!user) {
      res.status(401).json({ error: "未登录" });
      return;
    }
    req.user = user;
    next();
  };
}

function requireAdmin(req: AuthedRequest, res: Response, next: () => void) {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "需要管理员权限" });
    return;
  }
  next();
}

function resolveOwnedHost(
  store: GatewayStore,
  userId: string,
  hostId: string,
  res: Response,
): HostRow | null {
  const host = store.getHostById(hostId);
  if (!host) {
    res.status(404).json({ error: "主机不存在" });
    return null;
  }
  if (host.user_id !== userId) {
    res.status(403).json({ error: "无权访问该主机" });
    return null;
  }
  return host;
}

function resolveOwnedInstance(
  store: GatewayStore,
  req: AuthedRequest,
  res: Response,
): InstanceRow | null {
  const user = req.user!;
  const target = store.getInstanceById(String(req.params.id));
  if (!target) {
    res.status(404).json({ error: "实例不存在" });
    return null;
  }
  if (target.user_id !== user.id) {
    res.status(403).json({ error: "无权操作该实例" });
    return null;
  }
  return target;
}

export function createApiRouter(store: GatewayStore): Router {
  const router = express.Router();
  router.use(express.json({ limit: "1mb" }));

  router.get("/register-enabled", (_req: Request, res: Response) => {
    res.json({ enabled: store.isRegistrationEnabled() });
  });

  router.post("/register", (req: Request, res: Response) => {
    if (!store.isRegistrationEnabled()) {
      res.status(403).json({ error: "注册已关闭" });
      return;
    }
    const { username, password } = req.body ?? {};
    if (typeof username !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "用户名或密码格式错误" });
      return;
    }
    if (password.length < 6) {
      res.status(400).json({ error: "密码至少 6 位" });
      return;
    }
    if (store.findUserByUsername(username)) {
      res.status(409).json({ error: "用户名已存在" });
      return;
    }
    const user = store.createUser({ username, password, role: "user" });
    const sid = store.createSession(user.id);
    res.setHeader(
      "Set-Cookie",
      `${SESSION_COOKIE}=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 3600}`,
    );
    res.status(201).json({ id: user.id, username: user.username, role: user.role });
  });

  router.post("/login", (req: Request, res: Response) => {
    const { username, password } = req.body ?? {};
    if (typeof username !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "用户名或密码格式错误" });
      return;
    }
    const user = store.verifyUserPassword(username, password);
    if (!user) {
      res.status(401).json({ error: "用户名或密码错误" });
      return;
    }
    const sid = store.createSession(user.id);
    res.setHeader(
      "Set-Cookie",
      `${SESSION_COOKIE}=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 3600}`,
    );
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      mustChangePassword: Boolean(user.must_change_password),
    });
  });

  router.post("/logout", (req: AuthedRequest, res: Response) => {
    const cookies = req.headers.cookie ?? "";
    const match = cookies.match(new RegExp(`${SESSION_COOKIE}=([^;]+)`));
    if (match?.[1]) store.deleteSession(match[1]);
    res.setHeader(
      "Set-Cookie",
      `${SESSION_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`,
    );
    res.json({ ok: true });
  });

  // 远程 approve 回调（凭配对码，无需 session）
  router.post("/hosts/pairing/complete", (req: Request, res: Response) => {
    const { code, base_url, host_token, name } = req.body ?? {};
    if (
      typeof code !== "string" ||
      typeof base_url !== "string" ||
      typeof host_token !== "string"
    ) {
      res.status(400).json({ error: "参数不完整" });
      return;
    }
    const pairing = store.consumePairingCode(code);
    if (!pairing) {
      res.status(400).json({ error: "配对码无效或已过期" });
      return;
    }
    const { host } = store.createHost({
      userId: pairing.user_id,
      name: typeof name === "string" ? name : "远程主机",
      kind: "remote",
      // 远程未显式指定对外地址时会回推本机监听地址（可能是 loopback），
      // 此时用对端 IP 兜底；反代域名等可达地址原样保留。
      baseUrl: sanitizeReportedBaseUrl(base_url, req.socket.remoteAddress),
      hostToken: host_token,
      isLocal: false,
    });
    store.updateHostStatus(host.id, "online");
    res.json({ ok: true, hostId: host.id });
  });

  router.use(requireUser(store));

  router.get("/me", (req: AuthedRequest, res: Response) => {
    const u = req.user!;
    res.json({
      id: u.id,
      username: u.username,
      role: u.role,
      mustChangePassword: Boolean(u.must_change_password),
    });
  });

  router.post("/me/password", (req: AuthedRequest, res: Response) => {
    const { currentPassword, newPassword } = req.body ?? {};
    if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
      res.status(400).json({ error: "参数格式错误" });
      return;
    }
    const result = store.changeUserPassword(
      req.user!.id,
      currentPassword,
      newPassword,
    );
    if (!result.ok) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ ok: true });
  });

  router.get("/hosts", async (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const hosts = store.listHostsForUser(user.id);
    const out = await Promise.all(
      hosts.map(async (h) => {
        const status = await probeHostHealth(store, h);
        return {
          id: h.id,
          name: h.name,
          kind: h.kind,
          base_url: h.base_url,
          is_local: Boolean(h.is_local),
          proxy_data_plane: Boolean(h.proxy_data_plane),
          status,
          instance_count: store.countInstancesForHost(h.id),
          last_seen_at: h.last_seen_at,
          created_at: h.created_at,
        };
      }),
    );
    res.json(out);
  });

  router.post("/hosts/pairing", (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const pairing = store.createPairingCode(user.id);
    const settings = store.getSettings();
    // 经反代/域名访问控制台时，配对命令中的主控地址应对外可达，
    // 按当前请求 origin 生成，仅直连监听地址时回退到 settings。
    const masterUrl = requestOrigin(
      req,
      `http://${settings.httpHost}:${settings.httpPort}`,
    );
    res.json({
      code: pairing.code,
      master_url: masterUrl,
      expires_at: pairing.expires_at,
    });
  });

  router.delete("/hosts/:id", (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const ok = store.deleteHost(user.id, String(req.params.id));
    if (!ok) {
      res.status(404).json({ error: "主机不存在或不可删除" });
      return;
    }
    res.json({ ok: true });
  });

  router.patch("/hosts/:id", (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const host = resolveOwnedHost(store, user.id, String(req.params.id), res);
    if (!host) return;
    if (host.is_local) {
      res.status(400).json({ error: "本机 host 不支持修改数据面代理" });
      return;
    }
    const enabled = Boolean(req.body?.proxy_data_plane);
    if (!store.setHostProxyDataPlane(host.id, user.id, enabled)) {
      res.status(404).json({ error: "主机不存在" });
      return;
    }
    res.json({ ok: true, proxy_data_plane: enabled });
  });

  router.post("/hosts/:id/sync", async (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const host = resolveOwnedHost(store, user.id, String(req.params.id), res);
    if (!host) return;
    try {
      const agent = resolveHostAgent(store, host);
      const discovered = await agent.discoverInstances();
      const synced: number[] = [];
      for (const d of discovered) {
        store.upsertInstanceForHost({
          userId: user.id,
          hostId: host.id,
          uin: d.uin,
        });
        synced.push(d.uin);
      }
      res.json({ ok: true, synced });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  router.post(
    "/hosts/:id/instances/local",
    async (req: AuthedRequest, res: Response) => {
      const user = req.user!;
      const host = resolveOwnedHost(store, user.id, String(req.params.id), res);
      if (!host) return;
      const { uin, platform, signApiUrl, ver, label } = req.body ?? {};
      const uinNum = Number(uin);
      if (!Number.isInteger(uinNum) || uinNum <= 0) {
        res.status(400).json({ error: "uin 必须为正整数" });
        return;
      }
      const existing = store.getInstanceByUin(uinNum);
      if (existing && existing.user_id !== user.id) {
        res.status(409).json({ error: "该 UIN 已被其他用户登记" });
        return;
      }
      try {
        const agent = resolveHostAgent(store, host);
        const state = await agent.createLocal({
          uin: uinNum,
          platform: platform != null ? Number(platform) : undefined,
          signApiUrl: signApiUrl ? String(signApiUrl) : undefined,
          ver: ver ? String(ver) : undefined,
        });
        const row = store.upsertInstanceForHost({
          userId: user.id,
          hostId: host.id,
          uin: uinNum,
          label: label ? String(label) : undefined,
        });
        res.status(201).json({ id: row.id, uin: row.uin, ...state });
      } catch (err) {
        res.status(502).json({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  );

  router.get("/instances", (req: AuthedRequest, res: Response) => {
    const user = req.user!;
    const rows = store.listInstancesForUser(user.id);
    res.json(
      rows.map((r) => ({
        id: r.id,
        host_id: r.host_id,
        uin: r.uin,
        kind: r.kind,
        label: r.label,
        created_at: r.created_at,
      })),
    );
  });

  router.delete("/instances/:id", (req: AuthedRequest, res: Response) => {
    const target = resolveOwnedInstance(store, req, res);
    if (!target) return;
    store.deleteInstance(target.id);
    res.json({ ok: true });
  });

  router.get(
    "/instances/:id/status",
    async (req: AuthedRequest, res: Response) => {
      const target = resolveOwnedInstance(store, req, res);
      if (!target) return;
      if (!target.host_id) {
        res.json({ state: "unknown" });
        return;
      }
      const host = store.getHostById(target.host_id);
      if (!host) {
        res.json({ state: "unknown" });
        return;
      }
      try {
        const agent = resolveHostAgent(store, host);
        res.json(await agent.getStatus(target.uin));
      } catch {
        res.json({ state: "offline" });
      }
    },
  );

  router.get(
    "/instances/:id/login",
    async (req: AuthedRequest, res: Response) => {
      const target = resolveOwnedInstance(store, req, res);
      if (!target) return;
      if (!target.host_id) {
        res.status(400).json({ error: "实例未关联主机" });
        return;
      }
      const host = store.getHostById(target.host_id);
      if (!host) {
        res.status(404).json({ error: "主机不存在" });
        return;
      }
      const agent = resolveHostAgent(store, host);
      res.json(await agent.getLoginState(target.uin));
    },
  );

  router.post(
    "/instances/:id/login/submit",
    async (req: AuthedRequest, res: Response) => {
      const target = resolveOwnedInstance(store, req, res);
      if (!target) return;
      const host = target.host_id ? store.getHostById(target.host_id) : null;
      if (!host) {
        res.status(400).json({ error: "实例未关联主机" });
        return;
      }
      const { kind, value } = req.body ?? {};
      if (typeof kind !== "string") {
        res.status(400).json({ error: "缺少 kind" });
        return;
      }
      const agent = resolveHostAgent(store, host);
      const result = await agent.submitLogin(
        target.uin,
        kind,
        value != null ? String(value) : undefined,
      );
      res.status(result.ok ? 200 : 502).json(result);
    },
  );

  router.post(
    "/instances/:id/login/sms",
    async (req: AuthedRequest, res: Response) => {
      const target = resolveOwnedInstance(store, req, res);
      if (!target) return;
      const host = target.host_id ? store.getHostById(target.host_id) : null;
      if (!host) {
        res.status(400).json({ error: "实例未关联主机" });
        return;
      }
      const agent = resolveHostAgent(store, host);
      res.json(await agent.sendLoginSms(target.uin));
    },
  );

  router.post(
    "/instances/:id/relogin",
    async (req: AuthedRequest, res: Response) => {
      const target = resolveOwnedInstance(store, req, res);
      if (!target) return;
      const host = target.host_id ? store.getHostById(target.host_id) : null;
      if (!host) {
        res.status(400).json({ error: "实例未关联主机" });
        return;
      }
      try {
        const agent = resolveHostAgent(store, host);
        res.json(await agent.relogin(target.uin));
      } catch (err) {
        res.status(502).json({
          error: err instanceof Error ? err.message : String(err),
        });
      }
    },
  );

  router.get(
    "/instances/:id/logs",
    async (req: AuthedRequest, res: Response) => {
      const target = resolveOwnedInstance(store, req, res);
      if (!target) return;
      const host = target.host_id ? store.getHostById(target.host_id) : null;
      if (!host) {
        res.status(400).json({ error: "实例未关联主机" });
        return;
      }
      const lines = Number(req.query.lines ?? 80);
      const agent = resolveHostAgent(store, host);
      const text = await agent.tailLogs(target.uin, lines);
      res.type("text/plain").send(text);
    },
  );

  router.get("/tokens", (req: AuthedRequest, res: Response) => {
    res.json(store.listApiTokens(req.user!.id));
  });

  router.post("/tokens", (req: AuthedRequest, res: Response) => {
    const label = typeof req.body?.label === "string" ? req.body.label : undefined;
    const { id, token } = store.createApiToken(req.user!.id, label);
    res.status(201).json({ id, token });
  });

  router.delete("/tokens/:id", (req: AuthedRequest, res: Response) => {
    const ok = store.deleteApiToken(req.user!.id, String(req.params.id));
    if (!ok) {
      res.status(404).json({ error: "Token 不存在" });
      return;
    }
    res.json({ ok: true });
  });

  // admin 系统管理
  router.get("/users", requireAdmin, (_req: AuthedRequest, res: Response) => {
    res.json(
      store.listUsers().map((u) => ({
        id: u.id,
        username: u.username,
        role: u.role,
        created_at: u.created_at,
      })),
    );
  });

  router.post("/users", requireAdmin, (req: AuthedRequest, res: Response) => {
    const { username, password, role } = req.body ?? {};
    if (typeof username !== "string" || typeof password !== "string") {
      res.status(400).json({ error: "用户名或密码格式错误" });
      return;
    }
    if (store.findUserByUsername(username)) {
      res.status(409).json({ error: "用户名已存在" });
      return;
    }
    const user = store.createUser({
      username,
      password,
      role: role === "admin" ? "admin" : "user",
    });
    res.status(201).json({ id: user.id, username: user.username, role: user.role });
  });

  return router;
}
