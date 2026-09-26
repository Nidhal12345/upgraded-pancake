import * as React from "react";
import { cn } from "@/lib/utils";

export const inputClass =
  "h-9 w-full min-w-0 rounded-[8px] bg-input px-3 text-[14px] text-fg shadow-[inset_0_1px_1px_oklch(0.3_0.03_95/0.05),0_0_0_1px_var(--line-2)] outline-none transition-shadow hover:shadow-[inset_0_1px_1px_oklch(0.3_0.03_95/0.05),0_0_0_1px_var(--line-3)] placeholder:text-fg-4 focus:shadow-[0_0_0_1px_var(--accent-line),0_0_0_4px_var(--accent-soft)] disabled:opacity-50 aria-[invalid=true]:shadow-[0_0_0_1px_var(--danger)]";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(inputClass, className)} {...props} />,
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(inputClass, "h-auto min-h-20 resize-none py-2 leading-relaxed", className)} {...props} />
  ),
);
Textarea.displayName = "Textarea";

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("grid gap-1.5", className)}>
      <span className="text-[12px] font-medium text-fg-2">{label}</span>
      {children}
      {error ? <span className="text-[12px] text-danger-text">{error}</span> : hint ? <span className="text-[12px] text-fg-3">{hint}</span> : null}
    </label>
  );
}
