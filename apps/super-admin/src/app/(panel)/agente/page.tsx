import { Card } from "@/components/ui/card";
import { ChatWindow } from "@/components/agente/chat-window";
import { ConversationList } from "@/components/agente/conversation-list";

export const metadata = { title: "Agente IA · ENTERAR.ME Super Admin" };

export default function AgentePage() {
  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Agente IA global</h1>
        <p className="text-sm text-muted-foreground">
          Conversa con el agente IA del super admin. Tiene acceso a todos los tenants y métricas de plataforma.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <ChatWindow />
        <Card className="hidden h-[calc(100vh-12rem)] overflow-hidden rounded-xl border bg-card lg:flex lg:flex-col">
          <ConversationList />
        </Card>
      </div>
    </div>
  );
}
