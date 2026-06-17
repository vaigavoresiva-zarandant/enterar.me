"use client";

import * as React from "react";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import { Bot, Loader2, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn, formatDateTime } from "@/lib/utils";
import { useAgente } from "@/hooks/use-agente";
import type { ChatMessageInput } from "@/lib/ai";

interface LocalMsg {
  id: string;
  role: "user" | "assistant";
  content: string;
  skill?: string;
  created_at: string;
}

interface Conversacion {
  id: string;
  title: string;
  updated_at: string;
  last_skill?: string;
}

const DEMO_CONVERSACIONES: Conversacion[] = [
  { id: "c1", title: "Informe de stock diciembre", updated_at: "2025-12-01T10:00:00Z", last_skill: "generar-informe" },
  { id: "c2", title: "Tareas atrasadas obra Pamplona", updated_at: "2025-11-28T16:30:00Z" },
  { id: "c3", title: "Predicción de gasto Q1 2026", updated_at: "2025-11-25T09:15:00Z", last_skill: "predecir-demanda" },
];

export default function AgentePage() {
  const { data: session } = useSession();
  const tenantSlug = (session as any)?.tenantSlug || "demo";
  const token = (session as any)?.accessToken || "";

  const [activeId, setActiveId] = React.useState<string | null>("c1");
  const [messages, setMessages] = React.useState<LocalMsg[]>([]);
  const [input, setInput] = React.useState("");
  const [skillBadge, setSkillBadge] = React.useState<string | null>(null);
  const scrollRef = React.useRef<HTMLDivElement>(null);

  const { send, streaming, partial } = useAgente({
    tenantSlug,
    token,
    conversacionId: activeId || undefined,
  });

  React.useEffect(() => {
    // Cargar historial demo de la conversación activa
    setMessages([
      {
        id: "m1",
        role: "assistant",
        content:
          "Hola, soy tu agente ENTERAR.ME. Puedo ayudarte a generar informes, predecir demanda y responder dudas sobre tus tareas, materiales y trazabilidad.",
        created_at: new Date().toISOString(),
      },
    ]);
  }, [activeId]);

  React.useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, partial]);

  async function handleSend() {
    const text = input.trim();
    if (!text || streaming) return;
    setInput("");

    const userMsg: LocalMsg = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg]);

    const assistantId = crypto.randomUUID();
    setMessages((m) => [
      ...m,
      { id: assistantId, role: "assistant", content: "", created_at: new Date().toISOString() },
    ]);

    const history: ChatMessageInput[] = [...messages, userMsg].map((m) => ({
      role: m.role,
      content: m.content,
    }));

    setSkillBadge(null);
    await send({
      messages: history,
      onChunk: (delta) => {
        setMessages((m) =>
          m.map((msg) =>
            msg.id === assistantId ? { ...msg, content: msg.content + delta } : msg,
          ),
        );
      },
      onSkill: (s) => setSkillBadge(s),
    });
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  function newConversation() {
    setActiveId(null);
    setMessages([]);
    setSkillBadge(null);
    toast.info("Nueva conversación");
  }

  return (
    <div className="grid h-[calc(100vh-7rem)] gap-4 lg:grid-cols-[280px_1fr]">
      {/* Sidebar de conversaciones */}
      <Card className="hidden lg:flex lg:flex-col">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-sm">Conversaciones</CardTitle>
          <Button size="icon" variant="ghost" onClick={newConversation} aria-label="Nueva conversación">
            <Plus className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden p-2">
          <div className="scroll-area h-full max-h-full">
            <div className="flex flex-col gap-1">
              {DEMO_CONVERSACIONES.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setActiveId(c.id)}
                  className={cn(
                    "rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted",
                    activeId === c.id
                      ? "border-brand-purple/30 bg-brand-purple/5"
                      : "border-transparent",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="line-clamp-1 font-medium">{c.title}</span>
                    <Trash2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground hover:text-destructive" />
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatDateTime(c.updated_at)}</span>
                    {c.last_skill ? (
                      <Badge variant="purple" className="text-[10px]">
                        {c.last_skill}
                      </Badge>
                    ) : null}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Panel principal del chat */}
      <Card className="flex flex-col">
        <CardHeader className="flex-row items-center justify-between border-b">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-purple/10">
              <Bot className="h-5 w-5 text-brand-purple" />
            </div>
            <div>
              <CardTitle className="text-sm">Agente IA · {tenantSlug}</CardTitle>
              <p className="text-xs text-muted-foreground">
                {streaming ? "Pensando…" : "Conectado"}
              </p>
            </div>
          </div>
          {skillBadge ? (
            <Badge variant="accent" className="gap-1">
              <Sparkles className="h-3 w-3" />
              Skill: {skillBadge}
            </Badge>
          ) : null}
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0">
          <div ref={scrollRef} className="scroll-area h-full max-h-full p-4">
            <div className="mx-auto flex max-w-3xl flex-col gap-4">
              {messages.map((m) => (
                <MessageBubble key={m.id} msg={m} />
              ))}
              {streaming && partial ? (
                <div className="text-xs text-muted-foreground">●●● escribiendo…</div>
              ) : null}
            </div>
          </div>
        </CardContent>

        <div className="border-t p-3">
          <div className="mx-auto flex max-w-3xl items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Escribe tu mensaje…  (Enter para enviar, Shift+Enter para salto de línea)"
              rows={2}
              className="resize-none"
              disabled={streaming}
            />
            <Button
              variant="brand"
              size="icon"
              className="h-12 w-12"
              onClick={handleSend}
              disabled={streaming || !input.trim()}
              aria-label="Enviar mensaje"
            >
              {streaming ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

function MessageBubble({ msg }: { msg: LocalMsg }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2 text-sm shadow-sm",
          isUser
            ? "bg-brand-purple text-white rounded-br-sm"
            : "bg-card border rounded-bl-sm",
        )}
      >
        {msg.skill ? (
          <div className="mb-1">
            <Badge variant="accent" className="text-[10px]">
              {msg.skill}
            </Badge>
          </div>
        ) : null}
        <div className="whitespace-pre-wrap">{msg.content || "…"}</div>
        <div
          className={cn(
            "mt-1 text-[10px]",
            isUser ? "text-white/70" : "text-muted-foreground",
          )}
        >
          {formatDateTime(msg.created_at)}
        </div>
      </div>
    </div>
  );
}
