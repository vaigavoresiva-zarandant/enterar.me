import { PlanesGrid } from "@/components/planes/planes-grid";

export const metadata = { title: "Planes · ENTERAR.ME Super Admin" };

export default function PlanesPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Planes</h1>
        <p className="text-sm text-muted-foreground">
          Define los planes y sus límites para los tenants.
        </p>
      </div>
      <PlanesGrid />
    </div>
  );
}
