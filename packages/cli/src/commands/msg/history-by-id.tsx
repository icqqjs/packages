import React from "react";
import { Text, Box } from "ink";
import zod from "zod";
import { argument, option } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "以 message_id 为锚点拉聊天记录";

export const args = zod.tuple([
  zod.string().describe(argument({ name: "message_id", description: "消息 ID" })),
]);

export const options = zod.object({
  count: zod.number().default(20).describe(option({ description: "条数", alias: "c" })),
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function MsgHistoryById({ args: [messageId], options: { count } }: Props) {
  return (
    <IpcCommand
      action={Actions.HISTORY_BY_MSG_ID}
      params={{ message_id: messageId, count }}
      loadingText="拉取历史…"
      render={(data: Array<Record<string, unknown>>) => {
        const msgs = Array.isArray(data) ? data : [];
        if (msgs.length === 0) return <Text dimColor>无记录</Text>;
        return (
          <Box flexDirection="column" paddingX={1}>
            <Text bold color="cyan">历史 ({msgs.length} 条)</Text>
            {msgs.map((m, i) => (
              <Box key={i} marginTop={i > 0 ? 1 : 0} flexDirection="column">
                <Text dimColor>
                  ── {String(m.nickname ?? m.user_id)}{" "}
                  {m.time ? new Date(Number(m.time) * 1000).toLocaleString() : ""} ──
                </Text>
                <Text>{String(m.raw_message ?? "")}</Text>
              </Box>
            ))}
          </Box>
        );
      }}
    />
  );
}
