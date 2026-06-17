"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageList } from "@/components/agente/message-list";
import { SkillLegend } from "@/components/agente/skill-badge";
import { useAgente } from "@/hooks/use-agente";

export function ChatWindow() {
  const { messages, streaming, currentSkill, send, stop, reset } = useAgente();
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }, [input]);

  const submit = () => {
    if (!input.trim() || streaming) return;
    void send(input.trim());
    setInput("");
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col overflow-hidden rounded-xl border bg-card lg:h-[calc(100vh-10rem)]">
      <div className="flex flex-1 flex-col overflow-hidden">
        <MessageList
          messages={messages}
          streaming={streaming}
          currentSkill={currentSkill}
        />
      </div>

      <div className="border-t bg-background/50 p-3">
        <div className="mb-2 flex items-center justify-between">
          <SkillLegend />
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-muted-foreground"
            onClick={reset}
            disabled={messages.length === 0 || streaming}
          >
            <Trash2 className="h-3 w-3" />
            Limpiar
          </Button>
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Escribe tu consulta al agente global… (Enter para enviar, Shift+Enter para nueva línea)"
            className="min-h-[44px] resize-none"
            rows={1}
            disabled={streaming}
          />
          {streaming ? (
            <Button variant="destructive" size="icon" onClick={stop} className="h-11 w-11 shrink-0">
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              variant="brand"
              size="icon"
              onClick={submit}
              disabled={!input.trim()}
              className="h-11 w-11 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
