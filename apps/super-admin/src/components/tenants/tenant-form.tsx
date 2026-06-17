"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import Link from "next/link";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useCreateTenant } from "@/hooks/use-tenants";
import { usePlanes } from "@/hooks/use-planes";
import { useSectors } from "@/hooks/use-marketplace";
import { slugify } from "@/lib/utils";
import type { Plan, Sector } from "@/types/directus";

const schema = z.object({
  name: z.string().min(2, "El nombre es demasiado corto").max(120),
  slug: z
    .string()
    .min(2, "Slug demasiado corto")
    .max(60)
    .regex(/^[a-z0-9-]+$/, "Solo minúsculas, números y guiones"),
  plan_id: z.string().min(1, "Selecciona un plan"),
  admin_email: z.string().email("Email no válido"),
  sector_id: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

export function TenantForm({
  plans,
  sectors,
}: {
  plans: Plan[];
  sectors: Sector[];
}) {
  const router = useRouter();
  const create = useCreateTenant();
  const [submitting, setSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { slug: "", plan_id: "", admin_email: "", sector_id: "" },
  });

  const nameValue = watch("name");
  const slugValue = watch("slug");
  const planValue = watch("plan_id");
  const sectorValue = watch("sector_id");

  const onNameBlur = () => {
    if (!slugValue && nameValue) {
      setValue("slug", slugify(nameValue), { shouldValidate: true });
    }
  };

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const payload = {
        ...values,
        sector_id: values.sector_id || null,
      };
      const created = await create.mutateAsync(payload);
      if (created?.id) {
        toast.success("Tenant creado. Lanzando onboarding…");
        router.push(`/tenants/${created.id}`);
      } else {
        toast.error("No se pudo crear el tenant");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error creando tenant");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/tenants">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Nuevo tenant</h1>
          <p className="text-sm text-muted-foreground">
            Crea un tenant nuevo. El onboarding se lanzará automáticamente.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Datos del tenant</CardTitle>
            <CardDescription>
              Información básica de la organización
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                placeholder="Acme Industries S.L."
                {...register("name")}
                onBlur={onNameBlur}
              />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" placeholder="acme-industries" {...register("slug")} />
              {errors.slug && (
                <p className="text-xs text-destructive">{errors.slug.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Se usará en la URL del tenant: app.enterarme.me/{slugValue || "slug"}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin_email">Email del administrador</Label>
              <Input
                id="admin_email"
                type="email"
                placeholder="admin@acme.com"
                {...register("admin_email")}
              />
              {errors.admin_email && (
                <p className="text-xs text-destructive">
                  {errors.admin_email.message}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Recibirá las credenciales de acceso al panel del tenant.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Plan y sector</CardTitle>
            <CardDescription>
              Define el plan inicial y el sector (opcional)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="plan_id">Plan</Label>
              <Select value={planValue} onValueChange={(v) => setValue("plan_id", v, { shouldValidate: true })}>
                <SelectTrigger id="plan_id">
                  <SelectValue placeholder="Selecciona un plan" />
                </SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} · {p.price_monthly}€/mes
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.plan_id && (
                <p className="text-xs text-destructive">
                  {errors.plan_id.message}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="sector_id">Sector (opcional)</Label>
              <Select value={sectorValue} onValueChange={(v) => setValue("sector_id", v)}>
                <SelectTrigger id="sector_id">
                  <SelectValue placeholder="Sin sector" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Sin sector</SelectItem>
                  {sectors.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                El sector aplica plantillas del marketplace durante el onboarding.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="flex items-center justify-end gap-3">
          <Button asChild variant="outline" type="button">
            <Link href="/tenants">Cancelar</Link>
          </Button>
          <Button type="submit" variant="brand" disabled={submitting}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creando…
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Crear tenant
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}

/** Wrapper que carga planes y sectores (client) */
export function TenantFormWithData() {
  const planesQ = usePlanes();
  const sectorsQ = useSectors();

  if (planesQ.isLoading || sectorsQ.isLoading) {
    return (
      <div className="max-w-2xl space-y-4">
        <div className="h-8 w-48 animate-pulse rounded bg-muted" />
        <div className="h-64 animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  return <TenantForm plans={planesQ.data ?? []} sectors={sectorsQ.data ?? []} />;
}
