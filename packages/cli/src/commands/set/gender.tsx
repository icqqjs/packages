import React from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "设置性别 (0=未知 1=男 2=女)";

export const args = zod.tuple([
  zod.enum(["0", "1", "2"]).describe(argument({ name: "gender", description: "0=未知 1=男 2=女" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function SetGender({ args: [gender] }: Props) {
  const labels: Record<string, string> = { "0": "未知", "1": "男", "2": "女" };
  return (
    <IpcMutate
      action={Actions.SET_GENDER}
      params={{ gender: Number(gender) }}
      loadingText="设置性别…"
      successText={`性别已设置为「${labels[gender]}」`}
    />
  );
}
