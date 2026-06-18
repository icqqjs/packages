import React from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "发送讨论组消息";

export const args = zod.tuple([
  zod.number().describe(argument({ name: "discuss_id", description: "讨论组号" })),
  zod.string().describe(argument({ name: "message", description: "消息内容" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function DiscussSend({ args: [discussId, message] }: Props) {
  return (
    <IpcMutate
      action={Actions.SEND_DISCUSS_MSG}
      params={{ discuss_id: discussId, message }}
      loadingText="发送讨论组消息…"
      successText={`消息已发送到讨论组 ${discussId}`}
    />
  );
}
