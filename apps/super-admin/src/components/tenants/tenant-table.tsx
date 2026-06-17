"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import {
  Building2,
  MoreHorizontal,
  Pause,
  Play,
  Rocket,
  Search,
  Eye,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState, ErrorState } from "@/components/ui/states";
import { useTenants, useSuspendTenant, useLaunchOnboarding } from "@/hooks/use-tenants";
import { formatDate, formatDateTime, slugify } from "@/lib/utils";
import { toast } from "sonner";
import type { Tenant, TenantStatus, Plan } from "@/types/directus";
import { PlanBadge } from "@/components/planes/plan-badge";

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

interface TenantTableProps {
  plans?: Plan[];
}

export function TenantTable({ plans = [] }: TenantTableProps) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, refetch } = useTenants({
    search,
    status,
    page,
  });

  const suspend = useSuspendTenant();
  const launch = useLaunchOnboarding();

  const planMap = useMemo(() => {
    const m = new Map<string, Plan>();
    plans.forEach((p) => m.set(p.id, p));
    return m;
  }, [plans]);

  const handleSuspend = (t: Tenant) => {
    const next: TenantStatus = t.status === "suspendido" ? "activo" : "suspendido";
    suspend.mutate(
      { id: t.id, status: next },
      {
        onSuccess: () =>
          toast.success(
            next === "suspendido"
              ? `Tenant "${t.name}" suspendido`
              : `Tenant "${t.name}" reactivado`,
          ),
        onError: () => toast.error("No se pudo cambiar el estado"),
      },
    );
  };

  const handleOnboarding = (t: Tenant) => {
    launch.mutate(t.id, {
      onSuccess: (res) => {
        if (res.ok) toast.success(`Onboarding lanzado para "${t.name}"`);
        else toast.error(res.message ?? "Error en onboarding");
      },
      onError: () => toast.error("No se pudo lanzar onboarding"),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative max-w-sm flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, slug o email…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los estados</SelectItem>
              <SelectItem value="activo">Activos</SelectItem>
              <SelectItem value="pendiente">Pendientes</SelectItem>
              <SelectItem value="suspendido">Suspendidos</SelectItem>
              <SelectItem value="cancelado">Cancelados</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button asChild variant="brand">
          <Link href="/tenants/new">
            <Building2 className="h-4 w-4" />
            Nuevo tenant
          </Link>
        </Button>
      </div>

      <div className="rounded-lg border bg-card">
        {isError ? (
          <div className="p-4">
            <ErrorState onRetry={() => refetch()} />
          </div>
        ) : isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !data || data.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={<Building2 className="h-6 w-6" />}
              title="No hay tenants"
              description="Crea el primer tenant para empezar a usar ENTERAR.ME."
              action={
                <Button asChild variant="brand">
                  <Link href="/tenants/new">Crear tenant</Link>
                </Button>
              }
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden md:table-cell">Slug</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden lg:table-cell">Alta</TableHead>
                <TableHead className="hidden xl:table-cell">Última actividad</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((t) => {
                const plan = t.plan ?? (t.plan_id ? planMap.get(t.plan_id) : undefined);
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Link
                        href={`/tenants/${t.id}`}
                        className="group flex items-center gap-3"
                      >
                        <div className="flex h-9 w-9 items-center justify-center rounded-md bg-brand-red/10 text-brand-red">
                          <Building2 className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground group-hover:text-primary">
                            {t.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {t.admin_email ?? "—"}
                          </p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                      {t.slug}
                    </TableCell>
                    <TableCell>
                      {plan ? (
                        <PlanBadge code={plan.code} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[t.status]}>
                        {statusLabel[t.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                      {formatDate(t.date_created)}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground xl:table-cell">
                      {formatDateTime(t.last_activity)}
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuLabel>Acciones</DropdownMenuLabel>
                          <DropdownMenuItem asChild>
                            <Link href={`/tenants/${t.id}`} className="cursor-pointer">
                              <Eye className="h-4 w-4" />
                              Ver detalle
                            </Link>
                          </DropdownMenuItem>
                          {t.status === "pendiente" && (
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() => handleOnboarding(t)}
                              disabled={launch.isPending}
                            >
                              <Rocket className="h-4 w-4" />
                              Lanzar onboarding
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() => handleSuspend(t)}
                            disabled={suspend.isPending}
                          >
                            {t.status === "suspendido" ? (
                              <>
                                <Play className="h-4 w-4" />
                                Reactivar
                              </>
                            ) : (
                              <>
                                <Pause className="h-4 w-4" />
                                Suspender
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Paginación simple */}
      {!isLoading && data && data.length > 0 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Página {page} · {data.length} resultado(s)
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={data.length < 20}
              onClick={() => setPage((p) => p + 1)}
            >
              Siguiente
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Helper exportado para previsualizar slugs */
export { slugify };
