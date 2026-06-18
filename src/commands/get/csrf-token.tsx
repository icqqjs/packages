import React from "react";
import { Text } from "ink";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "获取 CSRF Token (bkn)";

export default function GetCsrfToken() {
  return (
    <IpcCommand
      action={Actions.GET_CSRF_TOKEN}
      params={{}}
      render={(data: { token?: number }) => <Text>bkn: {data.token}</Text>}
    />
  );
}
