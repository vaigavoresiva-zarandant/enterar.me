"use client";

import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2, Plus, Check, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePlanes, useCreatePlan, useUpdatePlan, useDeletePlan } from "@/hooks/use-planes";
import { formatCurrency, cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Plan, PlanCode } from "@/types/directus";
import { PlanBadge } from "@/components/planes/plan-badge";

interface PlanFormState {
  id?: string;
  code: PlanCode;
  name: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  max_users: number;
  max_locations: number;
  max_materials: number;
  max_conversations_per_month: number;
  is_active: boolean;
}

const emptyForm: PlanFormState = {
  code: "starter",
  name: "",
  description: "",
  price_monthly: 0,
  price_yearly: 0,
  max_users: 5,
  max_locations: 1,
  max_materials: 100,
  max_conversations_per_month: 500,
  is_active: true,
};

export function PlanesGrid() {
  const { data, isLoading } = usePlanes();
  const create = useCreatePlan();
  const update = useUpdatePlan();
  const del = useDeletePlan();

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PlanFormState>(emptyForm);

  const openNew = () => {
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (plan: Plan) => {
    setForm({
      id: plan.id,
      code: plan.code,
      name: plan.name,
      description: plan.description ?? "",
      price_monthly: plan.price_monthly,
      price_yearly: plan.price_yearly,
      max_users: plan.max_users,
      max_locations: plan.max_locations,
      max_materials: plan.max_materials,
      max_conversations_per_month: plan.max_conversations_per_month,
      is_active: plan.is_active,
    });
    setOpen(true);
  };

  const submit = async () => {
    try {
      const payload = {
        ...form,
        features: null,
        sort: 0,
      };
      if (form.id) {
        await update.mutateAsync({ id: form.id, patch: payload });
        toast.success("Plan actualizado");
      } else {
        await create.mutateAsync(payload);
        toast.success("Plan creado");
      }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando plan");
    }
  };

  const remove = async (plan: Plan) => {
    if (!confirm(`¿Eliminar el plan "${plan.name}"?`)) return;
    try {
      await del.mutateAsync(plan.id);
      toast.success("Plan eliminado");
    } catch {
      toast.error("No se pudo eliminar el plan");
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-72" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew} variant="brand">
          <Plus className="h-4 w-4" />
          Nuevo plan
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((plan) => (
          <Card key={plan.id} className={cn("flex flex-col", !plan.is_active && "opacity-60")}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {plan.name}
                    <PlanBadge code={plan.code} />
                  </CardTitle>
                  <CardDescription className="mt-1 line-clamp-2">
                    {plan.description || "Sin descripción"}
                  </CardDescription>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(plan)} className="cursor-pointer">
                      <Pencil className="h-4 w-4" />
                      Editar
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => remove(plan)}
                      className="cursor-pointer text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold tracking-tight">
                  {formatCurrency(plan.price_monthly)}
                </span>
                <span className="text-sm text-muted-foreground">/mes</span>
              </div>
              {plan.price_yearly > 0 && (
                <p className="text-xs text-muted-foreground">
                  O {formatCurrency(plan.price_yearly)}/año
                </p>
              )}
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                <LimitRow label="Usuarios" value={plan.max_users} />
                <LimitRow label="Ubicaciones" value={plan.max_locations} />
                <LimitRow label="Materiales" value={plan.max_materials} />
                <LimitRow
                  label="Conversaciones/mes"
                  value={plan.max_conversations_per_month}
                />
              </ul>
            </CardContent>
            <CardFooter>
              <Badge variant={plan.is_active ? "success" : "secondary"}>
                {plan.is_active ? "Activo" : "Inactivo"}
              </Badge>
            </CardFooter>
          </Card>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar plan" : "Nuevo plan"}</DialogTitle>
            <DialogDescription>
              Define los límites y precios del plan.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-4 overflow-y-auto scroll-area pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Código</Label>
                <Select
                  value={form.code}
                  onValueChange={(v) => setForm({ ...form, code: v as PlanCode })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="free">free</SelectItem>
                    <SelectItem value="starter">starter</SelectItem>
                    <SelectItem value="pro">pro</SelectItem>
                    <SelectItem value="enterprise">enterprise</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Precio mensual (€)</Label>
                <Input
                  type="number"
                  value={form.price_monthly}
                  onChange={(e) =>
                    setForm({ ...form, price_monthly: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Precio anual (€)</Label>
                <Input
                  type="number"
                  value={form.price_yearly}
                  onChange={(e) =>
                    setForm({ ...form, price_yearly: Number(e.target.value) })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Usuarios máx.</Label>
                <Input
                  type="number"
                  value={form.max_users}
                  onChange={(e) =>
                    setForm({ ...form, max_users: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Ubicaciones máx.</Label>
                <Input
                  type="number"
                  value={form.max_locations}
                  onChange={(e) =>
                    setForm({ ...form, max_locations: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Materiales máx.</Label>
                <Input
                  type="number"
                  value={form.max_materials}
                  onChange={(e) =>
                    setForm({ ...form, max_materials: Number(e.target.value) })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>Conversaciones/mes</Label>
                <Input
                  type="number"
                  value={form.max_conversations_per_month}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      max_conversations_per_month: Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={form.is_active ? "default" : "outline"}
                size="sm"
                onClick={() => setForm({ ...form, is_active: !form.is_active })}
              >
                {form.is_active ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                {form.is_active ? "Activo" : "Inactivo"}
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              variant="brand"
              onClick={submit}
              disabled={create.isPending || update.isPending || !form.name}
            >
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function LimitRow({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex items-center justify-between">
      <span>{label}</span>
      <span className="font-medium text-foreground">
        {value === 0 ? "Ilimitado" : value.toLocaleString("es-ES")}
      </span>
    </li>
  );
}
