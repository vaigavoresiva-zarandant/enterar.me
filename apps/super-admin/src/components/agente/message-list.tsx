"use client";

import { useEffect, useRef } from "react";
import { Bot, User, AlertCircle } from "lucide-react";
import { SkillBadge, SkillIndicator } from "@/components/agente/skill-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { AgentMessage } from "@/hooks/use-agente";

interface MessageListProps {
  messages: AgentMessage[];
  streaming: boolean;
  currentSkill: string | null;
}

export function MessageList({
  messages,
  streaming,
  currentSkill,
}: MessageListProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-brand-purple/10 text-brand-purple">
          <Bot className="h-7 w-7" />
        </div>
        <div>
          <p className="font-medium text-foreground">Agente global del Super Admin</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Pregúntame lo que quieras sobre la plataforma ENTERAR.ME: tenants,
            MRR, sectores, uso por plan…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="scroll-area h-full space-y-4 overflow-y-auto p-4 lg:p-6"
    >
      {messages.map((m) => (
        <MessageBubble key={m.id} message={m} />
      ))}
      {streaming && currentSkill && (
        <div className="flex items-center gap-2 pl-12 text-xs text-muted-foreground">
          <SkillIndicator active />
          <span>Skill activa:</span>
          <SkillBadge skill={currentSkill} />
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === "user";
  const isError = message.content.startsWith("_[error:");
  return (
    <div
      className={cn(
        "flex gap-3",
        isUser && "flex-row-reverse",
      )}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback
          className={
            isUser
              ? "bg-brand-red/10 text-brand-red"
              : "bg-brand-purple/10 text-brand-purple"
          }
        >
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      <div
        className={cn(
          "max-w-[80%] rounded-lg px-4 py-2.5 text-sm",
          isUser
            ? "bg-primary text-primary-foreground"
            : isError
              ? "bg-destructive/10 text-destructive"
              : "bg-muted text-foreground",
        )}
      >
        {!isUser && message.skill && (
          <div className="mb-1">
            <SkillBadge skill={message.skill} />
          </div>
        )}
        <div className="whitespace-pre-wrap break-words">
          {message.content || (message.pending ? "…" : "")}
          {message.pending && (
            <span className="ml-1 inline-block h-3 w-1.5 animate-pulse bg-current align-middle" />
          )}
        </div>
        {isError && (
          <div className="mt-1 flex items-center gap-1 text-xs opacity-80">
            <AlertCircle className="h-3 w-3" />
            Revisa la conexión con el servicio IA
          </div>
        )}
      </div>
    </div>
  );
}
