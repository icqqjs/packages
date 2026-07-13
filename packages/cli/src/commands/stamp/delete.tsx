import React from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "删除漫游表情";

export const args = zod.tuple([
  zod.string().describe(argument({ name: "id", description: "表情ID" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function StampDelete({ args: [id] }: Props) {
  return (
    <IpcMutate
      action={Actions.DELETE_STAMP}
      params={{ id }}
      loadingText="删除表情…"
      successText="表情已删除"
    />
  );
}
