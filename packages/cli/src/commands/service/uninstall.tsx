/**
 * icqq service uninstall — 卸载系统服务。
 */
import React from "react";
import zod from "zod";
import { argument } from "pastel";
import { uninstallService } from "./_helpers.js";
import { ServiceBatchRunner } from "./ServiceBatchRunner.js";

export const description = "卸载系统服务（默认全部已配置账号；可指定 QQ 号）";

export const args = zod.tuple([
  zod.coerce.number().optional().describe(
    argument({
      name: "uin",
      description: "仅卸载该 QQ 号的服务（不指定则卸载全部已配置账号）",
    }),
  ),
]);

type Props = { args: zod.infer<typeof args> };

export default function ServiceUninstall({ args: [argUin] }: Props) {
  return (
    <ServiceBatchRunner
      argUin={argUin}
      spinnerLabel="卸载系统服务…"
      successMessage="系统服务已卸载"
      run={(uin) => uninstallService(uin, () => {})}
    />
  );
}
