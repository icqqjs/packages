import React, { useState } from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { GroupSelector, MemberSelector } from "@/components/Selectors.js";

export const description = "设置群名片";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "gid", description: "群号（不填则交互选择）" })),
  zod.number().optional().describe(argument({ name: "uid", description: "QQ号（不填则交互选择）" })),
  zod.string().optional().describe(argument({ name: "card", description: "群名片内容" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function SetGroupCard({ args: [gid, uid, card] }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  const [selectedUid, setSelectedUid] = useState(uid);
  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;
  if (selectedUid === undefined) return <MemberSelector gid={selectedGid} onSelect={setSelectedUid} />;

  return (
    <IpcMutate
      action={Actions.SET_GROUP_CARD}
      params={{ group_id: selectedGid, user_id: selectedUid, card: card! }}
      loadingText="设置群名片…"
      successText={`群名片已设置为「${card}」`}
    />
  );
}
