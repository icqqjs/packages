import React, { useState, useEffect } from "react";
import { Text, Box, useApp } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { Spinner } from "@/components/Spinner.js";
import { loadConfig } from "@/lib/config.js";
import {
  availableConfigGetKeysHint,
  getConfigDisplayValue,
  isConfigGetGroup,
  isConfigGetKey,
  isConfigGetQuery,
  listAllConfigEntries,
  listGroupConfigEntries,
} from "@/lib/config-get.js";

export const description = "查看配置项";

export const args = zod.tuple([
  zod.string().optional().describe(
    argument({
      name: "key",
      description:
        "配置项（不指定则显示全部；可用 mcp、rpc 或 mcp.enabled、mcp.http.port 等）",
    }),
  ),
]);

type Props = {
  args: zod.infer<typeof args>;
};

export default function ConfigGet({ args: [key] }: Props) {
  const { exit } = useApp();
  const [loading, setLoading] = useState(true);
  const [output, setOutput] = useState<[string, string][]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const config = await loadConfig();

        if (!key) {
          setOutput(listAllConfigEntries(config));
        } else if (!isConfigGetQuery(key)) {
          throw new Error(
            `未知配置项: ${key}\n可用: ${availableConfigGetKeysHint()}`,
          );
        } else if (isConfigGetGroup(key)) {
          setOutput(listGroupConfigEntries(config, key));
        } else if (isConfigGetKey(key)) {
          setOutput([[key, getConfigDisplayValue(config, key)]]);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
      setLoading(false);
    })();
  }, [key]);

  useEffect(() => {
    if (!loading) {
      if (error) process.exitCode = 1;
      const timer = setTimeout(() => exit(), error ? 2000 : 100);
      return () => clearTimeout(timer);
    }
  }, [loading, error, exit]);

  if (loading) return <Spinner label="读取配置…" />;
  if (error) return <Text color="red">✖ {error}</Text>;

  return (
    <Box flexDirection="column" paddingX={1}>
      {output.map(([k, v]) => (
        <Text key={k}>
          <Text color="cyan">{k}</Text>
          <Text>: </Text>
          <Text>{v}</Text>
        </Text>
      ))}
    </Box>
  );
}
