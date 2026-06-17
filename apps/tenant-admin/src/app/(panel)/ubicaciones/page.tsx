"use client";

import * as React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Loader2,
  MapPin,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import { useUbicaciones, useCreateUbicacion, useUpdateUbicacion, useDeleteUbicacion, UBICACION_TIPOS, UBICACION_ESTADOS } from "@/hooks/use-ubicaciones";
import type { Ubicacion, UbicacionTipo, UbicacionEstado } from "@/types/directus";
import { ConfirmDialog } from "@/components/common/confirm-dialog";

const schema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  tipo: z.enum(["sede", "obra", "taller", "local", "otro"]),
  address: z.string().optional(),
  city: z.string().optional(),
  country: z.string().optional(),
  status: z.enum(["active", "inactive", "archived"]),
});
type FormValues = z.infer<typeof schema>;

export default function UbicacionesPage() {
  const [filters, setFilters] = React.useState<{ tipo?: string; status?: string }>({});
  const { data, isLoading, isError, refetch } = useUbicaciones(filters);
  const createMut = useCreateUbicacion();
  const updateMut = useUpdateUbicacion();
  const deleteMut = useDeleteUbicacion();

  const [editing, setEditing] = React.useState<Ubicacion | null>(null);
  const [open, setOpen] = React.useState(false);
  const [toDelete, setToDelete] = React.useState<Ubicacion | null>(null);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: "sede", status: "active" },
  });

  React.useEffect(() => {
    if (editing) {
      form.reset({
        name: editing.name,
        tipo: editing.tipo as UbicacionTipo,
        address: editing.address || "",
        city: editing.city || "",
        country: editing.country || "",
        status: editing.status as UbicacionEstado,
      });
    } else {
      form.reset({ name: "", tipo: "sede", address: "", city: "", country: "", status: "active" });
    }
  }, [editing, form]);

  async function onSubmit(values: FormValues) {
    if (editing) {
      await updateMut.mutateAsync({ id: editing.id, data: values });
      setEditing(null);
      setOpen(false);
    } else {
      await createMut.mutateAsync(values);
      setOpen(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Ubicaciones</h1>
          <p className="text-sm text-muted-foreground">
            Sedes, obras, talleres y locales. Necesarias para crear usuarios externos.
          </p>
        </div>
        <Button variant="brand" onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4" /> Nueva ubicación
        </Button>
      </header>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filters.tipo || "all"}
          onValueChange={(v) => setFilters((f) => ({ ...f, tipo: v === "all" ? undefined : v }))}
        >
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {UBICACION_TIPOS.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.status || "all"}
          onValueChange={(v) => setFilters((f) => ({ ...f, status: v === "all" ? undefined : v }))}
        >
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Estado" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {UBICACION_ESTADOS.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Listado */}
      {isError ? (
        <ErrorState onRetry={() => refetch()} />
      ) : isLoading ? (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title="Aún no hay ubicaciones"
          description="Crea tu primera ubicación para empezar a dar de alta usuarios externos y materiales."
          ctaLabel="Crear primera ubicación"
          onCta={() => { setEditing(null); setOpen(true); }}
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {data.map((u) => (
            <Card key={u.id} className="group">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-purple/10">
                      <MapPin className="h-5 w-5 text-brand-purple" />
                    </div>
                    <div>
                      <p className="font-semibold leading-tight">{u.name}</p>
                      <p className="text-xs text-muted-foreground capitalize">{u.tipo}</p>
                    </div>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${u.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
                    {u.status === "active" ? "Activa" : u.status === "inactive" ? "Inactiva" : "Archivada"}
                  </span>
                </div>
                {u.address ? (
                  <p className="mt-3 text-sm text-muted-foreground">
                    {u.address}
                    {u.city ? ` · ${u.city}` : ""}
                  </p>
                ) : (
                  <p className="mt-3 text-xs italic text-muted-foreground">Sin dirección</p>
                )}
                <div className="mt-3 flex gap-2 border-t pt-3">
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => { setEditing(u); setOpen(true); }}>
                    Editar
                  </Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setToDelete(u)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Formulario en modal */}
      {open ? (
        <FormModal
          open={open}
          onOpenChange={setOpen}
          editing={editing}
          form={form}
          onSubmit={onSubmit}
          submitting={createMut.isPending || updateMut.isPending}
        />
      ) : null}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title="¿Eliminar ubicación?"
        description={`Se eliminará "${toDelete?.name}". Los usuarios externos asignados deberán reasignarse.`}
        confirmLabel="Eliminar"
        onConfirm={async () => {
          if (toDelete) await deleteMut.mutateAsync(toDelete.id);
        }}
      />
    </div>
  );
}

function FormModal({
  open,
  onOpenChange,
  editing,
  form,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Ubicacion | null;
  form: ReturnType<typeof useForm<FormValues>>;
  onSubmit: (v: FormValues) => void | Promise<void>;
  submitting: boolean;
}) {
  const { register, handleSubmit, formState, setValue, watch } = form;
  return (
    <div className={`fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4 ${open ? "" : "hidden"}`}>
      <div className="w-full max-w-lg rounded-t-2xl bg-background p-6 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {editing ? "Editar ubicación" : "Nueva ubicación"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {editing ? "Actualiza los datos de esta ubicación." : "Crea una nueva ubicación para tu organización."}
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input {...register("name")} placeholder="Sede central" />
            {formState.errors.name ? (
              <p className="text-xs text-destructive">{formState.errors.name.message}</p>
            ) : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={watch("tipo")} onValueChange={(v) => setValue("tipo", v as UbicacionTipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UBICACION_TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estado *</Label>
              <Select value={watch("status")} onValueChange={(v) => setValue("status", v as UbicacionEstado)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UBICACION_ESTADOS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Dirección</Label>
            <Input {...register("address")} placeholder="C/ Mayor 1" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ciudad</Label>
              <Input {...register("city")} placeholder="Madrid" />
            </div>
            <div className="space-y-1.5">
              <Label>País</Label>
              <Input {...register("country")} placeholder="España" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" variant="brand" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editing ? "Guardar cambios" : "Crear"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
