import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-xs font-medium [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-black/10 text-foreground dark:border-white/15",
        brand: "border-transparent bg-brand/12 text-[color-mix(in_oklch,var(--brand),black_25%)] dark:text-brand",
        danger: "border-transparent bg-destructive/10 text-destructive",
        warning: "border-transparent bg-warning/15 text-[color-mix(in_oklch,var(--warning),black_45%)] dark:text-warning",
        success: "border-transparent bg-success/12 text-[color-mix(in_oklch,var(--success),black_30%)] dark:text-success",
        info: "border-transparent bg-info/12 text-[color-mix(in_oklch,var(--info),black_25%)] dark:text-info",
      },
    },
    defaultVariants: { variant: "secondary" },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
