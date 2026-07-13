/**
 * icqq service start — 启动已安装的系统服务。
 */
import React from "react";
import zod from "zod";
import { argument } from "pastel";
import { startService } from "./_helpers.js";
import { ServiceBatchRunner } from "./ServiceBatchRunner.js";

export const description = "启动系统服务（默认全部已配置账号；可指定 QQ 号）";

export const args = zod.tuple([
  zod.coerce.number().optional().describe(
    argument({
      name: "uin",
      description: "仅启动该 QQ 号的服务（不指定则启动全部已配置账号）",
    }),
  ),
]);

type Props = { args: zod.infer<typeof args> };

export default function ServiceStart({ args: [argUin] }: Props) {
  return (
    <ServiceBatchRunner
      argUin={argUin}
      spinnerLabel="启动系统服务…"
      successMessage="系统服务已启动"
      run={(uin) => startService(uin, () => {})}
    />
  );
}
