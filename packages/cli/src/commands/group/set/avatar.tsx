import React, { useState } from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { GroupSelector } from "@/components/Selectors.js";

export const description = "设置群头像";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "gid", description: "群号（不填则交互选择）" })),
  zod.string().optional().describe(argument({ name: "file", description: "图片文件路径" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function SetGroupAvatar({ args: [gid, file] }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;

  return (
    <IpcMutate
      action={Actions.SET_GROUP_AVATAR}
      params={{ group_id: selectedGid, file: file! }}
      loadingText="设置群头像…"
      successText="群头像已更新"
    />
  );
}
