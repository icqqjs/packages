import React from "react";
import { Text } from "ink";
import zod from "zod";
import { argument, option } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "批量 UID 转 QQ 号";

export const args = zod.tuple([
  zod.string().describe(
    argument({ name: "uids", description: "逗号分隔的 UID 列表" }),
  ),
]);

export const options = zod.object({
  gid: zod.number().optional().describe(option({ description: "群号（可选）", alias: "g" })),
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function Uids2Uins({ args: [uidsRaw], options: { gid } }: Props) {
  const uids = uidsRaw.split(",").map((s) => s.trim()).filter(Boolean);
  return (
    <IpcCommand
      action={Actions.UID2UINS}
      params={{ uids, group_id: gid }}
      render={(data: { uins?: number[] }) => (
        <Text>{JSON.stringify(data.uins ?? [], null, 2)}</Text>
      )}
    />
  );
}
