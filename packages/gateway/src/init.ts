import { randomBytes } from "node:crypto";
import os from "node:os";
import { loadConfig } from "@icqqjs/sdk/gateway";
import { GatewayStore } from "./db/store.js";

export type GatewayInitOptions = {
  adminUsername?: string;
  adminPassword?: string;
  httpHost?: string;
  httpPort?: number;
  masterKey?: string;
  migrateLocal?: boolean;
  registrationEnabled?: boolean;
};

export type GatewayInitResult = {
  alreadyInitialized: boolean;
  adminUserId?: string;
  adminUsername?: string;
  initialPassword?: string;
  mustChangePassword?: boolean;
  apiToken?: string;
  localHostId?: string;
  migratedUins: number[];
};

function defaultAdminUsername(): string {
  return process.env.USER || process.env.USERNAME || os.userInfo().username || "admin";
}

function generateInitialPassword(): string {
  return randomBytes(9).toString("base64url");
}

/**
 * gateway init：初始化 SQLite、默认 owner、本机 host、默认 API token。
 * 未提供密码时自动生成初始密码并返回（仅显示一次）。
 */
export async function runGatewayInit(
  options: GatewayInitOptions = {},
): Promise<GatewayInitResult> {
  const store = await GatewayStore.open(options.masterKey);
  try {
    if (store.isInitialized()) {
      return { alreadyInitialized: true, migratedUins: [] };
    }

    const httpHost = options.httpHost ?? "127.0.0.1";
    const httpPort = options.httpPort ?? 8787;
    const adminUsername = options.adminUsername ?? defaultAdminUsername();
    const generatedPassword = options.adminPassword ? undefined : generateInitialPassword();
    const adminPassword = options.adminPassword ?? generatedPassword!;

    store.setSettings({
      httpHost,
      httpPort,
      sessionSecret: randomBytes(32).toString("hex"),
      registrationEnabled: options.registrationEnabled ?? false,
    });

    const admin = store.createUser({
      username: adminUsername,
      password: adminPassword,
      role: "admin",
      mustChangePassword: Boolean(generatedPassword),
    });

    const { token } = store.createApiToken(admin.id, "default");

    const { host: localHost } = store.createHost({
      userId: admin.id,
      name: "本机",
      kind: "local",
      baseUrl: `http://${httpHost}:${httpPort}`,
      isLocal: true,
    });

    const migratedUins: number[] = [];
    if (options.migrateLocal) {
      const config = await loadConfig();
      for (const key of Object.keys(config.accounts)) {
        const uin = Number(key);
        if (!Number.isInteger(uin) || uin <= 0) continue;
        if (store.getInstanceByUin(uin)) {
          store.attachInstancesToHost(localHost.id, admin.id);
          continue;
        }
        store.upsertInstanceForHost({
          userId: admin.id,
          hostId: localHost.id,
          uin,
          label: "migrated",
        });
        migratedUins.push(uin);
      }
    }

    store.attachInstancesToHost(localHost.id, admin.id);

    if (generatedPassword) {
      console.log(
        `[gateway] 已创建管理员 ${adminUsername}，初始密码（仅显示一次）: ${generatedPassword}`,
      );
      console.log("[gateway] 首次登录后请立即修改密码");
    }

    return {
      alreadyInitialized: false,
      adminUserId: admin.id,
      adminUsername,
      initialPassword: generatedPassword,
      mustChangePassword: Boolean(generatedPassword),
      apiToken: token,
      localHostId: localHost.id,
      migratedUins,
    };
  } finally {
    store.close();
  }
}
