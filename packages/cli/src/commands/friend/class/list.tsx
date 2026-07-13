import React from "react";
import { Text } from "ink";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { Table } from "@/components/Table.js";

export const description = "查看好友分组列表";

export default function ListFriendClass() {
  return (
    <IpcCommand
      action={Actions.LIST_FRIEND_CLASSES}
      loadingText="获取好友分组…"
      render={(data: any[]) => {
        if (!data || data.length === 0) return <Text dimColor>暂无好友分组</Text>;
        return (
          <Table
            columns={[
              { key: "id", header: "分组ID", width: 8 },
              { key: "name", header: "分组名称", width: 20 },
            ]}
            data={data}
          />
        );
      }}
    />
  );
}
