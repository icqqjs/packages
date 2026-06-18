import React from "react";
import { Text } from "ink";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "查询服务器在线状态";

export default function GetOnlineStatus() {
  return (
    <IpcCommand
      action={Actions.GET_ONLINE_STATUS}
      params={{}}
      render={(data: { status?: number }) => <Text>在线状态: {data.status}</Text>}
    />
  );
}
