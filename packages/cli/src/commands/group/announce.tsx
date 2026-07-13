import React, { useState } from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { GroupSelector } from "@/components/Selectors.js";

export const description = "发送群公告";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "gid", description: "群号（不填则交互选择）" })),
  zod.string().optional().describe(argument({ name: "content", description: "公告内容" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function GroupAnnounce({ args: [gid, content] }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;

  return (
    <IpcMutate
      action={Actions.GROUP_ANNOUNCE}
      params={{ group_id: selectedGid, content: content! }}
      loadingText="发送公告…"
      successText="群公告已发送"
    />
  );
}
