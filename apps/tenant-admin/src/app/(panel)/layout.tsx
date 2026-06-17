import { Shell } from "@/components/layout/shell";

export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <Shell>{children}</Shell>;
}
