import React from "react";
import { Text, Box } from "ink";
import { IpcCommand } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";
import { Table } from "@/components/Table.js";

export const description = "查看待处理的好友/群请求";

export default function Requests() {
  return (
    <IpcCommand
      action={Actions.GET_SYSTEM_MSG}
      loadingText="获取系统消息…"
      render={(data: any) => (
        <Box flexDirection="column" gap={1}>
          <Text bold>好友请求</Text>
          {data.friendRequests?.length > 0 ? (
            <Table
              columns={[
                { key: "QQ号", header: "QQ号" },
                { key: "昵称", header: "昵称" },
                { key: "附言", header: "附言" },
                { key: "来源", header: "来源" },
                { key: "flag", header: "flag" },
              ]}
              data={data.friendRequests.map((req: any) => ({
                QQ号: req.user_id,
                昵称: req.nickname ?? "",
                附言: req.comment ?? "",
                来源: req.source ?? "",
                flag: req.flag,
              }))}
            />
          ) : (
            <Text dimColor>无待处理的好友请求</Text>
          )}
          <Text bold>群请求</Text>
          {data.groupRequests?.length > 0 ? (
            <Table
              columns={[
                { key: "群号", header: "群号" },
                { key: "群名", header: "群名" },
                { key: "QQ号", header: "QQ号" },
                { key: "昵称", header: "昵称" },
                { key: "类型", header: "类型" },
                { key: "附言", header: "附言" },
                { key: "flag", header: "flag" },
              ]}
              data={data.groupRequests.map((req: any) => ({
                群号: req.group_id,
                群名: req.group_name ?? "",
                QQ号: req.user_id,
                昵称: req.nickname ?? "",
                类型: req.sub_type === "add" ? "申请加群" : "邀请入群",
                附言: req.comment ?? "",
                flag: req.flag,
              }))}
            />
          ) : (
            <Text dimColor>无待处理的群请求</Text>
          )}
        </Box>
      )}
    />
  );
}
