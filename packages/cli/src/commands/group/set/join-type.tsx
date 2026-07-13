import React, { useState } from "react";
import zod from "zod";
import { argument, option } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { GroupSelector } from "@/components/Selectors.js";

export const description = "设置群加入方式";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "gid", description: "群号（不填则交互选择）" })),
  zod.string().describe(argument({ name: "type", description: "加入方式: 1=自由加入, 2=需验证, 3=需回答问题" })),
]);

export const options = zod.object({
  question: zod.string().optional().describe(option({ description: "验证问题（type=3 时需要）", alias: "q" })),
  answer: zod.string().optional().describe(option({ description: "验证答案（type=3 时需要）", alias: "a" })),
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function SetGroupJoinType({ args: [gid, type], options: { question, answer } }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;

  return (
    <IpcMutate
      action={Actions.GROUP_SET_JOIN_TYPE}
      params={{ group_id: selectedGid, type, question, answer }}
      loadingText="设置加入方式…"
      successText="已更新群加入方式"
    />
  );
}
