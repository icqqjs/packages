import React, { useState } from "react";
import { Text, Box } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { GroupSelector } from "@/components/Selectors.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "查看群资料";

export const args = zod.tuple([
  zod.number().optional().describe(
    argument({
      name: "gid",
      description: "群号（不填则交互选择）",
    }),
  ),
]);

type Props = {
  args: zod.infer<typeof args>;
};

function formatDate(ts: number): string {
  if (!ts) return "未知";
  return new Date(ts * 1000).toLocaleString("zh-CN");
}

function GroupInfo({ gid }: { gid: number }) {
  return (
    <IpcCommand
      action={Actions.GET_GROUP_INFO}
      params={{ gid }}
      loadingText="查询群资料…"
      render={(info) => (
        <Box flexDirection="column" paddingX={1}>
          <Text bold color="cyan">
            群资料
          </Text>
          <Text>群号: {info.group_id}</Text>
          <Text>群名: {info.group_name}</Text>
          <Text>
            成员: {info.member_count}/{info.max_member_count}
          </Text>
          <Text>群主: {info.owner_id}</Text>
          {info.create_time && (
            <Text>创建时间: {formatDate(info.create_time)}</Text>
          )}
          {info.last_join_time && (
            <Text>最后加入: {formatDate(info.last_join_time)}</Text>
          )}
          {info.grade !== undefined && <Text>等级: {info.grade}</Text>}
        </Box>
      )}
    />
  );
}

export default function ViewGroup({ args: [gid] }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;
  return <GroupInfo gid={selectedGid} />;
}
