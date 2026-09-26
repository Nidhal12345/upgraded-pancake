import type { Metadata } from "next";
import { Suspense } from "react";
import { Hydrated } from "@/components/shell/page";
import { CalendarView } from "@/features/calendar/calendar-view";

export const metadata: Metadata = { title: "Calendar" };

export default function Page() {
  return (
    <Suspense>
      <Hydrated>
        <CalendarView />
      </Hydrated>
    </Suspense>
  );
}
