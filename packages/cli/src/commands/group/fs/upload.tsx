import React, { useState } from "react";
import zod from "zod";
import { argument, option } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { GroupSelector } from "@/components/Selectors.js";

export const description = "上传文件到群文件";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "gid", description: "群号（不填则交互选择）" })),
  zod.string().describe(argument({ name: "file", description: "文件路径" })),
]);

export const options = zod.object({
  pid: zod.string().default("/").describe(option({ description: "目标目录ID", alias: "p" })),
  name: zod.string().optional().describe(option({ description: "文件名（默认为原文件名）", alias: "n" })),
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function GfsUpload({ args: [gid, file], options: { pid, name } }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;

  return (
    <IpcMutate
      action={Actions.GFS_UPLOAD}
      params={{ group_id: selectedGid, file, pid, name }}
      loadingText="上传文件…"
      successText="文件已上传"
    />
  );
}
