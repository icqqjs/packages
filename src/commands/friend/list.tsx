import React from "react";
import { Text } from "ink";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Table } from "@/components/Table.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "查看好友列表";

export default function ListFriend() {
  return (
    <IpcCommand
      action={Actions.LIST_FRIENDS}
      loadingText="加载好友列表…"
      render={(data) => {
        const friends = (data as any[]) ?? [];
        if (friends.length === 0) {
          return <Text dimColor>暂无好友</Text>;
        }

        return (
          <Table
            columns={[
              { key: "user_id", header: "QQ号", width: 12 },
              { key: "nickname", header: "昵称", width: 20 },
              { key: "remark", header: "备注", width: 20 },
              { key: "sex", header: "性别", width: 6 },
            ]}
            data={friends}
          />
        );
      }}
    />
  );
}
