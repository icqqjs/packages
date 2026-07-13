import React from "react";
import { Text } from "ink";
import zod from "zod";
import { argument, option } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { termLink } from "@/lib/parse-message.js";

export const description = "获取用户头像URL";

export const args = zod.tuple([
  zod.number().describe(
    argument({ name: "uid", description: "用户QQ号" }),
  ),
]);

export const options = zod.object({
  size: zod.number().optional().describe(option({ description: "头像大小 (0|40|100|140)", alias: "s" })),
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function AvatarUrl({ args: [uid], options: { size } }: Props) {
  return (
    <IpcCommand
      action={Actions.GET_AVATAR_URL}
      params={{ user_id: uid, size: size ?? 0 }}
      render={(data: any) => <Text>{termLink(data.url, data.url)}</Text>}
    />
  );
}
