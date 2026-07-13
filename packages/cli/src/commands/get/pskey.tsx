import React from "react";
import zod from "zod";
import { argument } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { Table } from "@/components/Table.js";

export const description = "获取 PSKey";

export const args = zod.tuple([
  zod.string().describe(
    argument({ name: "domain", description: "域名（如 qzone.qq.com）" }),
  ),
]);

type Props = { args: zod.infer<typeof args> };

export default function GetPSKey({ args: [domain] }: Props) {
  return (
    <IpcCommand
      action={Actions.GET_PSKEY}
      params={{ domain }}
      render={(data: any) => (
        <Table
          data={Array.isArray(data) ? data : [data]}
          columns={[
            { key: "domain", header: "域名" },
            { key: "p_skey", header: "PSKey" },
            { key: "g_tk", header: "GTK" },
            { key: "expire_time", header: "过期时间" },
          ]}
        />
      )}
    />
  );
}
