import React, { useState } from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { FriendSelector } from "@/components/Selectors.js";

export const description = "戳一戳好友";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "uid", description: "好友QQ号（不填则交互选择）" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function FriendPoke({ args: [uid] }: Props) {
  const [selectedUid, setSelectedUid] = useState(uid);
  if (selectedUid === undefined) return <FriendSelector onSelect={setSelectedUid} />;

  return (
    <IpcMutate
      action={Actions.FRIEND_POKE}
      params={{ user_id: selectedUid }}
      loadingText="戳一戳…"
      successText={`已戳 ${selectedUid}`}
    />
  );
}
