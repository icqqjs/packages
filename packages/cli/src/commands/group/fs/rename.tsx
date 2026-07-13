import React, { useState } from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { GroupSelector } from "@/components/Selectors.js";

export const description = "重命名群文件/目录";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "gid", description: "群号（不填则交互选择）" })),
  zod.string().optional().describe(argument({ name: "fid", description: "文件/目录ID" })),
  zod.string().optional().describe(argument({ name: "name", description: "新名称" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function GfsRename({ args: [gid, fid, name] }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;

  return (
    <IpcMutate
      action={Actions.GFS_RENAME}
      params={{ group_id: selectedGid, fid: fid!, name: name! }}
      loadingText="重命名…"
      successText={`已重命名为「${name}」`}
    />
  );
}
