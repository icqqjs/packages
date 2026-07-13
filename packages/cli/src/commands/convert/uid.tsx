import React from "react";
import { Text } from "ink";
import zod from "zod";
import { argument, option } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "将 UID 转换为 QQ号";

export const args = zod.tuple([
  zod.string().describe(
    argument({ name: "uid", description: "用户UID" }),
  ),
]);

export const options = zod.object({
  gid: zod.number().optional().describe(option({ description: "群号（可选，用于群场景）", alias: "g" })),
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function Uid2Uin({ args: [uid], options: { gid } }: Props) {
  return (
    <IpcCommand
      action={Actions.UID2UIN}
      params={{ uid, group_id: gid }}
      render={(data: any) => <Text>UID {uid} → QQ号 {data.uin}</Text>}
    />
  );
}
