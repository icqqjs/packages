import React, { useState, useEffect } from "react";
import { Text, useApp } from "ink";
import zod from "zod";
import { argument, option } from "pastel";
import { Spinner } from "@/components/Spinner.js";
import { resolveUin } from "@/lib/config.js";
import { isDaemonRunning } from "@/daemon/supervisor.js";
import { IpcClient } from "@/lib/ipc-client.js";
import { Actions } from "@/daemon/protocol.js";
import { useCliResultContract } from "@/lib/use-cli-result-contract.js";

export const description = "退出登录并停止守护进程";

export const args = zod.tuple([
  zod.coerce.number().optional().describe(
    argument({
      name: "uin",
      description: "要退出的QQ号（不指定则使用当前账号）",
    }),
  ),
]);

export const options = zod.object({
  k: zod
    .boolean()
    .default(false)
    .describe(
      option({
        description: "保留 token（仅本地断开，不通知 QQ 服务器，可用 icqq login -r 重连）",
        alias: "k",
      }),
    ),
});

type Props = {
  args: zod.infer<typeof args>;
  options: zod.infer<typeof options>;
};

export default function Logout({ args: [argUin], options: { k: keepToken } }: Props) {
  const { exit } = useApp();
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const { jsonMode } = useCliResultContract({
    pending: loading,
    error: success ? "" : message,
    data: { ok: true, message },
    exit,
    successExitDelayMs: 100,
  });

  useEffect(() => {
    void (async () => {
      try {
        const uin = argUin ?? await resolveUin();

        if (!(await isDaemonRunning(uin))) {
          setMessage(`守护进程未运行 (账号 ${uin})`);
          setLoading(false);
          return;
        }

        const ipc = await IpcClient.connect(uin);
        // 告知守护进程执行 logout（keepAlive = keepToken），守护进程自行退出
        await ipc.request(Actions.LOGOUT, { keep_token: keepToken });
        ipc.close();

        setMessage(
          keepToken
            ? `账号 ${uin} 已断开连接（token 已保留，可用 icqq login -r 重连）`
            : `账号 ${uin} 已退出登录（token 已作废）`,
        );
        setSuccess(true);
      } catch (e) {
        setMessage(e instanceof Error ? e.message : String(e));
      }
      setLoading(false);
    })();
  }, [argUin, keepToken]);

  if (jsonMode) return null;
  if (loading) return <Spinner label="正在退出登录…" />;

  return (
    <Text color={success ? "green" : "yellow"}>
      {success ? "✔" : "⚠"} {message}
    </Text>
  );
}
