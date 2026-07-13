import React from "react";
import zod from "zod";
import { argument, option } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "屏蔽/取消屏蔽群成员消息";

export const args = zod.tuple([
  zod.number().describe(
    argument({ name: "gid", description: "群号" }),
  ),
  zod.number().describe(
    argument({ name: "uid", description: "成员QQ号" }),
  ),
]);

export const options = zod.object({
  unscreen: zod.boolean().optional().describe(option({ description: "取消屏蔽", alias: "u" })),
});

type Props = { args: zod.infer<typeof args>; options: zod.infer<typeof options> };

export default function ScreenMember({ args: [gid, uid], options: { unscreen } }: Props) {
  const isScreen = !unscreen;
  return (
    <IpcMutate
      action={Actions.SET_SCREEN_MEMBER_MSG}
      params={{ group_id: gid, user_id: uid, is_screen: isScreen }}
      loadingText={isScreen ? "屏蔽中…" : "取消屏蔽中…"}
      successText={isScreen ? `已屏蔽群 ${gid} 成员 ${uid} 的消息` : `已取消屏蔽群 ${gid} 成员 ${uid} 的消息`}
    />
  );
}
