import { spawnSync } from "node:child_process";

/**
 * 检测 TCP 端口是否已有进程在监听（任意地址均算占用）。
 * Unix/macOS 用 lsof；Windows 用 netstat；命令不可用时回退 bind 探测。
 */
export function isPortInUse(port: number): boolean {
  if (port <= 0) return false;

  const fromSpawn = probeListeningPortWithSpawn(port);
  if (fromSpawn !== undefined) return fromSpawn;
  return !probePortAvailableWithBind(port);
}

function probeListeningPortWithSpawn(port: number): boolean | undefined {
  if (process.platform === "win32") {
    return probePortWindowsNetstat(port);
  }
  return probePortUnixLsof(port);
}

function probePortUnixLsof(port: number): boolean | undefined {
  const r = spawnSync("lsof", ["-nP", `-iTCP:${port}`, "-sTCP:LISTEN"], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (r.error && (r.error as NodeJS.ErrnoException).code === "ENOENT") {
    return undefined;
  }
  return r.status === 0 && Boolean(r.stdout?.trim());
}

function probePortWindowsNetstat(port: number): boolean | undefined {
  const r = spawnSync("netstat", ["-ano"], {
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "ignore"],
  });
  if (r.error && (r.error as NodeJS.ErrnoException).code === "ENOENT") {
    return undefined;
  }
  const pattern = new RegExp(`:${port}(?:\\s|$)`);
  return (r.stdout ?? "").split(/\r?\n/).some((line) => {
    const upper = line.toUpperCase();
    return upper.includes("LISTEN") && pattern.test(line);
  });
}

/** 尝试 bind 127.0.0.1:port，成功则端口可用 */
function probePortAvailableWithBind(port: number): boolean {
  const script = `
const net = require("net");
const server = net.createServer();
server.once("error", () => process.exit(1));
server.once("listening", () => server.close(() => process.exit(0)));
server.listen(${port}, "127.0.0.1");
`;
  const r = spawnSync(process.execPath, ["-e", script], { stdio: "ignore" });
  return r.status === 0;
}
