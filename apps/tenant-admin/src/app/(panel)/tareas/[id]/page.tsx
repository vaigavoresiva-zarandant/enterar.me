"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft, MapPin, User, Calendar, Package, Activity, ListChecks,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/error-state";
import { useTarea, useTareaEventos, TAREA_ESTADOS, TAREA_PRIORIDADES } from "@/hooks/use-tareas";
import type { EventoTarea, EventoTareaTipo, TareaEstado, TareaPrioridad } from "@/types/directus";
import { formatDateTime, formatDate } from "@/lib/utils";

const PRIORIDAD_BADGE: Record<TareaPrioridad, "secondary" | "accent" | "warning" | "red"> = {
  baja: "secondary",
  media: "accent",
  alta: "warning",
  critica: "red",
};

const EVENTO_LABEL: Record<EventoTareaTipo, string> = {
  creada: "Creada",
  iniciada: "Iniciada",
  pausada: "Pausada",
  completada: "Completada",
  cancelada: "Cancelada",
  material_consumido: "Material consumido",
  comentario: "Comentario",
  asignacion: "Asignación",
};

const EVENTO_BADGE: Record<EventoTareaTipo, string> = {
  creada: "bg-brand-teal/15 text-brand-teal",
  iniciada: "bg-brand-purple/15 text-brand-purple",
  pausada: "bg-warning/15 text-warning-foreground",
  completada: "bg-success/15 text-success",
  cancelada: "bg-destructive/15 text-destructive",
  material_consumido: "bg-brand-yellow/15 text-brand-yellow",
  comentario: "bg-muted text-muted-foreground",
  asignacion: "bg-secondary text-secondary-foreground",
};

export default function TareaDetallePage() {
  const params = useParams();
  const id = params.id as string;
  const tareaQ = useTarea(id);
  const eventosQ = useTareaEventos(id);

  return (
    <div className="space-y-6">
      <header>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link href="/tareas">
            <ArrowLeft className="h-4 w-4" /> Volver a tareas
          </Link>
        </Button>
        {tareaQ.isLoading ? (
          <Skeleton className="h-8 w-72" />
        ) : tareaQ.data ? (
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight">{tareaQ.data.title}</h1>
            <Badge variant={TAREA_ESTADOS.find((e) => e.value === tareaQ.data!.estado)?.color as any}>
              {TAREA_ESTADOS.find((e) => e.value === tareaQ.data!.estado)?.label}
            </Badge>
            <Badge variant={PRIORIDAD_BADGE[tareaQ.data.prioridad]}>
              {tareaQ.data.prioridad}
            </Badge>
          </div>
        ) : null}
      </header>

      {tareaQ.isError ? (
        <ErrorState onRetry={() => tareaQ.refetch()} />
      ) : tareaQ.isLoading ? (
        <Skeleton className="h-48" />
      ) : tareaQ.data ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm">Descripción</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-foreground/90 whitespace-pre-wrap">
                {tareaQ.data.description || "Sin descripción."}
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <InfoRow icon={MapPin} label="Ubicación">
                  {tareaQ.data.ubicacion?.name || "—"}
                </InfoRow>
                <InfoRow icon={User} label="Usuario externo">
                  {tareaQ.data.user_externo?.name || "—"}
                </InfoRow>
                <InfoRow icon={User} label="Usuario interno">
                  {tareaQ.data.user_interno
                    ? `${tareaQ.data.user_interno.first_name} ${tareaQ.data.user_interno.last_name}`
                    : "Sin asignar"}
                </InfoRow>
                <InfoRow icon={Calendar} label="Fecha límite">
                  {formatDate(tareaQ.data.due_date)}
                </InfoRow>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Materiales asignados</CardTitle>
              <CardDescription>Planificados y consumidos.</CardDescription>
            </CardHeader>
            <CardContent>
              {!tareaQ.data.materials || tareaQ.data.materials.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Sin materiales asignados a esta tarea.
                </p>
              ) : (
                <ul className="space-y-2">
                  {tareaQ.data.materials.map((tm) => (
                    <li
                      key={tm.id}
                      className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-brand-purple" />
                        <span className="font-medium">{tm.material?.name}</span>
                      </div>
                      <div className="text-right text-xs text-muted-foreground">
                        <p>Plan: <span className="text-foreground">{tm.cantidad_planificada}</span></p>
                        <p>Consumido: <span className="text-foreground">{tm.cantidad_consumida ?? 0}</span></p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <Activity className="h-4 w-4 text-brand-purple" />
                Trazabilidad — Eventos de la tarea
              </CardTitle>
              <CardDescription>
                Cada evento queda registrado con ubicación + momento.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {eventosQ.isError ? (
                <ErrorState onRetry={() => eventosQ.refetch()} />
              ) : eventosQ.isLoading ? (
                <Skeleton className="h-48" />
              ) : !eventosQ.data || eventosQ.data.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  Aún no hay eventos registrados.
                </p>
              ) : (
                <Timeline eventos={eventosQ.data} />
              )}
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

function InfoRow({
  icon: Icon, label, children,
}: {
  icon: React.ElementType;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
      <Icon className="mt-0.5 h-4 w-4 text-brand-purple" />
      <div className="min-w-0 flex-1">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{children}</p>
      </div>
    </div>
  );
}

function Timeline({ eventos }: { eventos: EventoTarea[] }) {
  return (
    <ol className="relative max-h-[32rem] overflow-y-auto border-l-2 border-muted pl-5">
      {eventos.map((ev) => (
        <li key={ev.id} className="mb-5 last:mb-0">
          <span className={`absolute -left-[11px] flex h-5 w-5 items-center justify-center rounded-full ${EVENTO_BADGE[ev.tipo]}`}>
            <span className="h-1.5 w-1.5 rounded-full bg-current" />
          </span>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-sm font-medium">
                <Badge className={`mr-2 ${EVENTO_BADGE[ev.tipo]}`}>
                  {EVENTO_LABEL[ev.tipo]}
                </Badge>
              </p>
              {ev.notas ? (
                <p className="mt-1 text-xs text-muted-foreground">{ev.notas}</p>
              ) : null}
              {ev.user_interno ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  Por {ev.user_interno.first_name} {ev.user_interno.last_name}
                </p>
              ) : null}
            </div>
            <div className="text-right text-xs text-muted-foreground">
              <p className="font-medium text-foreground">{formatDateTime(ev.created_at)}</p>
            </div>
          </div>
        </li>
      ))}
    </ol>
  );
}
