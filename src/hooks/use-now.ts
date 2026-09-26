"use client";
import { useEffect, useState } from "react";

/** Re-renders on a coarse interval (default: each minute) — for "now" lines, greetings, day rollover. */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
