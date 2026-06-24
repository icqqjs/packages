import React, { useCallback, useRef, useState } from "react";
import { Text, Box } from "ink";

export type LogTone = "dim" | "ok" | "warn" | "err";

export type LogEntry = {
  text: string;
  tone: LogTone;
};

function logToneColor(tone: LogTone): "green" | "yellow" | "red" | undefined {
  switch (tone) {
    case "ok":
      return "green";
    case "warn":
      return "yellow";
    case "err":
      return "red";
    default:
      return undefined;
  }
}

export function FlowLog({ entries }: { entries: LogEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <Box flexDirection="column" marginBottom={1}>
      {entries.map((entry, i) => (
        <Text
          key={`${i}-${entry.text}`}
          color={logToneColor(entry.tone)}
          dimColor={entry.tone === "dim"}
        >
          {entry.text}
        </Text>
      ))}
    </Box>
  );
}

export function useFlowLog() {
  const logsRef = useRef<LogEntry[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const pushLog = useCallback((text: string, tone: LogTone = "dim") => {
    const entry = { text, tone };
    logsRef.current = [...logsRef.current, entry];
    setLogs(logsRef.current);
  }, []);

  const resetLogs = useCallback(() => {
    logsRef.current = [];
    setLogs([]);
  }, []);

  return { logs, pushLog, resetLogs };
}
