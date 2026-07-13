import React, { useState } from "react";
import zod from "zod";
import { argument, option } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { GroupSelector, MemberSelector } from "@/components/Selectors.js";

export const description = "禁言群成员";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "gid", description: "群号（不填则交互选择）" })),
  zod.number().optional().describe(argument({ name: "uid", description: "QQ号（不填则交互选择）" })),
]);

export const options = zod.object({
  duration: zod.number().default(600).describe(option({ description: "禁言时长(秒)，0=解除禁言", alias: "d" })),
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function GroupMute({ args: [gid, uid], options: { duration } }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  const [selectedUid, setSelectedUid] = useState(uid);
  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;
  if (selectedUid === undefined) return <MemberSelector gid={selectedGid} onSelect={setSelectedUid} />;

  return (
    <IpcMutate
      action={Actions.GROUP_MUTE}
      params={{ group_id: selectedGid, user_id: selectedUid, duration }}
      loadingText="设置禁言…"
      successText={duration === 0 ? "已解除禁言" : `已禁言 ${duration} 秒`}
    />
  );
}
