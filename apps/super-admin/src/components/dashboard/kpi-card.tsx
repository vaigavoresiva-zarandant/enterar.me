"use client";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";

interface KpiCardProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  accent?: "red" | "yellow" | "purple" | "teal" | "gray";
  delay?: number;
}

const accentMap = {
  red: "bg-brand-red/10 text-brand-red",
  yellow: "bg-brand-yellow/15 text-brand-yellow",
  purple: "bg-brand-purple/10 text-brand-purple",
  teal: "bg-brand-teal/15 text-brand-teal",
  gray: "bg-muted text-muted-foreground",
} as const;

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "gray",
  delay = 0,
}: KpiCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay }}
    >
      <Card className="overflow-hidden">
        <CardContent className="flex items-start justify-between gap-4 p-5">
          <div className="min-w-0">
            <p className="truncate text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label}
            </p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-foreground">
              {value}
            </p>
            {hint && (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {hint}
              </p>
            )}
          </div>
          <div
            className={cn(
              "flex h-11 w-11 shrink-0 items-center justify-center rounded-lg",
              accentMap[accent],
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
