"use client";
import { memo } from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn } from "@/lib/utils";

/**
 * Rendered markdown. Checkboxes are interactive in read/split mode; toggling
 * reports the checkbox index so the source can be updated.
 */
export const MarkdownPreview = memo(function MarkdownPreview({ source, onToggleCheckbox, className }: { source: string; onToggleCheckbox?: (index: number) => void; className?: string }) {
  // index counter must reset on every render so checkbox N maps to the Nth `[ ]` in source
  let idx = 0;
  const components: Components = {
      a: ({ href, children }) => (
        <a href={href} target="_blank" rel="noopener noreferrer">
          {children}
        </a>
      ),
      input: ({ type, checked }) => {
        if (type !== "checkbox") return null;
        const my = idx++;
        return (
          <input
            type="checkbox"
            checked={!!checked}
            onChange={() => onToggleCheckbox?.(my)}
            disabled={!onToggleCheckbox}
            className="mt-[0.35em] size-[15px] shrink-0 cursor-pointer accent-[var(--accent)]"
            aria-label={checked ? "Completed item" : "Open item"}
          />
        );
      },
  };

  if (!source.trim())
    return <p className={cn("text-[14px] italic text-fg-4", className)}>Nothing to preview yet.</p>;
  return (
    <div className={cn("prose-meridian", className)}>
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {source}
      </ReactMarkdown>
    </div>
  );
});
