import React from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "标记消息已读";

export const args = zod.tuple([
  zod.string().describe(argument({ name: "msg_id", description: "消息ID" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function MsgMarkRead({ args: [msgId] }: Props) {
  return (
    <IpcMutate
      action={Actions.MARK_READ}
      params={{ message_id: msgId }}
      loadingText="标记已读…"
      successText="已标记为已读"
    />
  );
}
