"use client";

import * as React from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Package, Trash2, Loader2, Save, AlertCircle, ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { useUsuariosExternos } from "@/hooks/use-usuarios-externos";
import { useMateriales, useCreateMaterial, useUpdateMaterial, useDeleteMaterial, MAT_TIPOS } from "@/hooks/use-materiales";
import type { Material, MaterialTipo } from "@/types/directus";
import { formatCurrency } from "@/lib/utils";

const schema = z.object({
  name: z.string().min(2, "Mínimo 2 caracteres"),
  tipo: z.enum(["fungible", "no_fungible"]),
  sku: z.string().optional(),
  unit: z.string().min(1, "Requerido"),
  cost: z.coerce.number().min(0).optional(),
  user_externo_id: z.string().min(1, "Requerido"),
  stock_total: z.coerce.number().default(0),
  stock_min: z.coerce.number().optional(),
});
type FormValues = z.infer<typeof schema>;

export default function MaterialesPage() {
  const [tab, setTab] = React.useState<"all" | MaterialTipo>("all");
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Material | null>(null);
  const [toDelete, setToDelete] = React.useState<Material | null>(null);

  const usuariosQ = useUsuariosExternos();
  const materialesQ = useMateriales({ tipo: tab === "all" ? undefined : tab });
  const createMut = useCreateMaterial();
  const updateMut = useUpdateMaterial();
  const deleteMut = useDeleteMaterial();

  const noUsuarios = (usuariosQ.data?.length ?? 0) === 0;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { tipo: "fungible", unit: "ud", stock_total: 0 },
  });

  React.useEffect(() => {
    if (editing) {
      form.reset({
        name: editing.name,
        tipo: editing.tipo as MaterialTipo,
        sku: editing.sku || "",
        unit: editing.unit,
        cost: editing.cost ?? 0,
        user_externo_id: editing.user_externo_id,
        stock_total: editing.stock_total,
        stock_min: editing.stock_min ?? 0,
      });
    } else {
      form.reset({
        name: "",
        tipo: "fungible",
        sku: "",
        unit: "ud",
        cost: 0,
        user_externo_id: usuariosQ.data?.[0]?.id || "",
        stock_total: 0,
        stock_min: 0,
      });
    }
  }, [editing, form, usuariosQ.data]);

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
          <h1 className="text-2xl font-bold tracking-tight">Materiales</h1>
          <p className="text-sm text-muted-foreground">
            Fungibles y no fungibles. Cada material se asigna a un usuario externo.
          </p>
        </div>
        <Button
          variant="brand"
          onClick={() => { setEditing(null); setOpen(true); }}
          disabled={noUsuarios}
          title={noUsuarios ? "Primero crea un usuario externo" : undefined}
        >
          <Plus className="h-4 w-4" /> Nuevo material
        </Button>
      </header>

      {noUsuarios ? (
        <EmptyState
          icon={AlertCircle}
          title="Primero crea un usuario externo"
          description="Todo material debe estar asignado a un usuario externo. Crea uno antes de dar de alta materiales."
          ctaHref="/usuarios-externos"
          ctaLabel="Ir a Usuarios externos"
        />
      ) : null}

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="all">Todos</TabsTrigger>
          <TabsTrigger value="fungible">Fungibles</TabsTrigger>
          <TabsTrigger value="no_fungible">No fungibles</TabsTrigger>
        </TabsList>
        <TabsContent value={tab}>
          {materialesQ.isError ? (
            <ErrorState onRetry={() => materialesQ.refetch()} />
          ) : materialesQ.isLoading ? (
            <Skeleton className="h-72" />
          ) : !materialesQ.data || materialesQ.data.length === 0 ? (
            <EmptyState
              icon={Package}
              title="Sin materiales en esta vista"
              description="Crea tu primer material para empezar a controlar el stock."
              ctaLabel="Crear material"
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
                      <TableHead className="hidden md:table-cell">SKU</TableHead>
                      <TableHead>Unidad</TableHead>
                      <TableHead className="hidden lg:table-cell">Costo</TableHead>
                      <TableHead className="hidden lg:table-cell">Usuario externo</TableHead>
                      <TableHead>Stock</TableHead>
                      <TableHead className="text-right">Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {materialesQ.data.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-medium">
                          <Link href={`/materiales/${m.id}`} className="hover:underline">
                            {m.name}
                          </Link>
                        </TableCell>
                        <TableCell>
                          <Badge variant={m.tipo === "fungible" ? "yellow" : "purple"}>
                            {m.tipo === "fungible" ? "Fungible" : "No fungible"}
                          </Badge>
                        </TableCell>
                        <TableCell className="hidden md:table-cell font-mono text-xs">{m.sku || "—"}</TableCell>
                        <TableCell className="text-sm">{m.unit}</TableCell>
                        <TableCell className="hidden lg:table-cell text-sm">{formatCurrency(m.cost)}</TableCell>
                        <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                          {m.user_externo?.name || "—"}
                        </TableCell>
                        <TableCell>
                          <span className={`font-medium ${m.stock_min && m.stock_total < m.stock_min ? "text-destructive" : ""}`}>
                            {m.stock_total}
                          </span>
                          <span className="text-xs text-muted-foreground"> {m.unit}</span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button asChild size="sm" variant="ghost">
                              <Link href={`/materiales/${m.id}`}>
                                <ArrowRight className="h-4 w-4" />
                              </Link>
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => { setEditing(m); setOpen(true); }}>
                              Editar
                            </Button>
                            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setToDelete(m)}>
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
        </TabsContent>
      </Tabs>

      {open ? (
        <FormModal
          open={open}
          onOpenChange={setOpen}
          editing={editing}
          form={form}
          onSubmit={onSubmit}
          submitting={createMut.isPending || updateMut.isPending}
          usuarios={usuariosQ.data || []}
        />
      ) : null}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title="¿Eliminar material?"
        description={`Se eliminará "${toDelete?.name}". La trazabilidad histórica se mantendrá.`}
        confirmLabel="Eliminar"
        onConfirm={async () => {
          if (toDelete) await deleteMut.mutateAsync(toDelete.id);
        }}
      />
    </div>
  );
}

function FormModal({
  open, onOpenChange, editing, form, onSubmit, submitting, usuarios,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Material | null;
  form: ReturnType<typeof useForm<FormValues>>;
  onSubmit: (v: FormValues) => void | Promise<void>;
  submitting: boolean;
  usuarios: { id: string; name: string }[];
}) {
  const { register, handleSubmit, formState, setValue, watch } = form;
  return (
    <div className={`fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4 ${open ? "" : "hidden"}`}>
      <div className="w-full max-w-lg rounded-t-2xl bg-background p-6 shadow-xl sm:rounded-2xl">
        <h2 className="mb-4 text-lg font-semibold">
          {editing ? "Editar material" : "Nuevo material"}
        </h2>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Nombre *</Label>
            <Input {...register("name")} placeholder="Cemento Portland 25kg" />
            {formState.errors.name ? <p className="text-xs text-destructive">{formState.errors.name.message}</p> : null}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Tipo *</Label>
              <Select value={watch("tipo")} onValueChange={(v) => setValue("tipo", v as MaterialTipo)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MAT_TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Unidad *</Label>
              <Select value={watch("unit")} onValueChange={(v) => setValue("unit", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ud">ud</SelectItem>
                  <SelectItem value="kg">kg</SelectItem>
                  <SelectItem value="m">m</SelectItem>
                  <SelectItem value="m2">m²</SelectItem>
                  <SelectItem value="l">l</SelectItem>
                  <SelectItem value="caja">caja</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>SKU</Label>
              <Input {...register("sku")} placeholder="CEM-25" />
            </div>
            <div className="space-y-1.5">
              <Label>Costo unitario (€)</Label>
              <Input type="number" step="0.01" {...register("cost")} placeholder="5.50" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Stock total</Label>
              <Input type="number" {...register("stock_total")} />
            </div>
            <div className="space-y-1.5">
              <Label>Stock mínimo</Label>
              <Input type="number" {...register("stock_min")} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Usuario externo *</Label>
            <Select value={watch("user_externo_id")} onValueChange={(v) => setValue("user_externo_id", v)}>
              <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
              <SelectContent>
                {usuarios.map((u) => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {formState.errors.user_externo_id ? <p className="text-xs text-destructive">{formState.errors.user_externo_id.message}</p> : null}
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
