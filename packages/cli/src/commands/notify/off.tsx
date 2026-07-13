import React from "react";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "关闭系统通知";

export default function NotifyOff() {
  return (
    <IpcMutate
      action={Actions.SET_NOTIFY}
      params={{ enabled: false }}
      loadingText="关闭通知…"
      successText="系统通知已关闭"
    />
  );
}
