import React from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "设为群精华消息";

export const args = zod.tuple([
  zod.string().describe(argument({ name: "message_id", description: "消息ID" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function EssenceAdd({ args: [message_id] }: Props) {
  return (
    <IpcMutate
      action={Actions.GROUP_ESSENCE_ADD}
      params={{ message_id }}
      loadingText="设为精华…"
      successText="已设为精华消息"
    />
  );
}
