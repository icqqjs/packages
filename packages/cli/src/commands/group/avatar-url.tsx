import React from "react";
import { Text } from "ink";
import zod from "zod";
import { argument, option } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { termLink } from "@/lib/parse-message.js";

export const description = "获取群头像URL";

export const args = zod.tuple([
  zod.number().describe(
    argument({ name: "gid", description: "群号" }),
  ),
]);

export const options = zod.object({
  size: zod.number().optional().describe(option({ description: "头像大小 (0|40|100|140)", alias: "s" })),
  history: zod.number().optional().describe(option({ description: "历史头像记录 (1,2,3...)" })),
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function GroupAvatarUrl({ args: [gid], options: { size, history } }: Props) {
  return (
    <IpcCommand
      action={Actions.GET_GROUP_AVATAR_URL}
      params={{ group_id: gid, size: size ?? 0, history }}
      render={(data: any) => <Text>{termLink(data.url, data.url)}</Text>}
    />
  );
}
