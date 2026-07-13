import { useState, useMemo } from "react";

// ── Popular QQ face emojis (id → name) ──
export const FACE_MAP: [number, string][] = [
  [0, "😊 惊讶"], [1, "😖 撇嘴"], [2, "😍 色"], [4, "😎 得意"],
  [5, "😢 流泪"], [6, "☺️ 害羞"], [7, "🤐 闭嘴"], [8, "😴 睡"],
  [9, "😭 大哭"], [10, "😅 尴尬"], [11, "😠 发怒"], [12, "😜 调皮"],
  [13, "😁 呲牙"], [14, "😲 微笑"], [15, "🙁 难过"], [16, "😃 酷"],
  [18, "😱 抓狂"], [19, "🤮 吐"], [20, "🤭 偷笑"], [21, "😊 可爱"],
  [22, "🙄 白眼"], [23, "😤 傲慢"], [24, "😫 饥饿"], [25, "😪 困"],
  [26, "😨 惊恐"], [27, "😰 流汗"], [28, "😄 憨笑"], [29, "😏 悠闲"],
  [30, "💪 奋斗"], [31, "🤬 咒骂"], [32, "🤔 疑问"], [33, "🤫 嘘"],
  [34, "😵 晕"], [35, "😩 折磨"], [36, "🤑 衰"], [37, "💀 骷髅"],
  [38, "👊 敲打"], [39, "👋 再见"], [41, "😮‍💨 发抖"], [42, "😡 爱情"],
  [43, "🦗 跳跳"], [46, "🐷 猪头"], [49, "🤗 拥抱"], [53, "🎂 蛋糕"],
  [55, "💣 炸弹"], [56, "🔪 刀"], [59, "💩 便便"], [60, "☕ 咖啡"],
  [63, "🌹 玫瑰"], [64, "🥀 凋谢"], [66, "❤️ 爱心"], [67, "💔 心碎"],
  [74, "🌞 太阳"], [75, "🌙 月亮"], [76, "👍 赞"], [77, "👎 踩"],
  [78, "🤝 握手"], [79, "✌️ 胜利"], [96, "😂 冷汗"], [97, "😥 擦汗"],
  [98, "😋 抠鼻"], [99, "👏 鼓掌"], [100, "😳 糗大了"], [101, "😏 坏笑"],
  [104, "😿 委屈"], [106, "😷 吓"], [109, "👌 OK"], [111, "🤡 鄙视"],
  [116, "😘 飞吻"], [118, "🤩 发呆"], [120, "👊 拳头"], [122, "👎 差劲"],
  [123, "🤟 爱你"], [124, "🚫 NO"], [125, "👍 OK"], [129, "🤙 转圈"],
  [144, "🍻 干杯"], [147, "🔫 匕首"], [171, "🍵 茶"], [174, "🎵 音符"],
  [178, "😺 微笑猫"], [179, "😿 泪奔猫"], [212, "🤓 微微一笑"],
  [320, "🐶 狗头"], [325, "😅 苦涩"], [326, "🤌 裂开"],
];

const PAGE_SIZE = 10;

export function useEmojiMode() {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    if (!query) return FACE_MAP;
    const q = query.toLowerCase();
    return FACE_MAP.filter(([id, name]) =>
      name.toLowerCase().includes(q) || String(id) === q,
    );
  }, [query]);

  const reset = () => { setQuery(""); setIndex(0); setPage(0); };

  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const handleKey = (char: string | undefined, key: any): string | null => {
    if (key.escape) return "exit";
    if (key.upArrow) { setIndex((i) => Math.max(0, i - 1)); return null; }
    if (key.downArrow) { setIndex((i) => Math.min(pageItems.length - 1, i + 1)); return null; }
    if (key.leftArrow) { setPage((p) => Math.max(0, p - 1)); setIndex(0); return null; }
    if (key.rightArrow) { setPage((p) => Math.min(totalPages - 1, p + 1)); setIndex(0); return null; }
    if (key.return) {
      const globalIdx = page * PAGE_SIZE + index;
      const emoji = filtered[globalIdx];
      return emoji ? `[face:${emoji[0]}]` : null;
    }
    if (key.backspace || key.delete) { setQuery((q) => q.slice(0, -1)); setIndex(0); setPage(0); return null; }
    if (char && !key.ctrl && !key.meta) { setQuery((q) => q + char); setIndex(0); setPage(0); }
    return null;
  };

  return { query, index, page, filtered, pageItems, totalPages, reset, handleKey };
}
