import React, { useState, useEffect, type ReactNode } from "react";
import { Text, Box, useInput } from "ink";
import { Spinner } from "./Spinner.js";
import { useIpcConnection } from "@/lib/use-ipc-connection.js";
import type { IpcClient } from "@/lib/ipc-client.js";

/** 每页显示最多 15 个列表项（适配标准 24 行终端窗口，扣除标题、搜索框、状态栏） */
const PAGE = 15;

export type ListSelectorConfig<T, ID extends string | number = number> = {
  action: string;
  params?: Record<string, unknown>;
  title: string;
  loadingLabel: string;
  emptyLabel: string;
  getId: (item: T) => ID;
  getFilterTexts: (item: T) => string[];
  renderItem: (item: T, selected: boolean) => ReactNode;
  onSelect: (id: ID) => void;
};

function SelectorList<T, ID extends string | number>({
  ipc,
  ownConnection,
  config,
}: {
  ipc: IpcClient;
  /** 为 true 时选择后关闭连接（独立 ListSelector）；为 false 时复用父级连接 */
  ownConnection: boolean;
  config: ListSelectorConfig<T, ID>;
}) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [index, setIndex] = useState(0);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const resp = await ipc.request(config.action, config.params ?? {});
        if (resp.ok && Array.isArray(resp.data)) {
          setItems(resp.data as T[]);
        }
      } catch { /* ignore */ }
      setLoading(false);
    })();
  }, [ipc, config.action, config.params]);

  const lowerFilter = filter.toLowerCase();
  const filtered = filter
    ? items.filter((item) =>
        config.getFilterTexts(item).some((t) => t.toLowerCase().includes(lowerFilter)),
      )
    : items;

  const scrollTop = Math.max(0, Math.min(index - PAGE + 1, filtered.length - PAGE));
  const visible = filtered.slice(scrollTop, scrollTop + PAGE);

  useInput((char, key) => {
    if (key.return) {
      const item = filtered[index];
      if (item) {
        if (ownConnection) ipc.close();
        config.onSelect(config.getId(item));
      }
      return;
    }
    if (key.upArrow) {
      setIndex((i) => Math.max(0, i - 1));
      return;
    }
    if (key.downArrow) {
      setIndex((i) => Math.min(filtered.length - 1, i + 1));
      return;
    }
    if (key.backspace || key.delete) {
      setFilter((q) => q.slice(0, -1));
      setIndex(0);
      return;
    }
    if (char && !key.ctrl && !key.meta) {
      setFilter((q) => q + char);
      setIndex(0);
    }
  });

  if (loading) return <Spinner label={config.loadingLabel} />;

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">{config.title} <Text dimColor>(↑↓ 选择 | 输入过滤 | Enter 确认)</Text></Text>
      <Text>搜索: {filter}<Text color="cyan">█</Text></Text>
      <Box flexDirection="column" marginTop={1}>
        {visible.map((item) => {
          const i = filtered.indexOf(item);
          return (
            <Box key={String(config.getId(item))}>
              {config.renderItem(item, i === index)}
            </Box>
          );
        })}
        {filtered.length === 0 && <Text dimColor>{config.emptyLabel}</Text>}
        {filtered.length > PAGE && (
          <Text dimColor>{index + 1}/{filtered.length}</Text>
        )}
      </Box>
    </Box>
  );
}

type ListSelectorProps<T, ID extends string | number = number> =
  ListSelectorConfig<T, ID> & {
    /** 传入则复用已有连接，选择后不会 close */
    ipc?: IpcClient;
  };

function ListSelectorWithConnection<T, ID extends string | number = number>(
  props: ListSelectorConfig<T, ID>,
) {
  const { ipc, error } = useIpcConnection();

  if (error) return <Text color="red">✖ {error}</Text>;
  if (!ipc) return <Spinner label="连接守护进程…" />;

  return <SelectorList ipc={ipc} ownConnection config={props} />;
}

export function ListSelector<T, ID extends string | number = number>(
  props: ListSelectorProps<T, ID>,
) {
  const { ipc, ...config } = props;

  if (ipc) {
    return <SelectorList ipc={ipc} ownConnection={false} config={config} />;
  }

  return <ListSelectorWithConnection {...config} />;
}
