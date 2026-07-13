import React, { useState } from "react";
import zod from "zod";
import { argument, option } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { FriendSelector } from "@/components/Selectors.js";

export const description = "给好友点赞";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "uid", description: "好友QQ号（不填则交互选择）" })),
]);

export const options = zod.object({
  times: zod.number().default(1).describe(option({ description: "点赞次数(1-20)", alias: "t" })),
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function FriendLike({ args: [uid], options: { times } }: Props) {
  const [selectedUid, setSelectedUid] = useState(uid);
  if (selectedUid === undefined) return <FriendSelector onSelect={setSelectedUid} />;

  return (
    <IpcMutate
      action={Actions.FRIEND_LIKE}
      params={{ user_id: selectedUid, times }}
      loadingText="点赞中…"
      successText={`已给 ${selectedUid} 点赞 ${times} 次`}
    />
  );
}
