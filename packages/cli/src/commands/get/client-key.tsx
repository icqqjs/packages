import React from "react";
import { Text } from "ink";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "获取 ClientKey";

export default function GetClientKey() {
  return (
    <IpcCommand
      action={Actions.GET_CLIENT_KEY}
      params={{}}
      render={(data: any) => (
        <>
          <Text>client_key: {data.client_key}</Text>
          <Text>过期时间: {new Date(data.expire_time * 1000).toLocaleString()}</Text>
        </>
      )}
    />
  );
}
