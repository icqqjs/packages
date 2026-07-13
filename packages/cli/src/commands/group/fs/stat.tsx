import React, { useState } from "react";
import { Text, Box } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { GroupSelector } from "@/components/Selectors.js";

export const description = "查看群文件/目录详情";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "gid", description: "群号（不填则交互选择）" })),
  zod.string().describe(argument({ name: "fid", description: "文件/目录ID" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function GfsStat({ args: [gid, fid] }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;

  return (
    <IpcCommand
      action={Actions.GFS_STAT}
      params={{ group_id: selectedGid, fid }}
      loadingText="查询文件信息…"
      render={(data: any) => (
        <Box flexDirection="column" paddingX={1}>
          <Text bold color="cyan">{data.is_dir ? "目录" : "文件"}详情</Text>
          <Text>名称: {data.name}</Text>
          <Text>ID: {data.fid}</Text>
          {data.is_dir ? (
            <Text>文件数: {data.file_count ?? 0}</Text>
          ) : (
            <>
              <Text>大小: {((data.size ?? 0) / 1024 / 1024).toFixed(2)} MB</Text>
              <Text>MD5: {data.md5 ?? "N/A"}</Text>
            </>
          )}
          {data.user_id ? <Text>上传者: {data.user_id}</Text> : null}
          {data.upload_time ? <Text>上传时间: {new Date(data.upload_time * 1000).toLocaleString()}</Text> : null}
        </Box>
      )}
    />
  );
}
