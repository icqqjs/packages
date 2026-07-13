import React, { useState } from "react";
import zod from "zod";
import { argument, option } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { GroupSelector } from "@/components/Selectors.js";

export const description = "禁言匿名成员";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "gid", description: "群号（不填则交互选择）" })),
  zod.string().describe(argument({ name: "flag", description: "匿名 flag" })),
]);

export const options = zod.object({
  duration: zod.number().default(600).describe(option({ description: "禁言时长(秒)", alias: "d" })),
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function GroupMuteAnon({ args: [gid, flag], options: { duration } }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;

  return (
    <IpcMutate
      action={Actions.GROUP_MUTE_ANONY}
      params={{ group_id: selectedGid, flag, duration }}
      loadingText="禁言匿名成员…"
      successText={`已禁言匿名成员 ${duration} 秒`}
    />
  );
}
