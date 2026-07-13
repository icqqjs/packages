import React, { useState } from "react";
import zod from "zod";
import { argument, option } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { GroupSelector, MemberSelector } from "@/components/Selectors.js";

export const description = "设置/取消群管理员";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "gid", description: "群号（不填则交互选择）" })),
  zod.number().optional().describe(argument({ name: "uid", description: "QQ号（不填则交互选择）" })),
]);

export const options = zod.object({
  remove: zod.boolean().default(false).describe(option({ description: "取消管理员", alias: "r" })),
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function SetGroupAdmin({ args: [gid, uid], options: { remove } }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  const [selectedUid, setSelectedUid] = useState(uid);
  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;
  if (selectedUid === undefined) return <MemberSelector gid={selectedGid} onSelect={setSelectedUid} />;

  return (
    <IpcMutate
      action={Actions.SET_GROUP_ADMIN}
      params={{ group_id: selectedGid, user_id: selectedUid, enable: !remove }}
      loadingText={remove ? "取消管理员…" : "设置管理员…"}
      successText={remove ? "已取消管理员" : "已设置为管理员"}
    />
  );
}
