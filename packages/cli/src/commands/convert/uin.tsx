import React from "react";
import { Text } from "ink";
import zod from "zod";
import { argument, option } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "将 QQ号 转换为 UID";

export const args = zod.tuple([
  zod.number().describe(
    argument({ name: "uin", description: "用户QQ号" }),
  ),
]);

export const options = zod.object({
  gid: zod.number().optional().describe(option({ description: "群号（可选，用于群场景）", alias: "g" })),
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function Uin2Uid({ args: [uin], options: { gid } }: Props) {
  return (
    <IpcCommand
      action={Actions.UIN2UID}
      params={{ uin, group_id: gid }}
      render={(data: any) => <Text>QQ号 {uin} → UID {data.uid}</Text>}
    />
  );
}
