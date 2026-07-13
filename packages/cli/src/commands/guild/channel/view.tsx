import React from "react";
import { Text, Box } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "查看子频道详情";

export const args = zod.tuple([
  zod.string().describe(argument({ name: "guild_id", description: "频道 ID" })),
  zod.string().describe(argument({ name: "channel_id", description: "子频道 ID" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function GuildChannelView({ args: [guildId, channelId] }: Props) {
  return (
    <IpcCommand
      action={Actions.GET_CHANNEL_INFO}
      params={{ guild_id: guildId, channel_id: channelId }}
      loadingText="查询子频道…"
      render={(data: Record<string, unknown>) => (
        <Box flexDirection="column" paddingX={1}>
          <Text bold color="cyan">子频道详情</Text>
          <Text>{JSON.stringify(data, null, 2)}</Text>
        </Box>
      )}
    />
  );
}
