"use client";

import Link from "next/link";
import { useState } from "react";
import { MoreHorizontal, Pencil, Trash2, Plus, FileText, Package } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/states";
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
  useSectors,
  useCreateSector,
  useUpdateSector,
  useDeleteSector,
} from "@/hooks/use-marketplace";
import { slugify } from "@/lib/utils";
import { toast } from "sonner";
import type { Sector } from "@/types/directus";

const sectorColors = ["brand-red", "brand-yellow", "brand-purple", "brand-teal"] as const;

interface FormState {
  id?: string;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  is_published: boolean;
}

const emptyForm: FormState = {
  name: "",
  slug: "",
  description: "",
  icon: "Package",
  color: "brand-purple",
  is_published: true,
};

export function SectorGrid() {
  const { data, isLoading } = useSectors();
  const create = useCreateSector();
  const update = useUpdateSector();
  const del = useDeleteSector();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const openNew = () => {
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (s: Sector) => {
    setForm({
      id: s.id,
      name: s.name,
      slug: s.slug,
      description: s.description ?? "",
      icon: s.icon ?? "Package",
      color: s.color ?? "brand-purple",
      is_published: s.is_published,
    });
    setOpen(true);
  };

  const submit = async () => {
    const payload = {
      ...form,
      sort: 0,
    };
    try {
      if (form.id) {
        await update.mutateAsync({ id: form.id, patch: payload });
        toast.success("Sector actualizado");
      } else {
        await create.mutateAsync(payload);
        toast.success("Sector creado");
      }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando sector");
    }
  };

  const remove = async (s: Sector) => {
    if (!confirm(`¿Eliminar el sector "${s.name}"?`)) return;
    try {
      await del.mutateAsync(s.id);
      toast.success("Sector eliminado");
    } catch {
      toast.error("No se pudo eliminar");
    }
  };

  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-44" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew} variant="brand">
          <Plus className="h-4 w-4" />
          Nuevo sector
        </Button>
      </div>

      {!data || data.length === 0 ? (
        <EmptyState
          icon={<Package className="h-6 w-6" />}
          title="Sin sectores"
          description="Crea el primer sector del marketplace."
          action={
            <Button onClick={openNew} variant="brand">
              Crear sector
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((s) => {
            const colorClass =
              s.color && sectorColors.includes(s.color as never)
                ? `bg-${s.color}/10 text-${s.color}`
                : "bg-brand-purple/10 text-brand-purple";
            return (
              <Card key={s.id} className="group">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <Link
                      href={`/marketplace/sectores/${s.id}`}
                      className="flex items-start gap-3"
                    >
                      <div
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${colorClass}`}
                      >
                        <Package className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base group-hover:text-primary">
                          {s.name}
                        </CardTitle>
                        <CardDescription className="font-mono text-xs">
                          {s.slug}
                        </CardDescription>
                      </div>
                    </Link>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/marketplace/sectores/${s.id}`} className="cursor-pointer">
                            <FileText className="h-4 w-4" />
                            Ver plantillas
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => openEdit(s)}
                          className="cursor-pointer"
                        >
                          <Pencil className="h-4 w-4" />
                          Editar
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => remove(s)}
                          className="cursor-pointer text-destructive focus:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="line-clamp-2 text-sm text-muted-foreground">
                    {s.description || "Sin descripción"}
                  </p>
                  <div className="flex items-center justify-between">
                    <Badge variant={s.is_published ? "success" : "secondary"}>
                      {s.is_published ? "Publicado" : "Borrador"}
                    </Badge>
                    <Link
                      href={`/marketplace/sectores/${s.id}`}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      Ver plantillas →
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar sector" : "Nuevo sector"}</DialogTitle>
            <DialogDescription>
              Define el sector del marketplace.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) => {
                  const name = e.target.value;
                  setForm({
                    ...form,
                    name,
                    slug: form.id ? form.slug : slugify(name),
                  });
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input
                value={form.slug}
                onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
              />
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {sectorColors.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setForm({ ...form, color: c })}
                    className={`h-8 w-8 rounded-full bg-${c} ${
                      form.color === c ? "ring-2 ring-offset-2 ring-foreground" : ""
                    }`}
                    aria-label={`Color ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="brand" onClick={submit} disabled={!form.name}>
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
