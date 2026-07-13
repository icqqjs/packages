import React, { useState, useEffect, useRef } from "react";
import { Text, Box, useApp } from "ink";
import { Spinner } from "@/components/Spinner.js";
import { formatServiceError } from "@/lib/cli-errors.js";
import { resolveServiceUins } from "./_helpers.js";

export type ServiceBatchResult = {
  uin: number;
  ok: boolean;
  message: string;
};

type Props = {
  argUin?: number;
  spinnerLabel: string;
  successMessage: string;
  run: (uin: number) => Promise<void>;
  footer?: React.ReactNode;
};

export function ServiceBatchRunner({
  argUin,
  spinnerLabel,
  successMessage,
  run,
  footer,
}: Props) {
  const { exit } = useApp();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<ServiceBatchResult[]>([]);
  const [fatalError, setFatalError] = useState("");

  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    void (async () => {
      const platform = process.platform;
      if (platform !== "darwin" && platform !== "linux") {
        setFatalError(`不支持当前平台: ${platform}。仅支持 macOS 和 Linux。`);
        setLoading(false);
        return;
      }
      try {
        const uins = await resolveServiceUins(argUin);
        const out: ServiceBatchResult[] = [];
        for (const uin of uins) {
          try {
            await runRef.current(uin);
            out.push({ uin, ok: true, message: "已安装" });
          } catch (e) {
            out.push({
              uin,
              ok: false,
              message: e instanceof Error ? e.message : String(e),
            });
          }
        }
        setResults(out);
      } catch (e) {
        setFatalError(e instanceof Error ? e.message : String(e));
      }
      setLoading(false);
    })();
  }, [argUin]);

  useEffect(() => {
    if (!loading) {
      if (fatalError || results.some((r) => !r.ok)) process.exitCode = 1;
      setTimeout(exit, 0);
    }
  }, [loading, fatalError, results, exit]);

  if (loading) return <Spinner label={spinnerLabel} />;
  if (fatalError) return <Text color="red">{formatServiceError(fatalError)}</Text>;

  return (
    <Box flexDirection="column">
      {results.map((r) => (
        <Text key={r.uin} color={r.ok ? "green" : "red"}>
          {r.ok ? "✓" : "✗"} [{r.uin}] {r.ok ? successMessage : r.message}
        </Text>
      ))}
      {results.some((r) => r.ok) ? footer : null}
    </Box>
  );
}
