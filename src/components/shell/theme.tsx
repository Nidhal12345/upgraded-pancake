"use client";
import { useEffect } from "react";
import { useApp } from "@/data/store";

/** Inline script (in <head>) avoids a flash of the wrong theme before hydration. */
export const themeBootScript = `(function(){try{var t=localStorage.getItem('meridian:theme')||'system';var d=t==='dark'||(t==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d)}catch(e){}})()`;

export function ThemeSync() {
  const theme = useApp((s) => s.settings.theme);
  useEffect(() => {
    try {
      localStorage.setItem("meridian:theme", theme);
    } catch {}
    const m = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => document.documentElement.classList.toggle("dark", theme === "dark" || (theme === "system" && m.matches));
    apply();
    m.addEventListener("change", apply);
    return () => m.removeEventListener("change", apply);
  }, [theme]);
  return null;
}
