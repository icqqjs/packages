import React, { useState } from "react";
import { Text } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { Table } from "@/components/Table.js";
import { GuildSelector } from "@/components/Selectors.js";

export const description = "查看频道成员列表";

export const args = zod.tuple([
  zod.string().optional().describe(argument({ name: "guild_id", description: "频道ID（不填则交互选择）" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function GuildMembers({ args: [guildId] }: Props) {
  const [selectedId, setSelectedId] = useState(guildId);
  if (!selectedId) return <GuildSelector onSelect={setSelectedId} />;
  return (
    <IpcCommand
      action={Actions.GUILD_MEMBERS}
      params={{ guild_id: selectedId }}
      loadingText="获取频道成员…"
      render={(data: any) => {
        const members = Array.isArray(data) ? data : [];
        if (members.length === 0) return <Text dimColor>暂无成员</Text>;
        return (
          <Table
            columns={[
              { key: "tiny_id", header: "TinyID", width: 20 },
              { key: "nickname", header: "昵称", width: 20 },
              { key: "role_name", header: "角色", width: 15 },
            ]}
            data={members}
          />
        );
      }}
    />
  );
}
