"use client";

import { Badge } from "@/components/ui/badge";
import type { PlanCode } from "@/types/directus";

const planStyles: Record<PlanCode, { label: string; className: string }> = {
  free: {
    label: "Free",
    className: "bg-muted text-muted-foreground border-transparent",
  },
  starter: {
    label: "Starter",
    className: "bg-brand-teal/15 text-brand-teal border-transparent",
  },
  pro: {
    label: "Pro",
    className: "bg-brand-purple/15 text-brand-purple border-transparent",
  },
  enterprise: {
    label: "Enterprise",
    className: "bg-brand-red/10 text-brand-red border-transparent",
  },
};

export function PlanBadge({ code }: { code: PlanCode }) {
  const s = planStyles[code] ?? planStyles.free;
  return (
    <Badge variant="outline" className={s.className}>
      {s.label}
    </Badge>
  );
}
