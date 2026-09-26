"use client";
import * as React from "react";
import { Tooltip as T } from "radix-ui";
import { Kbd } from "./kbd";

export const TooltipProvider = ({ children }: { children: React.ReactNode }) => (
  <T.Provider delayDuration={350} skipDelayDuration={150}>{children}</T.Provider>
);

export function Tooltip({
  content,
  shortcut,
  side = "top",
  children,
  disabled,
}: {
  content: React.ReactNode;
  shortcut?: string[];
  side?: "top" | "bottom" | "left" | "right";
  children: React.ReactNode;
  disabled?: boolean;
}) {
  if (disabled) return <>{children}</>;
  return (
    <T.Root>
      <T.Trigger asChild>{children}</T.Trigger>
      <T.Portal>
        <T.Content
          side={side}
          sideOffset={6}
          className="z-[80] flex items-center gap-2 rounded-[7px] bg-fg px-2 py-1 text-[12px] font-medium text-bg shadow-md animate-in dark:bg-surface-3 dark:text-fg"
        >
          {content}
          {shortcut && (
            <span className="flex gap-0.5">
              {shortcut.map((k) => (
                <Kbd key={k} className="border-transparent bg-white/15 text-inherit shadow-none dark:bg-black/25">
                  {k}
                </Kbd>
              ))}
            </span>
          )}
        </T.Content>
      </T.Portal>
    </T.Root>
  );
}
