import { PlantillasGlobales } from "@/components/marketplace/plantillas-globales";

export const metadata = { title: "Plantillas · ENTERAR.ME Super Admin" };

export default function PlantillasPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Plantillas</h1>
        <p className="text-sm text-muted-foreground">
          Vista global de todas las plantillas del marketplace.
        </p>
      </div>
      <PlantillasGlobales />
    </div>
  );
}
