import React from "react";
import { Text, Box } from "ink";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { termLink } from "@/lib/parse-message.js";

export const description = "查看 Webhook 配置";

export default function WebhookView() {
  return (
    <IpcCommand
      action={Actions.GET_WEBHOOK}
      render={(data) => {
        const url = (data as any)?.url;
        return (
          <Box paddingX={1}>
            {url ? (
              <Text color="green">{termLink(url, url)}</Text>
            ) : (
              <Text dimColor>未配置 Webhook</Text>
            )}
          </Box>
        );
      }}
    />
  );
}
