import type { Client } from "@icqqjs/icqq";
import { LoginActions } from "@/daemon/login-actions.js";
import type { LoginSession } from "@/daemon/login-session.js";
import type { IpcRequest, IpcResponse } from "@/daemon/protocol.js";

type LoginClient = Client & {
  submitSlider?: (ticket: string) => Promise<unknown>;
  submitSmsCode?: (code: string) => Promise<unknown>;
  sendSmsCode?: () => Promise<unknown>;
  login: (...args: unknown[]) => Promise<unknown>;
};

export async function executeLoginAction(
  client: Client,
  req: IpcRequest,
  session: LoginSession,
): Promise<IpcResponse> {
  const c = client as LoginClient;

  switch (req.action) {
    case LoginActions.LOGIN_GET_STATE:
      return { id: req.id, ok: true, data: session.getState() };

    case LoginActions.LOGIN_SEND_SMS: {
      const rateErr = session.checkSubmitRateLimit();
      if (rateErr) return { id: req.id, ok: false, error: rateErr };
      try {
        await c.sendSmsCode?.();
        return { id: req.id, ok: true, data: { ok: true } };
      } catch (err) {
        return ipcError(req.id, err);
      }
    }

    case LoginActions.LOGIN_SUBMIT: {
      const rateErr = session.checkSubmitRateLimit();
      if (rateErr) return { id: req.id, ok: false, error: rateErr };
      const kind = String(req.params.kind ?? "");
      const value = req.params.value != null ? String(req.params.value) : "";
      try {
        switch (kind) {
          case "slider":
            if (!value.trim()) return { id: req.id, ok: false, error: "缺少 ticket" };
            await c.submitSlider?.(value.trim());
            break;
          case "sms":
            if (!value.trim()) return { id: req.id, ok: false, error: "缺少验证码" };
            await c.submitSmsCode?.(value.trim());
            break;
          case "continue":
          case "device_url":
          case "auth":
            await c.login();
            break;
          default:
            return { id: req.id, ok: false, error: `未知 kind: ${kind}` };
        }
        return { id: req.id, ok: true, data: { ok: true } };
      } catch (err) {
        return ipcError(req.id, err);
      }
    }

    default:
      return { id: req.id, ok: false, error: `未知 login action: ${req.action}` };
  }
}

function ipcError(id: string, err: unknown): IpcResponse {
  return {
    id,
    ok: false,
    error: err instanceof Error ? err.message : String(err),
  };
}
