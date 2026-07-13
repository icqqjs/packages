import React from "react";
import zod from "zod";
import { argument, option } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "拒绝好友/群请求";

export const args = zod.tuple([
  zod.string().describe(argument({ name: "flag", description: "请求标识(通过 icqq requests 查看)" })),
]);

export const options = zod.object({
  group: zod.boolean().default(false).describe(option({ description: "群请求(默认为好友请求)", alias: "g" })),
  reason: zod.string().default("").describe(option({ description: "拒绝理由", alias: "r" })),
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function RequestReject({ args: [flag], options: { group, reason } }: Props) {
  return (
    <IpcMutate
      action={group ? Actions.HANDLE_GROUP_REQUEST : Actions.HANDLE_FRIEND_REQUEST}
      params={{ flag, approve: false, reason }}
      loadingText="处理请求…"
      successText="已拒绝请求"
    />
  );
}
