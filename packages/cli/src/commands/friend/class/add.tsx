import React from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "新增好友分组";

export const args = zod.tuple([
  zod.string().describe(argument({ name: "name", description: "分组名称" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function AddFriendClass({ args: [name] }: Props) {
  return (
    <IpcMutate
      action={Actions.ADD_FRIEND_CLASS}
      params={{ name }}
      loadingText="创建分组…"
      successText={`已创建分组「${name}」`}
    />
  );
}
