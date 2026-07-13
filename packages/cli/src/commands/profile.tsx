import React from "react";
import { Text, Box } from "ink";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "查看个人资料";

export default function Profile() {
  return (
    <IpcCommand
      action={Actions.GET_SELF_PROFILE}
      loadingText="查询资料…"
      render={(data: any) => (
        <Box flexDirection="column" paddingX={1}>
          <Text bold color="cyan">{data.nickname}</Text>
          <Text>QQ号: {data.uin}</Text>
          <Text>性别: {data.sex === "male" ? "男" : data.sex === "female" ? "女" : "未知"}</Text>
          <Text>年龄: {data.age}</Text>
          <Text>好友: {data.friendCount}  群组: {data.groupCount}  黑名单: {data.blacklistCount}</Text>
        </Box>
      )}
    />
  );
}
