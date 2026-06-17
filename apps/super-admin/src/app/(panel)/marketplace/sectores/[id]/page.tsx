import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PlantillaEditor } from "@/components/marketplace/plantilla-editor";
import { getSector } from "@/lib/directus";

export const metadata = { title: "Detalle sector · ENTERAR.ME Super Admin" };

export default async function SectorDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sector = await getSector(id);
  if (!sector) notFound();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button asChild variant="ghost" size="icon">
          <Link href="/marketplace/sectores">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{sector.name}</h1>
          <p className="font-mono text-xs text-muted-foreground">{sector.slug}</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Descripción</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {sector.description || "Sin descripción"}
          </p>
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-lg font-semibold">Plantillas del sector</h2>
        <PlantillaEditor sectorId={sector.id} />
      </div>
    </div>
  );
}
