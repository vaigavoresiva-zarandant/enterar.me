import { InformesPanel } from "@/components/informes/informes-panel";

export const metadata = { title: "Informes · ENTERAR.ME Super Admin" };

// Datos mock razonables para el esqueleto funcional.
// En producción vendrán de /api/informes agregados desde Directus.
const mockData = {
  tenantsPorMes: [
    { label: "Feb", value: 4 },
    { label: "Mar", value: 7 },
    { label: "Abr", value: 6 },
    { label: "May", value: 9 },
    { label: "Jun", value: 12 },
    { label: "Jul", value: 8 },
  ],
  mrr: [
    { label: "Feb", value: 4200, secondary: 4500 },
    { label: "Mar", value: 5100, secondary: 5400 },
    { label: "Abr", value: 5800, secondary: 6200 },
    { label: "May", value: 6900, secondary: 7300 },
    { label: "Jun", value: 8400, secondary: 8900 },
    { label: "Jul", value: 9100, secondary: 9800 },
  ],
  distribucionPlanes: [
    { label: "Free", value: 12 },
    { label: "Starter", value: 18 },
    { label: "Pro", value: 9 },
    { label: "Enterprise", value: 3 },
  ],
  topSectores: [
    { sector: "Industrial", tenants: 14, mrr: 6800 },
    { sector: "Construcción", tenants: 11, mrr: 5200 },
    { sector: "Logística", tenants: 8, mrr: 4100 },
    { sector: "Retail", tenants: 6, mrr: 2900 },
    { sector: "Sanidad", tenants: 3, mrr: 2100 },
  ],
  churn: [
    { mes: "Febrero", rate: 0.012, bajas: 1 },
    { mes: "Marzo", rate: 0.008, bajas: 1 },
    { mes: "Abril", rate: 0.021, bajas: 2 },
    { mes: "Mayo", rate: 0.014, bajas: 2 },
    { mes: "Junio", rate: 0.006, bajas: 1 },
    { mes: "Julio", rate: 0.011, bajas: 2 },
  ],
};

export default function InformesPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Informes</h1>
        <p className="text-sm text-muted-foreground">
          Métricas globales de plataforma: tenants, MRR, churn, uso por plan, top sectores.
        </p>
      </div>
      <InformesPanel data={mockData} />
    </div>
  );
}
