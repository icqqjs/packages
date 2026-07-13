import React, { useState } from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { GroupSelector } from "@/components/Selectors.js";

export const description = "移动群文件到指定目录";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "gid", description: "群号（不填则交互选择）" })),
  zod.string().describe(argument({ name: "fid", description: "文件ID" })),
  zod.string().describe(argument({ name: "pid", description: "目标目录ID" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function GfsMove({ args: [gid, fid, pid] }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;

  return (
    <IpcMutate
      action={Actions.GFS_MOVE}
      params={{ group_id: selectedGid, fid, pid }}
      loadingText="移动文件…"
      successText="文件已移动"
    />
  );
}
