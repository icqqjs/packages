import { afterEach, beforeEach, describe, expect, it } from "vitest";
import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { GatewayStore } from "../src/db/store.js";

let tmpHome: string;

beforeEach(async () => {
  tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "icqq-gw-host-"));
  process.env.GATEWAY_HOME = tmpHome;
});

afterEach(async () => {
  delete process.env.GATEWAY_HOME;
  await fs.rm(tmpHome, { recursive: true, force: true });
});

describe("hosts and pairing", () => {
  it("isolates hosts by owner and allows remote host CRUD", async () => {
    const store = await GatewayStore.open("master-key");
    try {
      const alice = store.createUser({ username: "alice", password: "pw" });
      const bob = store.createUser({ username: "bob", password: "pw" });

      const { host: localAlice } = store.createHost({
        userId: alice.id,
        name: "本机",
        kind: "local",
        baseUrl: "http://127.0.0.1:8787",
        isLocal: true,
      });
      const { host: remoteBob } = store.createHost({
        userId: bob.id,
        name: "远程",
        kind: "remote",
        baseUrl: "http://10.0.0.2:8787",
        isLocal: false,
      });

      expect(store.listHostsForUser(alice.id).map((h) => h.id)).toEqual([
        localAlice.id,
      ]);
      expect(store.listHostsForUser(bob.id).map((h) => h.id)).toEqual([
        remoteBob.id,
      ]);

      expect(store.deleteHost(alice.id, localAlice.id)).toBe(false);
      expect(store.deleteHost(bob.id, remoteBob.id)).toBe(true);
      expect(store.listHostsForUser(bob.id)).toHaveLength(0);
    } finally {
      store.close();
    }
  });

  it("creates and consumes pairing codes once", async () => {
    const store = await GatewayStore.open("master-key");
    try {
      const user = store.createUser({ username: "owner", password: "pw" });
      const pairing = store.createPairingCode(user.id, 15);

      expect(pairing.code).toMatch(/^[0-9A-F]{8}$/);
      expect(store.consumePairingCode(pairing.code)?.user_id).toBe(user.id);
      expect(store.consumePairingCode(pairing.code)).toBeNull();
    } finally {
      store.close();
    }
  });

  it("attaches instances to host and counts them", async () => {
    const store = await GatewayStore.open("master-key");
    try {
      const user = store.createUser({ username: "owner", password: "pw" });
      const { host } = store.createHost({
        userId: user.id,
        name: "本机",
        kind: "local",
        baseUrl: "http://127.0.0.1:8787",
        isLocal: true,
      });

      store.addInstance({ userId: user.id, uin: 10001, kind: "local" });
      store.addInstance({ userId: user.id, uin: 10002, kind: "local" });
      store.attachInstancesToHost(host.id, user.id);

      expect(store.countInstancesForHost(host.id)).toBe(2);
      expect(
        store.listInstancesForUser(user.id).every((i) => i.host_id === host.id),
      ).toBe(true);
    } finally {
      store.close();
    }
  });

  it("admin only sees own hosts, not other users", async () => {
    const store = await GatewayStore.open("master-key");
    try {
      const admin = store.createUser({
        username: "admin",
        password: "pw",
        role: "admin",
      });
      const user = store.createUser({ username: "user", password: "pw" });

      store.createHost({
        userId: admin.id,
        name: "admin 本机",
        kind: "local",
        baseUrl: "http://127.0.0.1:8787",
        isLocal: true,
      });
      store.createHost({
        userId: user.id,
        name: "user 远程",
        kind: "remote",
        baseUrl: "http://10.0.0.3:8787",
        isLocal: false,
      });

      expect(store.listHostsForUser(admin.id)).toHaveLength(1);
      expect(store.listHostsForUser(user.id)).toHaveLength(1);
    } finally {
      store.close();
    }
  });
});
