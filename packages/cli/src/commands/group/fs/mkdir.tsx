import React, { useState } from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { GroupSelector } from "@/components/Selectors.js";

export const description = "在群文件系统中创建目录";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "gid", description: "群号（不填则交互选择）" })),
  zod.string().optional().describe(argument({ name: "name", description: "目录名" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function GfsMkdir({ args: [gid, name] }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;

  return (
    <IpcMutate
      action={Actions.GFS_MKDIR}
      params={{ group_id: selectedGid, name: name! }}
      loadingText="创建目录…"
      successText={`目录「${name}」已创建`}
    />
  );
}
