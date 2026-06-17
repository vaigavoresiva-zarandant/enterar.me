import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, FileText, ArrowRight } from "lucide-react";

export const metadata = { title: "Marketplace · ENTERAR.ME Super Admin" };

export default function MarketplacePage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Marketplace</h1>
        <p className="text-sm text-muted-foreground">
          Gestiona sectores y plantillas reutilizables del marketplace.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="group">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-purple/10 text-brand-purple">
                <Package className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Sectores</CardTitle>
                <CardDescription>Categorías del marketplace</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Organiza las plantillas por sector industrial para que los tenants
              puedan aplicar configuraciones predefinidas durante el onboarding.
            </p>
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link href="/marketplace/sectores">
                Gestionar sectores
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="group">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-teal/15 text-brand-teal">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <CardTitle className="text-base">Plantillas</CardTitle>
                <CardDescription>Todas las plantillas globales</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Vista global de todas las plantillas (addons, pipelines, materiales,
              tareas, usuarios) con filtros por tipo y sector.
            </p>
            <Button asChild variant="outline" className="mt-4 w-full">
              <Link href="/marketplace/plantillas">
                Ver plantillas
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
