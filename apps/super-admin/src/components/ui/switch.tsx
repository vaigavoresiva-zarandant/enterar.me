"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

type SwitchProps = React.InputHTMLAttributes<HTMLInputElement>;

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, ...props }, ref) => (
    <label
      className={cn(
        "relative inline-flex h-6 w-11 cursor-pointer items-center rounded-full transition-colors",
        props.checked ? "bg-primary" : "bg-muted",
        className,
      )}
    >
      <input
        ref={ref}
        type="checkbox"
        className="peer sr-only"
        {...props}
      />
      <span
        className={cn(
          "inline-block h-4 w-4 transform rounded-full bg-background shadow transition-transform",
          props.checked ? "translate-x-6" : "translate-x-1",
        )}
      />
    </label>
  ),
);
Switch.displayName = "Switch";

export { Switch };
