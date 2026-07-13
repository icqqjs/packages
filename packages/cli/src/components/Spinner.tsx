import React, { useState, useEffect, useRef } from "react";
import { Text } from "ink";

const frames = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function Spinner({ label }: { label?: string }) {
  const [frame, setFrame] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());

  useEffect(() => {
    // 80ms per frame ≈ 12.5fps，提供平滑的旋转动画
    const timer = setInterval(() => {
      setFrame((prev) => (prev + 1) % frames.length);
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 80);
    return () => clearInterval(timer);
  }, []);

  return (
    <Text>
      <Text color="cyan">{frames[frame]}</Text>
      {label && <Text> {label}</Text>}
      {elapsed >= 2 && <Text dimColor> ({elapsed}s)</Text>}
    </Text>
  );
}
