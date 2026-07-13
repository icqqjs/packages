import React, { useState } from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { GroupSelector } from "@/components/Selectors.js";

export const description = "设置群消息频率限制";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "gid", description: "群号（不填则交互选择）" })),
  zod.number().describe(argument({ name: "times", description: "每分钟消息条数限制" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function SetGroupRateLimit({ args: [gid, times] }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;

  return (
    <IpcMutate
      action={Actions.GROUP_SET_RATE_LIMIT}
      params={{ group_id: selectedGid, times }}
      loadingText="设置消息限制…"
      successText={`已设置每分钟消息限制为 ${times} 条`}
    />
  );
}
