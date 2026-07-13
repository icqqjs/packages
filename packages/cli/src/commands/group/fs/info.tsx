import React, { useState } from "react";
import { Text, Box } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { GroupSelector } from "@/components/Selectors.js";

export const description = "查看群文件系统信息";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "gid", description: "群号（不填则交互选择）" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function GfsInfo({ args: [gid] }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;

  return (
    <IpcCommand
      action={Actions.GFS_INFO}
      params={{ group_id: selectedGid }}
      loadingText="获取文件系统信息…"
      render={(data: any) => (
        <Box flexDirection="column" paddingX={1}>
          <Text bold color="cyan">群文件系统信息</Text>
          <Text>文件数: {data.file_count}</Text>
          <Text>最大文件数: {data.max_file_count}</Text>
          <Text>已用空间: {(data.used / 1024 / 1024).toFixed(1)} MB</Text>
          <Text>总空间: {(data.total / 1024 / 1024).toFixed(1)} MB</Text>
          <Text>剩余空间: {(data.free / 1024 / 1024).toFixed(1)} MB</Text>
        </Box>
      )}
    />
  );
}
