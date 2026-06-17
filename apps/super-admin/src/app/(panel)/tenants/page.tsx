import { TenantTable } from "@/components/tenants/tenant-table";
import { listPlans } from "@/lib/directus";

export const metadata = { title: "Tenants · ENTERAR.ME Super Admin" };

export default async function TenantsPage() {
  const plans = await listPlans();
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Tenants</h1>
        <p className="text-sm text-muted-foreground">
          Gestiona todas las organizaciones de la plataforma.
        </p>
      </div>
      <TenantTable plans={plans} />
    </div>
  );
}
