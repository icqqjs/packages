import React from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "发送群临时会话消息（通过群上下文私聊非好友成员）";

export const args = zod.tuple([
  zod.number().describe(
    argument({ name: "gid", description: "群号" }),
  ),
  zod.number().describe(
    argument({ name: "uid", description: "目标成员 QQ 号" }),
  ),
  zod.string().describe(
    argument({ name: "message", description: "消息内容" }),
  ),
]);

type Props = { args: zod.infer<typeof args> };

export default function GroupSendTemp({ args: [gid, uid, message] }: Props) {
  return (
    <IpcMutate
      action={Actions.SEND_TEMP_MSG}
      params={{ group_id: gid, user_id: uid, message }}
      loadingText="发送临时会话消息…"
      successText={`临时会话消息已发送到群 ${gid} 成员 ${uid}`}
    />
  );
}
