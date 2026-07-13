import React from "react";
import { Text } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { termLink } from "@/lib/parse-message.js";

export const description = "获取私聊文件下载链接";

export const args = zod.tuple([
  zod.number().describe(
    argument({ name: "uid", description: "好友QQ号" }),
  ),
  zod.string().describe(
    argument({ name: "fid", description: "文件ID" }),
  ),
]);

type Props = { args: zod.infer<typeof args> };

export default function FileUrl({ args: [uid, fid] }: Props) {
  return (
    <IpcCommand
      action={Actions.GET_FILE_URL}
      params={{ user_id: uid, fid }}
      render={(data: any) => <Text>下载地址: {termLink(data.url ?? String(data), data.url ?? String(data))}</Text>}
    />
  );
}
