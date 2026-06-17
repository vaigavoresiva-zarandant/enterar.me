"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Users, Loader2, Save, AlertCircle, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useUbicaciones } from "@/hooks/use-ubicaciones";
import {
  useUsuariosExternos,
  useCreateUsuarioExterno,
  useUpdateUsuarioExterno,
  useDeleteUsuarioExterno,
  UE_TYPES,
} from "@/hooks/use-usuarios-externos";
import type { UserExternal, ExternalType } from "@/types/directus";

const schema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  type: z.enum(["cliente", "proveedor", "interno"]),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  ubicacion_id: z.string().min(1, "Requerido"),
  status: z.enum(["active", "inactive"]),
});
type FormValues = z.infer<typeof schema>;

export default function UsuariosExternosPage() {
  const [filters, setFilters] = React.useState<{ type?: string; ubicacion_id?: string }>({});
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<UserExternal | null>(null);
  const [toDelete, setToDelete] = React.useState<UserExternal | null>(null);

  const ubicacionesQ = useUbicaciones();
  const usersQ = useUsuariosExternos(filters);
  const createMut = useCreateUsuarioExterno();
  const updateMut = useUpdateUsuarioExterno();
  const deleteMut = useDeleteUsuarioExterno();

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: "cliente", status: "active" },
  });

  React.useEffect(() => {
    if (editing) {
      form.reset({
        name: editing.name,
        type: editing.type as ExternalType,
        email: editing.email || "",
        phone: editing.phone || "",
        ubicacion_id: editing.ubicacion_id,
        status: editing.status as "active" | "inactive",
      });
    } else {
      form.reset({
        name: "",
        type: "cliente",
        email: "",
        phone: "",
        ubicacion_id: ubicacionesQ.data?.[0]?.id || "",
        status: "active",
      });
    }
  }, [editing, form, ubicacionesQ.data]);

  const noUbicaciones = (ubicacionesQ.data?.length ?? 0) === 0;

  async function onSubmit(values: FormValues) {
    const payload = { ...values, email: values.email || undefined };
    if (editing) {
      await updateMut.mutateAsync({ id: editing.id, data: payload });
      setEditing(null);
      setOpen(false);
    } else {
      await createMut.mutateAsync(payload);
      setOpen(false);
    }
  }

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Usuarios externos</h1>
          <p className="text-sm text-muted-foreground">
            Clientes y proveedores. Requieren una ubicación asignada.
          </p>
        </div>
        <Button
          variant="brand"
          onClick={() => { setEditing(null); setOpen(true); }}
          disabled={noUbicaciones}
          title={noUbicaciones ? "Primero crea una ubicación" : undefined}
        >
          <Plus className="h-4 w-4" /> Nuevo usuario externo
        </Button>
      </header>

      {noUbicaciones ? (
        <EmptyState
          icon={AlertCircle}
          title="Primero crea una ubicación"
          description="Para dar de alta usuarios externos necesitas al menos una ubicación. Es un prerrequisito obligatorio del sistema."
          ctaHref="/ubicaciones"
          ctaLabel="Ir a Ubicaciones"
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={filters.type || "all"}
          onValueChange={(v) => setFilters((f) => ({ ...f, type: v === "all" ? undefined : v }))}
        >
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los tipos</SelectItem>
            {UE_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.ubicacion_id || "all"}
          onValueChange={(v) => setFilters((f) => ({ ...f, ubicacion_id: v === "all" ? undefined : v }))}
        >
          <SelectTrigger className="w-[240px]"><SelectValue placeholder="Ubicación" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas las ubicaciones</SelectItem>
            {ubicacionesQ.data?.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {usersQ.isError ? (
        <ErrorState onRetry={() => usersQ.refetch()} />
      ) : usersQ.isLoading ? (
        <Skeleton className="h-72" />
      ) : !usersQ.data || usersQ.data.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Aún no hay usuarios externos"
          description="Crea clientes o proveedores y asígnales una ubicación para poder gestionar materiales."
          ctaLabel="Crear primer usuario externo"
          onCta={() => { setEditing(null); setOpen(true); }}
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="hidden md:table-cell">Ubicación</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {usersQ.data.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>
                      <Badge
                        variant={u.type === "cliente" ? "accent" : u.type === "proveedor" ? "purple" : "secondary"}
                      >
                        {u.type}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{u.email || "—"}</TableCell>
                    <TableCell className="hidden md:table-cell">
                      <span className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                        <MapPin className="h-3.5 w-3.5" />
                        {u.ubicacion?.name || "—"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={u.status === "active" ? "success" : "secondary"}>
                        {u.status === "active" ? "Activo" : "Inactivo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button size="sm" variant="ghost" onClick={() => { setEditing(u); setOpen(true); }}>
                          Editar
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setToDelete(u)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {open ? (
        <FormModal
          open={open}
          onOpenChange={setOpen}
          editing={editing}
          form={form}
          onSubmit={onSubmit}
          submitting={createMut.isPending || updateMut.isPending}
          ubicaciones={ubicacionesQ.data || []}
        />
      ) : null}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title="¿Eliminar usuario externo?"
        description={`Se eliminará "${toDelete?.name}". Los materiales asignados deberán reasignarse.`}
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
  ubicaciones,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: UserExternal | null;
  form: ReturnType<typeof useForm<FormValues>>;
  onSubmit: (v: FormValues) => void | Promise<void>;
  submitting: boolean;
  ubicaciones: { id: string; name: string }[];
}) {
  const { register, handleSubmit, formState, setValue, watch } = form;
  return (
    <div className={`fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4 ${open ? "" : "hidden"}`}>
      <div className="w-full max-w-lg rounded-t-2xl bg-background p-6 shadow-xl sm:rounded-2xl">
        <h2 className="mb-4 text-lg font-semibold">
          {editing ? "Editar usuario externo" : "Nuevo usuario externo"}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre / razón social *</Label>
            <Input {...register("name")} placeholder="Constructora Pepe S.L." />
            {formState.errors.name ? <p className="text-xs text-destructive">{formState.errors.name.message}</p> : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={watch("type")} onValueChange={(v) => setValue("type", v as ExternalType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {UE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Estado *</Label>
              <Select value={watch("status")} onValueChange={(v) => setValue("status", v as "active" | "inactive")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Activo</SelectItem>
                  <SelectItem value="inactive">Inactivo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" {...register("email")} placeholder="contacto@empresa.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Teléfono</Label>
              <Input {...register("phone")} placeholder="600 000 000" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Ubicación *</Label>
            <Select value={watch("ubicacion_id")} onValueChange={(v) => setValue("ubicacion_id", v)}>
              <SelectTrigger><SelectValue placeholder="Selecciona ubicación" /></SelectTrigger>
              <SelectContent>
                {ubicaciones.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formState.errors.ubicacion_id ? <p className="text-xs text-destructive">{formState.errors.ubicacion_id.message}</p> : null}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" variant="brand" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {editing ? "Guardar" : "Crear"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
