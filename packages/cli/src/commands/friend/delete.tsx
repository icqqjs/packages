import React, { useState } from "react";
import zod from "zod";
import { argument, option } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { FriendSelector } from "@/components/Selectors.js";

export const description = "删除好友";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "uid", description: "好友QQ号（不填则交互选择）" })),
]);

export const options = zod.object({
  block: zod.boolean().default(false).describe(option({ description: "加入黑名单", alias: "b" })),
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function FriendDelete({ args: [uid], options: { block } }: Props) {
  const [selectedUid, setSelectedUid] = useState(uid);
  if (selectedUid === undefined) return <FriendSelector onSelect={setSelectedUid} />;

  return (
    <IpcMutate
      action={Actions.FRIEND_DELETE}
      params={{ user_id: selectedUid, block }}
      loadingText="删除好友…"
      successText={`已删除好友 ${selectedUid}${block ? " 并加入黑名单" : ""}`}
    />
  );
}
