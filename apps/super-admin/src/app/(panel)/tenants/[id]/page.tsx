import { TenantDetail } from "@/components/tenants/tenant-detail";

export const metadata = { title: "Detalle tenant · ENTERAR.ME Super Admin" };

export default async function TenantDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TenantDetail id={id} />;
}
