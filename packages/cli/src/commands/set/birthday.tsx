import React from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "设置生日 (YYYYMMDD格式)";

export const args = zod.tuple([
  zod.string().describe(argument({ name: "birthday", description: "生日 YYYYMMDD" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function SetBirthday({ args: [birthday] }: Props) {
  return (
    <IpcMutate
      action={Actions.SET_BIRTHDAY}
      params={{ birthday }}
      loadingText="设置生日…"
      successText={`生日已设置为 ${birthday}`}
    />
  );
}
