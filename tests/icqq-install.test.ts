import { afterEach, describe, it, expect, vi } from "vitest";
import {
  IcqqInstallError,
  ICQQ_PACKAGE,
  classifyInstallFailure,
  detectPackageManager,
  formatInstallEnvironment,
  formatGithubInstallCommand,
  formatPublicInstallCommand,
  githubInstallInvocation,
  publicInstallInvocation,
  discoverIcqq,
  resolveSetupToken,
  resolveSetupTokenWithSource,
  runGithubPackagesGlobalInstall,
  runPublicRegistryGlobalInstall,
  extractInstallFailureDetail,
  summarizeInstallFailure,
  CLI_PACKAGE,
} from "../src/lib/icqq-install.js";

type ChildProcessOverrides = {
  execSyncImpl?: (command: string, options?: unknown) => unknown;
  spawnSyncImpl?: (cmd: string, args: string[], options?: unknown) => unknown;
};

type ResolveOverrides = Partial<typeof import("../src/lib/icqq-resolve.js")>;
type PmVersionOverrides = Partial<typeof import("../src/lib/pm-version.js")>;

async function loadIcqqInstallWithMocks(options?: {
  childProcess?: ChildProcessOverrides;
  resolve?: ResolveOverrides;
  pmVersion?: PmVersionOverrides;
}) {
  vi.resetModules();

  const actualResolve = await vi.importActual<typeof import("../src/lib/icqq-resolve.js")>(
    "../src/lib/icqq-resolve.js",
  );
  const actualPmVersion = await vi.importActual<typeof import("../src/lib/pm-version.js")>(
    "../src/lib/pm-version.js",
  );

  const execSyncMock = vi.fn(options?.childProcess?.execSyncImpl);
  const spawnSyncMock = vi.fn(
    options?.childProcess?.spawnSyncImpl ??
      (() => ({ status: 0, stdout: "", stderr: "" })),
  );

  vi.doMock("node:child_process", () => ({
    execSync: execSyncMock,
    spawnSync: spawnSyncMock,
  }));
  vi.doMock("../src/lib/icqq-resolve.js", () => ({
    ...actualResolve,
    ...options?.resolve,
  }));
  vi.doMock("../src/lib/pm-version.js", () => ({
    ...actualPmVersion,
    ...options?.pmVersion,
  }));

  const mod = await import("../src/lib/icqq-install.js");
  return { mod, execSyncMock, spawnSyncMock };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  vi.doUnmock("node:child_process");
  vi.doUnmock("../src/lib/icqq-resolve.js");
  vi.doUnmock("../src/lib/pm-version.js");
});

describe("icqq-install", () => {
  it("github install pnpm uses env only (no broken --config placeholders)", () => {
    const { args } = githubInstallInvocation("pnpm", ICQQ_PACKAGE, { majorVersion: 11 });
    expect(args).toEqual(["add", "-g", ICQQ_PACKAGE]);
    expect(args.join(" ")).not.toContain("${GITHUB_TOKEN}");
  });

  it("classifies auth errors", () => {
    expect(classifyInstallFailure("npm ERR! code E401")).toBe("auth");
    expect(classifyInstallFailure("network timeout")).toBe("other");
  });

  it("summarize auth failure", () => {
    expect(summarizeInstallFailure("auth", "")).toContain("read:packages");
  });

  it("extractInstallFailureDetail prefers pnpm stdout errors", () => {
    const detail = [
      "Command failed: pnpm add -g @icqqjs/icqq",
      "ERR_PNPM_FETCH_401  GET https://npm.pkg.github.com/@icqqjs%2Ficqq: Unauthorized",
    ].join("\n");
    expect(extractInstallFailureDetail(detail)).toContain("ERR_PNPM_FETCH_401");
    expect(summarizeInstallFailure("other", detail)).toContain("ERR_PNPM_FETCH_401");
  });

  it("resolveSetupToken prefers flag over env", () => {
    const prev = process.env.GITHUB_TOKEN;
    process.env.GITHUB_TOKEN = "from-env";
    expect(resolveSetupToken("from-flag")).toBe("from-flag");
    if (prev === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = prev;
  });

  it("resolves token from environment fallbacks", () => {
    const prevGithub = process.env.GITHUB_TOKEN;
    const prevIcqq = process.env.ICQQ_GITHUB_TOKEN;

    delete process.env.GITHUB_TOKEN;
    process.env.ICQQ_GITHUB_TOKEN = "from-icqq-env";
    expect(resolveSetupToken()).toBe("from-icqq-env");

    process.env.GITHUB_TOKEN = "from-github-env";
    expect(resolveSetupToken()).toBe("from-github-env");

    if (prevGithub === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = prevGithub;
    if (prevIcqq === undefined) delete process.env.ICQQ_GITHUB_TOKEN;
    else process.env.ICQQ_GITHUB_TOKEN = prevIcqq;
  });

  it("builds install invocations for yarn and cnpm variants", () => {
    expect(githubInstallInvocation("yarn", ICQQ_PACKAGE, { majorVersion: 1 }).cmd).toBe("npm");
    expect(
      githubInstallInvocation("yarn", ICQQ_PACKAGE, { majorVersion: 3 }).args.slice(0, 4),
    ).toEqual(["npm", "install", "-g", ICQQ_PACKAGE]);
    expect(githubInstallInvocation("cnpm", ICQQ_PACKAGE, { majorVersion: 9 }).cmd).toBe("cnpm");
    expect(formatGithubInstallCommand("npm", ICQQ_PACKAGE, { majorVersion: 10 })).toContain(
      "npm install -g @icqqjs/icqq",
    );
  });

  it("builds public registry cli upgrade command", () => {
    expect(publicInstallInvocation("pnpm", CLI_PACKAGE, { majorVersion: 11 }).args).toEqual([
      "add",
      "-g",
      `${CLI_PACKAGE}@latest`,
    ]);
    expect(formatPublicInstallCommand("npm", CLI_PACKAGE, { majorVersion: 10 })).toContain(
      "npm install -g @icqqjs/cli@latest",
    );
  });

  it("detects package manager from argv path", () => {
    const prev = process.argv[1];

    process.argv[1] = "/tmp/.pnpm/icqq/bin.js";
    expect(detectPackageManager()).toBe("pnpm");

    process.argv[1] = "/tmp/yarn/bin/icqq.js";
    expect(detectPackageManager()).toBe("yarn");

    process.argv[1] = prev;
  });

  it("summarizes wrong registry 404 distinctly", () => {
    expect(
      summarizeInstallFailure(
        "other",
        "404 Not Found - GET https://registry.npmjs.org/@icqqjs%2ficqq",
      ),
    ).toContain("npmjs.org 而非 GitHub Packages");
  });

  it("detects package manager from env probe when argv path does not match", async () => {
    const prevArgv1 = process.argv[1];
    const prevPnpmHome = process.env.PNPM_HOME;
    const prevCnpmHome = process.env.CNPM_HOME;
    const prevYarnHome = process.env.YARN_GLOBAL_FOLDER;
    process.argv[1] = "/tmp/icqq.js";
    delete process.env.PNPM_HOME;
    process.env.CNPM_HOME = "/tmp/cnpm";
    delete process.env.YARN_GLOBAL_FOLDER;

    const { mod, execSyncMock } = await loadIcqqInstallWithMocks({
      childProcess: {
        execSyncImpl: () => "9.0.0",
      },
    });

    expect(mod.detectPackageManager()).toBe("cnpm");
    expect(execSyncMock).toHaveBeenCalledWith("cnpm --version", { stdio: "ignore" });

    process.argv[1] = prevArgv1;
    if (prevPnpmHome === undefined) delete process.env.PNPM_HOME;
    else process.env.PNPM_HOME = prevPnpmHome;
    if (prevCnpmHome === undefined) delete process.env.CNPM_HOME;
    else process.env.CNPM_HOME = prevCnpmHome;
    if (prevYarnHome === undefined) delete process.env.YARN_GLOBAL_FOLDER;
    else process.env.YARN_GLOBAL_FOLDER = prevYarnHome;
  });

  it("falls back to npm when env probes fail", async () => {
    const prevArgv1 = process.argv[1];
    const prevYarnHome = process.env.YARN_GLOBAL_FOLDER;
    process.argv[1] = "/tmp/icqq.js";
    process.env.YARN_GLOBAL_FOLDER = "/tmp/yarn";

    const { mod } = await loadIcqqInstallWithMocks({
      childProcess: {
        execSyncImpl: () => {
          throw new Error("missing");
        },
      },
    });

    expect(mod.detectPackageManager()).toBe("npm");

    process.argv[1] = prevArgv1;
    if (prevYarnHome === undefined) delete process.env.YARN_GLOBAL_FOLDER;
    else process.env.YARN_GLOBAL_FOLDER = prevYarnHome;
  });

  it("discoverIcqq returns found result when runtime load works", async () => {
    const logs: string[] = [];
    const { mod } = await loadIcqqInstallWithMocks({
      resolve: {
        isIcqqAvailable: vi.fn().mockResolvedValue(true),
        getIcqqPath: vi.fn().mockResolvedValue("/global/icqq"),
      },
    });

    await expect(mod.discoverIcqq((line) => logs.push(line))).resolves.toEqual({
      found: true,
      path: "/global/icqq",
      listedButUnloadable: false,
    });
    expect(logs.some((line) => line.includes("可以加载（/global/icqq）"))).toBe(true);
  });

  it("discoverIcqq reports reinstall when package is listed but unloadable", async () => {
    const logs: string[] = [];
    const { mod, execSyncMock } = await loadIcqqInstallWithMocks({
      childProcess: {
        execSyncImpl: (command) => {
          if (command.startsWith("pnpm list -g")) return "@icqqjs/icqq";
          throw new Error("not found");
        },
      },
      resolve: {
        isIcqqAvailable: vi.fn().mockResolvedValue(false),
        collectGlobalNodeModulesRoots: vi.fn().mockReturnValue(["/r1", "/r2"]),
        resolveIcqqPackageRoot: vi.fn().mockReturnValue("/r1/@icqqjs/icqq"),
        resolveIcqqEntryPath: vi.fn().mockReturnValue("/r1/@icqqjs/icqq/index.js"),
      },
    });

    await expect(mod.discoverIcqq((line) => logs.push(line))).resolves.toEqual({
      found: false,
      path: "/r1/@icqqjs/icqq",
      listedButUnloadable: true,
    });
    expect(execSyncMock).toHaveBeenCalledTimes(4);
    expect(logs.some((line) => line.includes("找到包目录（/r1/@icqqjs/icqq）但未能加载"))).toBe(true);
    expect(logs.some((line) => line.includes("需重新安装以修复"))).toBe(true);
  });

  it("discoverIcqq reports install needed when no roots resolve", async () => {
    const logs: string[] = [];
    const { mod } = await loadIcqqInstallWithMocks({
      childProcess: {
        execSyncImpl: () => {
          throw new Error("not found");
        },
      },
      resolve: {
        isIcqqAvailable: vi.fn().mockResolvedValue(false),
        collectGlobalNodeModulesRoots: vi.fn().mockReturnValue([]),
        resolveIcqqPackageRoot: vi.fn().mockReturnValue(null),
        resolveIcqqEntryPath: vi.fn().mockReturnValue(null),
      },
    });

    await expect(mod.discoverIcqq((line) => logs.push(line))).resolves.toEqual({
      found: false,
      path: null,
      listedButUnloadable: false,
    });
    expect(logs.some((line) => line.includes("已扫描 0 个目录"))).toBe(true);
    expect(logs.some((line) => line.includes("结论：需要安装"))).toBe(true);
  });

  it("falls back to npm when auth install fails on another package manager", async () => {
    const { mod, spawnSyncMock } = await loadIcqqInstallWithMocks({
      childProcess: {
        spawnSyncImpl: (cmd) => {
          if (cmd === "pnpm") {
            return { status: 1, stdout: "npm ERR! code E401", stderr: "" };
          }
          return { status: 0, stdout: "", stderr: "" };
        },
      },
      pmVersion: {
        getPackageManagerMajor: vi.fn((pm: string) => (pm === "pnpm" ? 11 : 10)),
      },
    });

    expect(() => mod.runGithubPackagesGlobalInstall("pnpm", "token-1")).not.toThrow();
    expect(spawnSyncMock.mock.calls.some((call) => call[0] === "npm")).toBe(true);
  });

  it("wraps fallback failure details when npm retry also fails", async () => {
    const { mod } = await loadIcqqInstallWithMocks({
      childProcess: {
        spawnSyncImpl: (cmd) => {
          if (cmd === "pnpm" || cmd === "npm") {
            return { status: 1, stdout: "npm ERR! code E401", stderr: "" };
          }
          return { status: 0, stdout: "", stderr: "" };
        },
      },
      pmVersion: {
        getPackageManagerMajor: vi.fn((pm: string) => (pm === "pnpm" ? 11 : 10)),
      },
    });

    expect(() => mod.runGithubPackagesGlobalInstall("pnpm", "token-2")).toThrow(
      "已用 npm 重试仍失败",
    );
    try {
      mod.runGithubPackagesGlobalInstall("pnpm", "token-2");
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).name).toBe("IcqqInstallError");
      expect((error as IcqqInstallError).detail).toContain("--- npm fallback ---");
      expect((error as IcqqInstallError).detail).toContain("认证策略：");
    }
  });

  it("reinstall removes global package before install when requested", async () => {
    const { mod, spawnSyncMock } = await loadIcqqInstallWithMocks({
      childProcess: {
        spawnSyncImpl: (cmd, args) => {
          if (cmd === "pnpm" && args[0] === "remove") {
            return { status: 0, stdout: "", stderr: "" };
          }
          if (cmd === "pnpm" && args[0] === "add") {
            return { status: 0, stdout: "", stderr: "" };
          }
          return { status: 0, stdout: "", stderr: "" };
        },
      },
      pmVersion: {
        getPackageManagerMajor: vi.fn(() => 11),
      },
    });

    mod.runGithubPackagesGlobalInstall("pnpm", "token-3", mod.ICQQ_PACKAGE, {
      reinstall: true,
    });
    expect(spawnSyncMock.mock.calls[0]).toEqual([
      "pnpm",
      ["remove", "-g", mod.ICQQ_PACKAGE],
      expect.any(Object),
    ]);
    expect(spawnSyncMock.mock.calls.some((call) => call[1]?.[0] === "add")).toBe(true);
  });

  it("formats install environment with compatibility warning", async () => {
    const { mod } = await loadIcqqInstallWithMocks({
      pmVersion: {
        getPackageManagerMajor: vi.fn(() => 20),
      },
    });

    expect(mod.formatInstallEnvironment("pnpm")).toContain("不在最近维护的大版本窗口");
    expect(mod.formatInstallEnvironment("pnpm")).toContain("pnpm@20");
  });
});
