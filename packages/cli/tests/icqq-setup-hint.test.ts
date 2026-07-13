import { describe, it, expect, vi } from "vitest";
import {
  ICQQ_SETUP_HINT,
  TOKEN_HELP,
  pushTokenHelpLogs,
} from "../src/lib/icqq-setup-hint.ts";

describe("icqq-setup-hint", () => {
  it("contains non-interactive setup hint", () => {
    expect(ICQQ_SETUP_HINT).toContain("缺少 @icqqjs/icqq");
    expect(ICQQ_SETUP_HINT).toContain("icqq setup");
  });

  it("logs token help with retry note and all steps", () => {
    const log = vi.fn();

    pushTokenHelpLogs(log, "前一次认证失败");

    expect(log).toHaveBeenCalledWith("   ⚠ 前一次认证失败", "warn");
    expect(log).toHaveBeenCalledWith(`   【${TOKEN_HELP.title}】`, "ok");
    expect(log).toHaveBeenCalledWith(`   ${TOKEN_HELP.intro}`);
    for (const step of TOKEN_HELP.steps) {
      expect(log).toHaveBeenCalledWith(`   ${step}`);
    }
    expect(log).toHaveBeenCalledWith(`   ${TOKEN_HELP.alt}`);
  });

  it("logs token help without retry note", () => {
    const log = vi.fn();

    pushTokenHelpLogs(log);

    expect(log).not.toHaveBeenCalledWith(expect.stringContaining("⚠"), "warn");
    expect(log).toHaveBeenCalledWith(`   【${TOKEN_HELP.title}】`, "ok");
  });
});