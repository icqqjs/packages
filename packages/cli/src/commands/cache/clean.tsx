import React from "react";
import { IpcMutate } from "@/components/IpcCommand.js";
import { Actions } from "@/daemon/protocol.js";

export const description = "清理缓存";

export default function CacheClean() {
  return (
    <IpcMutate
      action={Actions.CLEAN_CACHE}
      loadingText="清理缓存…"
      successText="缓存已清理"
    />
  );
}
