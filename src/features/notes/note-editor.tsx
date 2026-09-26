"use client";
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { formatDistanceToNowStrict } from "date-fns";
import { Pin, PinOff, MoreHorizontal, Copy, Archive, ArchiveRestore, Trash2, RotateCcw, Save, ChevronLeft, PencilLine, Columns2, BookOpen, Palette, Check, GraduationCap, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useUI } from "@/data/ui-store";
import { extractCards } from "@/domain/learning";
import type { Note, NoteColor } from "@/domain/types";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Menu, MenuContent, MenuItem, MenuSeparator, MenuTrigger, MenuSub, MenuSubContent, MenuSubTrigger } from "@/components/ui/menu";
import { Kbd } from "@/components/ui/kbd";
import { Tooltip } from "@/components/ui/tooltip";
import { TONES, TONE_LABEL, toneVar } from "@/components/ui/misc";
import { EditorToolbar, type ToolbarAction } from "./toolbar";
import { MarkdownPreview } from "./markdown-preview";
import { cmd, continueList, toggleNthCheckbox, wordCount, type Change, type Edit } from "./md-commands";
import { useIsMobile } from "@/hooks/use-media-query";
import { cn } from "@/lib/utils";

export type EditorMode = "edit" | "split" | "read";
export interface NoteEditorHandle {
  save(): void;
  isDirty(): boolean;
}

interface Props {
  note: Note;
  mode: EditorMode;
  onModeChange: (m: EditorMode) => void;
  onSave: (id: string, content: { title: string; body: string }) => void;
  onDirtyChange: (dirty: boolean) => void;
  onMeta: (patch: Partial<Pick<Note, "pinned" | "color" | "state">>) => void;
  onDuplicate: () => void;
  onDeleteForever: () => void;
  onBack?: () => void;
}

/**
 * The writing surface. Edits live in a local draft — nothing is persisted
 * (or sent over the network) until the user saves with the button or ⌘S.
 */
export const NoteEditor = forwardRef<NoteEditorHandle, Props>(function NoteEditor(
  { note, mode, onModeChange, onSave, onDirtyChange, onMeta, onDuplicate, onDeleteForever, onBack },
  ref,
) {
  const mobile = useIsMobile();
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);
  const [justSaved, setJustSaved] = useState(false);
  const ta = useRef<HTMLTextAreaElement>(null);
  const readOnly = note.state === "trashed";
  const dirty = title !== note.title || body !== note.body;

  // Reset the draft only when switching to a different note.
  useEffect(() => {
    setTitle(note.title);
    setBody(note.body);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.id]);

  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const save = useCallback(() => {
    if (readOnly) return;
    if (!dirty) {
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1200);
      return;
    }
    onSave(note.id, { title: title.trim(), body });
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1600);
  }, [dirty, readOnly, onSave, note.id, title, body]);

  useImperativeHandle(ref, () => ({ save, isDirty: () => dirty }), [save, dirty]);

  // Apply a Change through execCommand so the browser keeps native undo history.
  const apply = useCallback((c: Change) => {
    const el = ta.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(c.from, c.to);
    const ok = typeof document.execCommand === "function" && document.execCommand("insertText", false, c.insert);
    if (!ok) {
      el.setRangeText(c.insert, c.from, c.to, "end");
      setBody(el.value);
    }
    requestAnimationFrame(() => el.setSelectionRange(c.selStart, c.selEnd));
  }, []);

  const edit = (): Edit | null => {
    const el = ta.current;
    return el ? { text: el.value, start: el.selectionStart, end: el.selectionEnd } : null;
  };

  const run = useCallback(
    (a: ToolbarAction) => {
      if (mode === "read") onModeChange("edit");
      requestAnimationFrame(() => {
        const e = edit();
        if (!e) return;
        const map: Record<ToolbarAction, (e: Edit) => Change> = {
          bold: cmd.bold, italic: cmd.italic, strike: cmd.strike, code: cmd.code,
          h1: cmd.heading(1), h2: cmd.heading(2), h3: cmd.heading(3),
          bullet: cmd.bullet, numbered: cmd.numbered, checkbox: cmd.checkbox, quote: cmd.quote, link: cmd.link,
        };
        apply(map[a](e));
      });
    },
    [apply, mode, onModeChange],
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    const k = e.key.toLowerCase();
    if (mod && k === "b") return e.preventDefault(), run("bold");
    if (mod && k === "i") return e.preventDefault(), run("italic");
    if (mod && e.shiftKey && k === "x") return e.preventDefault(), run("strike");
    if (mod && k === "k") return e.preventDefault(), e.stopPropagation(), run("link");
    if (e.key === "Enter" && !e.shiftKey && !mod) {
      const c = continueList({ text: e.currentTarget.value, start: e.currentTarget.selectionStart, end: e.currentTarget.selectionEnd });
      if (c) {
        e.preventDefault();
        apply(c);
      }
    }
    if (e.key === "Tab") {
      e.preventDefault();
      apply(cmd.insert(edit()!, "  "));
    }
  };

  // ⌘S / ⌘E handled at window level so they work in title, preview, anywhere.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      const k = e.key.toLowerCase();
      if (k === "s") {
        e.preventDefault();
        save();
      } else if (k === "e") {
        e.preventDefault();
        onModeChange(mode === "edit" ? "split" : mode === "split" ? "read" : "edit");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, mode, onModeChange]);

  const toggleCheckbox = useCallback((i: number) => !readOnly && setBody((b) => toggleNthCheckbox(b, i)), [readOnly]);
  const effectiveMode: EditorMode = readOnly ? "read" : mobile && mode === "split" ? "edit" : mode;
  const words = wordCount(body);

  // ── Learning capture ────────────────────────────────────────────
  const [selText, setSelText] = useState("");
  const trackSelection = () => {
    const el = ta.current;
    const t = el ? el.value.slice(el.selectionStart, el.selectionEnd).trim() : window.getSelection()?.toString().trim() ?? "";
    setSelText(t.length > 1 && t.length < 1200 ? t : "");
  };
  const source = { kind: "note" as const, id: note.id, label: title || "Untitled" };
  const makeCardFromSelection = () => {
    const raw = selText || (ta.current ? currentLine(ta.current) : "");
    const found = extractCards(raw);
    if (found.length > 1) return useUI.getState().openCardComposer({ batch: found, prefill: { source } });
    const [front, back] = found[0] ? [found[0].front, found[0].back] : [raw.replace(/^[-*#>\s]+/, "").replace(/\*\*/g, ""), ""];
    useUI.getState().openCardComposer({ prefill: { front, back, source } });
  };
  const extractAll = () => {
    const found = extractCards(body);
    if (!found.length) {
      toast("No definitions found", { description: "Use lines like “Term: definition”, “Term :: definition” or Q:/A: pairs." });
      return;
    }
    useUI.getState().openCardComposer({ batch: found, prefill: { source } });
  };

  return (
    <div className="flex h-full min-h-0 flex-col" style={toneVar(note.color)}>
      {/* header */}
      <div className="flex h-12 shrink-0 items-center gap-1.5 border-b border-line px-2 md:px-4">
        {onBack && (
          <Button variant="ghost" size="icon-sm" onClick={onBack} aria-label="Back to notes">
            <ChevronLeft />
          </Button>
        )}
        {!readOnly && (
          <Segmented
            size="xs"
            label="Editor mode"
            value={effectiveMode}
            onChange={onModeChange}
            options={[
              { value: "edit", label: <span className="max-sm:sr-only">Edit</span>, icon: <PencilLine />, title: "Edit (⌘E cycles)" },
              ...(mobile ? [] : [{ value: "split" as const, label: "Split", icon: <Columns2 />, title: "Split" }]),
              { value: "read", label: <span className="max-sm:sr-only">Read</span>, icon: <BookOpen />, title: "Read" },
            ]}
          />
        )}
        {readOnly && <span className="px-2 text-[12.5px] text-fg-3">In trash — restore to edit</span>}

        <div className="ml-auto flex items-center gap-1">
          <span className="mr-1 flex items-center gap-1.5 text-[12px] text-fg-3" aria-live="polite">
            {dirty ? (
              <>
                <span className="size-1.5 rounded-full bg-warn" />
                <span className="max-sm:hidden">Unsaved changes</span>
              </>
            ) : justSaved ? (
              <>
                <Check className="size-3.5 text-ok-text" /> <span className="max-sm:hidden">Saved</span>
              </>
            ) : (
              <span className="max-sm:hidden">Edited {formatDistanceToNowStrict(new Date(note.updatedAt), { addSuffix: true })}</span>
            )}
          </span>
          {!readOnly && (
            <Tooltip content={note.pinned ? "Unpin" : "Pin to top"}>
              <Button variant="ghost" size="icon-sm" aria-label={note.pinned ? "Unpin note" : "Pin note"} onClick={() => onMeta({ pinned: !note.pinned })} className={cn(note.pinned && "text-accent-text")}>
                {note.pinned ? <PinOff /> : <Pin />}
              </Button>
            </Tooltip>
          )}
          <Menu>
            <MenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Note actions">
                <MoreHorizontal />
              </Button>
            </MenuTrigger>
            <MenuContent align="end" className="w-[210px]">
              {note.state !== "trashed" ? (
                <>
                  <MenuSub>
                    <MenuSubTrigger>
                      <Palette /> Colour
                    </MenuSubTrigger>
                    <MenuSubContent>
                      {(["none", ...TONES] as NoteColor[]).map((c) => (
                        <MenuItem key={c} onSelect={() => onMeta({ color: c })}>
                          <span style={toneVar(c)} className={cn("size-3 rounded-full", c === "none" ? "border border-line-3" : "tone-solid")} />
                          {c === "none" ? "No colour" : TONE_LABEL[c]}
                          {note.color === c && <Check className="ml-auto !text-accent" />}
                        </MenuItem>
                      ))}
                    </MenuSubContent>
                  </MenuSub>
                  <MenuItem onSelect={extractAll}>
                    <Wand2 /> Extract learning cards
                  </MenuItem>
                  <MenuItem onSelect={onDuplicate}>
                    <Copy /> Duplicate
                  </MenuItem>
                  <MenuItem onSelect={() => onMeta({ state: note.state === "archived" ? "active" : "archived" })}>
                    {note.state === "archived" ? <ArchiveRestore /> : <Archive />}
                    {note.state === "archived" ? "Unarchive" : "Archive"}
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem danger onSelect={() => onMeta({ state: "trashed" })}>
                    <Trash2 /> Move to trash
                  </MenuItem>
                </>
              ) : (
                <>
                  <MenuItem onSelect={() => onMeta({ state: "active" })}>
                    <RotateCcw /> Restore
                  </MenuItem>
                  <MenuSeparator />
                  <MenuItem danger onSelect={onDeleteForever}>
                    <Trash2 /> Delete forever
                  </MenuItem>
                </>
              )}
            </MenuContent>
          </Menu>
          {!readOnly && (
            <Button variant={dirty ? "primary" : "secondary"} size="sm" onClick={save} aria-label="Save note (Cmd+S)">
              <Save />
              <span className="max-sm:hidden">Save</span>
              <span className="hidden gap-0.5 lg:flex">
                <Kbd className={cn(dirty && "border-white/20 bg-white/15 text-accent-fg/80 shadow-none")}>⌘S</Kbd>
              </span>
            </Button>
          )}
        </div>
      </div>

      {/* toolbar */}
      {effectiveMode !== "read" && (
        <div className="shrink-0 border-b border-line px-2 py-1 md:px-4">
          <EditorToolbar
            onAction={run}
            onEmoji={(em) => {
              const e = edit();
              if (e) apply(cmd.insert(e, em));
            }}
            onTable={(r, c) => {
              const e = edit();
              if (e) apply(cmd.table(e, r, c));
            }}
            trailing={
              <button
                onMouseDown={(e) => e.preventDefault()}
                onClick={makeCardFromSelection}
                title={selText ? "Turn the selection into a learning card" : "Turn the current line into a learning card"}
                className={cn(
                  "ml-auto flex h-8 shrink-0 items-center gap-1.5 rounded-[7px] px-2.5 text-[12.5px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--ring)] [&_svg]:size-4",
                  selText ? "bg-accent-soft text-accent-text" : "text-fg-3 hover:bg-hover hover:text-fg",
                )}
              >
                <GraduationCap /> Make card
              </button>
            }
          />
        </div>
      )}

      {/* body */}
      <div className={cn("grid min-h-0 flex-1", effectiveMode === "split" && "grid-cols-2")}>
        {effectiveMode !== "read" && (
          <div className="flex min-h-0 flex-col overflow-y-auto">
            <div className="mx-auto w-full max-w-[720px] px-5 pb-24 pt-6 md:px-10 md:pt-10">
              {note.color !== "none" && <div className="mb-4 h-1 w-10 rounded-full tone-solid" aria-hidden />}
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Untitled"
                aria-label="Note title"
                maxLength={200}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === "ArrowDown") {
                    e.preventDefault();
                    ta.current?.focus();
                  }
                }}
                className="w-full bg-transparent font-serif text-[34px] leading-tight tracking-[-0.01em] outline-none placeholder:text-fg-4 md:text-[40px]"
              />
              <textarea
                ref={ta}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                onKeyDown={onKeyDown}
                onSelect={trackSelection}
                onBlur={() => setTimeout(() => setSelText(""), 150)}
                placeholder={"Start writing…\n\nMarkdown works: # heading, **bold**, - list, - [ ] task, > quote"}
                aria-label="Note body (Markdown)"
                spellCheck
                className="field-sizing-content mt-4 min-h-[50dvh] w-full resize-none bg-transparent font-mono text-[14px] leading-[1.75] text-fg outline-none placeholder:text-fg-4"
              />
            </div>
          </div>
        )}
        {effectiveMode !== "edit" && (
          <div className={cn("min-h-0 overflow-y-auto", effectiveMode === "split" && "border-l border-line bg-surface-2/60")}>
            <article className="mx-auto w-full max-w-[720px] px-5 pb-24 pt-6 md:px-10 md:pt-10">
              {effectiveMode === "read" && note.color !== "none" && <div className="mb-4 h-1 w-10 rounded-full tone-solid" aria-hidden />}
              {effectiveMode === "read" && <h1 className="mb-6 font-serif text-[34px] leading-tight md:text-[40px]">{title || <span className="text-fg-4">Untitled</span>}</h1>}
              <div onMouseUp={() => setSelText(window.getSelection()?.toString().trim() ?? "")}>
                <MarkdownPreview source={body} onToggleCheckbox={readOnly ? undefined : toggleCheckbox} />
              </div>
              {effectiveMode === "read" && selText && !readOnly && (
                <button
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={makeCardFromSelection}
                  className="fixed bottom-6 left-1/2 z-30 flex h-9 -translate-x-1/2 items-center gap-2 rounded-full bg-accent-grad px-4 text-[13px] font-medium text-accent-fg shadow-lg animate-in max-md:bottom-24"
                >
                  <GraduationCap className="size-4" /> Make card from selection
                </button>
              )}
            </article>
          </div>
        )}
      </div>

      <div className="flex h-8 shrink-0 items-center gap-3 border-t border-line px-4 font-mono text-[11px] tabular text-fg-4 max-md:hidden">
        <span>{words} words</span>
        <span>{body.length} chars</span>
        <span className="ml-auto">Markdown · ⌘S save · ⌘E switch mode</span>
      </div>
    </div>
  );
});

function currentLine(el: HTMLTextAreaElement) {
  const v = el.value;
  const a = v.lastIndexOf("\n", el.selectionStart - 1) + 1;
  let b = v.indexOf("\n", el.selectionStart);
  if (b === -1) b = v.length;
  return v.slice(a, b).trim();
}
