import React, { useState } from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { GroupSelector } from "@/components/Selectors.js";

export const description = "设置群备注";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "gid", description: "群号（不填则交互选择）" })),
  zod.string().optional().describe(argument({ name: "remark", description: "备注内容" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function SetGroupRemark({ args: [gid, remark] }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;

  return (
    <IpcMutate
      action={Actions.SET_GROUP_REMARK}
      params={{ group_id: selectedGid, remark: remark! }}
      loadingText="设置群备注…"
      successText={`群备注已设置为「${remark}」`}
    />
  );
}
