/**
 * icqq service install — 将守护进程注册为系统服务（每账号一个 plist/unit）。
 * 不指定 QQ 号时默认安装所有已配置账号。
 */
import React from "react";
import zod from "zod";
import { argument } from "pastel";
import { Text } from "ink";
import { installService } from "./_helpers.js";
import { ServiceBatchRunner } from "./ServiceBatchRunner.js";

export const description = "安装系统服务（默认全部已配置账号；可指定 QQ 号）";

export const args = zod.tuple([
  zod.coerce.number().optional().describe(
    argument({
      name: "uin",
      description: "仅安装该 QQ 号的服务（不指定则安装全部已配置账号）",
    }),
  ),
]);

type Props = { args: zod.infer<typeof args> };

export default function ServiceInstall({ args: [argUin] }: Props) {
  return (
    <ServiceBatchRunner
      argUin={argUin}
      spinnerLabel="安装系统服务…"
      successMessage="系统服务已安装并启动"
      run={(uin) => installService(uin, () => {})}
      footer={
        <Text dimColor>
          注意：`icqq logout` 不会阻止服务自动重启，永久停止请 `icqq service uninstall`
        </Text>
      }
    />
  );
}
