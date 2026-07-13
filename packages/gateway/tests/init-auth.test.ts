import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runGatewayInit } from "../src/init.js";
import { GatewayStore } from "../src/db/store.js";

let tmpHome: string;

beforeEach(async () => {
  tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "icqq-gw-init-"));
  process.env.GATEWAY_HOME = tmpHome;
});

afterEach(async () => {
  delete process.env.GATEWAY_HOME;
  await fs.rm(tmpHome, { recursive: true, force: true });
});

describe("gateway init and auth defaults", () => {
  it("auto-generates password and flags mustChangePassword", async () => {
    const result = await runGatewayInit({
      adminUsername: "localadmin",
    });

    expect(result.alreadyInitialized).toBe(false);
    expect(result.initialPassword).toBeTruthy();
    expect(result.mustChangePassword).toBe(true);

    const store = await GatewayStore.open();
    try {
      expect(store.isRegistrationEnabled()).toBe(false);
      const user = store.verifyUserPassword("localadmin", result.initialPassword!);
      expect(user?.must_change_password).toBe(1);
    } finally {
      store.close();
    }
  });

  it("allows explicit password without mustChangePassword", async () => {
    const result = await runGatewayInit({
      adminUsername: "admin",
      adminPassword: "strong-password",
    });

    expect(result.mustChangePassword).toBe(false);
    const store = await GatewayStore.open();
    try {
      const user = store.verifyUserPassword("admin", "strong-password");
      expect(user?.must_change_password).toBe(0);
    } finally {
      store.close();
    }
  });

  it("changeUserPassword clears must_change_password", async () => {
    await runGatewayInit({ adminUsername: "u1", adminPassword: "old-pass-1" });
    const store = await GatewayStore.open();
    try {
      const user = store.verifyUserPassword("u1", "old-pass-1")!;
      store.db
        .prepare("UPDATE users SET must_change_password = 1 WHERE id = ?")
        .run(user.id);

      const changed = store.changeUserPassword(user.id, "old-pass-1", "new-pass-2");
      expect(changed.ok).toBe(true);
      expect(store.verifyUserPassword("u1", "new-pass-2")).toBeTruthy();
      expect(store.findUserById(user.id)?.must_change_password).toBe(0);
    } finally {
      store.close();
    }
  });
});
