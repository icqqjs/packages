import React from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "取消群精华消息";

export const args = zod.tuple([
  zod.string().describe(argument({ name: "message_id", description: "消息ID" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function EssenceRemove({ args: [message_id] }: Props) {
  return (
    <IpcMutate
      action={Actions.GROUP_ESSENCE_REMOVE}
      params={{ message_id }}
      loadingText="取消精华…"
      successText="已取消精华消息"
    />
  );
}
