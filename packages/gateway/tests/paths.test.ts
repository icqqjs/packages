import { afterEach, beforeEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { getGatewayDbPath, getGatewayHome, migrateLegacyGatewayHome } from "../src/lib/paths.js";

let tmpHome: string;
let legacyHome: string;

beforeEach(async () => {
  tmpHome = await fs.mkdtemp(path.join(os.tmpdir(), "icqq-gw-home-"));
  legacyHome = await fs.mkdtemp(path.join(os.tmpdir(), "icqq-legacy-"));
  process.env.GATEWAY_HOME = tmpHome;
  process.env.HOME = legacyHome;
});

afterEach(async () => {
  delete process.env.GATEWAY_HOME;
  delete process.env.HOME;
  await fs.rm(tmpHome, { recursive: true, force: true });
  await fs.rm(legacyHome, { recursive: true, force: true });
});

describe("gateway home paths", () => {
  it("uses GATEWAY_HOME override", () => {
    expect(getGatewayHome()).toBe(tmpHome);
    expect(getGatewayDbPath()).toBe(path.join(tmpHome, "gateway.sqlite"));
  });

  it("migrates legacy ~/.icqq/gateway.* files into gateway home", async () => {
    const legacyIcqq = path.join(legacyHome, ".icqq");
    await fs.mkdir(legacyIcqq, { recursive: true });
    await fs.writeFile(path.join(legacyIcqq, "gateway.key"), "legacy-key\n");

    await migrateLegacyGatewayHome();

    const migrated = await fs.readFile(path.join(tmpHome, "gateway.key"), "utf-8");
    expect(migrated).toBe("legacy-key\n");
    await expect(fs.access(path.join(legacyIcqq, "gateway.key"))).rejects.toThrow();
  });
});
