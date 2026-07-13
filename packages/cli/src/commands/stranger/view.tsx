import React from "react";
import { Text, Box } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "查看陌生人资料";

export const args = zod.tuple([
  zod.number().describe(argument({ name: "uid", description: "QQ号" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function StrangerView({ args: [uid] }: Props) {
  return (
    <IpcCommand
      action={Actions.GET_STRANGER_INFO}
      params={{ user_id: uid }}
      loadingText="查询陌生人资料…"
      render={(data: any) => (
        <Box flexDirection="column" paddingX={1}>
          <Text bold color="cyan">陌生人资料</Text>
          <Text>QQ号: {data.user_id}</Text>
          <Text>昵称: {data.nickname ?? "未知"}</Text>
          <Text>性别: {data.sex === "male" ? "男" : data.sex === "female" ? "女" : "未知"}</Text>
          <Text>年龄: {data.age ?? "未知"}</Text>
          {data.area ? <Text>地区: {data.area}</Text> : null}
        </Box>
      )}
    />
  );
}
