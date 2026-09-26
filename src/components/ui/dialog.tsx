"use client";
import * as React from "react";
import { Dialog as D, AlertDialog as A } from "radix-ui";
import { Drawer } from "vaul";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-media-query";
import { Button } from "./button";

const overlay = "fixed inset-0 z-[60] bg-[oklch(0.25_0.03_270/0.22)] data-[state=open]:animate-[fade_150ms_ease-out] dark:bg-black/55";

/**
 * Responsive modal: centered dialog on desktop, bottom sheet (vaul) on phones.
 * Same API everywhere so feature code never branches on viewport.
 */
export function Modal({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  className,
  hideTitle,
  size = "md",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  hideTitle?: boolean;
  size?: "sm" | "md" | "lg";
}) {
  const mobile = useIsMobile();
  if (mobile) {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/35" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-[61] flex max-h-[92dvh] flex-col rounded-t-[20px] bg-elevated shadow-lg outline-none">
            <div className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-line-3" />
            <div className={cn("px-5 pt-3", hideTitle && "sr-only")}>
              <Drawer.Title className="text-[17px] font-semibold tracking-[-0.01em]">{title}</Drawer.Title>
              {description && <Drawer.Description className="mt-0.5 text-[13px] text-fg-3">{description}</Drawer.Description>}
            </div>
            {hideTitle && description && <Drawer.Description className="sr-only">{description}</Drawer.Description>}
            <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 pb-4 pt-4", className)}>{children}</div>
            {footer && <div className="flex gap-2 border-t border-line px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))] [&>*]:flex-1">{footer}</div>}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className={overlay} />
        <D.Content
          className={cn(
            "fixed left-1/2 top-[12vh] z-[61] flex max-h-[80vh] w-[calc(100vw-32px)] -translate-x-1/2 flex-col rounded-[16px] bg-elevated shadow-lg outline-none animate-in",
            size === "sm" ? "max-w-[400px]" : size === "lg" ? "max-w-[680px]" : "max-w-[520px]",
          )}
        >
          <div className={cn("flex items-start justify-between gap-4 px-5 pt-4", hideTitle && "sr-only")}>
            <div>
              <D.Title className="text-[15px] font-semibold tracking-[-0.01em]">{title}</D.Title>
              {description && <D.Description className="mt-0.5 text-[13px] text-fg-3">{description}</D.Description>}
            </div>
            <D.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close" className="-mr-1.5 -mt-0.5">
                <X />
              </Button>
            </D.Close>
          </div>
          {hideTitle && description && <D.Description className="sr-only">{description}</D.Description>}
          <div className={cn("min-h-0 flex-1 overflow-y-auto px-5 py-4", className)}>{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}

export function Confirm({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Delete",
  onConfirm,
  tone = "danger",
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  tone?: "danger" | "primary";
}) {
  return (
    <A.Root open={open} onOpenChange={onOpenChange}>
      <A.Portal>
        <A.Overlay className={overlay} />
        <A.Content className="fixed left-1/2 top-1/2 z-[61] w-[calc(100vw-32px)] max-w-[380px] -translate-x-1/2 -translate-y-1/2 rounded-[16px] bg-elevated p-5 shadow-lg animate-in">
          <A.Title className="text-[15px] font-semibold">{title}</A.Title>
          {description && <A.Description className="mt-1.5 text-[13px] leading-relaxed text-fg-2">{description}</A.Description>}
          <div className="mt-5 flex justify-end gap-2">
            <A.Cancel asChild>
              <Button variant="ghost">Cancel</Button>
            </A.Cancel>
            <A.Action asChild>
              <Button variant={tone} onClick={onConfirm}>
                {confirmLabel}
              </Button>
            </A.Action>
          </div>
        </A.Content>
      </A.Portal>
    </A.Root>
  );
}

/** Right-hand inspector on desktop, bottom sheet on phones. */
export function Sheet({
  open,
  onOpenChange,
  title,
  children,
  footer,
  header,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  header?: React.ReactNode;
}) {
  const mobile = useIsMobile();
  if (mobile) {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange} repositionInputs={false}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-[60] bg-black/35" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-[61] flex max-h-[94dvh] flex-col rounded-t-[20px] bg-elevated outline-none">
            <div className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-line-3" />
            <Drawer.Title className="sr-only">{title}</Drawer.Title>
            <Drawer.Description className="sr-only">{title}</Drawer.Description>
            {header && <div className="flex items-center gap-1 px-4 pt-2">{header}</div>}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">{children}</div>
            {footer && <div className="border-t border-line px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>}
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }
  return (
    <D.Root open={open} onOpenChange={onOpenChange}>
      <D.Portal>
        <D.Overlay className="fixed inset-0 z-[60] bg-[oklch(0.25_0.03_270/0.14)] dark:bg-black/40" />
        <D.Content className="fixed bottom-2 right-2 top-2 z-[61] flex w-[440px] max-w-[calc(100vw-16px)] flex-col rounded-[16px] bg-elevated shadow-lg outline-none data-[state=open]:animate-[sheet-in_220ms_cubic-bezier(0.2,0.8,0.2,1)]">
          <D.Title className="sr-only">{title}</D.Title>
          <D.Description className="sr-only">{title}</D.Description>
          <div className="flex h-12 shrink-0 items-center gap-1 border-b border-line px-3">
            {header}
            <D.Close asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Close" className="ml-auto">
                <X />
              </Button>
            </D.Close>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="border-t border-line px-4 py-3">{footer}</div>}
        </D.Content>
      </D.Portal>
    </D.Root>
  );
}
