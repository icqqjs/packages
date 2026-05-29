import React, { useState, useEffect } from "react";
import { Text, Box, useInput } from "ink";
import type { IpcClient } from "@/lib/ipc-client.js";
import type { IpcEvent } from "@/daemon/protocol.js";
import { Actions } from "@/daemon/protocol.js";
import { useEmojiMode } from "./chat/useEmojiMode.js";
import { renderDisplayMessage } from "@/lib/parse-message.js";
import {
  guildMessageFromEventData,
  isGuildChannelMessageEvent,
} from "@/lib/ipc-event-filter.js";

type Message = {
  nickname: string;
  content: string;
  time: number;
};

type Mode = "chat" | "emoji";

type Props = {
  ipc: IpcClient;
  guildId: string;
  channelId: string;
  channelName?: string;
};

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString("zh-CN", { hour12: false });
}

export function ChannelChatSession({ ipc, guildId, channelId, channelName }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<Mode>("chat");
  const [showHelp, setShowHelp] = useState(true);

  useEffect(() => {
    return ipc.onEvent((event: IpcEvent) => {
      if (!isGuildChannelMessageEvent(event, channelId)) return;
      const msg = guildMessageFromEventData(event.data as Record<string, unknown>);
      setMessages((prev) => [...prev.slice(-100), msg]);
      setShowHelp(false);
    });
  }, [ipc, channelId]);

  const emoji = useEmojiMode();

  const sendMessage = async (text: string) => {
    setSending(true);
    try {
      await ipc.request(Actions.GUILD_SEND_MSG, {
        guild_id: guildId,
        channel_id: channelId,
        message: text,
      });
      setMessages((prev) => [
        ...prev.slice(-100),
        { nickname: "我", content: text, time: Math.floor(Date.now() / 1000) },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { nickname: "系统", content: `发送失败: ${e instanceof Error ? e.message : String(e)}`, time: Math.floor(Date.now() / 1000) },
      ]);
    }
    setSending(false);
  };

  useInput((char, key) => {
    if (mode === "emoji") {
      const result = emoji.handleKey(char, key);
      if (result === "exit") { setMode("chat"); return; }
      if (typeof result === "string") {
        setInput((prev) => prev + result);
        setMode("chat");
      }
      return;
    }

    // Chat mode
    if (key.ctrl && char === "h") { setShowHelp((v) => !v); return; }
    if (key.ctrl && char === "c") { process.exit(0); }
    if (key.tab) { setMode("emoji"); return; }

    if (key.return) {
      const text = input.trim();
      if (text) {
        void sendMessage(text);
        setInput("");
      }
      return;
    }

    if (key.backspace || key.delete) {
      setInput((prev) => prev.slice(0, -1));
      return;
    }

    if (char && !key.ctrl && !key.meta) {
      setInput((prev) => prev + char);
    }
  });

  const label = channelName ? `#${channelName}` : channelId;

  return (
    <Box flexDirection="column">
      {showHelp && mode === "chat" && (
        <Box borderStyle="round" borderColor="gray" paddingX={1} flexDirection="column">
          <Text bold color="cyan">子频道聊天 - {label}</Text>
          <Text dimColor>Enter 发送 | Tab 表情 | Ctrl+C 退出 | Ctrl+H 切换帮助</Text>
          <Text dimColor>暂仅支持发送文本、AT、表情</Text>
        </Box>
      )}

      <Box flexDirection="column" marginTop={showHelp ? 0 : 1}>
        {messages.slice(-20).map((msg, i) => (
          <Text key={i}>
            <Text dimColor>[{formatTime(msg.time)}]</Text>
            {" "}
            <Text bold color={msg.nickname === "我" ? "green" : msg.nickname === "系统" ? "red" : "blue"}>
              {msg.nickname}
            </Text>
            : {renderDisplayMessage(msg.content)}
          </Text>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text>
          <Text color="cyan" bold>{sending ? "发送中…" : `${label}>`}</Text>
          {" "}
          {input}
          <Text color="cyan">█</Text>
        </Text>
      </Box>

      {mode === "emoji" && (
        <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="magenta" paddingX={1}>
          <Text bold color="magenta">表情 <Text dimColor>(←→ 翻页 | ↑↓ 选择 | Enter: 插入 | Esc: 取消)</Text></Text>
          <Text>搜索: {emoji.query}<Text color="cyan">█</Text></Text>
          <Box flexDirection="column" marginTop={1}>
            {emoji.pageItems.map(([faceId, name], i) => (
              <Text key={faceId}>
                {i === emoji.index ? <Text color="yellow">❯ </Text> : <Text>  </Text>}
                <Text>{name}</Text>
                <Text dimColor> [face:{faceId}]</Text>
              </Text>
            ))}
            {emoji.filtered.length === 0 && <Text dimColor>无匹配表情</Text>}
            {emoji.totalPages > 1 && (
              <Text dimColor>第 {emoji.page + 1}/{emoji.totalPages} 页</Text>
            )}
          </Box>
        </Box>
      )}
    </Box>
  );
}
