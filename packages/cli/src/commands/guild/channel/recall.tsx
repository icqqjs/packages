import React, { useState } from "react";
import { Text } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { GuildSelector, ChannelSelector } from "@/components/Selectors.js";

export const description = "撤回子频道消息";

export const args = zod.tuple([
  zod.string().optional().describe(argument({ name: "guild_id", description: "频道ID（不填则交互选择）" })),
  zod.string().optional().describe(argument({ name: "channel_id", description: "子频道ID（不填则交互选择）" })),
  zod.number().optional().describe(argument({ name: "seq", description: "消息序列号" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function GuildRecall({ args: [guildId, channelId, seq] }: Props) {
  const [selectedGuild, setSelectedGuild] = useState(guildId);
  const [selectedChannel, setSelectedChannel] = useState(channelId);

  if (!selectedGuild) return <GuildSelector onSelect={setSelectedGuild} />;
  if (!selectedChannel) return <ChannelSelector guildId={selectedGuild} onSelect={setSelectedChannel} />;
  if (seq === undefined) {
    return <Text color="yellow">请提供 seq 参数（消息序列号）</Text>;
  }

  return (
    <IpcMutate
      action={Actions.GUILD_RECALL_MSG}
      params={{ guild_id: selectedGuild, channel_id: selectedChannel, seq }}
      loadingText="撤回频道消息…"
      successText="频道消息已撤回"
    />
  );
}
