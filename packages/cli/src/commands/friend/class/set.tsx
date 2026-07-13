import React, { useState } from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { FriendSelector } from "@/components/Selectors.js";

export const description = "设置好友所在分组";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "uid", description: "好友QQ号（不填则交互选择）" })),
  zod.number().describe(argument({ name: "class_id", description: "分组ID" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function SetFriendClass({ args: [uid, classId] }: Props) {
  const [selectedUid, setSelectedUid] = useState(uid);
  if (selectedUid === undefined) return <FriendSelector onSelect={setSelectedUid} />;

  return (
    <IpcMutate
      action={Actions.FRIEND_CLASS}
      params={{ user_id: selectedUid, class_id: classId }}
      loadingText="设置好友分组…"
      successText={`已将好友 ${selectedUid} 移至分组 #${classId}`}
    />
  );
}
