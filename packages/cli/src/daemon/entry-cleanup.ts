import fs from "node:fs/promises";
import {
  getPidPath,
  getSocketPath,
  getTokenPath,
  getRpcPortPath,
  getMcpEndpointPath,
} from "@/lib/paths.js";

/** 启动失败或登录中断时清理守护进程占位文件 */
export async function cleanupDaemonStartupArtifacts(
  uin: number,
): Promise<void> {
  const paths = [
    getPidPath(uin),
    getSocketPath(uin),
    getTokenPath(uin),
    getRpcPortPath(uin),
    getMcpEndpointPath(uin),
  ];
  await Promise.all(
    paths.map((p) =>
      fs.unlink(p).catch(() => {
        /* ignore */
      }),
    ),
  );
}
