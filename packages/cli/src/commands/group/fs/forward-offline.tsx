import React from "react";
import zod from "zod";
import { argument, option } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "转发离线文件到群";

export const args = zod.tuple([
  zod.number().describe(
    argument({ name: "gid", description: "目标群号" }),
  ),
  zod.string().describe(
    argument({ name: "fid", description: "离线文件ID" }),
  ),
]);

export const options = zod.object({
  name: zod.string().optional().describe(option({ description: "转发后的文件名" })),
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function GfsForwardOffline({ args: [gid, fid], options: { name } }: Props) {
  return (
    <IpcMutate
      action={Actions.GFS_FORWARD_OFFLINE}
      params={{ group_id: gid, fid, name }}
      loadingText="转发离线文件…"
      successText={`已将离线文件转发到群 ${gid}`}
    />
  );
}
