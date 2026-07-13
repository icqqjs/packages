import os from "node:os";
import type { IPty } from "node-pty";
import pty from "node-pty";
import type { WebSocket } from "ws";
import { ensureNodePtySpawnHelper } from "../lib/ensure-node-pty.js";

export function spawnHostShell(cols = 120, rows = 32): IPty {
  ensureNodePtySpawnHelper();

  const shell =
    process.env.SHELL ??
    (os.platform() === "win32" ? "powershell.exe" : "/bin/zsh");

  try {
    return pty.spawn(shell, [], {
      name: "xterm-256color",
      cols,
      rows,
      cwd: os.homedir(),
      env: process.env as Record<string, string>,
    });
  } catch (err) {
    const hint =
      err instanceof Error && err.message.includes("posix_spawnp")
        ? "（node-pty spawn-helper 可能缺少执行权限，请运行 pnpm rebuild node-pty）"
        : "";
    throw new Error(
      `无法启动 Shell: ${err instanceof Error ? err.message : String(err)}${hint}`,
      { cause: err },
    );
  }
}

export function attachPtyToWebSocket(term: IPty, ws: WebSocket): () => void {
  const onData = term.onData((data) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: "output", data }));
    }
  });

  const onMessage = (raw: Buffer | string) => {
    try {
      const msg = JSON.parse(String(raw)) as {
        type?: string;
        data?: string;
        cols?: number;
        rows?: number;
      };
      if (msg.type === "input" && msg.data) term.write(msg.data);
      if (msg.type === "resize" && msg.cols && msg.rows) {
        term.resize(msg.cols, msg.rows);
      }
    } catch {
      term.write(String(raw));
    }
  };

  ws.on("message", onMessage);
  ws.on("close", () => {
    term.kill();
    onData.dispose();
  });

  return () => {
    term.kill();
    onData.dispose();
  };
}
