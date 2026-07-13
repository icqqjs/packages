export const MIGRATIONS: string[] = [
  `CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY,
    applied_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS api_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash TEXT NOT NULL UNIQUE,
    label TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS icqq_instances (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    uin INTEGER NOT NULL UNIQUE,
    kind TEXT NOT NULL CHECK (kind IN ('local', 'remote')),
    rpc_host TEXT,
    rpc_port INTEGER,
    rpc_token_enc TEXT,
    label TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_instances_user ON icqq_instances(user_id)`,
  `CREATE INDEX IF NOT EXISTS idx_api_tokens_user ON api_tokens(user_id)`,
  `CREATE TABLE IF NOT EXISTS hosts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('local', 'remote')),
    base_url TEXT NOT NULL,
    host_token_enc TEXT NOT NULL,
    is_local INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'unknown',
    last_seen_at TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS pairing_codes (
    code TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS idx_hosts_user ON hosts(user_id)`,
];

/**
 * 幂等的增量迁移（node:sqlite 无 information_schema，用 try/catch 吞掉已存在错误）。
 * 每条都必须能重复执行。
 */
export const ALTERATIONS: string[] = [
  // token 掩码展示所需：保存明文后四位（非敏感），列表接口返回 tk-****后四位
  `ALTER TABLE api_tokens ADD COLUMN token_hint TEXT`,
  `ALTER TABLE icqq_instances ADD COLUMN host_id TEXT REFERENCES hosts(id) ON DELETE SET NULL`,
  `ALTER TABLE users ADD COLUMN must_change_password INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE hosts ADD COLUMN proxy_data_plane INTEGER NOT NULL DEFAULT 0`,
];
