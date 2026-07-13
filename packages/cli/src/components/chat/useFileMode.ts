import { useState, useEffect, useMemo } from "react";
import fs from "node:fs";
import path from "node:path";

const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"]);
const AUDIO_EXTS = new Set([".mp3", ".wav", ".flac", ".ogg", ".m4a", ".amr", ".silk"]);
const VIDEO_EXTS = new Set([".mp4", ".avi", ".mkv", ".mov", ".wmv"]);
const MEDIA_EXTS = new Set([...IMAGE_EXTS, ...AUDIO_EXTS, ...VIDEO_EXTS]);

export type FileEntry = {
  name: string;
  fullPath: string;
  isDir: boolean;
  tag: "image" | "audio" | "video" | "other";
};

function getFileTag(ext: string): FileEntry["tag"] {
  if (IMAGE_EXTS.has(ext)) return "image";
  if (AUDIO_EXTS.has(ext)) return "audio";
  if (VIDEO_EXTS.has(ext)) return "video";
  return "other";
}

export function tagColor(tag: FileEntry["tag"]): string {
  switch (tag) {
    case "image": return "green";
    case "audio": return "cyan";
    case "video": return "magenta";
    default: return "white";
  }
}

export function tagLabel(tag: FileEntry["tag"]): string {
  switch (tag) {
    case "image": return "图";
    case "audio": return "音";
    case "video": return "视";
    default: return "文";
  }
}

export { IMAGE_EXTS };

const PAGE_SIZE = 10;

export function useFileMode(active: boolean) {
  const [cwd, setCwd] = useState(process.cwd());
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [index, setIndex] = useState(0);
  const [filter, setFilter] = useState("");

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    void (async () => {
      try {
        const dirEntries = await fs.promises.readdir(cwd, { withFileTypes: true });
        if (cancelled) return;
        const list: FileEntry[] = [];
        const parent = path.dirname(cwd);
        if (parent !== cwd) {
          list.push({ name: "..", fullPath: parent, isDir: true, tag: "other" });
        }
        for (const e of dirEntries) {
          if (e.name.startsWith(".")) continue;
          const full = path.join(cwd, e.name);
          if (e.isDirectory()) {
            list.push({ name: e.name + "/", fullPath: full, isDir: true, tag: "other" });
          } else {
            const ext = path.extname(e.name).toLowerCase();
            list.push({ name: e.name, fullPath: full, isDir: false, tag: getFileTag(ext) });
          }
        }
        list.sort((a, b) => {
          if (a.name === "..") return -1;
          if (b.name === "..") return 1;
          if (a.isDir !== b.isDir) return a.isDir ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        setEntries(list);
        setIndex(0);
      } catch {
        if (!cancelled) setEntries([]);
      }
    })();
    return () => { cancelled = true; };
  }, [active, cwd]);

  const filtered = useMemo(() => {
    if (!filter) return entries;
    const q = filter.toLowerCase();
    return entries.filter((f) => f.name === ".." || f.name.toLowerCase().includes(q));
  }, [entries, filter]);

  const reset = () => { setCwd(process.cwd()); setFilter(""); setIndex(0); };

  const handleKey = (char: string | undefined, key: any): { action: "exit" | "insert" | "dir" | "sendFile"; value?: string; fileName?: string } | null => {
    if (key.escape) return { action: "exit" };
    if (key.upArrow) { setIndex((i) => Math.max(0, i - 1)); return null; }
    if (key.downArrow) { setIndex((i) => Math.min(filtered.length - 1, i + 1)); return null; }
    if (key.return) {
      const entry = filtered[index];
      if (!entry) return null;
      if (entry.isDir) {
        setCwd(entry.fullPath);
        setFilter("");
        return { action: "dir" };
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (IMAGE_EXTS.has(ext)) {
        return { action: "insert", value: `[image:${entry.fullPath}]` };
      }
      return { action: "sendFile", value: entry.fullPath, fileName: entry.name };
    }
    if (key.backspace || key.delete) { setFilter((q) => q.slice(0, -1)); setIndex(0); return null; }
    if (char && !key.ctrl && !key.meta) { setFilter((q) => q + char); setIndex(0); }
    return null;
  };

  return { cwd, filter, index, filtered: filtered.slice(0, PAGE_SIZE), totalFiltered: filtered.length, reset, handleKey };
}
