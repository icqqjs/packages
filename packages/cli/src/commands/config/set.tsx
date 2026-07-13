import React, { useState, useEffect } from "react";
import { Text, useApp } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { Spinner } from "@/components/Spinner.js";
import { loadConfig, saveConfig, resolveConfigScopeUin } from "@/lib/config.js";
import {
  applyConfigSet,
  isConfigSetKey,
  parseConfigSetValue,
} from "@/lib/config-set.js";

export const description = "设置配置项";

export const args = zod.tuple([
  zod.string().describe(
    argument({
      name: "key",
      description:
        "配置项 (currentUin, alerts.providers.bark.deviceKey, mcp.enabled, …)；配合 -u 可设账号级 mcp/rpc",
    }),
  ),
  zod.string().describe(
    argument({
      name: "value",
      description: "配置值",
    }),
  ),
]);

type Props = {
  args: zod.infer<typeof args>;
};

export default function ConfigSet({ args: [key, value] }: Props) {
  const { exit } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [scopeUin, setScopeUin] = useState<number | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        if (!isConfigSetKey(key)) {
          throw new Error(
            `未知配置项: ${key}\n可用键示例: alerts.providers.bark.deviceKey, alerts.enabled, mcp.enabled\n完整列表见: icqq config get`,
          );
        }

        const parsed = parseConfigSetValue(key, value);
        const config = await loadConfig();
        const scopeUin = resolveConfigScopeUin();
        applyConfigSet(config, key, parsed, scopeUin);
        await saveConfig(config);
        setSuccess(true);
        setScopeUin(scopeUin ?? null);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
      setLoading(false);
    })();
  }, [key, value]);

  useEffect(() => {
    if (!loading) {
      if (error) process.exitCode = 1;
      const timer = setTimeout(() => exit(), error ? 2000 : 100);
      return () => clearTimeout(timer);
    }
  }, [loading, error, exit]);

  if (loading) return <Spinner label="保存配置…" />;
  if (error) return <Text color="red">✖ {error}</Text>;

  return (
    <Text color="green">
      ✔ 已设置 {key} = {value}
      {scopeUin !== null ? `（账号 ${scopeUin}）` : "（全局）"}
      {key.startsWith("mcp.") || key.startsWith("rpc.")
        ? "（执行 icqq service restart 后生效）"
        : ""}
    </Text>
  );
}
