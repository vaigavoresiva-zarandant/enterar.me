"use client";

import Link from "next/link";
import { ArrowLeft, Building2, Rocket, Users, MapPin, Calendar, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTenant, useLaunchOnboarding } from "@/hooks/use-tenants";
import { usePlanes } from "@/hooks/use-planes";
import { PlanBadge } from "@/components/planes/plan-badge";
import { formatDate, formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import type { TenantStatus } from "@/types/directus";

const statusVariant: Record<TenantStatus, "success" | "warning" | "destructive" | "secondary"> = {
  activo: "success",
  pendiente: "warning",
  suspendido: "destructive",
  cancelado: "secondary",
};
const statusLabel: Record<TenantStatus, string> = {
  activo: "Activo",
  pendiente: "Pendiente",
  suspendido: "Suspendido",
  cancelado: "Cancelado",
};

export function TenantDetail({ id }: { id: string }) {
  const { data: tenant, isLoading, isError, refetch } = useTenant(id);
  const launch = useLaunchOnboarding();
  const plansQ = usePlanes();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (isError || !tenant) {
    return (
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm">
          <Link href="/tenants">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
        <p className="text-muted-foreground">No se pudo cargar el tenant.</p>
      </div>
    );
  }

  const handleOnboarding = () => {
    launch.mutate(tenant.id, {
      onSuccess: (res) => {
        if (res.ok) {
          toast.success("Onboarding lanzado correctamente");
          refetch();
        } else {
          toast.error(res.message ?? "Error en onboarding");
        }
      },
      onError: () => toast.error("No se pudo lanzar el onboarding"),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Button asChild variant="ghost" size="icon">
            <Link href="/tenants">
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{tenant.name}</h1>
            <p className="font-mono text-xs text-muted-foreground">{tenant.slug}</p>
          </div>
          <Badge variant={statusVariant[tenant.status]}>
            {statusLabel[tenant.status]}
          </Badge>
        </div>
        {tenant.status === "pendiente" && (
          <Button onClick={handleOnboarding} variant="brand" disabled={launch.isPending}>
            <Rocket className="h-4 w-4" />
            Lanzar onboarding
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Usuarios</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Users className="h-5 w-5 text-muted-foreground" />
              {(tenant as { users_count?: number }).users_count ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Ubicaciones</CardDescription>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <MapPin className="h-5 w-5 text-muted-foreground" />
              {(tenant as { locations_count?: number }).locations_count ?? 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Última actividad</CardDescription>
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              {formatDateTime(tenant.last_activity)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-brand-red" />
              Datos del tenant
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <DetailRow label="Nombre" value={tenant.name} />
            <DetailRow label="Slug" value={tenant.slug} mono />
            <DetailRow
              label="Email admin"
              value={
                tenant.admin_email ? (
                  <a
                    href={`mailto:${tenant.admin_email}`}
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    <Mail className="h-3 w-3" />
                    {tenant.admin_email}
                  </a>
                ) : "—"
              }
            />
            <DetailRow label="País" value={tenant.country ?? "—"} />
            <DetailRow label="Ciudad" value={tenant.city ?? "—"} />
            <DetailRow label="Zona horaria" value={tenant.timezone ?? "—"} />
            <DetailRow label="Fecha de alta" value={formatDate(tenant.date_created)} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Suscripción</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <DetailRow
              label="Plan"
              value={
                tenant.plan ? (
                  <PlanBadge code={tenant.plan.code} />
                ) : (
                  plansQ.data?.find((p) => p.id === tenant.plan_id)?.name ?? "—"
                )
              }
            />
            <DetailRow label="Sector" value={tenant.sector?.name ?? "—"} />
            <DetailRow
              label="Estado"
              value={<Badge variant={statusVariant[tenant.status]}>{statusLabel[tenant.status]}</Badge>}
            />
            <DetailRow
              label="Actualizado"
              value={formatDateTime(tenant.date_updated)}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  mono,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b pb-2 last:border-0 last:pb-0">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right font-medium ${mono ? "font-mono text-xs" : ""}`}>
        {value}
      </span>
    </div>
  );
}
