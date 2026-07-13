import type { Client } from "@icqqjs/icqq";
import type { DaemonContext } from "./daemon-context.js";
import { getActionCatalogEntry } from "./action-catalog.js";
import { isLoginAction } from "./login-actions.js";
import { executeLoginAction } from "./executors/login.js";
import type { LoginSession } from "./login-session.js";
import type { IpcRequest, IpcResponse } from "./protocol.js";

export async function handleRequest(
  client: Client,
  req: IpcRequest,
  ctx: DaemonContext | null,
  loginSession?: LoginSession | null,
): Promise<IpcResponse> {
  if (isLoginAction(req.action)) {
    if (!loginSession?.isActive()) {
      return { id: req.id, ok: false, error: "daemon_login_required" };
    }
    return executeLoginAction(client, req, loginSession);
  }

  if (!ctx) {
    return { id: req.id, ok: false, error: "daemon_login_required" };
  }

  const catalogEntry = getActionCatalogEntry(req.action);
  if (catalogEntry) {
    try {
      const data = await catalogEntry.execute(client, req.params, ctx);
      return { id: req.id, ok: true, data };
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : typeof err === "string"
            ? err
            : JSON.stringify(err) ?? String(err);
      return {
        id: req.id,
        ok: false,
        error: message,
      };
    }
  }

  return { id: req.id, ok: false, error: `未知操作: ${req.action}` };
}
