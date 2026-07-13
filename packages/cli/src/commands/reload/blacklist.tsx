import React from "react";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "重载黑名单";

export default function ReloadBlacklist() {
  return (
    <IpcMutate
      action={Actions.RELOAD_BLACKLIST}
      params={{}}
      loadingText="重载黑名单…"
      successText="黑名单已重载"
    />
  );
}
