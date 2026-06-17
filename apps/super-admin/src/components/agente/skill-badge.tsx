"use client";

import { Badge } from "@/components/ui/badge";
import { Sparkles, Bot } from "lucide-react";
import { cn } from "@/lib/utils";

interface SkillBadgeProps {
  skill?: string | null;
  className?: string;
}

const skillColors: Record<string, string> = {
  rag: "bg-brand-purple/15 text-brand-purple",
  search: "bg-brand-teal/15 text-brand-teal",
  create: "bg-brand-yellow/15 text-brand-yellow",
  update: "bg-brand-red/10 text-brand-red",
  default: "bg-muted text-muted-foreground",
};

export function SkillBadge({ skill, className }: SkillBadgeProps) {
  if (!skill) return null;
  const colorClass = skillColors[skill] ?? skillColors.default;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
        colorClass,
        className,
      )}
      title={`Skill invocada: ${skill}`}
    >
      <Sparkles className="h-3 w-3" />
      {skill}
    </span>
  );
}

export function SkillIndicator({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-purple/10 px-2.5 py-1 text-xs font-medium text-brand-purple">
      <Bot className="h-3 w-3 animate-pulse" />
      Procesando…
    </span>
  );
}

export function SkillLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
      <span>Skills:</span>
      {Object.entries({
        rag: "RAG",
        search: "Búsqueda",
        create: "Crear",
        update: "Actualizar",
      }).map(([k, label]) => (
        <Badge
          key={k}
          variant="outline"
          className={`border-transparent ${skillColors[k]}`}
        >
          {label}
        </Badge>
      ))}
    </div>
  );
}
