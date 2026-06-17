"use client";

import { useState, useCallback, useRef } from "react";
import { streamAgentChat, type AgentStreamChunk } from "@/lib/ai";

export interface AgentMessage {
  id: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  skill?: string | null;
  pending?: boolean;
}

export function useAgente() {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [streaming, setStreaming] = useState(false);
  const [currentSkill, setCurrentSkill] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || streaming) return;
      const userMsg: AgentMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text,
      };
      const assistantMsg: AgentMessage = {
        id: `a-${Date.now()}`,
        role: "assistant",
        content: "",
        pending: true,
      };
      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setStreaming(true);
      setCurrentSkill(null);

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const stream = streamAgentChat(
          {
            conversation_id: conversationId ?? undefined,
            messages: [...messages, userMsg].map((m) => ({
              role: m.role,
              content: m.content,
            })),
            scope: "global",
          },
          controller.signal,
        );

        let acc = "";
        for await (const chunk of stream as AsyncIterable<AgentStreamChunk>) {
          if (chunk.error) {
            acc += `\n\n_[error: ${chunk.error}]_`;
            break;
          }
          if (chunk.skill) setCurrentSkill(chunk.skill);
          if (chunk.delta) {
            acc += chunk.delta;
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantMsg.id
                  ? { ...m, content: acc, pending: false, skill: chunk.skill ?? m.skill }
                  : m,
              ),
            );
          }
          if (chunk.done) break;
        }
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, pending: false } : m,
          ),
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: `_[error: ${msg}]_`, pending: false }
              : m,
          ),
        );
      } finally {
        setStreaming(false);
        setCurrentSkill(null);
        abortRef.current = null;
      }
    },
    [conversationId, messages, streaming],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    setStreaming(false);
  }, []);

  const reset = useCallback(() => {
    setMessages([]);
    setConversationId(null);
    setCurrentSkill(null);
  }, []);

  return {
    messages,
    streaming,
    currentSkill,
    conversationId,
    setConversationId,
    send,
    stop,
    reset,
  };
}
