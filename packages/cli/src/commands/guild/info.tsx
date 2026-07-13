import React, { useState } from "react";
import { Text, Box } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { GuildSelector } from "@/components/Selectors.js";

export const description = "查看频道信息";

export const args = zod.tuple([
  zod.string().optional().describe(argument({ name: "guild_id", description: "频道ID（不填则交互选择）" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function GuildInfo({ args: [guildId] }: Props) {
  const [selectedId, setSelectedId] = useState(guildId);
  if (!selectedId) return <GuildSelector onSelect={setSelectedId} />;

  return (
    <IpcCommand
      action={Actions.GUILD_INFO}
      params={{ guild_id: selectedId }}
      loadingText="获取频道信息…"
      render={(data: any) => {
        if (!data) return <Text dimColor>频道不存在</Text>;
        return (
          <Box flexDirection="column" paddingX={1}>
            <Text bold color="cyan">频道信息</Text>
            <Text>频道ID: {data.guild_id}</Text>
            <Text>频道名称: {data.guild_name}</Text>
          </Box>
        );
      }}
    />
  );
}
