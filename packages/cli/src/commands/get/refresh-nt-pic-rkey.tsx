import React from "react";
import zod from "zod";
import { option } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "刷新 QQNT 图片 rkey";

export const options = zod.object({
  force: zod.boolean().default(false).describe(option({ description: "强制刷新", alias: "f" })),
});

type Props = { options: zod.infer<typeof options> };

export default function RefreshNtPicRkey({ options: { force } }: Props) {
  return (
    <IpcMutate
      action={Actions.REFRESH_NT_PIC_RKEY}
      params={{ force }}
      loadingText="刷新 rkey…"
      successText="rkey 已刷新"
    />
  );
}
