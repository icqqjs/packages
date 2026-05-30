import React, { useState, useEffect } from "react";
import { Text, Box, useInput } from "ink";
import type { IpcClient } from "@/lib/ipc-client.js";
import { Actions } from "@/daemon/protocol.js";
import { useAtMode } from "./chat/useAtMode.js";
import { useEmojiMode } from "./chat/useEmojiMode.js";
import { useFileMode, tagColor, tagLabel } from "./chat/useFileMode.js";
import { renderDisplayMessage } from "@/lib/parse-message.js";
import {
  chatMessageFromEventData,
} from "@/lib/ipc-event-filter.js";

type Message = {
  nickname: string;
  content: string;
  time: number;
};

type MemberInfo = {
  user_id: number;
  nickname: string;
  card: string;
};

type Mode = "chat" | "at" | "emoji" | "file";

type Props = {
  ipc: IpcClient;
  type: "private" | "group";
  id: number;
};

const PAGE_SIZE = 10;

function formatTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString("zh-CN", { hour12: false });
}

export function ChatSession({ ipc, type, id }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [mode, setMode] = useState<Mode>("chat");
  const [showHelp, setShowHelp] = useState(true);

  // ── Group members (for @ autocomplete) ──
  const [members, setMembers] = useState<MemberInfo[]>([]);
  useEffect(() => {
    if (type !== "group") return;
    void (async () => {
      try {
        const resp = await ipc.request(Actions.LIST_GROUP_MEMBERS, { gid: id });
        if (resp.ok && Array.isArray(resp.data)) {
          setMembers(
            (resp.data as MemberInfo[]).map((m) => ({
              user_id: m.user_id,
              nickname: m.nickname,
              card: m.card || "",
            })),
          );
        }
      } catch { /* ignore */ }
    })();
  }, [ipc, type, id]);

  // ── Live messages（连接后服务端自动推送） ──
  useEffect(() => {
    return ipc.subscribeChatSession(type, id, (event) => {
      const msg = chatMessageFromEventData(event.data as Record<string, unknown>);
      setMessages((prev) => [...prev.slice(-100), msg]);
      setShowHelp(false);
    });
  }, [ipc, type, id]);

  // ── Mode hooks ──
  const at = useAtMode(members);
  const emoji = useEmojiMode();
  const file = useFileMode(mode === "file");

  // ── Send helpers ──
  const sendMessage = async (text: string) => {
    setSending(true);
    try {
      const action = type === "private" ? Actions.SEND_PRIVATE_MSG : Actions.SEND_GROUP_MSG;
      const params = type === "private" ? { uid: id, message: text } : { gid: id, message: text };
      await ipc.request(action, params);
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

  const sendFile = async (filePath: string, fileName: string) => {
    setSending(true);
    try {
      const action = type === "private" ? Actions.SEND_PRIVATE_FILE : Actions.SEND_GROUP_FILE;
      const params = type === "private" ? { uid: id, file: filePath } : { gid: id, file: filePath };
      await ipc.request(action, params);
      setMessages((prev) => [
        ...prev.slice(-100),
        { nickname: "我", content: `[文件] ${fileName}`, time: Math.floor(Date.now() / 1000) },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { nickname: "系统", content: `文件发送失败: ${e instanceof Error ? e.message : String(e)}`, time: Math.floor(Date.now() / 1000) },
      ]);
    }
    setSending(false);
  };

  // ── Key handling (delegated to mode hooks) ──
  useInput((char, key) => {
    if (mode === "at") {
      const result = at.handleKey(char, key);
      if (result === "exit") { setMode("chat"); return; }
      if (result) { setInput((prev) => prev + result); setMode("chat"); }
      return;
    }

    if (mode === "emoji") {
      const result = emoji.handleKey(char, key);
      if (result === "exit") { setMode("chat"); return; }
      if (result) { setInput((prev) => prev + result); setMode("chat"); }
      return;
    }

    if (mode === "file") {
      const result = file.handleKey(char, key);
      if (!result) return;
      if (result.action === "exit") { setMode("chat"); file.reset(); return; }
      if (result.action === "dir") return;
      if (result.action === "insert") {
        setInput((prev) => prev + result.value!);
        setMode("chat"); file.reset();
        return;
      }
      if (result.action === "sendFile") {
        void sendFile(result.value!, result.fileName!);
        setMode("chat"); file.reset();
      }
      return;
    }

    // ── Chat Mode ──
    if (key.return) {
      const text = input.trim();
      if (!text) return;
      void sendMessage(text);
      setInput("");
      return;
    }
    if (key.backspace || key.delete) { setInput((prev) => prev.slice(0, -1)); return; }
    if (key.ctrl && char === "g" && type === "group") { setMode("at"); at.reset(); return; }
    if (key.ctrl && char === "y") { setMode("emoji"); emoji.reset(); return; }
    if (key.ctrl && char === "o") { setMode("file"); file.reset(); return; }
    if (key.ctrl && char === "h") { setShowHelp((v) => !v); return; }
    if (char && !key.ctrl && !key.meta) { setInput((prev) => prev + char); }
  });

  // ── Render ──

  return (
    <Box flexDirection="column">
      <Text bold color="yellow">
        ━━ {type === "group" ? "群聊" : "私聊"} ({id}) ━━
      </Text>

      {showHelp && mode === "chat" && (
        <Box marginTop={1} flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
          <Text dimColor>快捷键:</Text>
          {type === "group" && <Text dimColor>  Ctrl+G  @成员提及</Text>}
          <Text dimColor>  Ctrl+Y  表情选择器</Text>
          <Text dimColor>  Ctrl+O  发送文件</Text>
          <Text dimColor>  Ctrl+H  切换帮助</Text>
          <Text dimColor>  Ctrl+C  退出聊天</Text>
        </Box>
      )}

      <Box flexDirection="column" marginTop={1}>
        {messages.map((msg, i) => (
          <Text key={i}>
            <Text dimColor>[{formatTime(msg.time)}]</Text>{" "}
            <Text bold>{msg.nickname}</Text>: {renderDisplayMessage(msg.content)}
          </Text>
        ))}
      </Box>

      {/* ── @ Autocomplete Panel ── */}
      {mode === "at" && (
        <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="cyan" paddingX={1}>
          <Text bold color="cyan">@ 成员 <Text dimColor>(Tab: @全体 | Enter: 选择 | Esc: 取消)</Text></Text>
          <Text>搜索: {at.query}<Text color="cyan">█</Text></Text>
          <Box flexDirection="column" marginTop={1}>
            {at.filtered.slice(0, PAGE_SIZE).map((m, i) => (
              <Text key={m.user_id}>
                {i === at.index ? <Text color="yellow">❯ </Text> : <Text>  </Text>}
                <Text bold>{m.card || m.nickname}</Text>
                <Text dimColor> ({m.user_id})</Text>
              </Text>
            ))}
            {at.filtered.length === 0 && <Text dimColor>无匹配成员</Text>}
            {at.filtered.length > PAGE_SIZE && (
              <Text dimColor>… 还有 {at.filtered.length - PAGE_SIZE} 人</Text>
            )}
          </Box>
        </Box>
      )}

      {/* ── Emoji Panel ── */}
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

      {/* ── File Picker Panel ── */}
      {mode === "file" && (
        <Box flexDirection="column" marginTop={1} borderStyle="single" borderColor="green" paddingX={1}>
          <Text bold color="green">文件 <Text dimColor>(↑↓ 选择 | Enter: 打开/插入 | Esc: 取消)</Text></Text>
          <Text dimColor>目录: {file.cwd}</Text>
          <Text>过滤: {file.filter}<Text color="cyan">█</Text></Text>
          <Box flexDirection="column" marginTop={1}>
            {file.filtered.map((f, i) => (
              <Text key={f.fullPath}>
                {i === file.index ? <Text color="yellow">❯ </Text> : <Text>  </Text>}
                {f.isDir ? (
                  <Text color="blue">{f.name}</Text>
                ) : (
                  <>
                    <Text color={tagColor(f.tag)}>[{tagLabel(f.tag)}]</Text>
                    <Text> {f.name}</Text>
                  </>
                )}
              </Text>
            ))}
            {file.filtered.length === 0 && <Text dimColor>无匹配文件</Text>}
            {file.totalFiltered > PAGE_SIZE && (
              <Text dimColor>… 还有 {file.totalFiltered - PAGE_SIZE} 个</Text>
            )}
          </Box>
        </Box>
      )}

      {/* ── Input Line ── */}
      {mode === "chat" && (
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text color="green">&gt; </Text>
            <Text>
              {input}
              <Text color="cyan">█</Text>
            </Text>
            {sending && <Text color="yellow"> 发送中…</Text>}
          </Box>
          <Text dimColor>
            {type === "group" ? "Ctrl+G @成员 | " : ""}Ctrl+Y 表情 | Ctrl+O 文件
          </Text>
        </Box>
      )}
    </Box>
  );
}
