/**
 * icqq-gateway 全局系统服务：install/uninstall/start/stop/status。
 * 数据与日志落在 ~/.icqq-gateway。
 */
import { execSync } from "node:child_process";
import { createRequire } from "node:module";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import {
  getGatewayHome,
  getGatewayLogPath,
  getGatewayStoppedPath,
} from "./lib/paths.js";

const require = createRequire(import.meta.url);

export function getGatewayEntryPath(): string {
  return require.resolve("@icqqjs/gateway/entry");
}

export function getGatewayLaunchdLabel(): string {
  return "com.icqq.gateway";
}

export function getGatewayLaunchdPlistPath(): string {
  return path.join(
    os.homedir(),
    "Library",
    "LaunchAgents",
    `${getGatewayLaunchdLabel()}.plist`,
  );
}

export function getGatewaySystemdServiceName(): string {
  return "icqq-gateway.service";
}

export function getGatewaySystemdServicePath(): string {
  const configHome =
    process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");
  return path.join(configHome, "systemd", "user", getGatewaySystemdServiceName());
}

export function buildGatewayLaunchdPlist(): string {
  const nodePath = process.execPath;
  const entryPath = getGatewayEntryPath();
  const logPath = getGatewayLogPath();
  const label = getGatewayLaunchdLabel();
  const stoppedPath = getGatewayStoppedPath();

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

export function buildGatewaySystemdUnit(): string {
  const nodePath = process.execPath;
  const entryPath = getGatewayEntryPath();
  const logPath = getGatewayLogPath();

  return `[Unit]
Description=icqq gateway (multi-bot shared MCP/RPC)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${nodePath} ${entryPath}
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

export type GatewayServiceState = {
  installed: boolean;
  filePath: string;
  running: boolean;
  pid: number | null;
};

async function clearGatewayStoppedFlag(): Promise<void> {
  try {
    await fs.unlink(getGatewayStoppedPath());
  } catch {
    /* ignore */
  }
}

export async function markGatewayGracefulStop(): Promise<void> {
  await fs.mkdir(getGatewayHome(), { recursive: true, mode: 0o700 });
  await fs.writeFile(getGatewayStoppedPath(), `${Date.now()}\n`, { mode: 0o600 });
}

export async function installGatewayService(log: (s: string) => void): Promise<void> {
  await clearGatewayStoppedFlag();
  if (process.platform === "darwin") {
    const plistPath = getGatewayLaunchdPlistPath();
    await fs.mkdir(path.dirname(plistPath), { recursive: true });
    try {
      execSync(`launchctl unload "${plistPath}" 2>/dev/null`, { stdio: "ignore" });
    } catch {
      /* ignore */
    }
    log(`写入 plist → ${plistPath}`);
    await fs.writeFile(plistPath, buildGatewayLaunchdPlist(), { mode: 0o644 });
    log("加载 launchd 服务…");
    execSync(`launchctl load "${plistPath}"`, { stdio: "pipe" });
    return;
  }
  const svcPath = getGatewaySystemdServicePath();
  const svcName = getGatewaySystemdServiceName();
  await fs.mkdir(path.dirname(svcPath), { recursive: true });
  log(`写入 service → ${svcPath}`);
  await fs.writeFile(svcPath, buildGatewaySystemdUnit(), { mode: 0o644 });
  log("重载 systemd 配置并启用服务…");
  execSync("systemctl --user daemon-reload", { stdio: "pipe" });
  execSync(`systemctl --user enable --now "${svcName}"`, { stdio: "pipe" });
}

export async function uninstallGatewayService(log: (s: string) => void): Promise<void> {
  await markGatewayGracefulStop();
  if (process.platform === "darwin") {
    const plistPath = getGatewayLaunchdPlistPath();
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
    return;
  }
  const svcName = getGatewaySystemdServiceName();
  const svcPath = getGatewaySystemdServicePath();
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
  execSync("systemctl --user daemon-reload", { stdio: "pipe" });
}

export async function startGatewayService(log: (s: string) => void): Promise<void> {
  await clearGatewayStoppedFlag();
  if (process.platform === "darwin") {
    const plistPath = getGatewayLaunchdPlistPath();
    try {
      await fs.access(plistPath);
    } catch {
      throw new Error("服务未安装，请先执行 icqq-gateway service install");
    }
    log("启动 launchd 服务…");
    const uid = process.getuid?.();
    try {
      execSync(`launchctl kickstart "gui/${uid}/${getGatewayLaunchdLabel()}"`, {
        stdio: "pipe",
      });
    } catch {
      execSync(`launchctl load "${plistPath}"`, { stdio: "pipe" });
    }
    return;
  }
  log("启动 systemd 服务…");
  execSync(`systemctl --user start "${getGatewaySystemdServiceName()}"`, {
    stdio: "pipe",
  });
}

export async function stopGatewayService(log: (s: string) => void): Promise<void> {
  await markGatewayGracefulStop();
  if (process.platform === "darwin") {
    const plistPath = getGatewayLaunchdPlistPath();
    log("停止 launchd 服务…");
    try {
      execSync(`launchctl unload "${plistPath}"`, { stdio: "pipe" });
    } catch {
      /* already stopped */
    }
    return;
  }
  log("停止 systemd 服务…");
  execSync(`systemctl --user stop "${getGatewaySystemdServiceName()}"`, {
    stdio: "pipe",
  });
}

export async function queryGatewayService(): Promise<GatewayServiceState> {
  if (process.platform === "darwin") {
    const plistPath = getGatewayLaunchdPlistPath();
    let installed = false;
    try {
      await fs.access(plistPath);
      installed = true;
    } catch {
      /* not installed */
    }
    let running = false;
    let pid: number | null = null;
    if (installed) {
      try {
        const out = execSync(
          `launchctl list "${getGatewayLaunchdLabel()}" 2>/dev/null`,
          { encoding: "utf-8" },
        );
        const m = out.match(/"PID"\s*=\s*(\d+)/);
        if (m) {
          pid = Number(m[1]);
          running = pid > 0;
        }
      } catch {
        /* not loaded */
      }
    }
    return { installed, filePath: plistPath, running, pid };
  }

  const svcName = getGatewaySystemdServiceName();
  const svcPath = getGatewaySystemdServicePath();
  let installed = false;
  try {
    await fs.access(svcPath);
    installed = true;
  } catch {
    /* not installed */
  }
  let running = false;
  let pid: number | null = null;
  if (installed) {
    try {
      const active = execSync(
        `systemctl --user is-active "${svcName}" 2>/dev/null`,
        { encoding: "utf-8" },
      ).trim();
      running = active === "active";
    } catch {
      /* inactive */
    }
    try {
      const show = execSync(
        `systemctl --user show "${svcName}" --property=MainPID 2>/dev/null`,
        { encoding: "utf-8" },
      );
      const m = show.match(/MainPID=(\d+)/);
      if (m) pid = Number(m[1]) || null;
    } catch {
      /* ignore */
    }
  }
  return { installed, filePath: svcPath, running, pid };
}
