import React, { useState } from "react";
import { Text } from "ink";
import zod from "zod";
import { argument, option } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { GuildSelector, ChannelSelector } from "@/components/Selectors.js";

export const description = "发送子频道互联分享";

export const args = zod.tuple([
  zod.string().optional().describe(
    argument({ name: "guild-id", description: "频道ID（不填则交互选择）" }),
  ),
  zod.string().optional().describe(
    argument({ name: "channel-id", description: "子频道ID（不填则交互选择）" }),
  ),
  zod.string().optional().describe(
    argument({ name: "url", description: "分享链接" }),
  ),
  zod.string().optional().describe(
    argument({ name: "title", description: "分享标题" }),
  ),
]);

export const options = zod.object({
  summary: zod.string().optional().describe(option({ description: "分享描述" })),
  content: zod.string().optional().describe(option({ description: "消息列表文字" })),
  image: zod.string().optional().describe(option({ description: "预览图网址" })),
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function ChannelShare({ args: [guildId, channelId, url, title], options: { summary, content, image } }: Props) {
  const [selectedGuild, setSelectedGuild] = useState(guildId);
  const [selectedChannel, setSelectedChannel] = useState(channelId);

  if (!selectedGuild) return <GuildSelector onSelect={setSelectedGuild} />;
  if (!selectedChannel) return <ChannelSelector guildId={selectedGuild} onSelect={setSelectedChannel} />;
  if (!url || !title) {
    return <Text color="yellow">请提供 url 与 title 参数</Text>;
  }

  return (
    <IpcMutate
      action={Actions.GUILD_CHANNEL_SHARE}
      params={{ guild_id: selectedGuild, channel_id: selectedChannel, url, title, summary, content, image }}
      loadingText="发送分享…"
      successText="频道分享已发送"
    />
  );
}
