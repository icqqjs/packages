import React, { useState } from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { FriendSelector } from "@/components/Selectors.js";

export const description = "发送文件给好友";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "uid", description: "好友QQ号（不填则交互选择）" })),
  zod.string().describe(argument({ name: "file", description: "文件路径" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function FriendSendFile({ args: [uid, file] }: Props) {
  const [selectedUid, setSelectedUid] = useState(uid);
  if (selectedUid === undefined) return <FriendSelector onSelect={setSelectedUid} />;

  return (
    <IpcMutate
      action={Actions.SEND_PRIVATE_FILE}
      params={{ user_id: selectedUid, file }}
      loadingText="发送文件…"
      successText="文件已发送"
    />
  );
}
