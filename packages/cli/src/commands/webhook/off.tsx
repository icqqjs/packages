import React from "react";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "关闭 Webhook 推送";

export default function WebhookOff() {
  return (
    <IpcMutate
      action={Actions.SET_WEBHOOK}
      params={{ url: "" }}
      loadingText="关闭 Webhook…"
      successText="Webhook 已关闭"
    />
  );
}
