"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { FocusMode } from "@/domain/types";
import { useApp } from "@/data/store";
import { todayKey } from "@/lib/dates";

export const ROUNDS_PER_CYCLE = 4;

/**
 * Wall-clock based timer: we store `endsAt` rather than ticking a counter, so
 * the remaining time survives reloads, background tabs, and device sleep.
 * Persisted per device (localStorage), intentionally not synced.
 */
interface FocusState {
  mode: FocusMode;
  status: "idle" | "running" | "paused";
  endsAt: number | null;
  remainingMs: number; // authoritative when paused / idle
  round: number; // 1..4 — which focus round we're in
  label: string;
  celebrate: number; // increments when a full cycle completes
  autoStart: boolean;
  sound: boolean;
  lastCompletedMode?: FocusMode;

  start(): void;
  pause(): void;
  reset(): void;
  skip(): void;
  setMode(m: FocusMode): void;
  setLabel(l: string): void;
  setAutoStart(v: boolean): void;
  setSound(v: boolean): void;
  tick(): void;
  dismissCelebration(): void;
}

export function durationFor(mode: FocusMode) {
  const s = useApp.getState().settings;
  const min = mode === "focus" ? s.focusMinutes : mode === "short" ? s.shortBreakMinutes : s.longBreakMinutes;
  return min * 60_000;
}

function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctx();
    [660, 880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine";
      o.frequency.value = f;
      const t = ctx.currentTime + i * 0.14;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(ctx.destination);
      o.start(t);
      o.stop(t + 1);
    });
  } catch {
    /* audio unavailable */
  }
}

export const useFocus = create<FocusState>()(
  persist(
    (set, get) => {
      const complete = () => {
        const s = get();
        const minutes = Math.round(durationFor(s.mode) / 60_000);
        useApp.getState().addSession({ mode: s.mode, minutes, endedAt: new Date().toISOString(), day: todayKey(), label: s.label || undefined });
        if (s.sound) chime();
        let nextMode: FocusMode;
        let round = s.round;
        let celebrate = s.celebrate;
        if (s.mode === "focus") {
          if (s.round >= ROUNDS_PER_CYCLE) {
            nextMode = "long";
            celebrate++;
          } else nextMode = "short";
        } else {
          nextMode = "focus";
          round = s.mode === "long" ? 1 : s.round + 1;
        }
        const ms = durationFor(nextMode);
        set({
          mode: nextMode,
          round,
          celebrate,
          lastCompletedMode: s.mode,
          remainingMs: ms,
          status: s.autoStart ? "running" : "idle",
          endsAt: s.autoStart ? Date.now() + ms : null,
        });
        if (typeof Notification !== "undefined" && Notification.permission === "granted" && document.hidden) {
          new Notification(s.mode === "focus" ? "Focus session complete" : "Break's over", {
            body: s.mode === "focus" ? "Nice work. Take a breath." : "Ready for the next round?",
          });
        }
      };

      return {
        mode: "focus",
        status: "idle",
        endsAt: null,
        remainingMs: 25 * 60_000,
        round: 1,
        label: "",
        celebrate: 0,
        autoStart: false,
        sound: true,

        start() {
          const s = get();
          if (s.status === "running") return;
          if (typeof Notification !== "undefined" && Notification.permission === "default") void Notification.requestPermission();
          set({ status: "running", endsAt: Date.now() + s.remainingMs });
        },
        pause() {
          const s = get();
          if (s.status !== "running" || !s.endsAt) return;
          set({ status: "paused", remainingMs: Math.max(0, s.endsAt - Date.now()), endsAt: null });
        },
        reset() {
          set({ status: "idle", endsAt: null, remainingMs: durationFor(get().mode) });
        },
        skip() {
          const s = get();
          let mode: FocusMode;
          let round = s.round;
          if (s.mode === "focus") mode = s.round >= ROUNDS_PER_CYCLE ? "long" : "short";
          else {
            mode = "focus";
            round = s.mode === "long" ? 1 : s.round + 1;
          }
          set({ mode, round, status: "idle", endsAt: null, remainingMs: durationFor(mode) });
        },
        setMode(mode) {
          set({ mode, status: "idle", endsAt: null, remainingMs: durationFor(mode) });
        },
        setLabel: (label) => set({ label }),
        setAutoStart: (autoStart) => set({ autoStart }),
        setSound: (sound) => set({ sound }),
        tick() {
          const s = get();
          if (s.status === "running" && s.endsAt && Date.now() >= s.endsAt) complete();
        },
        dismissCelebration: () => set({ lastCompletedMode: undefined }),
      };
    },
    {
      name: "meridian:focus",
      partialize: (s) => ({
        mode: s.mode,
        status: s.status,
        endsAt: s.endsAt,
        remainingMs: s.remainingMs,
        round: s.round,
        label: s.label,
        autoStart: s.autoStart,
        sound: s.sound,
        celebrate: s.celebrate,
      }),
    },
  ),
);

export function remainingOf(s: Pick<FocusState, "status" | "endsAt" | "remainingMs">, now = Date.now()) {
  return s.status === "running" && s.endsAt ? Math.max(0, s.endsAt - now) : s.remainingMs;
}

export function fmtClock(ms: number) {
  const total = Math.ceil(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export const MODE_LABEL: Record<FocusMode, string> = { focus: "Focus", short: "Short break", long: "Long break" };
