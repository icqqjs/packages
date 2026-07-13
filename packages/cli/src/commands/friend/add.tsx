import React, { useState } from "react";
import zod from "zod";
import { argument, option } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { GroupSelector } from "@/components/Selectors.js";

export const description = "添加好友（通过群）";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "gid", description: "群号（不填则交互选择）" })),
  zod.number().describe(argument({ name: "uid", description: "目标QQ号" })),
]);

export const options = zod.object({
  comment: zod.string().default("").describe(option({ description: "验证消息", alias: "c" })),
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function AddFriend({ args: [gid, uid], options: { comment } }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;

  return (
    <IpcMutate
      action={Actions.ADD_FRIEND}
      params={{ group_id: selectedGid, user_id: uid, comment }}
      loadingText="发送好友申请…"
      successText={`已向 ${uid} 发送好友申请`}
    />
  );
}
