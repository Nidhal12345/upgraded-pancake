import type { Metadata } from "next";
import { Suspense } from "react";
import { Hydrated } from "@/components/shell/page";
import { StatsView } from "@/features/stats/stats-view";

export const metadata: Metadata = { title: "Stats" };

export default function Page() {
  return (
    <Suspense>
      <Hydrated>
        <StatsView />
      </Hydrated>
    </Suspense>
  );
}
