import React, { useState } from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { FriendSelector } from "@/components/Selectors.js";

export const description = "设置好友备注";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "uid", description: "好友QQ号（不填则交互选择）" })),
  zod.string().optional().describe(argument({ name: "remark", description: "备注名" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function FriendRemark({ args: [uid, remark] }: Props) {
  const [selectedUid, setSelectedUid] = useState(uid);
  if (selectedUid === undefined) return <FriendSelector onSelect={setSelectedUid} />;

  return (
    <IpcMutate
      action={Actions.FRIEND_REMARK}
      params={{ user_id: selectedUid, remark: remark! }}
      loadingText="设置备注…"
      successText={`已将好友 ${selectedUid} 的备注设为「${remark}」`}
    />
  );
}
