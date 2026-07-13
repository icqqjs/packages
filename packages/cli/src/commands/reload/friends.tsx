import React from "react";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "刷新好友列表缓存";

export default function ReloadFriends() {
  return (
    <IpcMutate
      action={Actions.RELOAD_FRIEND_LIST}
      loadingText="刷新好友列表…"
      successText="好友列表已刷新"
    />
  );
}
