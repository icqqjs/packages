import React from "react";
import { Text } from "ink";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "查看通知配置";

export default function NotifyView() {
  return (
    <IpcCommand
      action={Actions.GET_NOTIFY}
      loadingText="查询中…"
      render={(data: any) => {
        const enabled = data?.notifyEnabled ?? false;
        return enabled
          ? <Text color="green">系统通知: 已开启 ✔</Text>
          : <Text dimColor>系统通知: 已关闭</Text>;
      }}
    />
  );
}
