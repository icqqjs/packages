import React from "react";
import zod from "zod";
import { argument, option } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "接受好友/群请求";

export const args = zod.tuple([
  zod.string().describe(argument({ name: "flag", description: "请求标识(通过 icqq requests 查看)" })),
]);

export const options = zod.object({
  group: zod.boolean().default(false).describe(option({ description: "群请求(默认为好友请求)", alias: "g" })),
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function RequestAccept({ args: [flag], options: { group } }: Props) {
  return (
    <IpcMutate
      action={group ? Actions.HANDLE_GROUP_REQUEST : Actions.HANDLE_FRIEND_REQUEST}
      params={{ flag, approve: true }}
      loadingText="处理请求…"
      successText="已接受请求"
    />
  );
}
