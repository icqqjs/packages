import React, { useState } from "react";
import zod from "zod";
import { argument, option } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { GroupSelector } from "@/components/Selectors.js";

export const description = "设置群匿名开关";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "gid", description: "群号（不填则交互选择）" })),
]);

export const options = zod.object({
  disable: zod.boolean().default(false).describe(option({ description: "关闭匿名", alias: "d" })),
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function SetGroupAnonymous({ args: [gid], options: { disable } }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;

  return (
    <IpcMutate
      action={Actions.GROUP_ALLOW_ANONY}
      params={{ group_id: selectedGid, enable: !disable }}
      loadingText={disable ? "关闭匿名…" : "开启匿名…"}
      successText={disable ? "已关闭匿名" : "已开启匿名"}
    />
  );
}
