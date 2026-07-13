import React, { useState } from "react";
import { Text } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { Spinner } from "@/components/Spinner.js";
import { ChatSession } from "@/components/ChatSession.js";
import { GroupSelector } from "@/components/Selectors.js";
import { useIpcConnection } from "@/lib/use-ipc-connection.js";

export const description = "进入群聊天模式";

export const args = zod.tuple([
  zod.number().optional().describe(
    argument({
      name: "id",
      description: "群号（不填则交互选择）",
    }),
  ),
]);

type Props = {
  args: zod.infer<typeof args>;
};

export default function GroupChat({ args: [id] }: Props) {
  const { ipc, error } = useIpcConnection();
  const [selectedId, setSelectedId] = useState<number | undefined>(id);

  if (error) {
    return <Text color="red">✖ {error}</Text>;
  }

  if (!ipc) {
    return <Spinner label="连接守护进程…" />;
  }

  if (selectedId === undefined) {
    return <GroupSelector ipc={ipc} onSelect={setSelectedId} />;
  }

  return <ChatSession ipc={ipc} type="group" id={selectedId} />;
}
