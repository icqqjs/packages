import React from "react";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "开启系统通知";

export default function NotifyOn() {
  return (
    <IpcMutate
      action={Actions.SET_NOTIFY}
      params={{ enabled: true }}
      loadingText="开启通知…"
      successText="系统通知已开启"
    />
  );
}
