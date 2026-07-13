import React from "react";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "重载陌生人列表";

export default function ReloadStrangers() {
  return (
    <IpcMutate
      action={Actions.RELOAD_STRANGER_LIST}
      params={{}}
      loadingText="重载陌生人列表…"
      successText="陌生人列表已重载"
    />
  );
}
