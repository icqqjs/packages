import { afterEach, beforeEach, describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { GatewayStore } from "../src/db/store.js";

let tmpHome: string;

beforeEach(async () => {
  tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "icqq-gw-"));
  process.env.GATEWAY_HOME = tmpHome;
});

afterEach(async () => {
  delete process.env.GATEWAY_HOME;
  await fs.rm(tmpHome, { recursive: true, force: true });
});

describe("GatewayStore", () => {
  it("creates users, verifies passwords and isolates instances by owner", async () => {
    const store = await GatewayStore.open("master-key");
    try {
      expect(store.isInitialized()).toBe(false);

      const admin = store.createUser({
        username: "admin",
        password: "pw-admin",
        role: "admin",
      });
      const alice = store.createUser({ username: "alice", password: "pw-alice" });

      expect(store.isInitialized()).toBe(true);
      expect(store.verifyUserPassword("admin", "pw-admin")?.id).toBe(admin.id);
      expect(store.verifyUserPassword("admin", "bad")).toBeNull();

      store.addInstance({ userId: admin.id, uin: 111, kind: "local" });
      store.addInstance({ userId: alice.id, uin: 222, kind: "local" });

      expect(store.listInstancesForUser(admin.id).map((i) => i.uin)).toEqual([111]);
      expect(store.listInstancesForUser(alice.id).map((i) => i.uin)).toEqual([222]);

      expect(store.userOwnsUin(admin.id, 111)).toBe(true);
      expect(store.userOwnsUin(admin.id, 222)).toBe(false);
      expect(store.userOwnsUin(alice.id, 222)).toBe(true);
    } finally {
      store.close();
    }
  });

  it("encrypts remote RPC tokens at rest and decrypts on read", async () => {
    const store = await GatewayStore.open("master-key");
    try {
      const owner = store.createUser({ username: "owner", password: "pw" });
      const inst = store.addInstance({
        userId: owner.id,
        uin: 333,
        kind: "remote",
        rpcHost: "10.0.0.1",
        rpcPort: 9000,
        rpcToken: "plain-rpc-token",
      });

      expect(inst.rpc_token_enc).toBeTruthy();
      expect(inst.rpc_token_enc).not.toContain("plain-rpc-token");
      const stored = store.getInstanceByUin(333)!;
      expect(store.getInstanceRpcToken(stored)).toBe("plain-rpc-token");
    } finally {
      store.close();
    }
  });

  it("resolves users via api tokens and sessions", async () => {
    const store = await GatewayStore.open("master-key");
    try {
      const user = store.createUser({ username: "bob", password: "pw" });
      const { token } = store.createApiToken(user.id, "cli");
      expect(store.findUserByApiToken(token)?.id).toBe(user.id);
      expect(store.findUserByApiToken("nope")).toBeNull();

      const sid = store.createSession(user.id);
      expect(store.findUserBySession(sid)?.id).toBe(user.id);
      store.deleteSession(sid);
      expect(store.findUserBySession(sid)).toBeNull();
    } finally {
      store.close();
    }
  });

  it("issues tk- prefixed tokens, masks them in listing, and destroys them", async () => {
    const store = await GatewayStore.open("master-key");
    try {
      const user = store.createUser({ username: "carol", password: "pw" });
      const { id, token } = store.createApiToken(user.id, "n8n");

      expect(token.startsWith("tk-")).toBe(true);

      const list = store.listApiTokens(user.id);
      expect(list).toHaveLength(1);
      expect(list[0]!.masked).toBe(`tk-${"•".repeat(8)}${token.slice(-4)}`);
      expect(list[0]!.masked).not.toContain(token.slice(3, 10));
      expect(list[0]!.label).toBe("n8n");

      // 不能删除别人的 token
      const other = store.createUser({ username: "dave", password: "pw" });
      expect(store.deleteApiToken(other.id, id)).toBe(false);
      expect(store.listApiTokens(user.id)).toHaveLength(1);

      expect(store.deleteApiToken(user.id, id)).toBe(true);
      expect(store.listApiTokens(user.id)).toHaveLength(0);
      expect(store.findUserByApiToken(token)).toBeNull();
    } finally {
      store.close();
    }
  });

  it("transfers and deletes instances", async () => {
    const store = await GatewayStore.open("master-key");
    try {
      const a = store.createUser({ username: "a", password: "pw" });
      const b = store.createUser({ username: "b", password: "pw" });
      const inst = store.addInstance({ userId: a.id, uin: 444, kind: "local" });

      store.transferInstanceOwner(inst.id, b.id);
      expect(store.userOwnsUin(b.id, 444)).toBe(true);
      expect(store.userOwnsUin(a.id, 444)).toBe(false);

      store.deleteInstance(inst.id);
      expect(store.getInstanceByUin(444)).toBeNull();
    } finally {
      store.close();
    }
  });
});
