"use client";
import * as React from "react";
import { Popover as P } from "radix-ui";
import { cn } from "@/lib/utils";

export const Popover = P.Root;
export const PopoverTrigger = P.Trigger;
export const PopoverAnchor = P.Anchor;
export const PopoverClose = P.Close;

export const PopoverContent = React.forwardRef<
  React.ComponentRef<typeof P.Content>,
  React.ComponentPropsWithoutRef<typeof P.Content>
>(({ className, sideOffset = 6, align = "start", ...props }, ref) => (
  <P.Portal>
    <P.Content
      ref={ref}
      sideOffset={sideOffset}
      align={align}
      collisionPadding={12}
      className={cn("z-[70] rounded-[12px] bg-elevated p-1 shadow-[var(--highlight),var(--shadow-lg)] outline-none animate-in", className)}
      {...props}
    />
  </P.Portal>
));
PopoverContent.displayName = "PopoverContent";
