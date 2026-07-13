import React, { useState } from "react";
import { Text, Box } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { GroupSelector } from "@/components/Selectors.js";

export const description = "查看群匿名信息";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "gid", description: "群号（不填则交互选择）" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function GroupAnonInfo({ args: [gid] }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;

  return (
    <IpcCommand
      action={Actions.GROUP_ANON_INFO}
      params={{ group_id: selectedGid }}
      loadingText="查询匿名信息…"
      render={(data: any) => (
        <Box flexDirection="column" paddingX={1}>
          <Text bold color="cyan">群匿名信息</Text>
          <Text>匿名开关: {data.enable ? "开启" : "关闭"}</Text>
          {data.id !== undefined ? <Text>匿名ID: {data.id}</Text> : null}
          {data.name ? <Text>匿名昵称: {data.name}</Text> : null}
        </Box>
      )}
    />
  );
}
