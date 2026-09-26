import type { Metadata } from "next";
import { Suspense } from "react";
import { Hydrated } from "@/components/shell/page";
import { TasksView } from "@/features/tasks/tasks-view";

export const metadata: Metadata = { title: "Tasks" };

export default function Page() {
  return (
    <Suspense>
      <Hydrated>
        <TasksView />
      </Hydrated>
    </Suspense>
  );
}
