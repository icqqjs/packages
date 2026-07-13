import React, { useState } from "react";
import { Text, Box } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { GroupSelector } from "@/components/Selectors.js";

export const description = "获取群文件下载链接";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "gid", description: "群号（不填则交互选择）" })),
  zod.string().describe(argument({ name: "fid", description: "文件ID" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function GfsDownload({ args: [gid, fid] }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;

  return (
    <IpcCommand
      action={Actions.GFS_DOWNLOAD}
      params={{ group_id: selectedGid, fid }}
      loadingText="获取下载链接…"
      render={(data: any) => (
        <Box flexDirection="column" paddingX={1}>
          <Text bold color="cyan">下载信息</Text>
          {data.name ? <Text>文件名: {data.name}</Text> : null}
          <Text>链接: {data.url}</Text>
        </Box>
      )}
    />
  );
}
