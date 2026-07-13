import React from "react";
import { Text } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "查看用户的加好友设置";

export const args = zod.tuple([
  zod.number().describe(
    argument({ name: "uin", description: "用户QQ号" }),
  ),
]);

type Props = { args: zod.infer<typeof args> };

const settingMap: Record<number, string> = {
  0: "允许所有人",
  1: "需要验证",
  2: "需要正确回答问题",
  3: "需要回答问题并由我确认",
  99: "已拒绝所有人",
};

export default function AddFriendSetting({ args: [uin] }: Props) {
  return (
    <IpcCommand
      action={Actions.GET_ADD_FRIEND_SETTING}
      params={{ user_id: uin }}
      render={(data: any) => (
        <Text>加好友设置: {settingMap[data.setting] ?? `未知 (${data.setting})`}</Text>
      )}
    />
  );
}
