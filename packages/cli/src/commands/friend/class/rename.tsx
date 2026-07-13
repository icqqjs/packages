import React from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "重命名好友分组";

export const args = zod.tuple([
  zod.number().describe(argument({ name: "id", description: "分组ID" })),
  zod.string().describe(argument({ name: "name", description: "新名称" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function RenameFriendClass({ args: [id, name] }: Props) {
  return (
    <IpcMutate
      action={Actions.RENAME_FRIEND_CLASS}
      params={{ id, name }}
      loadingText="重命名分组…"
      successText={`已将分组 #${id} 重命名为「${name}」`}
    />
  );
}
