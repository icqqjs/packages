import React from "react";
import { Text, Box } from "ink";

export const YES_NO_OPTIONS = ["是", "否"] as const;

export type CompletedEntry = readonly [label: string, value: string];

export function StepFlowFrame({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <Box flexDirection="column" paddingX={1}>
      <Text bold color="cyan">
        {title}
      </Text>
      {hint ? <Text dimColor>{hint}</Text> : null}
      {children}
    </Box>
  );
}

export function StepFlowCompleted({ entries }: { entries: CompletedEntry[] }) {
  if (entries.length === 0) return null;
  return (
    <Box marginTop={1} flexDirection="column">
      {entries.map(([label, value]) => (
        <Text key={label}>
          <Text color="green">✔ </Text>
          <Text>{label}: </Text>
          <Text color="white">{value}</Text>
        </Text>
      ))}
    </Box>
  );
}

export function StepFlowSection({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <Box marginTop={1} flexDirection="column">
      <Text bold color="yellow">
        {title}
      </Text>
      {hint ? <Text dimColor>{hint}</Text> : null}
    </Box>
  );
}

export function StepFlowPrompt({
  label,
  hint,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <Box marginTop={1} flexDirection="column">
      <Text>
        {label}
        {hint ? <> <Text dimColor>{hint}</Text></> : null}
      </Text>
    </Box>
  );
}

export function StepFlowTextInput({ value }: { value: string }) {
  return (
    <Box>
      <Text color="green">❯ </Text>
      <Text>
        {value}
        <Text color="cyan">█</Text>
      </Text>
    </Box>
  );
}

export function StepFlowMaskedInput({
  value,
  char = "●",
}: {
  value: string;
  char?: string;
}) {
  return (
    <Box>
      <Text color="cyan">❯ </Text>
      <Text>
        {char.repeat(value.length)}
        <Text color="cyan">█</Text>
      </Text>
    </Box>
  );
}

export function StepFlowSelect({
  label,
  hint,
  options,
  selectedIndex,
  renderOption,
}: {
  label: React.ReactNode;
  hint?: React.ReactNode;
  options: readonly string[];
  selectedIndex: number;
  renderOption?: (option: string, index: number) => React.ReactNode;
}) {
  return (
    <Box marginTop={1} flexDirection="column">
      <Text>
        {label}
        {hint ? <> <Text dimColor>{hint}</Text></> : null}
      </Text>
      {options.map((option, i) => (
        <Text key={`${i}-${option}`}>
          <Text color={i === selectedIndex ? "cyan" : undefined}>
            {i === selectedIndex ? "❯ " : "  "}
            {renderOption ? renderOption(option, i) : option}
          </Text>
        </Text>
      ))}
    </Box>
  );
}
