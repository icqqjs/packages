import React from "react";
import { Text } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "查看用户在线状态信息";

export const args = zod.tuple([
  zod.number().describe(
    argument({ name: "uin", description: "用户QQ号" }),
  ),
]);

type Props = { args: zod.infer<typeof args> };

export default function StatusInfo({ args: [uin] }: Props) {
  return (
    <IpcCommand
      action={Actions.GET_STATUS_INFO}
      params={{ uin }}
      render={(data: any) => {
        if (!data) return <Text color="yellow">无法获取该用户的状态信息</Text>;
        return (
          <>
            <Text>QQ: {data.uin}</Text>
            <Text>状态码: {data.status}</Text>
            <Text>终端类型: {data.termType}</Text>
            <Text>终端描述: {data.termDesc}</Text>
            <Text>网络类型: {data.networkType}</Text>
            <Text>图标类型: {data.iconType}</Text>
          </>
        );
      }}
    />
  );
}
