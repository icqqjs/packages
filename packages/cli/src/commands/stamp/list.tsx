import React from "react";
import { Text } from "ink";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { Table } from "@/components/Table.js";

export const description = "查看漫游表情列表";

export default function StampList() {
  return (
    <IpcCommand
      action={Actions.GET_ROAMING_STAMP}
      loadingText="获取漫游表情…"
      render={(data: any) => {
        const stamps = Array.isArray(data) ? data : [];
        if (stamps.length === 0) return <Text dimColor>暂无漫游表情</Text>;
        return (
          <Table
            columns={[
              { key: "index", header: "#", width: 4 },
              { key: "id", header: "ID", width: 40 },
            ]}
            data={stamps.map((s: string, i: number) => ({ index: i + 1, id: s }))}
          />
        );
      }}
    />
  );
}
