import React, { useState } from "react";
import { Text, Box } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { FriendSelector } from "@/components/Selectors.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "查看好友资料";

export const args = zod.tuple([
  zod.number().optional().describe(
    argument({
      name: "uid",
      description: "好友QQ号（不填则交互选择）",
    }),
  ),
]);

type Props = {
  args: zod.infer<typeof args>;
};

function FriendInfo({ uid }: { uid: number }) {
  return (
    <IpcCommand
      action={Actions.GET_FRIEND_INFO}
      params={{ uid }}
      loadingText="查询好友资料…"
      render={(info) => (
        <Box flexDirection="column" paddingX={1}>
          <Text bold color="cyan">
            好友资料
          </Text>
          <Text>QQ号: {info.user_id}</Text>
          <Text>昵称: {info.nickname}</Text>
          {info.remark && <Text>备注: {info.remark}</Text>}
          {info.sex !== undefined && <Text>性别: {info.sex}</Text>}
          {info.age !== undefined && <Text>年龄: {info.age}</Text>}
          {info.area && <Text>地区: {info.area}</Text>}
        </Box>
      )}
    />
  );
}

export default function ViewFriend({ args: [uid] }: Props) {
  const [selectedUid, setSelectedUid] = useState(uid);
  if (selectedUid === undefined) return <FriendSelector onSelect={setSelectedUid} />;
  return <FriendInfo uid={selectedUid} />;
}
