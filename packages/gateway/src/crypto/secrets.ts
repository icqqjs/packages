import path from "node:path";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import fs from "node:fs/promises";
import { getGatewayKeyPath, isProductionGatewayMode } from "../lib/paths.js";

const ALGO = "aes-256-gcm";
const IV_LEN = 12;
const TAG_LEN = 16;
const KEY_LEN = 32;

export function deriveMasterKey(raw: string): Buffer {
  return scryptSync(raw, "icqq-gateway", KEY_LEN);
}

export async function loadOrCreateMasterKey(explicit?: string): Promise<Buffer> {
  if (explicit) return deriveMasterKey(explicit);
  const env = process.env.GATEWAY_MASTER_KEY?.trim();
  if (env) return deriveMasterKey(env);

  const keyPath = getGatewayKeyPath();
  if (isProductionGatewayMode()) {
    try {
      const raw = (await fs.readFile(keyPath, "utf-8")).trim();
      if (raw) return deriveMasterKey(raw);
    } catch {
      /* fall through */
    }
    throw new Error(
      "生产环境必须提供 GATEWAY_MASTER_KEY 或挂载 gateway.key，禁止自动生成",
    );
  }

  try {
    const raw = (await fs.readFile(keyPath, "utf-8")).trim();
    if (!raw) throw new Error("empty key");
    return deriveMasterKey(raw);
  } catch {
    const generated = randomBytes(32).toString("hex");
    await fs.mkdir(path.dirname(keyPath), { recursive: true, mode: 0o700 });
    await fs.writeFile(keyPath, `${generated}\n`, { mode: 0o600 });
    console.warn(
      `[gateway] 已自动生成主密钥 ${keyPath}，请妥善备份`,
    );
    return deriveMasterKey(generated);
  }
}

export function encryptSecret(masterKey: Buffer, plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, masterKey, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

export function decryptSecret(masterKey: Buffer, payload: string): string {
  const buf = Buffer.from(payload, "base64");
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const data = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv(ALGO, masterKey, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}

export function hashPassword(password: string, salt?: string): string {
  const s = salt ?? randomBytes(16).toString("hex");
  const hash = scryptSync(password, s, 64).toString("hex");
  return `${s}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const computed = scryptSync(password, salt, 64).toString("hex");
  return computed === hash;
}

export function hashApiToken(token: string): string {
  return scryptSync(token, "icqq-api-token", 32).toString("hex");
}
