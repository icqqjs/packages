import React from "react";
import { Text } from "ink";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Table } from "@/components/Table.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "查看群组列表";

export default function ListGroup() {
  return (
    <IpcCommand
      action={Actions.LIST_GROUPS}
      loadingText="加载群列表…"
      render={(data) => {
        const groups = (data as any[]) ?? [];
        if (groups.length === 0) {
          return <Text dimColor>暂无群组</Text>;
        }

        return (
          <Table
            columns={[
              { key: "group_id", header: "群号", width: 12 },
              { key: "group_name", header: "群名", width: 30 },
              { key: "member_count", header: "成员数", width: 8 },
              { key: "max_member_count", header: "上限", width: 8 },
              { key: "owner_id", header: "群主", width: 12 },
            ]}
            data={groups}
          />
        );
      }}
    />
  );
}
