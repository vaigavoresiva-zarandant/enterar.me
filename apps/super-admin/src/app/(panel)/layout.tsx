import { Shell } from "@/components/layout/shell";

/**
 * Layout del grupo (panel): aplica el Shell (sidebar + header + footer sticky)
 * a todas las páginas bajo (panel). El dashboard (/) se sirve desde app/page.tsx
 * y aplica el Shell manualmente porque vive fuera del grupo (panel).
 */
export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Shell>{children}</Shell>;
}
