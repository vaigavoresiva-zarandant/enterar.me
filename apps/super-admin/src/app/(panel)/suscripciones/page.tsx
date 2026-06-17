import { SuscripcionesTableWithData } from "@/components/suscripciones/suscripciones-table";

export const metadata = { title: "Suscripciones · ENTERAR.ME Super Admin" };

export default function SuscripcionesPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Suscripciones</h1>
        <p className="text-sm text-muted-foreground">
          Lista global de suscripciones, filtros por plan y estado.
        </p>
      </div>
      <SuscripcionesTableWithData />
    </div>
  );
}
