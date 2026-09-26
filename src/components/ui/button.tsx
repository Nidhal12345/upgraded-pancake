import * as React from "react";
import { Slot } from "radix-ui";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-[background-color,color,box-shadow,transform,opacity] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 disabled:saturate-50 active:scale-[0.98] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-accent-grad text-accent-fg shadow-[inset_0_1px_0_oklch(1_0_0/0.2),0_1px_2px_oklch(0.3_0.1_280/0.25),0_0_0_1px_oklch(0.4_0.18_280/0.35)] hover:brightness-[1.06] dark:shadow-[inset_0_1px_0_oklch(1_0_0/0.25),0_0_0_1px_oklch(0.6_0.14_285/0.4)]",
        secondary: "bg-surface text-fg shadow-[var(--highlight),var(--shadow-sm)] hover:bg-surface-2",
        ghost: "text-fg-2 hover:bg-hover hover:text-fg active:bg-pressed data-[state=open]:bg-pressed data-[state=open]:text-fg",
        subtle: "bg-surface-2 text-fg-2 hover:bg-surface-3 hover:text-fg",
        danger: "bg-danger text-white hover:opacity-90",
        "danger-ghost": "text-danger-text hover:bg-danger-soft",
        link: "text-accent-text underline-offset-4 hover:underline px-0 h-auto",
      },
      size: {
        xs: "h-6 rounded-[6px] px-2 text-[12px] [&_svg]:size-3.5",
        sm: "h-7 rounded-[7px] px-2.5 text-[13px] [&_svg]:size-3.5",
        md: "h-8 rounded-[8px] px-3 text-[13px] [&_svg]:size-4",
        lg: "h-10 rounded-[10px] px-4 text-[14px] [&_svg]:size-4",
        icon: "size-8 rounded-[8px] [&_svg]:size-4",
        "icon-sm": "size-7 rounded-[7px] [&_svg]:size-[15px]",
        "icon-xs": "size-6 rounded-[6px] [&_svg]:size-3.5",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, type = "button", ...props }, ref) => {
    const Comp = asChild ? Slot.Root : "button";
    return <Comp ref={ref} type={asChild ? undefined : type} className={cn(buttonVariants({ variant, size }), className)} {...props} />;
  },
);
Button.displayName = "Button";
