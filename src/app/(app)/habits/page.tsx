import type { Metadata } from "next";
import { Suspense } from "react";
import { Hydrated } from "@/components/shell/page";
import { HabitsView } from "@/features/habits/habits-view";

export const metadata: Metadata = { title: "Habits" };

export default function Page() {
  return (
    <Suspense>
      <Hydrated>
        <HabitsView />
      </Hydrated>
    </Suspense>
  );
}
