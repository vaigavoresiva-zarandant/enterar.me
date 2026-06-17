"use client";

import { useMemo, useState } from "react";
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
import { EmptyState, ErrorState } from "@/components/ui/states";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery } from "@tanstack/react-query";
import { formatDate, formatCurrency } from "@/lib/utils";
import { PlanBadge } from "@/components/planes/plan-badge";
import type { Subscription, SubscriptionStatus, Plan } from "@/types/directus";

const statusVariant: Record<SubscriptionStatus, "success" | "warning" | "destructive" | "secondary" | "info"> = {
  activa: "success",
  trialing: "info",
  past_due: "warning",
  cancelada: "destructive",
  pausada: "secondary",
};
const statusLabel: Record<SubscriptionStatus, string> = {
  activa: "Activa",
  trialing: "Trial",
  past_due: "Pago pendiente",
  cancelada: "Cancelada",
  pausada: "Pausada",
};

export function SuscripcionesTable({
  subscriptions,
  plans,
  isLoading,
  isError,
  onRetry,
}: {
  subscriptions: Subscription[];
  plans: Plan[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
}) {
  const [planFilter, setPlanFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const planMap = useMemo(() => {
    const m = new Map<string, Plan>();
    plans.forEach((p) => m.set(p.id, p));
    return m;
  }, [plans]);

  const filtered = useMemo(() => {
    return subscriptions.filter((s) => {
      if (planFilter !== "all" && s.plan_id !== planFilter) return false;
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      return true;
    });
  }, [subscriptions, planFilter, statusFilter]);

  if (isError) {
    return (
      <div className="rounded-lg border bg-card p-4">
        <ErrorState onRetry={onRetry} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select value={planFilter} onValueChange={setPlanFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Plan" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los planes</SelectItem>
            {plans.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="activa">Activas</SelectItem>
            <SelectItem value="trialing">Trial</SelectItem>
            <SelectItem value="past_due">Pago pendiente</SelectItem>
            <SelectItem value="pausada">Pausadas</SelectItem>
            <SelectItem value="cancelada">Canceladas</SelectItem>
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
        ) : filtered.length === 0 ? (
          <div className="p-4">
            <EmptyState
              title="Sin suscripciones"
              description="No hay suscripciones que coincidan con los filtros."
            />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tenant</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="hidden md:table-cell">Ciclo</TableHead>
                <TableHead className="hidden lg:table-cell">Próxima factura</TableHead>
                <TableHead className="hidden lg:table-cell">Importe</TableHead>
                <TableHead className="hidden xl:table-cell">Método pago</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const plan = s.plan ?? planMap.get(s.plan_id);
                return (
                  <TableRow key={s.id}>
                    <TableCell>
                      <div className="font-medium">{s.tenant?.name ?? "—"}</div>
                      <div className="font-mono text-xs text-muted-foreground">
                        {s.tenant?.slug ?? ""}
                      </div>
                    </TableCell>
                    <TableCell>
                      {plan ? <PlanBadge code={plan.code} /> : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant[s.status]}>
                        {statusLabel[s.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                      {s.billing_cycle === "monthly" ? "Mensual" : "Anual"}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">
                      {formatDate(s.current_period_end)}
                    </TableCell>
                    <TableCell className="hidden font-medium lg:table-cell">
                      {formatCurrency(s.amount, s.currency)}
                    </TableCell>
                    <TableCell className="hidden text-sm text-muted-foreground xl:table-cell">
                      {s.payment_method ?? "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}

/** Wrapper que carga suscripciones vía /api/suscripciones */
export function SuscripcionesTableWithData() {
  const subsQ = useQuery({
    queryKey: ["suscripciones"],
    queryFn: async () => {
      const res = await fetch("/api/suscripciones");
      if (!res.ok) throw new Error("Error");
      return (await res.json()) as Subscription[];
    },
  });
  const plansQ = useQuery({
    queryKey: ["planes"],
    queryFn: async () => {
      const res = await fetch("/api/planes");
      if (!res.ok) throw new Error("Error");
      return (await res.json()) as Plan[];
    },
  });

  return (
    <SuscripcionesTable
      subscriptions={subsQ.data ?? []}
      plans={plansQ.data ?? []}
      isLoading={subsQ.isLoading}
      isError={subsQ.isError}
      onRetry={() => subsQ.refetch()}
    />
  );
}
