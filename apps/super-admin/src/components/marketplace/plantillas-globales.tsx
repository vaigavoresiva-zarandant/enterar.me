"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useTemplates, useSectors } from "@/hooks/use-marketplace";
import type { TemplateType } from "@/types/directus";

const typeLabels: Record<TemplateType, string> = {
  addon: "Addon",
  pipeline: "Pipeline",
  material: "Material",
  tarea: "Tarea",
  usuario: "Usuario",
};

const typeStyles: Record<TemplateType, string> = {
  addon: "bg-brand-yellow/15 text-brand-yellow",
  pipeline: "bg-brand-purple/15 text-brand-purple",
  material: "bg-brand-teal/15 text-brand-teal",
  tarea: "bg-brand-red/10 text-brand-red",
  usuario: "bg-muted text-foreground",
};

export function PlantillasGlobales() {
  const [type, setType] = useState<TemplateType | "all">("all");
  const [sector, setSector] = useState<string>("all");

  const sectorsQ = useSectors();
  const { data, isLoading } = useTemplates({ type, sector });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={type} onValueChange={(v) => setType(v as TemplateType | "all")}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {Object.entries(typeLabels).map(([v, l]) => (
              <SelectItem key={v} value={v}>
                {l}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sector} onValueChange={setSector}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Sector" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los sectores</SelectItem>
            {sectorsQ.data?.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
              </SelectItem>
            )) ?? null}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Sin plantillas"
              description="No hay plantillas que coincidan con los filtros."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead className="hidden md:table-cell">Sector</TableHead>
                <TableHead className="hidden lg:table-cell">Versión</TableHead>
                <TableHead className="hidden lg:table-cell">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <div className="font-medium">{t.name}</div>
                    <div className="font-mono text-xs text-muted-foreground">
                      {t.slug}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${typeStyles[t.type]}`}
                    >
                      {typeLabels[t.type]}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    {t.sector?.name ?? "—"}
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                    v{t.version}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell">
                    <Badge variant={t.is_published ? "success" : "secondary"}>
                      {t.is_published ? "Publicada" : "Borrador"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
