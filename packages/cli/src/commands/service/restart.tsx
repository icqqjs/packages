/**
 * icqq service restart — 重启系统服务。
 */
import React from "react";
import zod from "zod";
import { argument } from "pastel";
import { restartService } from "./_helpers.js";
import { ServiceBatchRunner } from "./ServiceBatchRunner.js";

export const description = "重启系统服务（默认全部已配置账号；可指定 QQ 号）";

export const args = zod.tuple([
  zod.coerce.number().optional().describe(
    argument({
      name: "uin",
      description: "仅重启该 QQ 号的服务（不指定则重启全部已配置账号）",
    }),
  ),
]);

type Props = { args: zod.infer<typeof args> };

export default function ServiceRestart({ args: [argUin] }: Props) {
  return (
    <ServiceBatchRunner
      argUin={argUin}
      spinnerLabel="重启系统服务…"
      successMessage="系统服务已重启"
      run={(uin) => restartService(uin, () => {})}
    />
  );
}
