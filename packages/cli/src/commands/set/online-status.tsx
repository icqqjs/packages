import React from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "设置在线状态 (11=在线 31=离开 41=隐身 50=忙碌 60=Q我吧 70=请勿打扰)";

export const args = zod.tuple([
  zod.number().describe(argument({ name: "status", description: "状态码" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function SetOnlineStatus({ args: [status] }: Props) {
  const labels: Record<number, string> = {
    11: "在线", 31: "离开", 41: "隐身", 50: "忙碌", 60: "Q我吧", 70: "请勿打扰",
  };
  return (
    <IpcMutate
      action={Actions.SET_ONLINE_STATUS}
      params={{ status }}
      loadingText="设置状态…"
      successText={`在线状态已设置为「${labels[status] ?? status}」`}
    />
  );
}
