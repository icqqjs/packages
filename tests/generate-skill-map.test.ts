import { describe, expect, it } from "vitest";
import { generateSkillMcpMap } from "../scripts/generate-skill-mcp-map.js";

describe("generate-skill-mcp-map", () => {
  it("includes core messaging actions with CLI mapping", async () => {
    const md = await generateSkillMcpMap();
    expect(md).toContain("DO NOT EDIT");
    expect(md).toContain("`send_private_msg`");
    expect(md).toContain("`icqq friend send`");
    expect(md).toContain("`send_group_msg`");
    expect(md).toContain("`icqq group send`");
    expect(md).toContain("| `logout`");
    expect(md).toMatch(/logout.*禁止/);
  });
});
