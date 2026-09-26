"use client";
import * as React from "react";
import { DropdownMenu as D, ContextMenu as C } from "radix-ui";
import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const content = "z-[70] min-w-[200px] rounded-[12px] bg-elevated p-1 shadow-[var(--highlight),var(--shadow-lg)] outline-none animate-in";
const item =
  "relative flex h-8 select-none items-center gap-2.5 rounded-[7px] px-2 text-[13px] text-fg outline-none data-[disabled]:opacity-40 data-[highlighted]:bg-hover [&_svg]:size-4 [&_svg]:text-fg-3 data-[highlighted]:[&_svg]:text-fg-2";

export const Menu = D.Root;
export const MenuTrigger = D.Trigger;
export const MenuGroup = D.Group;
export const MenuSub = D.Sub;

export const MenuContent = React.forwardRef<React.ComponentRef<typeof D.Content>, React.ComponentPropsWithoutRef<typeof D.Content>>(
  ({ className, sideOffset = 6, align = "start", ...p }, ref) => (
    <D.Portal>
      <D.Content ref={ref} sideOffset={sideOffset} align={align} collisionPadding={12} className={cn(content, className)} {...p} />
    </D.Portal>
  ),
);
MenuContent.displayName = "MenuContent";

export function MenuItem({ className, danger, shortcut, children, ...p }: React.ComponentPropsWithoutRef<typeof D.Item> & { danger?: boolean; shortcut?: string }) {
  return (
    <D.Item className={cn(item, danger && "text-danger-text [&_svg]:!text-danger-text data-[highlighted]:bg-danger-soft", className)} {...p}>
      {children}
      {shortcut && <span className="ml-auto pl-4 font-mono text-[11px] text-fg-4">{shortcut}</span>}
    </D.Item>
  );
}

export function MenuCheckItem({ className, children, checked, ...p }: React.ComponentPropsWithoutRef<typeof D.CheckboxItem>) {
  return (
    <D.CheckboxItem checked={checked} className={cn(item, "pr-8", className)} {...p}>
      {children}
      <D.ItemIndicator className="absolute right-2">
        <Check className="!text-accent" />
      </D.ItemIndicator>
    </D.CheckboxItem>
  );
}

export const MenuSeparator = () => <D.Separator className="-mx-1 my-1 h-px bg-line" />;
export const MenuLabel = ({ children }: { children: React.ReactNode }) => (
  <D.Label className="px-2 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-[0.06em] text-fg-4">{children}</D.Label>
);

export function MenuSubTrigger({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <D.SubTrigger className={cn(item, "data-[state=open]:bg-surface-3/80", className)}>
      {children}
      <ChevronRight className="ml-auto !size-3.5" />
    </D.SubTrigger>
  );
}
export function MenuSubContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <D.Portal>
      <D.SubContent sideOffset={4} collisionPadding={12} className={cn(content, className)}>
        {children}
      </D.SubContent>
    </D.Portal>
  );
}

// Context menu variants share the same look
export const Context = C.Root;
export const ContextTrigger = C.Trigger;
export function ContextContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <C.Portal>
      <C.Content collisionPadding={12} className={cn(content, className)}>
        {children}
      </C.Content>
    </C.Portal>
  );
}
export function ContextItem({ className, danger, children, ...p }: React.ComponentPropsWithoutRef<typeof C.Item> & { danger?: boolean }) {
  return (
    <C.Item className={cn(item, danger && "text-danger-text [&_svg]:!text-danger-text data-[highlighted]:bg-danger-soft", className)} {...p}>
      {children}
    </C.Item>
  );
}
export const ContextSeparator = () => <C.Separator className="-mx-1 my-1 h-px bg-line" />;
