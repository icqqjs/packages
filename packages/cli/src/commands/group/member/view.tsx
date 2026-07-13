import React, { useState } from "react";
import { Text, Box } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { GroupSelector, MemberSelector } from "@/components/Selectors.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "查看群成员资料";

export const args = zod.tuple([
  zod.number().optional().describe(
    argument({
      name: "gid",
      description: "群号（不填则交互选择）",
    }),
  ),
  zod.number().optional().describe(
    argument({
      name: "uid",
      description: "成员QQ号（不填则交互选择）",
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

const roleMap: Record<string, string> = {
  owner: "群主",
  admin: "管理员",
  member: "成员",
};

function MemberInfo({ gid, uid }: { gid: number; uid: number }) {
  return (
    <IpcCommand
      action={Actions.GET_GROUP_MEMBER_INFO}
      params={{ gid, uid }}
      loadingText="查询群成员资料…"
      render={(info) => (
        <Box flexDirection="column" paddingX={1}>
          <Text bold color="cyan">
            群成员资料
          </Text>
          <Text>QQ号: {info.user_id}</Text>
          <Text>昵称: {info.nickname}</Text>
          {info.card && <Text>群名片: {info.card}</Text>}
          <Text>角色: {roleMap[info.role] ?? info.role}</Text>
          {info.title && <Text>头衔: {info.title}</Text>}
          <Text>等级: {info.level}</Text>
          <Text>加入时间: {formatDate(info.join_time)}</Text>
          <Text>最后发言: {formatDate(info.last_sent_time)}</Text>
          {info.shutup_time > 0 && (
            <Text color="red">
              禁言至: {formatDate(info.shutup_time)}
            </Text>
          )}
        </Box>
      )}
    />
  );
}

export default function ViewGroupMember({ args: [gid, uid] }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  const [selectedUid, setSelectedUid] = useState(uid);

  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;
  if (selectedUid === undefined) return <MemberSelector gid={selectedGid} onSelect={setSelectedUid} />;
  return <MemberInfo gid={selectedGid} uid={selectedUid} />;
}
