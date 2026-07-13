/**
 * DaemonSupervisor — 账号守护进程进程契约：spawn/stop/janitor、就绪探测、OS 服务安装。
 *
 * 守护进程以 fork 方式在后台运行，通过 IPC message "ready" 通知父进程启动完成。
 * 统一存储于 ~/.icqq/<uin>/ 目录：daemon.pid、daemon.sock、daemon.log、daemon.token
 */
import { fork, execSync } from "node:child_process";
import { openSync, closeSync } from "node:fs";
import fs from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import { loadConfig } from "@/lib/config.js";
import {
  getAccountDir,
  getLogPath,
  getPidPath,
  getSocketPath,
  getTokenPath,
  getDaemonStoppedPath,
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

function findDaemonPids(uin: number): number[] {
  if (os.platform() === "win32") return [];
  try {
    const out = execSync(`pgrep -f "entry\\.js ${uin}\\b"`, {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    if (!out) return [];
    return out
      .split("\n")
      .map((s) => Number(s.trim()))
      .filter((n) => Number.isInteger(n) && n > 0);
  } catch {
    return [];
  }
}

/** 停止该 uin 的全部 daemon 进程并清理陈旧产物（IPC 不可达时强制重启用） */
export async function forceStopDaemon(uin: number): Promise<void> {
  await stopDaemon(uin);
  const pids = findDaemonPids(uin);
  for (const pid of pids) {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      /* ignore */
    }
  }
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const alive = (
      await Promise.all(
        pids.map(async (pid) => ((await isPidAlive(pid)) ? pid : null)),
      )
    ).filter((pid): pid is number => pid != null);
    if (alive.length === 0) break;
    await new Promise((r) => setTimeout(r, 150));
  }
  for (const pid of pids) {
    try {
      if (await isPidAlive(pid)) process.kill(pid, "SIGKILL");
    } catch {
      /* ignore */
    }
  }
  await janitorStaleDaemonArtifacts(uin);
}

const spawning = new Map<number, Promise<void>>();

export async function spawnDaemon(uin: number): Promise<void> {
  const inflight = spawning.get(uin);
  if (inflight) return inflight;

  const job = spawnDaemonInner(uin).finally(() => {
    spawning.delete(uin);
  });
  spawning.set(uin, job);
  return job;
}

async function spawnDaemonInner(uin: number): Promise<void> {
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
    let settled = false;
    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };

    const child = fork(entryPath, [String(uin)], {
      detached: true,
      stdio: ["ignore", logFd, logFd, "ipc"],
    });

    const timeout = setTimeout(() => {
      cleanup();
      finish(() =>
        reject(new Error(`守护进程启动超时。查看日志: ${logPath}`)),
      );
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
        finish(resolve);
      }
    });

    child.on("error", (err) => {
      cleanup();
      finish(() => reject(err));
    });

    child.on("exit", (code) => {
      cleanup();
      finish(() =>
        reject(
          new Error(
            `守护进程退出 (code=${code ?? "null"})。查看日志: ${logPath}`,
          ),
        ),
      );
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

export function getLaunchdLabel(uin: number): string {
  return `com.icqq.daemon.${uin}`;
}

export function getLaunchdPlistPath(uin: number): string {
  return path.join(
    os.homedir(),
    "Library",
    "LaunchAgents",
    `${getLaunchdLabel(uin)}.plist`,
  );
}

export function getSystemdServiceName(uin: number): string {
  return `icqq-${uin}.service`;
}

export function getSystemdServicePath(uin: number): string {
  const configHome =
    process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");
  return path.join(configHome, "systemd", "user", getSystemdServiceName(uin));
}

function getDaemonEntryPath(): string {
  return path.resolve(__dirname, "entry.js");
}

export function buildLaunchdPlist(uin: number): string {
  const nodePath = process.execPath;
  const entryPath = getDaemonEntryPath();
  const logPath = getLogPath(uin);
  const label = getLaunchdLabel(uin);
  const stoppedPath = getDaemonStoppedPath(uin);

  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>${label}</string>
    <key>ProgramArguments</key>
    <array>
        <string>${nodePath}</string>
        <string>${entryPath}</string>
        <string>${uin}</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <dict>
        <key>PathState</key>
        <dict>
            <key>${stoppedPath}</key>
            <false/>
        </dict>
    </dict>
    <key>StandardOutPath</key>
    <string>${logPath}</string>
    <key>StandardErrorPath</key>
    <string>${logPath}</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>HOME</key>
        <string>${os.homedir()}</string>
        <key>PATH</key>
        <string>${path.dirname(nodePath)}:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    </dict>
    <key>ThrottleInterval</key>
    <integer>10</integer>
</dict>
</plist>
`;
}

export function buildSystemdUnit(uin: number): string {
  const nodePath = process.execPath;
  const entryPath = getDaemonEntryPath();
  const logPath = getLogPath(uin);

  return `[Unit]
Description=icqq QQ daemon for account ${uin}
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${nodePath} ${entryPath} ${uin}
Restart=on-failure
RestartSec=10
StandardOutput=append:${logPath}
StandardError=append:${logPath}
Environment=HOME=${os.homedir()}
Environment=PATH=${path.dirname(nodePath)}:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin

[Install]
WantedBy=default.target
`;
}

export async function getAllUins(): Promise<number[]> {
  const config = await loadConfig();
  return Object.keys(config.accounts)
    .map(Number)
    .filter((n) => !Number.isNaN(n) && n > 0)
    .sort((a, b) => a - b);
}

/**
 * 解析 service 命令目标账号列表。
 * - 指定 uin → 仅该账号
 * - 未指定 → 所有已配置账号（非 currentUin）
 */
export async function resolveServiceUins(
  argUin: number | undefined,
): Promise<number[]> {
  if (argUin !== undefined) return [argUin];
  const uins = await getAllUins();
  if (uins.length === 0) {
    throw new Error("未找到已配置的账号，请先执行 icqq login");
  }
  return uins;
}

export type ServiceState = {
  uin: number;
  installed: boolean;
  filePath: string;
  running: boolean;
  pid: number | null;
  lastExitCode: number | null;
};

let legacyGlobalCleaned = false;

/** 移除误装的单例全局服务（com.icqq.daemon.plist / icqq.service） */
async function cleanupLegacyGlobalService(log: (s: string) => void): Promise<void> {
  if (legacyGlobalCleaned) return;
  legacyGlobalCleaned = true;

  if (process.platform === "darwin") {
    const plistPath = path.join(
      os.homedir(),
      "Library",
      "LaunchAgents",
      "com.icqq.daemon.plist",
    );
    try {
      await fs.access(plistPath);
      log("移除误装的全局 plist com.icqq.daemon.plist…");
      try {
        execSync(`launchctl unload "${plistPath}" 2>/dev/null`, { stdio: "ignore" });
      } catch {
        /* ignore */
      }
      await fs.unlink(plistPath);
    } catch {
      /* not present */
    }
    return;
  }

  const configHome =
    process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");
  const svcPath = path.join(configHome, "systemd", "user", "icqq.service");
  try {
    await fs.access(svcPath);
    log("移除误装的全局 unit icqq.service…");
    try {
      execSync(`systemctl --user disable --now icqq.service 2>/dev/null`, {
        stdio: "ignore",
      });
    } catch {
      /* ignore */
    }
    await fs.unlink(svcPath);
    try {
      execSync("systemctl --user daemon-reload", { stdio: "pipe" });
    } catch {
      /* ignore */
    }
  } catch {
    /* not present */
  }
}

export async function installService(
  uin: number,
  log: (s: string) => void,
): Promise<void> {
  await clearDaemonStoppedFlag(uin);
  await cleanupLegacyGlobalService(log);
  if (process.platform === "darwin") {
    await _installLaunchd(uin, log);
  } else {
    await _installSystemd(uin, log);
  }
}

export async function uninstallService(
  uin: number,
  log: (s: string) => void,
): Promise<void> {
  if (process.platform === "darwin") {
    await _uninstallLaunchd(uin, log);
  } else {
    await _uninstallSystemd(uin, log);
  }
}

export async function startService(
  uin: number,
  log: (s: string) => void,
): Promise<void> {
  await clearDaemonStoppedFlag(uin);
  const svcState =
    process.platform === "darwin"
      ? await _queryLaunchd(uin)
      : await _querySystemd(uin);
  if ((await isDaemonRunning(uin)) && !svcState.running) {
    throw new Error(
      `账号 ${uin} 守护进程已在运行，但未由系统服务托管。请执行 \`icqq service restart -u ${uin}\` 统一到 launchd`,
    );
  }
  if (process.platform === "darwin") {
    await _startLaunchd(uin, log);
  } else {
    await _startSystemd(uin, log);
  }
}

export async function stopService(
  uin: number,
  log: (s: string) => void,
): Promise<void> {
  if (process.platform === "darwin") {
    await _stopLaunchd(uin, log);
  } else {
    await _stopSystemd(uin, log);
  }
}

export async function restartService(
  uin: number,
  log: (s: string) => void,
): Promise<void> {
  if (process.platform === "darwin") {
    await _restartLaunchd(uin, log);
  } else {
    await _restartSystemd(uin, log);
  }
}

export async function queryService(uin: number): Promise<ServiceState> {
  const base =
    process.platform === "darwin"
      ? await _queryLaunchd(uin)
      : await _querySystemd(uin);
  return { uin, ...base };
}

async function _installLaunchd(uin: number, log: (s: string) => void): Promise<void> {
  const plistPath = getLaunchdPlistPath(uin);
  await fs.mkdir(path.dirname(plistPath), { recursive: true });
  try {
    execSync(`launchctl unload "${plistPath}" 2>/dev/null`, { stdio: "ignore" });
  } catch {
    /* ignore */
  }
  log(`写入 plist → ${plistPath}`);
  await fs.writeFile(plistPath, buildLaunchdPlist(uin), { mode: 0o644 });
  log("加载 launchd 服务…");
  execSync(`launchctl load "${plistPath}"`, { stdio: "pipe" });
}

async function _uninstallLaunchd(uin: number, log: (s: string) => void): Promise<void> {
  const plistPath = getLaunchdPlistPath(uin);
  try {
    await fs.access(plistPath);
  } catch {
    throw new Error(`未找到 plist: ${plistPath}，请确认服务已安装`);
  }
  log("停止并卸载 launchd 服务…");
  try {
    execSync(`launchctl unload "${plistPath}"`, { stdio: "pipe" });
  } catch {
    /* already stopped */
  }
  log(`删除 plist → ${plistPath}`);
  await fs.unlink(plistPath);
}

function _isLaunchdJobLoaded(uin: number): boolean {
  try {
    execSync(`launchctl list "${getLaunchdLabel(uin)}" 2>/dev/null`, {
      encoding: "utf-8",
    });
    return true;
  } catch {
    return false;
  }
}

function _launchdKickstartTarget(uin: number): string {
  const uid = process.getuid?.();
  if (uid === undefined) {
    throw new Error("无法获取当前用户 UID");
  }
  return `gui/${uid}/${getLaunchdLabel(uin)}`;
}

async function _startLaunchd(uin: number, log: (s: string) => void): Promise<void> {
  const plistPath = getLaunchdPlistPath(uin);
  try {
    await fs.access(plistPath);
  } catch {
    throw new Error(`服务未安装，请先执行 icqq service install`);
  }

  const state = await _queryLaunchd(uin);
  if (state.running) return;

  log("启动 launchd 服务…");
  if (_isLaunchdJobLoaded(uin)) {
    execSync(`launchctl kickstart "${_launchdKickstartTarget(uin)}"`, {
      stdio: "pipe",
    });
  } else {
    execSync(`launchctl load "${plistPath}"`, { stdio: "pipe" });
  }
}

async function _stopLaunchd(uin: number, log: (s: string) => void): Promise<void> {
  const plistPath = getLaunchdPlistPath(uin);
  try {
    await fs.access(plistPath);
  } catch {
    throw new Error(`服务未安装，请先执行 icqq service install`);
  }
  log("停止 launchd 服务…");
  try {
    execSync(`launchctl unload "${plistPath}"`, { stdio: "pipe" });
  } catch {
    /* already stopped */
  }
}

async function _restartLaunchd(uin: number, log: (s: string) => void): Promise<void> {
  const plistPath = getLaunchdPlistPath(uin);
  try {
    await fs.access(plistPath);
  } catch {
    throw new Error(`服务未安装，请先执行 icqq service install`);
  }
  const state = await _queryLaunchd(uin);
  if (state.running) {
    const target = _launchdKickstartTarget(uin);
    log(`重启 launchd 服务 (${target})…`);
    try {
      execSync(`launchctl kickstart -k "${target}"`, { stdio: "pipe" });
      return;
    } catch {
      log("kickstart 失败，改用 unload/load…");
    }
  }
  await _stopLaunchd(uin, log);
  await _startLaunchd(uin, log);
}

async function _queryLaunchd(uin: number): Promise<Omit<ServiceState, "uin">> {
  const plistPath = getLaunchdPlistPath(uin);
  let installed = false;
  try {
    await fs.access(plistPath);
    installed = true;
  } catch {
    /* not installed */
  }

  let running = false;
  let pid: number | null = null;
  let lastExitCode: number | null = null;

  if (installed) {
    try {
      const out = execSync(`launchctl list "${getLaunchdLabel(uin)}" 2>/dev/null`, {
        encoding: "utf-8",
      });
      const pidMatch = out.match(/"PID"\s*=\s*(\d+)/);
      const exitMatch = out.match(/"LastExitStatus"\s*=\s*(\d+)/);
      if (pidMatch) {
        pid = Number(pidMatch[1]);
        running = pid > 0;
      }
      if (exitMatch) lastExitCode = Number(exitMatch[1]);
    } catch {
      /* service not loaded */
    }
  }

  return { installed, filePath: plistPath, running, pid, lastExitCode };
}

async function _installSystemd(uin: number, log: (s: string) => void): Promise<void> {
  const svcPath = getSystemdServicePath(uin);
  const svcName = getSystemdServiceName(uin);
  await fs.mkdir(path.dirname(svcPath), { recursive: true });
  try {
    execSync(`systemctl --user disable --now "${svcName}" 2>/dev/null`, {
      stdio: "ignore",
    });
  } catch {
    /* ignore */
  }
  log(`写入 service → ${svcPath}`);
  await fs.writeFile(svcPath, buildSystemdUnit(uin), { mode: 0o644 });
  log("重载 systemd 配置并启用服务…");
  execSync("systemctl --user daemon-reload", { stdio: "pipe" });
  execSync(`systemctl --user enable --now "${svcName}"`, { stdio: "pipe" });
}

async function _uninstallSystemd(uin: number, log: (s: string) => void): Promise<void> {
  const svcName = getSystemdServiceName(uin);
  const svcPath = getSystemdServicePath(uin);
  try {
    await fs.access(svcPath);
  } catch {
    throw new Error(`未找到 service 文件: ${svcPath}，请确认服务已安装`);
  }
  log("停止并禁用 systemd 服务…");
  try {
    execSync(`systemctl --user disable --now "${svcName}"`, { stdio: "pipe" });
  } catch {
    /* ignore */
  }
  log(`删除 service 文件 → ${svcPath}`);
  await fs.unlink(svcPath);
  log("重载 systemd 配置…");
  execSync("systemctl --user daemon-reload", { stdio: "pipe" });
}

async function _startSystemd(uin: number, log: (s: string) => void): Promise<void> {
  const svcName = getSystemdServiceName(uin);
  const svcPath = getSystemdServicePath(uin);
  try {
    await fs.access(svcPath);
  } catch {
    throw new Error(`服务未安装，请先执行 icqq service install`);
  }
  log("启动 systemd 服务…");
  execSync(`systemctl --user start "${svcName}"`, { stdio: "pipe" });
}

async function _stopSystemd(uin: number, log: (s: string) => void): Promise<void> {
  const svcName = getSystemdServiceName(uin);
  const svcPath = getSystemdServicePath(uin);
  try {
    await fs.access(svcPath);
  } catch {
    throw new Error(`服务未安装，请先执行 icqq service install`);
  }
  log("停止 systemd 服务…");
  execSync(`systemctl --user stop "${svcName}"`, { stdio: "pipe" });
}

async function _restartSystemd(uin: number, log: (s: string) => void): Promise<void> {
  const svcName = getSystemdServiceName(uin);
  const svcPath = getSystemdServicePath(uin);
  try {
    await fs.access(svcPath);
  } catch {
    throw new Error(`服务未安装，请先执行 icqq service install`);
  }
  log("重启 systemd 服务…");
  execSync(`systemctl --user restart "${svcName}"`, { stdio: "pipe" });
}

async function _querySystemd(uin: number): Promise<Omit<ServiceState, "uin">> {
  const svcName = getSystemdServiceName(uin);
  const svcPath = getSystemdServicePath(uin);
  let installed = false;
  try {
    await fs.access(svcPath);
    installed = true;
  } catch {
    /* not installed */
  }

  let running = false;
  let pid: number | null = null;
  let lastExitCode: number | null = null;

  if (installed) {
    try {
      const active = execSync(
        `systemctl --user is-active "${svcName}" 2>/dev/null`,
        { encoding: "utf-8" },
      ).trim();
      running = active === "active";
    } catch {
      /* not active */
    }
    try {
      const show = execSync(
        `systemctl --user show "${svcName}" --property=MainPID,ExecMainStatus 2>/dev/null`,
        { encoding: "utf-8" },
      );
      const pidMatch = show.match(/MainPID=(\d+)/);
      const exitMatch = show.match(/ExecMainStatus=(\d+)/);
      if (pidMatch) pid = Number(pidMatch[1]) || null;
      if (exitMatch) lastExitCode = Number(exitMatch[1]);
    } catch {
      /* ignore */
    }
  }

  return { installed, filePath: svcPath, running, pid, lastExitCode };
}


/** 命名空间式入口，描述账号守护进程完整进程契约 */
export const DaemonSupervisor = {
  janitor: janitorStaleDaemonArtifacts,
  spawn: spawnDaemon,
  stop: stopDaemon,
  isRunning: isDaemonRunning,
  getPid: getDaemonPid,
  installService,
  uninstallService,
  startService,
  stopService,
  restartService,
  queryService,
  resolveServiceUins,
  getAllUins,
} as const;
