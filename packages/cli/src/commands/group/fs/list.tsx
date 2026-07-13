import React, { useState } from "react";
import { Text, Box } from "ink";
import zod from "zod";
import { argument, option } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { Table } from "@/components/Table.js";
import { GroupSelector } from "@/components/Selectors.js";

export const description = "列出群文件";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "gid", description: "群号（不填则交互选择）" })),
]);

export const options = zod.object({
  pid: zod.string().default("/").describe(option({ description: "父目录ID", alias: "p" })),
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function GfsList({ args: [gid], options: { pid } }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;

  return (
    <IpcCommand
      action={Actions.GFS_LIST}
      params={{ group_id: selectedGid, pid }}
      loadingText="获取文件列表…"
      render={(data: any[]) => (
        <Box flexDirection="column">
          {data.length === 0 ? (
            <Text dimColor>目录为空</Text>
          ) : (
            <Table
              columns={[
                { key: "名称", header: "名称" },
                { key: "类型", header: "类型" },
                { key: "大小", header: "大小" },
                { key: "ID", header: "ID" },
              ]}
              data={data.map((f: any) => ({
                名称: f.name,
                类型: f.is_dir ? "📁 目录" : "📄 文件",
                大小: f.is_dir ? "-" : formatSize(f.size),
                ID: f.fid,
              }))}
            />
          )}
        </Box>
      )}
    />
  );
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + " GB";
}
