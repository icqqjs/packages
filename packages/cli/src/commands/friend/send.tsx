import React from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "发送私聊消息（同 icqq send private <qq> <message>）";

export const args = zod.tuple([
  zod.number().describe(
    argument({ name: "qq", description: "好友QQ号" }),
  ),
  zod.string().describe(
    argument({ name: "message", description: "消息内容" }),
  ),
]);

type Props = { args: zod.infer<typeof args> };

export default function FriendSend({ args: [uid, message] }: Props) {
  return (
    <IpcMutate
      action={Actions.SEND_PRIVATE_MSG}
      params={{ user_id: uid, message }}
      loadingText="发送消息…"
      successText={`消息已发送到好友 ${uid}`}
    />
  );
}
