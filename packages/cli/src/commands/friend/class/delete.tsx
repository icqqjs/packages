import React from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "删除好友分组";

export const args = zod.tuple([
  zod.number().describe(argument({ name: "id", description: "分组ID" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function DeleteFriendClass({ args: [id] }: Props) {
  return (
    <IpcMutate
      action={Actions.DELETE_FRIEND_CLASS}
      params={{ id }}
      loadingText="删除分组…"
      successText={`已删除分组 #${id}`}
    />
  );
}
