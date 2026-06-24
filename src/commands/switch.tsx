import React, { useState, useEffect } from "react";
import { Text, Box, useApp, useInput } from "ink";
import zod from "zod";
import { argument } from "pastel";
import { Spinner } from "@/components/Spinner.js";
import {
  loadConfig,
  saveConfig,
  type IcqqConfig,
} from "@/lib/config.js";
import { isDaemonRunning } from "@/daemon/lifecycle.js";

export const description = "切换当前操作的账号";

export const args = zod.tuple([
  zod.coerce
    .number()
    .optional()
    .describe(
      argument({
        name: "qq",
        description: "目标QQ号（不指定则交互选择）",
      }),
    ),
]);

type Props = {
  args: zod.infer<typeof args>;
};

type AccountEntry = {
  uin: number;
  running: boolean;
  isCurrent: boolean;
};

function AccountPicker({
  accounts,
  onSelect,
}: {
  accounts: AccountEntry[];
  onSelect: (uin: number) => void;
}) {
  const [cursor, setCursor] = useState(0);

  useInput((_input, key) => {
    if (key.upArrow) {
      setCursor((c) => (c > 0 ? c - 1 : accounts.length - 1));
    } else if (key.downArrow) {
      setCursor((c) => (c < accounts.length - 1 ? c + 1 : 0));
    } else if (key.return) {
      onSelect(accounts[cursor]!.uin);
    }
  });

  return (
    <Box flexDirection="column">
      <Text bold>选择要切换的账号 (↑↓ 选择, Enter 确认):</Text>
      {accounts.map((a, i) => (
        <Text key={a.uin}>
          <Text color={i === cursor ? "cyan" : undefined}>
            {i === cursor ? "❯ " : "  "}
            {a.uin}
          </Text>
          {a.running ? (
            <Text color="green"> ●</Text>
          ) : (
            <Text dimColor> ○</Text>
          )}
          {a.isCurrent ? <Text color="yellow"> [当前]</Text> : null}
        </Text>
      ))}
    </Box>
  );
}

export default function Switch({ args: [qq] }: Props) {
  const { exit } = useApp();
  const [loading, setLoading] = useState(true);
  const [accounts, setAccounts] = useState<AccountEntry[]>([]);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (qq) {
      // Direct switch
      void (async () => {
        try {
          const config = await loadConfig();
          if (!config.accounts[String(qq)]) {
            throw new Error(`账号 ${qq} 未配置，请先执行 icqq login -q ${qq}`);
          }
          config.currentUin = qq;
          await saveConfig(config);
          const running = await isDaemonRunning(qq);
          setDone(
            running
              ? `已切换到账号 ${qq}`
              : `已切换到账号 ${qq}（守护进程未运行，可执行 icqq login -q ${qq} -r 或 icqq service start ${qq}）`,
          );
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
        }
        setLoading(false);
      })();
    } else {
      // Load account list for interactive selection
      void (async () => {
        try {
          const config = await loadConfig();
          const uins = Object.keys(config.accounts)
            .map(Number)
            .filter((n) => !Number.isNaN(n));
          if (uins.length === 0) {
            throw new Error("无已配置的账号，请先执行 icqq login");
          }
          if (uins.length === 1) {
            config.currentUin = uins[0]!;
            await saveConfig(config);
            setDone(`已切换到账号 ${uins[0]}`);
            setLoading(false);
            return;
          }
          const entries = await Promise.all(
            uins.map(async (uin) => ({
              uin,
              running: await isDaemonRunning(uin),
              isCurrent: uin === config.currentUin,
            })),
          );
          setAccounts(entries);
          setLoading(false);
        } catch (e) {
          setError(e instanceof Error ? e.message : String(e));
          setLoading(false);
        }
      })();
    }
  }, [qq]);

  useEffect(() => {
    if (done || error) {
      if (error) process.exitCode = 1;
      const timer = setTimeout(() => exit(), error ? 2000 : 100);
      return () => clearTimeout(timer);
    }
  }, [done, error, exit]);

  const handleSelect = async (uin: number) => {
    try {
      const config = await loadConfig();
      config.currentUin = uin;
      await saveConfig(config);
      const running = await isDaemonRunning(uin);
      setDone(
        running
          ? `已切换到账号 ${uin}`
          : `已切换到账号 ${uin}（守护进程未运行，可执行 icqq login -q ${uin} -r 或 icqq service start ${uin}）`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (loading) return <Spinner label="加载账号列表…" />;
  if (error) return <Text color="red">✖ {error}</Text>;
  if (done) return <Text color="green">✔ {done}</Text>;

  return (
    <AccountPicker
      accounts={accounts}
      onSelect={(uin) => void handleSelect(uin)}
    />
  );
}
