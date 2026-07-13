import React, { useState } from "react";
import zod from "zod";
import { argument, option } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { GroupSelector, MemberSelector } from "@/components/Selectors.js";

export const description = "踢出群成员";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "gid", description: "群号（不填则交互选择）" })),
  zod.number().optional().describe(argument({ name: "uid", description: "QQ号（不填则交互选择）" })),
]);

export const options = zod.object({
  block: zod.boolean().default(false).describe(option({ description: "不再接收申请", alias: "b" })),
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function GroupKick({ args: [gid, uid], options: { block } }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  const [selectedUid, setSelectedUid] = useState(uid);
  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;
  if (selectedUid === undefined) return <MemberSelector gid={selectedGid} onSelect={setSelectedUid} />;

  return (
    <IpcMutate
      action={Actions.GROUP_KICK}
      params={{ group_id: selectedGid, user_id: selectedUid, block }}
      loadingText="踢出成员…"
      successText={`已将 ${selectedUid} 踢出群`}
    />
  );
}
