import type { Metadata } from "next";
import { Suspense } from "react";
import { Hydrated } from "@/components/shell/page";
import { WeekView } from "@/features/week/week-view";

export const metadata: Metadata = { title: "This week" };

export default function Page() {
  return (
    <Suspense>
      <Hydrated>
        <WeekView />
      </Hydrated>
    </Suspense>
  );
}
