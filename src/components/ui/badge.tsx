import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-sm border px-1.5 py-0.5 text-xs font-medium [&_svg]:size-3",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border bg-card text-foreground",
        danger: "border-border bg-card text-foreground before:size-1.5 before:rounded-full before:bg-destructive",
        warning: "border-border bg-card text-foreground before:size-1.5 before:rounded-full before:bg-warning",
        success: "border-border bg-card text-foreground before:size-1.5 before:rounded-full before:bg-success",
        info: "border-border bg-card text-foreground before:size-1.5 before:rounded-full before:bg-info",
      },
    },
    defaultVariants: { variant: "secondary" },
  },
);

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
