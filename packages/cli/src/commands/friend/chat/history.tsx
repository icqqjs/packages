import React from "react";
import { Text, Box } from "ink";
import zod from "zod";
import { argument, option } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "查看私聊消息记录";

export const args = zod.tuple([
  zod.number().describe(argument({ name: "uid", description: "好友QQ号" })),
]);

export const options = zod.object({
  count: zod.number().default(20).describe(option({ description: "消息条数", alias: "c" })),
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function HistoryPrivate({ args: [uid], options: { count } }: Props) {
  return (
    <IpcCommand
      action={Actions.HISTORY_PRIVATE}
      params={{ user_id: uid, count }}
      loadingText="获取消息记录…"
      render={(data: any[]) => (
        <Box flexDirection="column">
          {data.length === 0 ? (
            <Text dimColor>暂无消息记录</Text>
          ) : (
            data.map((msg: any, i: number) => (
              <Box key={i}>
                <Text dimColor>[{new Date(msg.time * 1000).toLocaleString()}] </Text>
                <Text color="cyan">{msg.sender?.nickname ?? msg.user_id}: </Text>
                <Text>{msg.raw_message ?? JSON.stringify(msg.message)}</Text>
              </Box>
            ))
          )}
        </Box>
      )}
    />
  );
}
