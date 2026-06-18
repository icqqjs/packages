import React from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "发送群聊长消息（long_msg）";

export const args = zod.tuple([
  zod.number().describe(argument({ name: "gid", description: "群号" })),
  zod.string().describe(argument({ name: "message", description: "消息内容" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function GroupSendLong({ args: [gid, message] }: Props) {
  return (
    <IpcMutate
      action={Actions.SEND_LONG_MSG}
      params={{ group_id: gid, message }}
      loadingText="发送长消息…"
      successText={`长消息已发送到群 ${gid}`}
    />
  );
}
