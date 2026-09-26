import type { Metadata } from "next";
import { Suspense } from "react";
import { Hydrated } from "@/components/shell/page";
import { FocusView } from "@/features/focus/focus-view";

export const metadata: Metadata = { title: "Focus" };

export default function Page() {
  return (
    <Suspense>
      <Hydrated>
        <FocusView />
      </Hydrated>
    </Suspense>
  );
}
