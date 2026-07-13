import React, { useState } from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { GroupSelector, MemberSelector } from "@/components/Selectors.js";

export const description = "设置群专属头衔";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "gid", description: "群号（不填则交互选择）" })),
  zod.number().optional().describe(argument({ name: "uid", description: "QQ号（不填则交互选择）" })),
  zod.string().optional().describe(argument({ name: "title", description: "头衔内容" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function SetGroupTitle({ args: [gid, uid, title] }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  const [selectedUid, setSelectedUid] = useState(uid);
  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;
  if (selectedUid === undefined) return <MemberSelector gid={selectedGid} onSelect={setSelectedUid} />;

  return (
    <IpcMutate
      action={Actions.SET_GROUP_TITLE}
      params={{ group_id: selectedGid, user_id: selectedUid, title: title! }}
      loadingText="设置头衔…"
      successText={`群头衔已设置为「${title}」`}
    />
  );
}
