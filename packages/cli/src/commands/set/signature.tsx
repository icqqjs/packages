import React from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "设置个性签名";

export const args = zod.tuple([
  zod.string().describe(argument({ name: "text", description: "签名内容" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function SetSignature({ args: [text] }: Props) {
  return (
    <IpcMutate
      action={Actions.SET_SIGNATURE}
      params={{ signature: text }}
      loadingText="设置签名…"
      successText={`个性签名已设置为「${text}」`}
    />
  );
}
