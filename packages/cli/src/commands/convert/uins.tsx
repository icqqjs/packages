import React from "react";
import { Text } from "ink";
import zod from "zod";
import { argument, option } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "批量 QQ 号转 UID";

export const args = zod.tuple([
  zod.string().describe(
    argument({ name: "uins", description: "逗号分隔的 QQ 号列表" }),
  ),
]);

export const options = zod.object({
  gid: zod.number().optional().describe(option({ description: "群号（可选）", alias: "g" })),
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function Uins2Uids({ args: [uinsRaw], options: { gid } }: Props) {
  const uins = uinsRaw.split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
  return (
    <IpcCommand
      action={Actions.UIN2UIDS}
      params={{ uins, group_id: gid }}
      render={(data: { uids?: string[] }) => (
        <Text>{JSON.stringify(data.uids ?? [], null, 2)}</Text>
      )}
    />
  );
}
