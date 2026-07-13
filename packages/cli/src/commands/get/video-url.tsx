import React from "react";
import { Text } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { termLink } from "@/lib/parse-message.js";

export const description = "获取视频下载地址";

export const args = zod.tuple([
  zod.string().describe(
    argument({ name: "fid", description: "视频文件ID" }),
  ),
  zod.string().describe(
    argument({ name: "md5", description: "视频文件MD5" }),
  ),
]);

type Props = { args: zod.infer<typeof args> };

export default function GetVideoUrl({ args: [fid, md5] }: Props) {
  return (
    <IpcCommand
      action={Actions.GET_VIDEO_URL}
      params={{ fid, md5 }}
      render={(data: any) => (
        data.url ? <Text>{termLink(data.url, data.url)}</Text> : <Text color="yellow">无法获取视频地址</Text>
      )}
    />
  );
}
