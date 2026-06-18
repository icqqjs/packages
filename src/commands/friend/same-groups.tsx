import React from "react";
import { Text, Box } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "查找与好友的共群";

export const args = zod.tuple([
  zod.number().describe(argument({ name: "uid", description: "好友 QQ 号" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function FriendSameGroups({ args: [uid] }: Props) {
  return (
    <IpcCommand
      action={Actions.SEARCH_SAME_GROUP}
      params={{ user_id: uid }}
      loadingText="查询共群…"
      render={(data: unknown) => (
        <Box flexDirection="column" paddingX={1}>
          <Text bold color="cyan">共群</Text>
          <Text>{JSON.stringify(data, null, 2)}</Text>
        </Box>
      )}
    />
  );
}
