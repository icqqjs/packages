import { describe, it, expect, vi } from "vitest";

const createClientMock = vi.fn(async () => ({ uin: 123 }));

vi.mock("@/lib/icqq-resolve.js", () => ({
  resolveIcqq: vi.fn(async () => ({ createClient: createClientMock })),
}));

vi.mock("@/lib/paths.js", () => ({
  getAccountDir: (uin: number) => `/tmp/icqq/${uin}`,
}));

import { createIcqqClient } from "../src/lib/client.js";

describe("createIcqqClient", () => {
  it("delegates to resolved icqq createClient with account options", async () => {
    const client = await createIcqqClient(12345, {
      platform: 3,
      signApiUrl: "https://sign.example.com",
      ver: "2.0",
      logLevel: "info",
    });
    expect(createClientMock).toHaveBeenCalledWith({
      platform: 3,
      sign_api_addr: "https://sign.example.com",
      ver: "2.0",
      data_dir: "/tmp/icqq/12345",
      log_level: "info",
    });
    expect(client).toEqual({ uin: 123 });
  });
});
