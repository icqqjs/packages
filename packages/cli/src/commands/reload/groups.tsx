import React from "react";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "刷新群列表缓存";

export default function ReloadGroups() {
  return (
    <IpcMutate
      action={Actions.RELOAD_GROUP_LIST}
      loadingText="刷新群列表…"
      successText="群列表已刷新"
    />
  );
}
