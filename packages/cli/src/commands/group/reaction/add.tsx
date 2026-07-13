import React from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "对群消息添加表态";

export const args = zod.tuple([
  zod.string().describe(argument({ name: "message_id", description: "群消息ID" })),
  zod.string().describe(argument({ name: "id", description: "表情ID" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function GroupReactionAdd({ args: [message_id, id] }: Props) {
  return (
    <IpcMutate
      action={Actions.GROUP_SET_REACTION}
      params={{ message_id, id }}
      loadingText="添加表态…"
      successText="已添加表态"
    />
  );
}
