import React from "react";
import zod from "zod";
import { argument, option } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "转发私聊文件到群或临时会话";

export const args = zod.tuple([
  zod.number().describe(argument({ name: "uid", description: "文件所属会话 QQ 号" })),
  zod.string().describe(argument({ name: "fid", description: "文件 fid" })),
]);

export const options = zod.object({
  gid: zod.number().optional().describe(option({ description: "目标群号（不填则仅生成转发 fid）", alias: "g" })),
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function FriendForwardFile({ args: [uid, fid], options: { gid } }: Props) {
  return (
    <IpcMutate
      action={Actions.FRIEND_FORWARD_FILE}
      params={{ user_id: uid, fid, group_id: gid }}
      loadingText="转发文件…"
      successText={gid ? `文件已转发到群 ${gid}` : "文件转发 fid 已生成"}
    />
  );
}
