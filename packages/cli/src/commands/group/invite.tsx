import React, { useState } from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { GroupSelector, FriendSelector } from "@/components/Selectors.js";

export const description = "邀请好友入群";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "gid", description: "群号（不填则交互选择）" })),
  zod.number().optional().describe(argument({ name: "uid", description: "好友QQ号（不填则交互选择）" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function GroupInvite({ args: [gid, uid] }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  const [selectedUid, setSelectedUid] = useState(uid);
  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;
  if (selectedUid === undefined) return <FriendSelector onSelect={setSelectedUid} />;

  return (
    <IpcMutate
      action={Actions.GROUP_INVITE}
      params={{ group_id: selectedGid, user_id: selectedUid }}
      loadingText="邀请入群…"
      successText={`已邀请 ${selectedUid} 加入群 ${selectedGid}`}
    />
  );
}
