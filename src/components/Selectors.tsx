/**
 * Pre-configured ListSelector wrappers for common entity types.
 * FriendSelector, GroupSelector, MemberSelector.
 */
import React from "react";
import { Text } from "ink";
import { ListSelector } from "./ListSelector.js";
import { Actions } from "@/daemon/protocol.js";
import type { IpcClient } from "@/lib/ipc-client.js";

type SelectorProps = { ipc?: IpcClient };

// ── Friend ──

type FriendItem = {
  user_id: number;
  nickname: string;
  remark: string;
};

export function FriendSelector({
  ipc,
  onSelect,
}: SelectorProps & { onSelect: (uid: number) => void }) {
  return (
    <ListSelector<FriendItem>
      ipc={ipc}
      action={Actions.LIST_FRIENDS}
      title="选择好友"
      loadingLabel="加载好友列表…"
      emptyLabel="无匹配好友"
      getId={(f) => f.user_id}
      getFilterTexts={(f) => [f.nickname, f.remark, String(f.user_id)]}
      renderItem={(f, selected) => (
        <>
          {selected ? <Text color="yellow">❯ </Text> : <Text>  </Text>}
          <Text bold>{f.remark || f.nickname}</Text>
          {f.remark && <Text dimColor> ({f.nickname})</Text>}
          <Text dimColor> · {f.user_id}</Text>
        </>
      )}
      onSelect={onSelect}
    />
  );
}

// ── Group ──

type GroupItem = {
  group_id: number;
  group_name: string;
  member_count: number;
};

export function GroupSelector({
  ipc,
  onSelect,
}: SelectorProps & { onSelect: (gid: number) => void }) {
  return (
    <ListSelector<GroupItem>
      ipc={ipc}
      action={Actions.LIST_GROUPS}
      title="选择群"
      loadingLabel="加载群列表…"
      emptyLabel="无匹配群"
      getId={(g) => g.group_id}
      getFilterTexts={(g) => [g.group_name, String(g.group_id)]}
      renderItem={(g, selected) => (
        <>
          {selected ? <Text color="yellow">❯ </Text> : <Text>  </Text>}
          <Text bold>{g.group_name}</Text>
          <Text dimColor> ({g.group_id}) · {g.member_count}人</Text>
        </>
      )}
      onSelect={onSelect}
    />
  );
}

// ── Member ──

type MemberItem = {
  user_id: number;
  nickname: string;
  card: string;
  role: string;
};

export function MemberSelector({
  ipc,
  gid,
  onSelect,
}: SelectorProps & { gid: number; onSelect: (uid: number) => void }) {
  return (
    <ListSelector<MemberItem>
      ipc={ipc}
      action={Actions.LIST_GROUP_MEMBERS}
      params={{ gid }}
      title="选择成员"
      loadingLabel={`加载群 ${gid} 成员列表…`}
      emptyLabel="无匹配成员"
      getId={(m) => m.user_id}
      getFilterTexts={(m) => [m.nickname, m.card, String(m.user_id)]}
      renderItem={(m, selected) => (
        <>
          {selected ? <Text color="yellow">❯ </Text> : <Text>  </Text>}
          <Text bold>{m.card || m.nickname}</Text>
          {m.card && <Text dimColor> ({m.nickname})</Text>}
          <Text dimColor> · {m.user_id}</Text>
          {m.role !== "member" && <Text color={m.role === "owner" ? "red" : "yellow"}> [{m.role === "owner" ? "群主" : "管理"}]</Text>}
        </>
      )}
      onSelect={onSelect}
    />
  );
}

// ── Guild ──

type GuildItem = {
  guild_id: string;
  guild_name: string;
};

export function GuildSelector({
  ipc,
  onSelect,
}: SelectorProps & { onSelect: (guildId: string) => void }) {
  return (
    <ListSelector<GuildItem, string>
      ipc={ipc}
      action={Actions.GUILD_LIST}
      title="选择频道"
      loadingLabel="加载频道列表…"
      emptyLabel="无匹配频道"
      getId={(g) => g.guild_id}
      getFilterTexts={(g) => [g.guild_name, g.guild_id]}
      renderItem={(g, selected) => (
        <>
          {selected ? <Text color="yellow">❯ </Text> : <Text>  </Text>}
          <Text bold>{g.guild_name}</Text>
          <Text dimColor> ({g.guild_id})</Text>
        </>
      )}
      onSelect={onSelect}
    />
  );
}

// ── Channel ──

type ChannelItem = {
  channel_id: string;
  channel_name: string;
  channel_type: number;
};

export function ChannelSelector({
  ipc,
  guildId,
  onSelect,
}: SelectorProps & { guildId: string; onSelect: (channelId: string) => void }) {
  return (
    <ListSelector<ChannelItem, string>
      ipc={ipc}
      action={Actions.GUILD_CHANNELS}
      params={{ guild_id: guildId }}
      title="选择子频道"
      loadingLabel="加载子频道列表…"
      emptyLabel="无匹配子频道"
      getId={(c) => c.channel_id}
      getFilterTexts={(c) => [c.channel_name, c.channel_id]}
      renderItem={(c, selected) => (
        <>
          {selected ? <Text color="yellow">❯ </Text> : <Text>  </Text>}
          <Text bold>{c.channel_name}</Text>
          <Text dimColor> ({c.channel_id})</Text>
        </>
      )}
      onSelect={onSelect}
    />
  );
}
