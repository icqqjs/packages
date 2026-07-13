import React, { useState } from "react";
import { Text } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { GuildSelector, ChannelSelector } from "@/components/Selectors.js";

export const description = "发送子频道消息";

export const args = zod.tuple([
  zod.string().optional().describe(argument({ name: "guild_id", description: "频道ID（不填则交互选择）" })),
  zod.string().optional().describe(argument({ name: "channel_id", description: "子频道ID（不填则交互选择）" })),
  zod.string().optional().describe(argument({ name: "message", description: "消息内容" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function GuildSend({ args: [guildId, channelId, message] }: Props) {
  const [selectedGuild, setSelectedGuild] = useState(guildId);
  const [selectedChannel, setSelectedChannel] = useState(channelId);

  if (!selectedGuild) return <GuildSelector onSelect={setSelectedGuild} />;
  if (!selectedChannel) return <ChannelSelector guildId={selectedGuild} onSelect={setSelectedChannel} />;
  if (!message) {
    return (
      <Text color="yellow">
        请提供 message 参数，例如: icqq guild channel send &lt;guild_id&gt; &lt;channel_id&gt; &quot;你好&quot;
      </Text>
    );
  }

  return (
    <IpcMutate
      action={Actions.GUILD_SEND_MSG}
      params={{ guild_id: selectedGuild, channel_id: selectedChannel, message }}
      loadingText="发送频道消息…"
      successText="频道消息已发送"
    />
  );
}
