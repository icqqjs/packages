import React, { useState } from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { GroupSelector } from "@/components/Selectors.js";

export const description = "删除群文件/目录";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "gid", description: "群号（不填则交互选择）" })),
  zod.string().optional().describe(argument({ name: "fid", description: "文件/目录ID" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function GfsDelete({ args: [gid, fid] }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;

  return (
    <IpcMutate
      action={Actions.GFS_DELETE}
      params={{ group_id: selectedGid, fid: fid! }}
      loadingText="删除文件…"
      successText="文件/目录已删除"
    />
  );
}
