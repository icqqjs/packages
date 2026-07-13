import React, { useState } from "react";
import { Text } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { Table } from "@/components/Table.js";
import { GroupSelector } from "@/components/Selectors.js";

export const description = "查看群禁言列表";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "gid", description: "群号（不填则交互选择）" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function GroupMutedList({ args: [gid] }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;

  return (
    <IpcCommand
      action={Actions.GROUP_MUTED_LIST}
      params={{ group_id: selectedGid }}
      loadingText="获取禁言列表…"
      render={(data: any[]) => {
        if (!data || data.length === 0) return <Text dimColor>当前无被禁言成员</Text>;
        return (
          <Table
            columns={[
              { key: "uin", header: "QQ号", width: 12 },
              { key: "unMuteTime", header: "解禁时间", width: 22 },
            ]}
            data={data.map((m: any) => ({
              uin: m.uin,
              unMuteTime: new Date((m.unMuteTime ?? 0) * 1000).toLocaleString(),
            }))}
          />
        );
      }}
    />
  );
}
