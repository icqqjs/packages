import express, { Router, type Request, type Response } from "express";
import type { GatewayStore, UserRow } from "../db/store.js";
import { extractBearer, resolveSessionUser, SESSION_COOKIE } from "../http/auth.js";
import { hostAgentLocal } from "./local.js";
import { runPairApprove } from "./pairing.js";
import { hostAgentVersion, ipcRequest } from "./instances.js";

type AuthedRequest = Request & { gatewayUser?: UserRow };

function requireGatewayUser(store: GatewayStore) {
  return (req: AuthedRequest, res: Response, next: () => void) => {
    const user = resolveSessionUser(store, req.headers.cookie);
    if (!user) {
      res.status(401).json({ error: "请先登录 gateway 管理员账号" });
      return;
    }
    req.gatewayUser = user;
    next();
  };
}

function requireHostAgentAuth(store: GatewayStore) {
  return (req: Request, res: Response, next: () => void) => {
    const token = extractBearer(req.headers.authorization);
    if (!token || !store.validateHostAgentToken(token)) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    next();
  };
}

export function createHostAgentRouter(store: GatewayStore): Router {
  const router = Router();
  router.use(express.json({ limit: "1mb" }));

  router.get("/health", requireHostAgentAuth(store), (_req, res) => {
    res.json({ ok: true, version: hostAgentVersion() });
  });

  router.post("/pair/approve", requireGatewayUser(store), async (req: AuthedRequest, res) => {
    if (req.gatewayUser?.role !== "admin") {
      res.status(403).json({ error: "需要管理员权限" });
      return;
    }
    const { master_url, code, remote_base_url, name } = req.body ?? {};
    if (typeof master_url !== "string" || typeof code !== "string") {
      res.status(400).json({ error: "缺少 master_url 或 code" });
      return;
    }
    try {
      const result = await runPairApprove(store, {
        masterUrl: master_url,
        code,
        remoteBaseUrl:
          typeof remote_base_url === "string" ? remote_base_url : undefined,
        name: typeof name === "string" ? name : undefined,
      });
      res.json({ ok: true, ...result });
    } catch (err) {
      res.status(502).json({
        error: err instanceof Error ? err.message : String(err),
      });
    }
  });

  router.use(requireHostAgentAuth(store));

  router.get("/instances", async (_req, res) => {
    res.json(await hostAgentLocal.discoverInstances());
  });

  router.post("/instances/local", async (req, res) => {
    const { uin, platform, signApiUrl, ver } = req.body ?? {};
    const uinNum = Number(uin);
    if (!Number.isInteger(uinNum) || uinNum <= 0) {
      res.status(400).json({ error: "uin 必须为正整数" });
      return;
    }
    res.json(
      await hostAgentLocal.createLocal({
        uin: uinNum,
        platform: platform != null ? Number(platform) : undefined,
        signApiUrl: signApiUrl ? String(signApiUrl) : undefined,
        ver: ver ? String(ver) : undefined,
      }),
    );
  });

  router.get("/instances/:uin/status", async (req, res) => {
    res.json(await hostAgentLocal.getStatus(Number(req.params.uin)));
  });

  router.get("/instances/:uin/login", async (req, res) => {
    res.json(await hostAgentLocal.getLoginState(Number(req.params.uin)));
  });

  router.post("/instances/:uin/login/submit", async (req, res) => {
    const { kind, value } = req.body ?? {};
    if (typeof kind !== "string") {
      res.status(400).json({ error: "缺少 kind" });
      return;
    }
    res.json(
      await hostAgentLocal.submitLogin(
        Number(req.params.uin),
        kind,
        value != null ? String(value) : undefined,
      ),
    );
  });

  router.post("/instances/:uin/login/sms", async (req, res) => {
    res.json(await hostAgentLocal.sendLoginSms(Number(req.params.uin)));
  });

  router.post("/instances/:uin/relogin", async (req, res) => {
    res.json(await hostAgentLocal.relogin(Number(req.params.uin)));
  });

  router.post("/instances/:uin/ipc", async (req, res) => {
    const { action, params } = req.body ?? {};
    if (typeof action !== "string") {
      res.status(400).json({ error: "缺少 action" });
      return;
    }
    res.json(
      await ipcRequest(
        Number(req.params.uin),
        action,
        (params as Record<string, unknown>) ?? {},
      ),
    );
  });

  router.get("/instances/:uin/logs", async (req, res) => {
    const lines = Number(req.query.lines ?? 40);
    const text = await hostAgentLocal.tailLogs(Number(req.params.uin), lines);
    res.type("text/plain").send(text);
  });

  return router;
}
