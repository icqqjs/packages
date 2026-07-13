import React, { useState } from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { FriendSelector } from "@/components/Selectors.js";

export const description = "撤回发送给好友的文件";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "uid", description: "好友QQ号（不填则交互选择）" })),
  zod.string().describe(argument({ name: "fid", description: "文件ID" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function FriendRecallFile({ args: [uid, fid] }: Props) {
  const [selectedUid, setSelectedUid] = useState(uid);
  if (selectedUid === undefined) return <FriendSelector onSelect={setSelectedUid} />;

  return (
    <IpcMutate
      action={Actions.FRIEND_RECALL_FILE}
      params={{ user_id: selectedUid, fid }}
      loadingText="撤回文件…"
      successText="文件已撤回"
    />
  );
}
