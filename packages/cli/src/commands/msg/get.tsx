import React from "react";
import { Text, Box } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "获取单条消息详情";

export const args = zod.tuple([
  zod.string().describe(argument({ name: "msg_id", description: "消息ID" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function MsgGet({ args: [msgId] }: Props) {
  return (
    <IpcCommand
      action={Actions.GET_MSG}
      params={{ message_id: msgId }}
      loadingText="获取消息…"
      render={(data: any) => (
        <Box flexDirection="column" paddingX={1}>
          <Text bold color="cyan">消息详情</Text>
          <Text>消息ID: {data.message_id}</Text>
          <Text>发送者: {data.sender?.nickname ?? data.user_id} ({data.user_id})</Text>
          {data.group_id ? <Text>群号: {data.group_id}</Text> : null}
          <Text>时间: {new Date((data.time ?? 0) * 1000).toLocaleString()}</Text>
          <Text>内容: {data.raw_message ?? JSON.stringify(data.message)}</Text>
        </Box>
      )}
    />
  );
}
