import React from "react";
import { Text } from "ink";
import zod from "zod";
import { option } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "获取 Cookies";

export const options = zod.object({
  domain: zod.string().optional().describe(option({ description: "域名（可选）" })),
});

type Props = { options: zod.infer<typeof options> };

export default function GetCookies({ options: { domain } }: Props) {
  return (
    <IpcCommand
      action={Actions.GET_COOKIES}
      params={{ domain }}
      render={(data: { cookies?: string }) => <Text>{data.cookies ?? ""}</Text>}
    />
  );
}
