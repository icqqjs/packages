import React from "react";
import zod from "zod";
import { argument, option } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "发送群链接分享卡片";

export const args = zod.tuple([
  zod.number().describe(argument({ name: "gid", description: "群号" })),
  zod.string().describe(argument({ name: "url", description: "链接 URL" })),
  zod.string().describe(argument({ name: "title", description: "标题" })),
]);

export const options = zod.object({
  image: zod.string().optional().describe(option({ description: "预览图 URL" })),
  content: zod.string().optional().describe(option({ description: "摘要" })),
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function GroupShareCard({ args: [gid, url, title], options: { image, content } }: Props) {
  return (
    <IpcMutate
      action={Actions.SEND_CONTACT_SHARE}
      params={{ group_id: gid, url, title, image, content }}
      loadingText="发送分享…"
      successText={`分享已发送到群 ${gid}`}
    />
  );
}
