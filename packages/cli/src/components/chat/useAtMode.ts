import { useState, useMemo } from "react";

type MemberInfo = {
  user_id: number;
  nickname: string;
  card: string;
};

export function useAtMode(members: MemberInfo[]) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  const filtered = useMemo(() => {
    if (!query) return members;
    const q = query.toLowerCase();
    return members.filter(
      (m) =>
        m.card.toLowerCase().includes(q) ||
        m.nickname.toLowerCase().includes(q) ||
        String(m.user_id).includes(q),
    );
  }, [members, query]);

  const reset = () => { setQuery(""); setIndex(0); };

  const handleKey = (char: string | undefined, key: any): string | null => {
    if (key.escape) return "exit";
    if (key.upArrow) { setIndex((i) => Math.max(0, i - 1)); return null; }
    if (key.downArrow) { setIndex((i) => Math.min(filtered.length - 1, i + 1)); return null; }
    if (key.tab) return "[at:all]";
    if (key.return) {
      const member = filtered[index];
      return member ? `[at:${member.user_id}]` : null;
    }
    if (key.backspace || key.delete) { setQuery((q) => q.slice(0, -1)); setIndex(0); return null; }
    if (char && !key.ctrl && !key.meta) { setQuery((q) => q + char); setIndex(0); }
    return null;
  };

  return { query, index, filtered, reset, handleKey };
}
