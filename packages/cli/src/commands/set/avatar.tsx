import React from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "设置头像";

export const args = zod.tuple([
  zod.string().describe(argument({ name: "file", description: "图片文件路径" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function SetAvatar({ args: [file] }: Props) {
  return (
    <IpcMutate
      action={Actions.SET_AVATAR}
      params={{ file }}
      loadingText="设置头像…"
      successText="头像已更新"
    />
  );
}
