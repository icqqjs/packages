import React from "react";
import { Text } from "ink";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { Table } from "@/components/Table.js";

export const description = "查看频道列表";

export default function GuildList() {
  return (
    <IpcCommand
      action={Actions.GUILD_LIST}
      loadingText="获取频道列表…"
      render={(data: any) => {
        const guilds = Array.isArray(data) ? data : [];
        if (guilds.length === 0) return <Text dimColor>暂无频道</Text>;
        return (
          <Table
            columns={[
              { key: "guild_id", header: "频道ID", width: 20 },
              { key: "guild_name", header: "频道名称", width: 30 },
            ]}
            data={guilds}
          />
        );
      }}
    />
  );
}
