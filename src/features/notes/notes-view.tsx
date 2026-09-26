"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { formatDistanceToNowStrict } from "date-fns";
import { Plus, Search, X, Pin, NotebookPen, Archive, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useApp } from "@/data/store";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { EmptyState, toneVar } from "@/components/ui/misc";
import { Modal, Confirm } from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { NoteEditor, type EditorMode, type NoteEditorHandle } from "./note-editor";
import { useIsMobile } from "@/hooks/use-media-query";
import type { Note, NoteState } from "@/domain/types";
import { cn } from "@/lib/utils";
import { isTypingTarget } from "@/components/shell/shortcuts";

const excerpt = (body: string) =>
  body
    .replace(/^#+\s.*$/m, "")
    .replace(/[#>*_~`|]|- \[[ xX]\]|\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 140);

export function NotesView() {
  const router = useRouter();
  const params = useSearchParams();
  const mobile = useIsMobile();
  const notes = useApp((s) => s.notes);
  const a = useApp.getState;

  const [folder, setFolder] = useState<NoteState>("active");
  const [q, setQ] = useState("");
  const [mode, setMode] = useState<EditorMode>("edit");
  const [dirty, setDirty] = useState(false);
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const editor = useRef<NoteEditorHandle>(null);

  const idParam = params.get("id");
  const current = notes.find((n) => n.id === idParam) ?? null;

  // Follow the opened note into its folder (e.g. from ⌘K search into Archive) — render-time sync.
  const [followed, setFollowed] = useState<string | null>(null);
  const followKey = current ? `${current.id}:${current.state}` : null;
  if (followKey !== followed) {
    setFollowed(followKey);
    if (current && current.state !== folder) setFolder(current.state);
  }

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return notes
      .filter((n) => n.state === folder && (!needle || n.title.toLowerCase().includes(needle) || n.body.toLowerCase().includes(needle)))
      .sort((x, y) => Number(y.pinned) - Number(x.pinned) || (y.updatedAt > x.updatedAt ? 1 : -1));
  }, [notes, folder, q]);
  const counts = useMemo(() => ({ archived: notes.filter((n) => n.state === "archived").length, trashed: notes.filter((n) => n.state === "trashed").length }), [notes]);

  // Auto-select first note on desktop.
  useEffect(() => {
    if (!mobile && !current && list[0]) router.replace(`/notes?id=${list[0].id}`, { scroll: false });
  }, [mobile, current, list, router]);

  /** Guard any navigation away from a note with unsaved changes. */
  const guarded = useCallback(
    (fn: () => void) => {
      if (dirty) setPending(() => fn);
      else fn();
    },
    [dirty],
  );
  const open = (id: string | null) => guarded(() => router.replace(id ? `/notes?id=${id}` : "/notes", { scroll: false }));

  useEffect(() => {
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

  const create = () =>
    guarded(() => {
      const n = a().createNote();
      setFolder("active");
      setMode("edit");
      router.replace(`/notes?id=${n.id}`, { scroll: false });
      setTimeout(() => document.querySelector<HTMLInputElement>('[aria-label="Note title"]')?.focus(), 60);
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target) || e.metaKey || e.ctrlKey || document.querySelector("[role=dialog]")) return;
      if (e.key === "c" || e.key === "n") {
        e.preventDefault();
        create();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const onMeta = (n: Note, patch: Partial<Pick<Note, "pinned" | "color" | "state">>) => {
    const prev = n.state;
    a().updateNoteMeta(n.id, patch);
    if (patch.state && patch.state !== prev) {
      const label = patch.state === "trashed" ? "Moved to trash" : patch.state === "archived" ? "Archived" : "Restored";
      toast(label, { description: n.title || "Untitled", action: { label: "Undo", onClick: () => a().updateNoteMeta(n.id, { state: prev }) } });
      if (!mobile) {
        const next = list.find((x) => x.id !== n.id);
        router.replace(next ? `/notes?id=${next.id}` : "/notes", { scroll: false });
      } else router.replace("/notes", { scroll: false });
    }
  };

  const showList = !mobile || !current;
  const showEditor = !mobile || !!current;

  return (
    <div className="flex h-[calc(100dvh-58px-env(safe-area-inset-bottom))] md:h-dvh">
      {showList && (
        <aside className="flex w-full min-w-0 flex-col md:w-[300px] md:shrink-0 lg:w-[340px]">
          <div className="flex flex-col gap-3 px-4 pb-3 pt-5">
            <div className="flex items-center justify-between">
              <h1 className="font-serif text-[30px] leading-none">Notes</h1>
              <Button variant="primary" size="sm" onClick={create} aria-label="New note">
                <Plus /> New <Kbd className="border-white/20 bg-white/15 text-accent-fg/80 shadow-none max-md:hidden">C</Kbd>
              </Button>
            </div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-4" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search notes…"
                aria-label="Search notes"
                className="h-8 w-full rounded-[8px] bg-input pl-8 pr-7 text-[13px] shadow-sm outline-none placeholder:text-fg-4 focus:shadow-[0_0_0_1px_var(--accent-line),0_0_0_4px_var(--accent-soft)]"
              />
              {q && (
                <button onClick={() => setQ("")} aria-label="Clear search" className="absolute right-1.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center text-fg-3">
                  <X className="size-3.5" />
                </button>
              )}
            </div>
            <Segmented
              size="xs"
              label="Folder"
              value={folder}
              onChange={(f) => guarded(() => setFolder(f))}
              className="w-full [&>button]:flex-1"
              options={[
                { value: "active", label: "Notes" },
                { value: "archived", label: `Archive${counts.archived ? ` ${counts.archived}` : ""}` },
                { value: "trashed", label: `Trash${counts.trashed ? ` ${counts.trashed}` : ""}` },
              ]}
            />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-6">
            {folder === "trashed" && list.length > 0 && (
              <div className="mx-2 mb-2 flex items-center justify-between rounded-[8px] bg-surface-2 px-3 py-2 text-[12px] text-fg-3">
                Trashed notes are deleted after 30 days.
                <button onClick={() => setConfirmEmpty(true)} className="font-medium text-danger-text hover:underline">
                  Empty
                </button>
              </div>
            )}
            {list.length === 0 ? (
              <EmptyState
                compact
                icon={q ? <Search /> : folder === "archived" ? <Archive /> : folder === "trashed" ? <Trash2 /> : <NotebookPen />}
                title={q ? "No matching notes" : folder === "archived" ? "Archive is empty" : folder === "trashed" ? "Trash is empty" : "No notes yet"}
                body={q ? `Nothing contains “${q}”.` : folder === "active" ? "Capture ideas, meeting notes, and plans." : undefined}
                action={folder === "active" && !q ? <Button size="sm" onClick={create}><Plus /> New note</Button> : undefined}
              />
            ) : (
              <ul className="flex flex-col gap-0.5">
                {list.map((n) => {
                  const active = n.id === current?.id;
                  return (
                    <li key={n.id}>
                      <button
                        onClick={() => open(n.id)}
                        aria-current={active ? "true" : undefined}
                        style={toneVar(n.color)}
                        className={cn(
                          "relative flex w-full flex-col gap-1 rounded-[10px] px-3 py-2.5 text-left outline-none transition-colors focus-visible:shadow-[inset_0_0_0_1.5px_var(--accent-line)]",
                          active ? "bg-surface shadow-sm" : "hover:bg-hover",
                        )}
                      >
                        <span className="flex items-center gap-2">
                          {n.color !== "none" && <span className="size-2 shrink-0 rounded-full tone-solid" />}
                          <span className={cn("min-w-0 flex-1 truncate text-[13.5px] font-medium", !n.title && "text-fg-3")}>{n.title || "Untitled"}</span>
                          {n.pinned && <Pin className="size-3 shrink-0 text-accent-text" aria-label="Pinned" />}
                          {active && dirty && <span className="size-1.5 shrink-0 rounded-full bg-warn" aria-label="Unsaved" />}
                        </span>
                        <span className="line-clamp-2 text-[12.5px] leading-snug text-fg-3">{excerpt(n.body) || "No content"}</span>
                        <span className="text-[11px] text-fg-4">{formatDistanceToNowStrict(new Date(n.updatedAt), { addSuffix: true })}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>
      )}

      {showEditor && (
        <section className="min-w-0 flex-1 bg-paper shadow-[inset_1px_0_0_var(--line)]" aria-label="Editor">
          {current ? (
            <NoteEditor
              ref={editor}
              key={current.id}
              note={current}
              mode={mode}
              onModeChange={setMode}
              onDirtyChange={setDirty}
              onSave={(id, c) => a().saveNote(id, c)}
              onMeta={(p) => onMeta(current, p)}
              onDuplicate={() =>
                guarded(() => {
                  const d = a().duplicateNote(current.id);
                  if (d) {
                    router.replace(`/notes?id=${d.id}`, { scroll: false });
                    toast("Note duplicated");
                  }
                })
              }
              onDeleteForever={() => {
                a().deleteNoteForever(current.id);
                toast("Note deleted forever");
                router.replace("/notes", { scroll: false });
              }}
              onBack={mobile ? () => open(null) : undefined}
            />
          ) : (
            <EmptyState className="h-full" icon={<NotebookPen />} title="Select a note" body="Or start a fresh page." action={<Button onClick={create}><Plus /> New note</Button>} />
          )}
        </section>
      )}

      <Modal
        open={!!pending}
        onOpenChange={(o) => !o && setPending(null)}
        title="Save changes?"
        description="This note has unsaved edits."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Keep editing
            </Button>
            <Button
              variant="danger-ghost"
              onClick={() => {
                const fn = pending;
                setDirty(false);
                setPending(null);
                fn?.();
              }}
            >
              Discard
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                editor.current?.save();
                const fn = pending;
                setDirty(false);
                setPending(null);
                setTimeout(() => fn?.(), 0);
              }}
            >
              Save
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] text-fg-2">Save before leaving, or discard your edits.</p>
      </Modal>
      <Confirm
        open={confirmEmpty}
        onOpenChange={setConfirmEmpty}
        title="Empty trash?"
        description={`${counts.trashed} notes will be permanently deleted. This can't be undone.`}
        confirmLabel="Empty trash"
        onConfirm={() => {
          a().emptyTrash();
          router.replace("/notes", { scroll: false });
        }}
      />
    </div>
  );
}
