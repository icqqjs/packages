/**
 * icqq service stop — 停止系统服务（保留 plist/unit）。
 */
import React from "react";
import zod from "zod";
import { argument } from "pastel";
import { stopService } from "./_helpers.js";
import { ServiceBatchRunner } from "./ServiceBatchRunner.js";

export const description = "停止系统服务（默认全部已配置账号；可指定 QQ 号）";

export const args = zod.tuple([
  zod.coerce.number().optional().describe(
    argument({
      name: "uin",
      description: "仅停止该 QQ 号的服务（不指定则停止全部已配置账号）",
    }),
  ),
]);

type Props = { args: zod.infer<typeof args> };

export default function ServiceStop({ args: [argUin] }: Props) {
  return (
    <ServiceBatchRunner
      argUin={argUin}
      spinnerLabel="停止系统服务…"
      successMessage="系统服务已停止（可 `icqq service start` 重新启动）"
      run={(uin) => stopService(uin, () => {})}
    />
  );
}
