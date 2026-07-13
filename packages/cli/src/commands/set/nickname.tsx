import React from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "设置昵称";

export const args = zod.tuple([
  zod.string().describe(argument({ name: "name", description: "昵称" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function SetNickname({ args: [name] }: Props) {
  return (
    <IpcMutate
      action={Actions.SET_NICKNAME}
      params={{ nickname: name }}
      loadingText="设置昵称…"
      successText={`昵称已设置为「${name}」`}
    />
  );
}
