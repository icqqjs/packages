import { useState, useEffect } from "react";
import { IpcClient } from "./ipc-client.js";
import { resolveUin } from "./config.js";
import { isDaemonRunning } from "@/daemon/supervisor.js";
import { formatDaemonNotRunning } from "./cli-errors.js";

/**
 * 连接守护进程 IPC。
 * 默认在组件卸载时自动 close（避免连接泄漏）。
 */
export function useIpcConnection(): {
  ipc: IpcClient | null;
  error: string;
  uin: number | null;
} {
  const [ipc, setIpc] = useState<IpcClient | null>(null);
  const [error, setError] = useState("");
  const [uin, setUin] = useState<number | null>(null);

  useEffect(() => {
    let closed = false;
    let client: IpcClient | null = null;

    void (async () => {
      try {
        const resolvedUin = await resolveUin();
        if (!closed) setUin(resolvedUin);
        if (!(await isDaemonRunning(resolvedUin))) {
          throw new Error(formatDaemonNotRunning(resolvedUin));
        }
        client = await IpcClient.connect(resolvedUin);
        if (!closed) setIpc(client);
        else client.close();
      } catch (e) {
        if (!closed) setError(e instanceof Error ? e.message : String(e));
      }
    })();

    return () => {
      closed = true;
      client?.close();
    };
  }, []);

  return { ipc, error, uin };
}
