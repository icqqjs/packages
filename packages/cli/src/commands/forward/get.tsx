import React from "react";
import { Text, Box } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "查看转发消息内容";

export const args = zod.tuple([
  zod.string().describe(argument({ name: "resid", description: "转发消息的 resid" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function ForwardGet({ args: [resid] }: Props) {
  return (
    <IpcCommand
      action={Actions.GET_FORWARD_MSG}
      params={{ resid }}
      loadingText="获取转发消息…"
      render={(data: any) => {
        const msgs = Array.isArray(data) ? data : [];
        if (msgs.length === 0) return <Text dimColor>转发消息为空</Text>;
        return (
          <Box flexDirection="column" paddingX={1}>
            <Text bold color="cyan">转发消息 ({msgs.length} 条)</Text>
            {msgs.map((m: any, i: number) => (
              <Box key={i} marginTop={i > 0 ? 1 : 0} flexDirection="column">
                <Text dimColor>── {m.nickname ?? m.user_id} ({m.time ? new Date(m.time * 1000).toLocaleString() : ""}) ──</Text>
                <Text>{typeof m.message === "string" ? m.message : JSON.stringify(m.message)}</Text>
              </Box>
            ))}
          </Box>
        );
      }}
    />
  );
}
