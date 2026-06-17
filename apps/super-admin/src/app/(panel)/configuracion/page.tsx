import { ConfiguracionClient } from "@/components/configuracion/configuracion-client";

export const metadata = { title: "Configuración · ENTERAR.ME Super Admin" };

export default function ConfiguracionPage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Configuración</h1>
        <p className="text-sm text-muted-foreground">
          Datos de la cuenta super admin, tokens de API, webhooks e integraciones.
        </p>
      </div>
      <ConfiguracionClient />
    </div>
  );
}
