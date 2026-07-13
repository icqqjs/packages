import React from "react";
import { Text } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "获取私聊文件信息";

export const args = zod.tuple([
  zod.number().describe(
    argument({ name: "uid", description: "好友QQ号" }),
  ),
  zod.string().describe(
    argument({ name: "fid", description: "文件ID" }),
  ),
]);

type Props = { args: zod.infer<typeof args> };

export default function FileInfo({ args: [uid, fid] }: Props) {
  return (
    <IpcCommand
      action={Actions.GET_FILE_INFO}
      params={{ user_id: uid, fid }}
      render={(data: any) => (
        <>
          <Text>文件名: {data.name}</Text>
          <Text>大小: {data.size}</Text>
          <Text>MD5: {data.md5}</Text>
          <Text>下载地址: {data.url}</Text>
        </>
      )}
    />
  );
}
