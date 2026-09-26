import type { Metadata } from "next";
import { Suspense } from "react";
import { Hydrated } from "@/components/shell/page";
import { LearningView } from "@/features/learning/learning-view";

export const metadata: Metadata = { title: "Learning" };

export default function Page() {
  return (
    <Suspense>
      <Hydrated>
        <LearningView />
      </Hydrated>
    </Suspense>
  );
}
