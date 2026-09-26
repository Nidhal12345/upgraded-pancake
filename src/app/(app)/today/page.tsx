import type { Metadata } from "next";
import { Hydrated } from "@/components/shell/page";
import { TodayView } from "@/features/today/today-view";

export const metadata: Metadata = { title: "Today" };

export default function Page() {
  return (
    <Hydrated>
      <TodayView />
    </Hydrated>
  );
}
