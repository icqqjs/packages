import React, { useState } from "react";
import { Text } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { Spinner } from "@/components/Spinner.js";
import { ChannelChatSession } from "@/components/ChannelChatSession.js";
import { GuildSelector, ChannelSelector } from "@/components/Selectors.js";
import { useIpcConnection } from "@/lib/use-ipc-connection.js";

export const description = "进入子频道聊天模式";

export const args = zod.tuple([
  zod.string().optional().describe(
    argument({ name: "guild_id", description: "频道ID（不填则交互选择）" }),
  ),
  zod.string().optional().describe(
    argument({ name: "channel_id", description: "子频道ID（不填则交互选择）" }),
  ),
]);

type Props = { args: zod.infer<typeof args> };

export default function ChannelChat({ args: [guildId, channelId] }: Props) {
  const { ipc, error } = useIpcConnection();
  const [selectedGuild, setSelectedGuild] = useState(guildId);
  const [selectedChannel, setSelectedChannel] = useState(channelId);

  if (error) return <Text color="red">✖ {error}</Text>;
  if (!ipc) return <Spinner label="连接守护进程…" />;
  if (!selectedGuild) {
    return <GuildSelector ipc={ipc} onSelect={setSelectedGuild} />;
  }
  if (!selectedChannel) {
    return (
      <ChannelSelector
        ipc={ipc}
        guildId={selectedGuild}
        onSelect={setSelectedChannel}
      />
    );
  }

  return (
    <ChannelChatSession
      ipc={ipc}
      guildId={selectedGuild}
      channelId={selectedChannel}
    />
  );
}
