import React, { useState } from "react";
import { Text } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { GroupSelector } from "@/components/Selectors.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "设置群名称";

export const args = zod.tuple([
  zod.number().optional().describe(
    argument({
      name: "gid",
      description: "群号（不填则交互选择）",
    }),
  ),
  zod.string().optional().describe(
    argument({
      name: "name",
      description: "新群名称",
    }),
  ),
]);

type Props = {
  args: zod.infer<typeof args>;
};

export default function SetGroupName({ args: [gid, name] }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;
  if (!name) {
    return <Text color="yellow">请提供 name 参数，例如: icqq group set name 123456789 &quot;新群名&quot;</Text>;
  }
  return (
    <IpcMutate
      action={Actions.SET_GROUP_NAME}
      params={{ gid: selectedGid, name }}
      loadingText="设置群名称…"
      successText={`已将群 ${selectedGid} 的名称设置为「${name}」`}
    />
  );
}
