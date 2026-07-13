import React, { useState } from "react";
import zod from "zod";
import { argument, option } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { GroupSelector } from "@/components/Selectors.js";

export const description = "全体禁言";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "gid", description: "群号（不填则交互选择）" })),
]);

export const options = zod.object({
  off: zod.boolean().default(false).describe(option({ description: "关闭全体禁言" })),
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function GroupMuteAll({ args: [gid], options: { off } }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;

  return (
    <IpcMutate
      action={Actions.GROUP_MUTE_ALL}
      params={{ group_id: selectedGid, enable: !off }}
      loadingText={off ? "关闭全体禁言…" : "开启全体禁言…"}
      successText={off ? "已关闭全体禁言" : "已开启全体禁言"}
    />
  );
}
