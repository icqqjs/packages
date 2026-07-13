import React from "react";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "重载频道列表";

export default function ReloadGuilds() {
  return (
    <IpcMutate
      action={Actions.RELOAD_GUILDS}
      params={{}}
      loadingText="重载频道列表…"
      successText="频道列表已重载"
    />
  );
}
