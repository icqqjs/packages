/**
 * 守护进程生命周期管理：启动、停止、状态检测。
 *
 * 守护进程以 fork 方式在后台运行，通过 IPC message "ready" 通知父进程启动完成。
 * 统一存储于 ~/.icqq/<uin>/ 目录：daemon.pid、daemon.sock、daemon.log、daemon.token
 *
 * @module lifecycle
 */
import { fork } from "node:child_process";
import { openSync, closeSync } from "node:fs";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  getAccountDir,
  getLogPath,
  getPidPath,
  getSocketPath,
  getTokenPath,
  clearDaemonStoppedFlag,
} from "@/lib/paths.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function isPidAlive(pid: number): Promise<boolean> {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function checkSocket(uin: number): Promise<boolean> {
  return new Promise((resolve) => {
    const sockPath = getSocketPath(uin);
    const sock = net.connect(sockPath);
    const timer = setTimeout(() => {
      sock.destroy();
      resolve(false);
    }, 2000);
    sock.on("connect", () => {
      clearTimeout(timer);
      sock.destroy();
      resolve(true);
    });
    sock.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
  });
}

/** 清理陈旧 pid/socket/token（进程已死或 socket 不可达） */
export async function janitorStaleDaemonArtifacts(uin: number): Promise<void> {
  let pid: number | null = null;
  try {
    const pidStr = await fs.readFile(getPidPath(uin), "utf-8");
    const parsed = Number(pidStr.trim());
    if (!Number.isNaN(parsed)) pid = parsed;
  } catch {
    /* no pid file */
  }

  const socketOk = await checkSocket(uin);
  const pidAlive = pid !== null && (await isPidAlive(pid));

  if (pidAlive && socketOk) return;

  const paths = [getPidPath(uin), getSocketPath(uin), getTokenPath(uin)];
  await Promise.all(
    paths.map((p) =>
      fs.unlink(p).catch(() => {
        /* ignore */
      }),
    ),
  );
}

export async function isDaemonRunning(uin: number): Promise<boolean> {
  await janitorStaleDaemonArtifacts(uin);
  try {
    const pidStr = await fs.readFile(getPidPath(uin), "utf-8");
    const pid = Number(pidStr.trim());
    if (Number.isNaN(pid)) return false;
    if (!(await isPidAlive(pid))) return false;
    return await checkSocket(uin);
  } catch {
    return false;
  }
}

export async function getDaemonPid(uin: number): Promise<number | null> {
  await janitorStaleDaemonArtifacts(uin);
  try {
    const pidStr = await fs.readFile(getPidPath(uin), "utf-8");
    const pid = Number(pidStr.trim());
    if (Number.isNaN(pid)) return null;
    if (!(await isPidAlive(pid))) return null;
    return pid;
  } catch {
    return null;
  }
}

export async function spawnDaemon(uin: number): Promise<void> {
  await janitorStaleDaemonArtifacts(uin);
  if (await isDaemonRunning(uin)) {
    throw new Error(`账号 ${uin} 的守护进程已在运行中`);
  }

  await clearDaemonStoppedFlag(uin);

  await fs.mkdir(getAccountDir(uin), { recursive: true, mode: 0o700 });

  const logPath = getLogPath(uin);

  try {
    const stat = await fs.stat(logPath);
    if (stat.size > 5 * 1024 * 1024) {
      await fs.rename(logPath, logPath + ".old");
    }
  } catch { /* ignore */ }

  const logFd = openSync(logPath, "a");
  const entryPath = path.resolve(__dirname, "entry.js");

  return new Promise<void>((resolve, reject) => {
    const child = fork(entryPath, [String(uin)], {
      detached: true,
      stdio: ["ignore", logFd, logFd, "ipc"],
    });

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`守护进程启动超时。查看日志: ${logPath}`));
    }, 30000);

    const cleanup = () => {
      clearTimeout(timeout);
      child.removeAllListeners();
      try {
        closeSync(logFd);
      } catch {
        /* ignore */
      }
    };

    child.on("message", (msg) => {
      if (msg === "ready") {
        cleanup();
        child.unref();
        resolve();
      }
    });

    child.on("error", (err) => {
      cleanup();
      reject(err);
    });

    child.on("exit", (code) => {
      cleanup();
      if (code !== 0) {
        reject(
          new Error(
            `守护进程退出 (code=${code})。查看日志: ${logPath}`,
          ),
        );
      }
    });
  });
}

export async function stopDaemon(uin: number): Promise<boolean> {
  const pid = await getDaemonPid(uin);
  if (pid === null) {
    await janitorStaleDaemonArtifacts(uin);
    return false;
  }

  try {
    process.kill(pid, "SIGTERM");

    const deadline = Date.now() + 5000;
    let alive = true;
    while (Date.now() < deadline) {
      alive = await isPidAlive(pid);
      if (!alive) break;
      await new Promise((r) => setTimeout(r, 200));
    }

    if (alive) {
      try {
        process.kill(pid, "SIGKILL");
      } catch {
        /* ignore */
      }
      const killDeadline = Date.now() + 2000;
      while (Date.now() < killDeadline) {
        if (!(await isPidAlive(pid))) break;
        await new Promise((r) => setTimeout(r, 100));
      }
    }

    await janitorStaleDaemonArtifacts(uin);
    return true;
  } catch {
    await janitorStaleDaemonArtifacts(uin);
    return false;
  }
}
