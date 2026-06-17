"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Save, Trash2, Pencil, Plus, AlertTriangle } from "lucide-react";
import {
  useTemplatesBySector,
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
} from "@/hooks/use-marketplace";
import type { MarketplaceTemplate, TemplateType } from "@/types/directus";
import { toast } from "sonner";

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
  usuario: "bg-brand-gray/10 text-foreground",
};

interface FormState {
  id?: string;
  name: string;
  slug: string;
  description: string;
  type: TemplateType;
  config: string;
  is_published: boolean;
  version: string;
}

const emptyForm: FormState = {
  name: "",
  slug: "",
  description: "",
  type: "addon",
  config: '{\n  "key": "value"\n}',
  is_published: true,
  version: "1.0.0",
};

export function PlantillaEditor({ sectorId }: { sectorId: string }) {
  const { data, isLoading } = useTemplatesBySector(sectorId);
  const create = useCreateTemplate();
  const update = useUpdateTemplate();
  const del = useDeleteTemplate();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [configError, setConfigError] = useState<string | null>(null);

  const openNew = () => {
    setForm(emptyForm);
    setConfigError(null);
    setOpen(true);
  };

  const openEdit = (t: MarketplaceTemplate) => {
    setForm({
      id: t.id,
      name: t.name,
      slug: t.slug,
      description: t.description ?? "",
      type: t.type,
      config: JSON.stringify(t.config ?? {}, null, 2),
      is_published: t.is_published,
      version: t.version ?? "1.0.0",
    });
    setConfigError(null);
    setOpen(true);
  };

  const submit = async () => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(form.config);
      setConfigError(null);
    } catch (e) {
      setConfigError("JSON inválido: " + (e as Error).message);
      return;
    }
    const payload = {
      sector_id: sectorId,
      type: form.type,
      name: form.name,
      slug: form.slug,
      description: form.description,
      config: parsed as Record<string, unknown>,
      is_published: form.is_published,
      version: form.version,
    };
    try {
      if (form.id) {
        await update.mutateAsync({ id: form.id, patch: payload });
        toast.success("Plantilla actualizada");
      } else {
        await create.mutateAsync(payload);
        toast.success("Plantilla creada");
      }
      setOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error guardando plantilla");
    }
  };

  const remove = async (t: MarketplaceTemplate) => {
    if (!confirm(`¿Eliminar la plantilla "${t.name}"?`)) return;
    try {
      await del.mutateAsync(t.id);
      toast.success("Plantilla eliminada");
    } catch {
      toast.error("No se pudo eliminar");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={openNew} variant="brand">
          <Plus className="h-4 w-4" />
          Nueva plantilla
        </Button>
      </div>

      {!data || data.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aún no hay plantillas en este sector.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {data.map((t) => (
            <Card key={t.id}>
              <CardContent className="flex items-center justify-between gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${typeStyles[t.type]}`}
                    >
                      {typeLabels[t.type]}
                    </span>
                    <span className="font-medium">{t.name}</span>
                    <span className="font-mono text-xs text-muted-foreground">
                      {t.slug}
                    </span>
                    <Badge variant="outline" className="text-xs">
                      v{t.version}
                    </Badge>
                    {!t.is_published && (
                      <Badge variant="secondary" className="text-xs">
                        Borrador
                      </Badge>
                    )}
                  </div>
                  {t.description && (
                    <p className="mt-1 truncate text-sm text-muted-foreground">
                      {t.description}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => openEdit(t)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => remove(t)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar plantilla" : "Nueva plantilla"}</DialogTitle>
            <DialogDescription>
              Configura la plantilla del marketplace. La configuración es JSON.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[65vh] space-y-4 overflow-y-auto scroll-area pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Slug</Label>
                <Input
                  value={form.slug}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      slug: e.target.value
                        .toLowerCase()
                        .replace(/[^a-z0-9-]/g, "-"),
                    })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Tipo</Label>
                <Select
                  value={form.type}
                  onValueChange={(v) => setForm({ ...form, type: v as TemplateType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Versión</Label>
                <Input
                  value={form.version}
                  onChange={(e) => setForm({ ...form, version: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Descripción</Label>
              <Input
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Configuración (JSON)</Label>
                <span className="text-xs text-muted-foreground">
                  Estructura tipada según el tipo
                </span>
              </div>
              <Textarea
                value={form.config}
                onChange={(e) => {
                  setForm({ ...form, config: e.target.value });
                  try {
                    JSON.parse(e.target.value);
                    setConfigError(null);
                  } catch (err) {
                    setConfigError((err as Error).message);
                  }
                }}
                className="min-h-[200px] font-mono text-xs"
                spellCheck={false}
              />
              {configError && (
                <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  <span className="font-mono">{configError}</span>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant={form.is_published ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  setForm({ ...form, is_published: !form.is_published })
                }
              >
                {form.is_published ? "Publicado" : "Borrador"}
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
              disabled={create.isPending || update.isPending || !form.name || !!configError}
            >
              <Save className="h-4 w-4" />
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
