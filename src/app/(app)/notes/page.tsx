import type { Metadata } from "next";
import { Suspense } from "react";
import { Hydrated } from "@/components/shell/page";
import { NotesView } from "@/features/notes/notes-view";

export const metadata: Metadata = { title: "Notes" };

export default function Page() {
  return (
    <Suspense>
      <Hydrated>
        <NotesView />
      </Hydrated>
    </Suspense>
  );
}
