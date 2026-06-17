"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  closestCorners,
  type DragEndEvent,
  type DragStartEvent,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus, ListChecks, LayoutGrid, Table as TableIcon, Loader2, Save, Trash2, MapPin, User, AlertCircle, ArrowRight, GripVertical, X, CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/common/error-state";
import { EmptyState } from "@/components/common/empty-state";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import {
  useTareas, useCreateTarea, useUpdateTarea, useDeleteTarea,
  TAREA_ESTADOS, TAREA_PRIORIDADES,
  type CompleteTareaPayload,
} from "@/hooks/use-tareas";
import { useUbicaciones } from "@/hooks/use-ubicaciones";
import { useUsuariosExternos } from "@/hooks/use-usuarios-externos";
import { useMateriales } from "@/hooks/use-materiales";
import type { Tarea, TareaEstado, TareaPrioridad } from "@/types/directus";
import { formatDate, formatDateTime } from "@/lib/utils";

const ESTADO_LABEL: Record<TareaEstado, string> = {
  pendiente: "Pendiente",
  en_progreso: "En progreso",
  completada: "Completada",
  cancelada: "Cancelada",
};

const ESTADO_ACCENT: Record<TareaEstado, string> = {
  pendiente: "bg-brand-yellow/10 border-brand-yellow/30",
  en_progreso: "bg-brand-purple/10 border-brand-purple/30",
  completada: "bg-success/10 border-success/30",
  cancelada: "bg-destructive/10 border-destructive/30",
};

const ESTADO_DOT: Record<TareaEstado, string> = {
  pendiente: "bg-brand-yellow",
  en_progreso: "bg-brand-purple",
  completada: "bg-success",
  cancelada: "bg-destructive",
};

const PRIORIDAD_BADGE: Record<TareaPrioridad, "secondary" | "accent" | "warning" | "red"> = {
  baja: "secondary",
  media: "accent",
  alta: "warning",
  critica: "red",
};

export default function TareasPage() {
  const [view, setView] = React.useState<"kanban" | "tabla">("kanban");
  const [filters, setFilters] = React.useState<{ ubicacion_id?: string; user_externo_id?: string }>({});
  const [open, setOpen] = React.useState(false);
  const [editing, setEditing] = React.useState<Tarea | null>(null);
  const [toDelete, setToDelete] = React.useState<Tarea | null>(null);
  const [completing, setCompleting] = React.useState<Tarea | null>(null);

  const ubicacionesQ = useUbicaciones();
  const usuariosQ = useUsuariosExternos();
  const tareasQ = useTareas(filters);
  const createMut = useCreateTarea();
  const updateMut = useUpdateTarea();
  const deleteMut = useDeleteTarea();

  const noUbicaciones = (ubicacionesQ.data?.length ?? 0) === 0;
  const noUsuarios = (usuariosQ.data?.length ?? 0) === 0;
  const blocked = noUbicaciones || noUsuarios;

  const [activeId, setActiveId] = React.useState<string | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  async function onDragEnd(e: DragEndEvent) {
    const taskId = String(e.active.id);
    const newEstado = String(e.over?.id) as TareaEstado | null;
    setActiveId(null);
    if (!newEstado) return;
    const tarea = tareasQ.data?.find((t) => t.id === taskId);
    if (!tarea || tarea.estado === newEstado) return;
    try {
      await updateMut.mutateAsync({ id: taskId, data: { estado: newEstado } });
      if (newEstado === "completada") {
        setCompleting(tarea);
      }
    } catch {
      toast.error("No se pudo mover la tarea");
    }
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  const columns = TAREA_ESTADOS;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tareas</h1>
          <p className="text-sm text-muted-foreground">
            Kanban de trabajos. Cada tarea requiere ubicación + usuario externo.
          </p>
        </div>
        <Button
          variant="brand"
          onClick={() => { setEditing(null); setOpen(true); }}
          disabled={blocked}
          title={blocked ? "Crea primero ubicación y usuario externo" : undefined}
        >
          <Plus className="h-4 w-4" /> Nueva tarea
        </Button>
      </header>

      {blocked ? (
        <EmptyState
          icon={AlertCircle}
          title="Faltan prerrequisitos"
          description={`Para crear tareas necesitas al menos una ubicación y un usuario externo. ${
            noUbicaciones ? "Falta ubicación. " : ""
          }${noUsuarios ? "Falta usuario externo." : ""}`}
          ctaHref={noUbicaciones ? "/ubicaciones" : "/usuarios-externos"}
          ctaLabel={noUbicaciones ? "Ir a Ubicaciones" : "Ir a Usuarios externos"}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filters.ubicacion_id || "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, ubicacion_id: v === "all" ? undefined : v }))}
          >
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Ubicación" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las ubicaciones</SelectItem>
              {ubicacionesQ.data?.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.user_externo_id || "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, user_externo_id: v === "all" ? undefined : v }))}
          >
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Usuario externo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              {usuariosQ.data?.map((u) => (
                <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Tabs value={view} onValueChange={(v) => setView(v as any)}>
          <TabsList>
            <TabsTrigger value="kanban"><LayoutGrid className="h-4 w-4" /> Kanban</TabsTrigger>
            <TabsTrigger value="tabla"><TableIcon className="h-4 w-4" /> Tabla</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {tareasQ.isError ? (
        <ErrorState onRetry={() => tareasQ.refetch()} />
      ) : tareasQ.isLoading ? (
        <div className="grid gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-72" />
          ))}
        </div>
      ) : !tareasQ.data || tareasQ.data.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Sin tareas todavía"
          description="Crea tu primera tarea y verás aquí el tablero Kanban con 4 columnas: pendiente, en progreso, completada y cancelada."
          ctaLabel="Crear tarea"
          onCta={() => { setEditing(null); setOpen(true); }}
        />
      ) : view === "kanban" ? (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {columns.map((col) => {
              const items = tareasQ.data!.filter((t) => t.estado === col.value);
              return (
                <KanbanColumn
                  key={col.value}
                  estado={col.value}
                  label={col.label}
                  count={items.length}
                  tasks={items}
                  onSelect={setEditing}
                  onComplete={setCompleting}
                  onDelete={setToDelete}
                />
              );
            })}
          </div>
          <DragOverlay>
            {activeId ? (
              <TaskCard
                task={tareasQ.data!.find((t) => t.id === activeId)!}
                dragging
                onSelect={() => {}}
                onComplete={() => {}}
                onDelete={() => {}}
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Prioridad</TableHead>
                  <TableHead className="hidden md:table-cell">Ubicación</TableHead>
                  <TableHead className="hidden lg:table-cell">Usuario externo</TableHead>
                  <TableHead className="hidden lg:table-cell">Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tareasQ.data.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">
                      <Link href={`/tareas/${t.id}`} className="hover:underline">{t.title}</Link>
                    </TableCell>
                    <TableCell>
                      <Badge variant={TAREA_ESTADOS.find((e) => e.value === t.estado)?.color as any}>
                        {ESTADO_LABEL[t.estado]}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={PRIORIDAD_BADGE[t.prioridad]}>{t.prioridad}</Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{t.ubicacion?.name || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{t.user_externo?.name || "—"}</TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">{formatDate(t.due_date)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button asChild size="sm" variant="ghost">
                          <Link href={`/tareas/${t.id}`}><ArrowRight className="h-4 w-4" /></Link>
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(t)}>Editar</Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setToDelete(t)}>
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
        <TareaFormModal
          open={open}
          onOpenChange={setOpen}
          editing={editing}
          submitting={createMut.isPending || updateMut.isPending}
          ubicaciones={ubicacionesQ.data || []}
          usuarios={usuariosQ.data || []}
          onSubmit={async (v) => {
            if (editing) {
              await updateMut.mutateAsync({ id: editing.id, data: v });
              setEditing(null);
            } else {
              await createMut.mutateAsync(v);
            }
            setOpen(false);
          }}
        />
      ) : null}

      {completing ? (
        <CompleteTaskModal
          tarea={completing}
          onClose={() => setCompleting(null)}
          onSubmit={async (payload) => {
            await fetch(`/api/tareas/${payload.tarea_id}/completar`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify(payload),
            });
            toast.success(`Tarea completada · ${payload.materiales.length} consumo(s) registrado(s)`);
            setCompleting(null);
            tareasQ.refetch();
          }}
        />
      ) : null}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(v) => !v && setToDelete(null)}
        title="¿Eliminar tarea?"
        description={`Se eliminará "${toDelete?.title}". La trazabilidad histórica se mantendrá.`}
        confirmLabel="Eliminar"
        onConfirm={async () => {
          if (toDelete) await deleteMut.mutateAsync(toDelete.id);
        }}
      />
    </div>
  );
}

function KanbanColumn({
  estado, label, count, tasks, onSelect, onComplete, onDelete,
}: {
  estado: TareaEstado;
  label: string;
  count: number;
  tasks: Tarea[];
  onSelect: (t: Tarea) => void;
  onComplete: (t: Tarea) => void;
  onDelete: (t: Tarea) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: estado });
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${ESTADO_DOT[estado]}`} />
          <h3 className="text-sm font-semibold">{label}</h3>
        </div>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">{count}</span>
      </div>
      <div
        ref={setNodeRef}
        className={`flex min-h-[200px] flex-col gap-2 rounded-xl border-2 border-dashed p-2 transition-colors ${
          isOver ? "border-brand-purple/60 bg-brand-purple/5" : "border-muted"
        }`}
      >
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.length === 0 ? (
            <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-muted-foreground">
              Arrastra aquí
            </div>
          ) : (
            tasks.map((t) => (
              <SortableTaskCard
                key={t.id}
                task={t}
                onSelect={onSelect}
                onComplete={onComplete}
                onDelete={onDelete}
              />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  );
}

function SortableTaskCard(props: {
  task: Tarea;
  onSelect: (t: Tarea) => void;
  onComplete: (t: Tarea) => void;
  onDelete: (t: Tarea) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useDraggable({
    id: props.task.id,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
      <TaskCard {...props} />
    </div>
  );
}

function TaskCard({
  task, dragging, onSelect, onComplete, onDelete,
}: {
  task: Tarea;
  dragging?: boolean;
  onSelect: (t: Tarea) => void;
  onComplete: (t: Tarea) => void;
  onDelete: (t: Tarea) => void;
}) {
  return (
    <Card
      className={`group cursor-grab touch-none border-l-4 ${ESTADO_ACCENT[task.estado]} ${
        dragging ? "shadow-lg ring-2 ring-brand-purple" : ""
      }`}
    >
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-2">
          <button
            className="flex-1 text-left"
            onClick={(e) => { e.stopPropagation(); onSelect(task); }}
          >
            <p className="line-clamp-2 text-sm font-medium">{task.title}</p>
          </button>
          <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100" />
        </div>

        <div className="mt-2 flex flex-wrap gap-1">
          <Badge variant={PRIORIDAD_BADGE[task.prioridad]} className="text-[10px]">
            {task.prioridad}
          </Badge>
          {task.materials && task.materials.length > 0 ? (
            <Badge variant="secondary" className="text-[10px]">
              {task.materials.length} material(es)
            </Badge>
          ) : null}
        </div>

        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          {task.ubicacion ? (
            <p className="flex items-center gap-1">
              <MapPin className="h-3 w-3" /> {task.ubicacion.name}
            </p>
          ) : null}
          {task.user_externo ? (
            <p className="flex items-center gap-1">
              <User className="h-3 w-3" /> {task.user_externo.name}
            </p>
          ) : null}
          {task.due_date ? (
            <p className="text-foreground/70">{formatDate(task.due_date)}</p>
          ) : null}
        </div>

        <div className="mt-2 flex gap-1 border-t pt-2">
          {task.estado !== "completada" ? (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs text-success"
              onClick={(e) => { e.stopPropagation(); onComplete(task); }}
            >
              Completar
            </Button>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-destructive"
            onClick={(e) => { e.stopPropagation(); onDelete(task); }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ------------------------- Formulario -------------------------
function TareaFormModal({
  open, onOpenChange, editing, onSubmit, submitting, ubicaciones, usuarios,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  editing: Tarea | null;
  onSubmit: (v: Partial<Tarea>) => void | Promise<void>;
  submitting: boolean;
  ubicaciones: { id: string; name: string }[];
  usuarios: { id: string; name: string }[];
}) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [estado, setEstado] = React.useState<TareaEstado>("pendiente");
  const [prioridad, setPrioridad] = React.useState<TareaPrioridad>("media");
  const [ubicacionId, setUbicacionId] = React.useState("");
  const [userExternoId, setUserExternoId] = React.useState("");
  const [dueDate, setDueDate] = React.useState("");

  React.useEffect(() => {
    if (editing) {
      setTitle(editing.title);
      setDescription(editing.description || "");
      setEstado(editing.estado);
      setPrioridad(editing.prioridad);
      setUbicacionId(editing.ubicacion_id);
      setUserExternoId(editing.user_externo_id);
      setDueDate(editing.due_date ? editing.due_date.slice(0, 10) : "");
    } else {
      setTitle(""); setDescription(""); setEstado("pendiente"); setPrioridad("media");
      setUbicacionId(ubicaciones[0]?.id || "");
      setUserExternoId(usuarios[0]?.id || "");
      setDueDate("");
    }
  }, [editing, ubicaciones, usuarios]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    await onSubmit({
      title, description,
      estado, prioridad,
      ubicacion_id: ubicacionId,
      user_externo_id: userExternoId,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
    });
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl bg-background p-6 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{editing ? "Editar tarea" : "Nueva tarea"}</h2>
          <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} required placeholder="Instalar cerramiento planta 2" />
          </div>
          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Estado</Label>
              <Select value={estado} onValueChange={(v) => setEstado(v as TareaEstado)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TAREA_ESTADOS.map((e) => (
                    <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Select value={prioridad} onValueChange={(v) => setPrioridad(v as TareaPrioridad)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TAREA_PRIORIDADES.map((p) => (
                    <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ubicación *</Label>
              <Select value={ubicacionId} onValueChange={setUbicacionId}>
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  {ubicaciones.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Usuario externo *</Label>
              <Select value={userExternoId} onValueChange={setUserExternoId}>
                <SelectTrigger><SelectValue placeholder="Selecciona" /></SelectTrigger>
                <SelectContent>
                  {usuarios.map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Fecha límite</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
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

// ------------------------- Modal completar -------------------------
function CompleteTaskModal({
  tarea, onClose, onSubmit,
}: {
  tarea: Tarea;
  onClose: () => void;
  onSubmit: (p: CompleteTareaPayload) => Promise<void>;
}) {
  const matQ = useMateriales();
  const [selected, setSelected] = React.useState<Record<string, number>>({});
  const [notas, setNotas] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  function toggle(id: string) {
    setSelected((s) => {
      const c = { ...s };
      if (c[id]) delete c[id]; else c[id] = 1;
      return c;
    });
  }

  async function submit() {
    setSubmitting(true);
    try {
      await onSubmit({
        tarea_id: tarea.id,
        materiales: Object.entries(selected).map(([material_id, cantidad]) => ({ material_id, cantidad })),
        notas,
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-lg rounded-t-2xl bg-background p-6 shadow-xl sm:rounded-2xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Completar tarea</h2>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <p className="mb-3 text-sm text-muted-foreground">
          Marca los materiales consumidos. Se generarán movimientos de stock (tipo <strong>salida</strong>) y eventos de trazabilidad.
        </p>
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {matQ.data?.length ? (
            matQ.data.map((m) => (
              <div
                key={m.id}
                className={`flex items-center justify-between rounded-md border p-2 ${selected[m.id] ? "border-brand-purple/40 bg-brand-purple/5" : ""}`}
              >
                <label className="flex flex-1 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={!!selected[m.id]}
                    onChange={() => toggle(m.id)}
                    className="h-4 w-4 rounded"
                  />
                  <span className="font-medium">{m.name}</span>
                  <span className="text-xs text-muted-foreground">stock: {m.stock_total} {m.unit}</span>
                </label>
                {selected[m.id] ? (
                  <Input
                    type="number"
                    className="w-24"
                    value={selected[m.id]}
                    min={1}
                    onChange={(e) =>
                      setSelected((s) => ({ ...s, [m.id]: Number(e.target.value) }))
                    }
                  />
                ) : null}
              </div>
            ))
          ) : (
            <p className="text-sm text-muted-foreground">No hay materiales disponibles.</p>
          )}
        </div>
        <div className="mt-3 space-y-1.5">
          <Label>Notas</Label>
          <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={2} placeholder="Observaciones de cierre" />
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="success" onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Completar y registrar
          </Button>
        </div>
      </div>
    </div>
  );
}
