"use client";
import { useEffect } from "react";
import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ViewError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => console.error(error), [error]);
  return (
    <div className="grid min-h-[70dvh] place-items-center p-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto grid size-11 place-items-center rounded-[12px] bg-danger-soft text-danger-text">
          <TriangleAlert className="size-5" />
        </div>
        <h1 className="mt-4 text-[16px] font-semibold">Something went wrong in this view</h1>
        <p className="mt-1 text-[13.5px] leading-relaxed text-fg-3">Your data is safe — it&apos;s saved on this device and in the cloud. Try reloading the view.</p>
        <Button variant="primary" className="mt-5" onClick={reset}>
          Try again
        </Button>
      </div>
    </div>
  );
}
