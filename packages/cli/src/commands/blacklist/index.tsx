import React from "react";
import { Text, Box } from "ink";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { Table } from "@/components/Table.js";

export const description = "查看黑名单";

export default function ListBlacklist() {
  return (
    <IpcCommand
      action={Actions.LIST_BLACKLIST}
      loadingText="获取黑名单…"
      render={(data) => {
        const list = data as any[];
        if (!list || list.length === 0) {
          return <Text dimColor>黑名单为空</Text>;
        }
        return (
          <Box flexDirection="column">
            <Table
              columns={[
                { key: "QQ号", header: "QQ号" },
                { key: "昵称", header: "昵称" },
              ]}
              data={list.map((u: any) => ({
                QQ号: u.user_id,
                昵称: u.nickname ?? "",
              }))}
            />
          </Box>
        );
      }}
    />
  );
}
