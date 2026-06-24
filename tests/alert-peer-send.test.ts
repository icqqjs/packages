import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendPeerAlert } from "../src/lib/alert-peer-send.js";

function createRpcClient() {
  return {
    request: vi.fn(async (action: string) => ({
      id: "1",
      ok: true,
      data: { action },
    })),
    close: vi.fn(),
  };
}

describe("sendPeerAlert", () => {
  const connectRpc = vi.fn();
  const base = {
    host: "10.0.0.2",
    port: 9100,
    token: "secret-token",
  };

  beforeEach(() => {
    connectRpc.mockReset();
  });

  it("sends private message when userId is set", async () => {
    const client = createRpcClient();
    connectRpc.mockResolvedValue(client);

    await sendPeerAlert(
      { ...base, userId: 111 },
      "title",
      "body",
      connectRpc,
    );

    expect(connectRpc).toHaveBeenCalledWith({
      host: "10.0.0.2",
      port: 9100,
      token: "secret-token",
    });
    expect(client.request).toHaveBeenCalledWith("send_private_msg", {
      user_id: 111,
      message: "title\nbody",
    });
    expect(client.close).toHaveBeenCalled();
  });

  it("sends group message when groupId is set", async () => {
    const client = createRpcClient();
    connectRpc.mockResolvedValue(client);

    await sendPeerAlert({ ...base, groupId: 222 }, "t", "b", connectRpc);

    expect(client.request).toHaveBeenCalledWith("send_group_msg", {
      group_id: 222,
      message: "t\nb",
    });
  });

  it("sends both when userId and groupId are set", async () => {
    const client = createRpcClient();
    connectRpc.mockResolvedValue(client);

    await sendPeerAlert(
      { ...base, userId: 1, groupId: 2 },
      "t",
      "b",
      connectRpc,
    );

    expect(client.request).toHaveBeenCalledTimes(2);
  });

  it("succeeds when one target fails and the other succeeds", async () => {
    const client = createRpcClient();
    client.request
      .mockResolvedValueOnce({ id: "1", ok: false, error: "private fail" })
      .mockResolvedValueOnce({ id: "2", ok: true, data: {} });
    connectRpc.mockResolvedValue(client);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await sendPeerAlert({ ...base, userId: 1, groupId: 2 }, "t", "b", connectRpc);

    expect(errSpy).toHaveBeenCalledWith(expect.stringContaining("peer partial failure"));
    errSpy.mockRestore();
  });

  it("throws when all targets fail", async () => {
    const client = createRpcClient();
    client.request.mockResolvedValue({ id: "1", ok: false, error: "boom" });
    connectRpc.mockResolvedValue(client);

    await expect(
      sendPeerAlert({ ...base, userId: 1 }, "t", "b", connectRpc),
    ).rejects.toThrow("boom");
    expect(client.close).toHaveBeenCalled();
  });
});
