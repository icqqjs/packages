import React from "react";
import { Text, Box } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "查看详细资料卡（icqq getProfile）";

export const args = zod.tuple([
  zod.union([zod.number(), zod.string()]).describe(
    argument({ name: "target", description: "QQ号或 UID" }),
  ),
]);

type Props = { args: zod.infer<typeof args> };

export default function FriendProfile({ args: [target] }: Props) {
  const params =
    typeof target === "number" || /^\d+$/.test(target)
      ? { user_id: Number(target) }
      : { uid: target };

  return (
    <IpcCommand
      action={Actions.GET_PROFILE}
      params={params}
      loadingText="查询资料卡…"
      render={(data: Record<string, unknown>) => (
        <Box flexDirection="column" paddingX={1}>
          <Text bold color="cyan">详细资料</Text>
          <Text>{JSON.stringify(data, null, 2)}</Text>
        </Box>
      )}
    />
  );
}
