import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { streamPost } from "@/lib/api";
import type { PoetKey } from "@/lib/prompts";

export type MessageRole = "user" | "assistant";

export interface Message {
  role: MessageRole;
  content: string;
}

export type ChatMode = "qa" | "poet";

interface SendMessageParams {
  text: string;
  mode: ChatMode;
  poet: PoetKey;
  poemContext?: string;
}

interface UseChatReturn {
  messages: Message[];
  isStreaming: boolean;
  streamingContent: string;
  sendMessage: (params: SendMessageParams) => Promise<void>;
  clearMessages: () => void;
  stopStreaming: () => void;
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState<boolean>(false);
  const [streamingContent, setStreamingContent] = useState<string>("");

  const stopFlagRef = useRef<boolean>(false);
  const abortRef = useRef<AbortController | null>(null);
  const messagesRef = useRef<Message[]>([]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const stopStreaming = useCallback(() => {
    stopFlagRef.current = true;
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const clearMessages = useCallback(() => {
    stopStreaming();
    setMessages([]);
    setStreamingContent("");
  }, [stopStreaming]);

  const sendMessage = useCallback(async ({ text, mode, poet, poemContext = "" }: SendMessageParams): Promise<void> => {
    const trimmed = text.trim();
    if (!trimmed || isStreaming) {
      return;
    }

    stopFlagRef.current = false;

    const nextUser: Message = { role: "user", content: trimmed };
    const history = [...messagesRef.current];
    const nextMessages = [...history, nextUser];
    setMessages(nextMessages);

    setIsStreaming(true);
    setStreamingContent("");

    try {
      const controller = new AbortController();
      abortRef.current = controller;
      const { text: fullText } = await streamPost({
        path: "/ai/chat/stream",
        body: {
          mode,
          poet,
          poemContext,
          history,
          userMessage: trimmed,
        },
        signal: controller.signal,
        onToken: (_token, cumulativeText) => {
          if (stopFlagRef.current) {
            return;
          }
          setStreamingContent(cumulativeText);
        },
      });

      if (stopFlagRef.current) {
        return;
      }

      const assistantMessage: Message = {
        role: "assistant",
        content: fullText.trim(),
      };

      const settled = [...nextMessages, assistantMessage];
      setMessages(settled);
      messagesRef.current = settled;
    } catch (error: unknown) {
      const isAbort = error instanceof Error && error.name === "AbortError";
      if (!stopFlagRef.current && !isAbort) {
        const fallback: Message = {
          role: "assistant",
          content: error instanceof Error ? `请求失败：${error.message}` : "请求失败，请稍后重试。",
        };
        const settled = [...nextMessages, fallback];
        setMessages(settled);
        messagesRef.current = settled;
      }
    } finally {
      abortRef.current = null;
      setIsStreaming(false);
      setStreamingContent("");
    }
  }, [isStreaming]);

  const stableState = useMemo(() => ({ messages, isStreaming, streamingContent }), [messages, isStreaming, streamingContent]);

  return {
    messages: stableState.messages,
    isStreaming: stableState.isStreaming,
    streamingContent: stableState.streamingContent,
    sendMessage,
    clearMessages,
    stopStreaming,
  };
}
