import { describe, expect, it } from "vitest";
import {
  deriveMasterKey,
  encryptSecret,
  decryptSecret,
  hashApiToken,
  hashPassword,
  verifyPassword,
} from "../src/crypto/secrets.js";

describe("secrets", () => {
  it("encrypts and decrypts round-trip with the same master key", () => {
    const key = deriveMasterKey("test-master-key");
    const enc = encryptSecret(key, "super-secret-token");
    expect(enc).not.toContain("super-secret-token");
    expect(decryptSecret(key, enc)).toBe("super-secret-token");
  });

  it("fails to decrypt with a different master key", () => {
    const key = deriveMasterKey("key-a");
    const other = deriveMasterKey("key-b");
    const enc = encryptSecret(key, "payload");
    expect(() => decryptSecret(other, enc)).toThrow();
  });

  it("verifies passwords and rejects wrong ones", () => {
    const hash = hashPassword("hunter2");
    expect(verifyPassword("hunter2", hash)).toBe(true);
    expect(verifyPassword("wrong", hash)).toBe(false);
  });

  it("hashes api tokens deterministically", () => {
    expect(hashApiToken("abc")).toBe(hashApiToken("abc"));
    expect(hashApiToken("abc")).not.toBe(hashApiToken("abd"));
  });
});
