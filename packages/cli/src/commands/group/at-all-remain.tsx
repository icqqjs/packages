import React, { useState } from "react";
import { Text, Box } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { GroupSelector } from "@/components/Selectors.js";

export const description = "查看@全体成员剩余次数";

export const args = zod.tuple([
  zod.number().optional().describe(argument({ name: "gid", description: "群号（不填则交互选择）" })),
]);

type Props = { args: zod.infer<typeof args> };

export default function GroupAtAllRemain({ args: [gid] }: Props) {
  const [selectedGid, setSelectedGid] = useState(gid);
  if (selectedGid === undefined) return <GroupSelector onSelect={setSelectedGid} />;

  return (
    <IpcCommand
      action={Actions.GROUP_AT_ALL_REMAIN}
      params={{ group_id: selectedGid }}
      loadingText="查询中…"
      render={(data: any) => (
        <Box paddingX={1}>
          <Text>@全体成员 剩余次数: <Text bold color="cyan">{data}</Text></Text>
        </Box>
      )}
    />
  );
}
