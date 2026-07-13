import React from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "设置 Webhook URL";

export const args = zod.tuple([
  zod.string().url().describe(argument({ name: "url", description: "Webhook URL" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function WebhookSet({ args: [url] }: Props) {
  return (
    <IpcMutate
      action={Actions.SET_WEBHOOK}
      params={{ url }}
      loadingText="设置 Webhook…"
      successText="Webhook 已更新"
    />
  );
}
