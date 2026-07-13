import React from "react";
import zod from "zod";
import { argument, option } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "转发群文件到另一个群";

export const args = zod.tuple([
  zod.number().describe(
    argument({ name: "source-gid", description: "源群号（文件所在群）" }),
  ),
  zod.string().describe(
    argument({ name: "fid", description: "文件ID" }),
  ),
  zod.number().describe(
    argument({ name: "target-gid", description: "目标群号" }),
  ),
]);

export const options = zod.object({
  pid: zod.string().optional().describe(option({ description: "目标目录ID，默认根目录" })),
  name: zod.string().optional().describe(option({ description: "转发后的文件名" })),
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function GfsForward({ args: [sourceGid, fid, targetGid], options: { pid, name } }: Props) {
  return (
    <IpcMutate
      action={Actions.GFS_FORWARD}
      params={{ group_id: sourceGid, fid, target_group_id: targetGid, pid, name }}
      loadingText="转发群文件…"
      successText={`已将群 ${sourceGid} 的文件转发到群 ${targetGid}`}
    />
  );
}
