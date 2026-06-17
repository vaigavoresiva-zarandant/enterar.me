import { SectorGrid } from "@/components/marketplace/sector-card";

export const metadata = { title: "Sectores · ENTERAR.ME Super Admin" };

export default function SectoresPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Sectores</h1>
        <p className="text-sm text-muted-foreground">
          Categorías del marketplace. Cada sector agrupa plantillas reutilizables.
        </p>
      </div>
      <SectorGrid />
    </div>
  );
}
