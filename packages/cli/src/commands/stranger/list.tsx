import React from "react";
import { Text, Box } from "ink";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "陌生人列表";

export default function StrangerList() {
  return (
    <IpcCommand
      action={Actions.LIST_STRANGERS}
      params={{}}
      loadingText="获取陌生人列表…"
      render={(data: Array<{ user_id: number; nickname: string }>) => {
        if (!Array.isArray(data) || data.length === 0) {
          return <Text dimColor>暂无陌生人</Text>;
        }
        return (
          <Box flexDirection="column" paddingX={1}>
            <Text bold color="cyan">陌生人 ({data.length})</Text>
            {data.map((s) => (
              <Text key={s.user_id}>
                {s.user_id} {s.nickname}
              </Text>
            ))}
          </Box>
        );
      }}
    />
  );
}
