import React from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "设置个人说明";

export const args = zod.tuple([
  zod.string().describe(argument({ name: "text", description: "说明内容" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function SetDescription({ args: [text] }: Props) {
  return (
    <IpcMutate
      action={Actions.SET_DESCRIPTION}
      params={{ description: text }}
      loadingText="设置说明…"
      successText={`个人说明已设置为「${text}」`}
    />
  );
}
