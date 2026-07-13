import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import fs from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { getGatewayDbPath, migrateLegacyGatewayHome } from "../lib/paths.js";
import { migrate } from "./migrate.js";
import {
  decryptSecret,
  encryptSecret,
  hashApiToken,
  hashPassword,
  loadOrCreateMasterKey,
  verifyPassword,
} from "../crypto/secrets.js";

export type UserRow = {
  id: string;
  username: string;
  password_hash: string;
  role: "admin" | "user";
  must_change_password: number;
  created_at: string;
};

export type InstanceRow = {
  id: string;
  user_id: string;
  host_id: string | null;
  uin: number;
  kind: "local" | "remote";
  rpc_host: string | null;
  rpc_port: number | null;
  rpc_token_enc: string | null;
  label: string | null;
  created_at: string;
};

export type HostRow = {
  id: string;
  user_id: string;
  name: string;
  kind: "local" | "remote";
  base_url: string;
  host_token_enc: string;
  is_local: number;
  proxy_data_plane: number;
  status: "online" | "offline" | "unknown";
  last_seen_at: string | null;
  created_at: string;
};

export type PairingCodeRow = {
  code: string;
  user_id: string;
  expires_at: string;
  used_at: string | null;
  created_at: string;
};

export type GatewaySettings = {
  httpHost: string;
  httpPort: number;
  sessionSecret: string;
  registrationEnabled: boolean;
};

export class GatewayStore {
  readonly db: DatabaseSync;
  readonly masterKey: Buffer;

  private constructor(db: DatabaseSync, masterKey: Buffer) {
    this.db = db;
    this.masterKey = masterKey;
  }

  static async open(masterKeyRaw?: string): Promise<GatewayStore> {
    await migrateLegacyGatewayHome();
    const dbPath = getGatewayDbPath();
    await fs.mkdir(path.dirname(dbPath), { recursive: true, mode: 0o700 });
    const db = new DatabaseSync(dbPath);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec("PRAGMA foreign_keys = ON");
    migrate(db);
    const masterKey = await loadOrCreateMasterKey(masterKeyRaw);
    const store = new GatewayStore(db, masterKey);
    store.ensureLocalHostMigration();
    return store;
  }

  /** 旧库升级：若无本机 host 则为 admin 自动创建并挂靠已有实例 */
  ensureLocalHostMigration(): void {
    if (!this.isInitialized() || this.getLocalHost()) return;
    const users = this.listUsers();
    const admin = users.find((u) => u.role === "admin") ?? users[0];
    if (!admin) return;
    const settings = this.getSettings();
    const { host } = this.createHost({
      userId: admin.id,
      name: "本机",
      kind: "local",
      baseUrl: `http://${settings.httpHost}:${settings.httpPort}`,
      isLocal: true,
    });
    this.attachInstancesToHost(host.id, admin.id);
  }

  isInitialized(): boolean {
    const row = this.db
      .prepare("SELECT COUNT(*) as c FROM users")
      .get() as { c: number };
    return row.c > 0;
  }

  getSettings(): GatewaySettings {
    const get = (key: string, fallback: string) => {
      const row = this.db
        .prepare("SELECT value FROM settings WHERE key = ?")
        .get(key) as { value: string } | undefined;
      return row?.value ?? fallback;
    };
    return {
      httpHost: get("http.host", "127.0.0.1"),
      httpPort: Number(get("http.port", "8787")),
      sessionSecret: get("session.secret", ""),
      registrationEnabled: get("registration.enabled", "false") === "true",
    };
  }

  setSettings(partial: Partial<GatewaySettings>): void {
    const current = this.getSettings();
    const next = { ...current, ...partial };
    const upsert = this.db.prepare(
      "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
    );
    upsert.run("http.host", next.httpHost);
    upsert.run("http.port", String(next.httpPort));
    if (next.sessionSecret) upsert.run("session.secret", next.sessionSecret);
    upsert.run("registration.enabled", next.registrationEnabled ? "true" : "false");
  }

  isRegistrationEnabled(): boolean {
    return this.getSettings().registrationEnabled;
  }

  getHostAgentToken(): string | null {
    const row = this.db
      .prepare("SELECT value FROM settings WHERE key = ?")
      .get("host.agent.token") as { value: string } | undefined;
    return row?.value ?? null;
  }

  setHostAgentToken(token: string): void {
    this.db
      .prepare(
        "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
      )
      .run("host.agent.token", token);
  }

  validateHostAgentToken(token: string): boolean {
    const agentToken = this.getHostAgentToken();
    if (agentToken && agentToken === token) return true;
    return this.findHostByToken(token) != null;
  }

  createUser(input: {
    username: string;
    password: string;
    role?: "admin" | "user";
    mustChangePassword?: boolean;
  }): UserRow {
    const id = randomUUID();
    const now = new Date().toISOString();
    const row: UserRow = {
      id,
      username: input.username,
      password_hash: hashPassword(input.password),
      role: input.role ?? "user",
      must_change_password: input.mustChangePassword ? 1 : 0,
      created_at: now,
    };
    this.db
      .prepare(
        `INSERT INTO users (id, username, password_hash, role, must_change_password, created_at)
         VALUES (@id, @username, @password_hash, @role, @must_change_password, @created_at)`,
      )
      .run(row);
    return row;
  }

  changeUserPassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): { ok: true } | { ok: false; error: string } {
    const user = this.findUserById(userId);
    if (!user) return { ok: false, error: "用户不存在" };
    if (!verifyPassword(currentPassword, user.password_hash)) {
      return { ok: false, error: "当前密码错误" };
    }
    if (newPassword.length < 6) {
      return { ok: false, error: "新密码至少 6 位" };
    }
    this.db
      .prepare(
        "UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?",
      )
      .run(hashPassword(newPassword), userId);
    return { ok: true };
  }

  setHostProxyDataPlane(hostId: string, userId: string, enabled: boolean): boolean {
    const info = this.db
      .prepare(
        "UPDATE hosts SET proxy_data_plane = ? WHERE id = ? AND user_id = ?",
      )
      .run(enabled ? 1 : 0, hostId, userId);
    return Number(info.changes) > 0;
  }

  findUserByUsername(username: string): UserRow | null {
    return (
      (this.db
        .prepare("SELECT * FROM users WHERE username = ?")
        .get(username) as UserRow | undefined) ?? null
    );
  }

  findUserById(id: string): UserRow | null {
    return (
      (this.db.prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined) ??
      null
    );
  }

  verifyUserPassword(username: string, password: string): UserRow | null {
    const user = this.findUserByUsername(username);
    if (!user || !verifyPassword(password, user.password_hash)) return null;
    return user;
  }

  listUsers(): UserRow[] {
    return this.db.prepare("SELECT * FROM users ORDER BY created_at").all() as UserRow[];
  }

  createApiToken(userId: string, label?: string): { id: string; token: string } {
    const token = `tk-${randomBytes(24).toString("hex")}`;
    const id = randomUUID();
    const hint = token.slice(-4);
    this.db
      .prepare(
        `INSERT INTO api_tokens (id, user_id, token_hash, token_hint, label, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        userId,
        hashApiToken(token),
        hint,
        label ?? null,
        new Date().toISOString(),
      );
    return { id, token };
  }

  deleteApiToken(userId: string, tokenId: string): boolean {
    const info = this.db
      .prepare("DELETE FROM api_tokens WHERE id = ? AND user_id = ?")
      .run(tokenId, userId);
    return Number(info.changes) > 0;
  }

  findUserByApiToken(token: string): UserRow | null {
    const hash = hashApiToken(token);
    const row = this.db
      .prepare(
        `SELECT u.* FROM api_tokens t JOIN users u ON u.id = t.user_id WHERE t.token_hash = ?`,
      )
      .get(hash) as UserRow | undefined;
    return row ?? null;
  }

  listApiTokens(
    userId: string,
  ): Array<{
    id: string;
    label: string | null;
    masked: string;
    created_at: string;
  }> {
    const rows = this.db
      .prepare(
        "SELECT id, label, token_hint, created_at FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC",
      )
      .all(userId) as Array<{
      id: string;
      label: string | null;
      token_hint: string | null;
      created_at: string;
    }>;
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      masked: `tk-${"•".repeat(8)}${r.token_hint ?? "????"}`,
      created_at: r.created_at,
    }));
  }

  createSession(userId: string, ttlHours = 24 * 7): string {
    const id = randomBytes(32).toString("hex");
    const now = new Date();
    const expires = new Date(now.getTime() + ttlHours * 3600_000);
    this.db
      .prepare(
        `INSERT INTO sessions (id, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)`,
      )
      .run(id, userId, expires.toISOString(), now.toISOString());
    return id;
  }

  findUserBySession(sessionId: string): UserRow | null {
    const row = this.db
      .prepare(
        `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
         WHERE s.id = ? AND s.expires_at > ?`,
      )
      .get(sessionId, new Date().toISOString()) as UserRow | undefined;
    return row ?? null;
  }

  deleteSession(sessionId: string): void {
    this.db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId);
  }

  addInstance(input: {
    userId: string;
    hostId?: string;
    uin: number;
    kind: "local" | "remote";
    rpcHost?: string;
    rpcPort?: number;
    rpcToken?: string;
    label?: string;
  }): InstanceRow {
    const id = randomUUID();
    const rpc_token_enc =
      input.rpcToken != null
        ? encryptSecret(this.masterKey, input.rpcToken)
        : null;
    const row: InstanceRow = {
      id,
      user_id: input.userId,
      host_id: input.hostId ?? null,
      uin: input.uin,
      kind: input.kind,
      rpc_host: input.rpcHost ?? null,
      rpc_port: input.rpcPort ?? null,
      rpc_token_enc,
      label: input.label ?? null,
      created_at: new Date().toISOString(),
    };
    this.db
      .prepare(
        `INSERT INTO icqq_instances
         (id, user_id, host_id, uin, kind, rpc_host, rpc_port, rpc_token_enc, label, created_at)
         VALUES (@id, @user_id, @host_id, @uin, @kind, @rpc_host, @rpc_port, @rpc_token_enc, @label, @created_at)`,
      )
      .run(row);
    return row;
  }

  upsertInstanceForHost(input: {
    userId: string;
    hostId: string;
    uin: number;
    label?: string;
  }): InstanceRow {
    const existing = this.getInstanceByUin(input.uin);
    if (existing) {
      this.db
        .prepare(
          `UPDATE icqq_instances SET host_id = ?, user_id = ?, kind = 'local', label = COALESCE(?, label)
           WHERE uin = ?`,
        )
        .run(input.hostId, input.userId, input.label ?? null, input.uin);
      return this.getInstanceByUin(input.uin)!;
    }
    return this.addInstance({
      userId: input.userId,
      hostId: input.hostId,
      uin: input.uin,
      kind: "local",
      label: input.label,
    });
  }

  getInstanceRpcToken(instance: InstanceRow): string | null {
    if (!instance.rpc_token_enc) return null;
    return decryptSecret(this.masterKey, instance.rpc_token_enc);
  }

  listInstancesForUser(userId: string): InstanceRow[] {
    return this.db
      .prepare("SELECT * FROM icqq_instances WHERE user_id = ? ORDER BY uin")
      .all(userId) as InstanceRow[];
  }

  listInstancesForHost(hostId: string): InstanceRow[] {
    return this.db
      .prepare("SELECT * FROM icqq_instances WHERE host_id = ? ORDER BY uin")
      .all(hostId) as InstanceRow[];
  }

  countInstancesForHost(hostId: string): number {
    const row = this.db
      .prepare("SELECT COUNT(*) as c FROM icqq_instances WHERE host_id = ?")
      .get(hostId) as { c: number };
    return row.c;
  }

  getInstanceByUin(uin: number): InstanceRow | null {
    return (
      (this.db
        .prepare("SELECT * FROM icqq_instances WHERE uin = ?")
        .get(uin) as InstanceRow | undefined) ?? null
    );
  }

  getInstanceById(id: string): InstanceRow | null {
    return (
      (this.db
        .prepare("SELECT * FROM icqq_instances WHERE id = ?")
        .get(id) as InstanceRow | undefined) ?? null
    );
  }

  userOwnsUin(userId: string, uin: number): boolean {
    const row = this.db
      .prepare("SELECT 1 FROM icqq_instances WHERE user_id = ? AND uin = ?")
      .get(userId, uin);
    return row != null;
  }

  transferInstanceOwner(instanceId: string, newUserId: string): void {
    this.db
      .prepare("UPDATE icqq_instances SET user_id = ? WHERE id = ?")
      .run(newUserId, instanceId);
  }

  deleteInstance(instanceId: string): void {
    this.db.prepare("DELETE FROM icqq_instances WHERE id = ?").run(instanceId);
  }

  generateHostToken(): string {
    return `ht-${randomBytes(24).toString("hex")}`;
  }

  getHostToken(host: HostRow): string {
    return decryptSecret(this.masterKey, host.host_token_enc);
  }

  createHost(input: {
    userId: string;
    name: string;
    kind: "local" | "remote";
    baseUrl: string;
    hostToken?: string;
    isLocal?: boolean;
  }): { host: HostRow; token: string } {
    const token = input.hostToken ?? this.generateHostToken();
    const id = randomUUID();
    const now = new Date().toISOString();
    const host: HostRow = {
      id,
      user_id: input.userId,
      name: input.name,
      kind: input.kind,
      base_url: input.baseUrl,
      host_token_enc: encryptSecret(this.masterKey, token),
      is_local: input.isLocal ? 1 : 0,
      proxy_data_plane: 0,
      status: "unknown",
      last_seen_at: null,
      created_at: now,
    };
    this.db
      .prepare(
        `INSERT INTO hosts
         (id, user_id, name, kind, base_url, host_token_enc, is_local, proxy_data_plane, status, last_seen_at, created_at)
         VALUES (@id, @user_id, @name, @kind, @base_url, @host_token_enc, @is_local, @proxy_data_plane, @status, @last_seen_at, @created_at)`,
      )
      .run(host);
    return { host, token };
  }

  listHostsForUser(userId: string): HostRow[] {
    return this.db
      .prepare("SELECT * FROM hosts WHERE user_id = ? ORDER BY is_local DESC, created_at")
      .all(userId) as HostRow[];
  }

  getHostById(id: string): HostRow | null {
    return (
      (this.db.prepare("SELECT * FROM hosts WHERE id = ?").get(id) as HostRow | undefined) ??
      null
    );
  }

  getLocalHost(): HostRow | null {
    return (
      (this.db
        .prepare("SELECT * FROM hosts WHERE is_local = 1 LIMIT 1")
        .get() as HostRow | undefined) ?? null
    );
  }

  findHostByToken(token: string): HostRow | null {
    const hosts = this.db.prepare("SELECT * FROM hosts").all() as HostRow[];
    for (const h of hosts) {
      try {
        if (decryptSecret(this.masterKey, h.host_token_enc) === token) return h;
      } catch {
        /* skip */
      }
    }
    return null;
  }

  updateHostStatus(
    hostId: string,
    status: HostRow["status"],
    lastSeenAt?: string,
  ): void {
    this.db
      .prepare(
        "UPDATE hosts SET status = ?, last_seen_at = COALESCE(?, last_seen_at) WHERE id = ?",
      )
      .run(status, lastSeenAt ?? new Date().toISOString(), hostId);
  }

  deleteHost(userId: string, hostId: string): boolean {
    const info = this.db
      .prepare("DELETE FROM hosts WHERE id = ? AND user_id = ? AND is_local = 0")
      .run(hostId, userId);
    return Number(info.changes) > 0;
  }

  createPairingCode(userId: string, ttlMinutes = 15): PairingCodeRow {
    const code = randomBytes(4).toString("hex").toUpperCase();
    const now = new Date();
    const expires = new Date(now.getTime() + ttlMinutes * 60_000);
    const row: PairingCodeRow = {
      code,
      user_id: userId,
      expires_at: expires.toISOString(),
      used_at: null,
      created_at: now.toISOString(),
    };
    this.db
      .prepare(
        `INSERT INTO pairing_codes (code, user_id, expires_at, used_at, created_at)
         VALUES (@code, @user_id, @expires_at, @used_at, @created_at)`,
      )
      .run(row);
    return row;
  }

  consumePairingCode(code: string): PairingCodeRow | null {
    const row = this.db
      .prepare("SELECT * FROM pairing_codes WHERE code = ?")
      .get(code.toUpperCase()) as PairingCodeRow | undefined;
    if (!row) return null;
    if (row.used_at) return null;
    if (new Date(row.expires_at) < new Date()) return null;
    this.db
      .prepare("UPDATE pairing_codes SET used_at = ? WHERE code = ?")
      .run(new Date().toISOString(), code.toUpperCase());
    return row;
  }

  attachInstancesToHost(hostId: string, userId: string): void {
    this.db
      .prepare(
        "UPDATE icqq_instances SET host_id = ? WHERE user_id = ? AND host_id IS NULL",
      )
      .run(hostId, userId);
  }

  close(): void {
    this.db.close();
  }
}
