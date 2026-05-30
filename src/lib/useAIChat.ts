"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { WELCOME_MESSAGE } from "@/lib/aiSystemPrompt";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  projectId: string;
  userId: string;
  role: "user" | "assistant" | "system";
  content: string;
  provider?: string;
  timestamp: Timestamp | null;
  isLocal?: boolean;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAIChat(
  projectId: string | undefined,
  userId: string | undefined
) {
  const [firestoreMessages, setFirestoreMessages] = useState<ChatMessage[]>([]);
  const [optimisticMessages, setOptimisticMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [aiResponding, setAiResponding] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const optimisticIdCounter = useRef(0);

  // ── Firestore real-time listener ──────────────────────────────────────────

  useEffect(() => {
    if (!projectId || !userId) {
      setFirestoreMessages([]);
      setOptimisticMessages([]);
      setLoading(false);
      setInitialLoadDone(false);
      return;
    }

    setLoading(true);
    console.log("[useAIChat] Realtime listener active for project:", projectId);

    const q = query(
      collection(db, "aiChats"),
      where("projectId", "==", projectId),
      orderBy("timestamp", "asc")
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const msgs = snap.docs.map((d) => ({
          id: d.id,
          ...(d.data() as Omit<ChatMessage, "id">),
        }));
        console.log("[useAIChat] Messages loaded:", msgs.length);
        setFirestoreMessages(msgs);

        // Clear optimistic messages that now exist in Firestore
        setOptimisticMessages((prev) => {
          if (prev.length === 0) return prev;
          // Remove optimistic messages whose content matches a Firestore message
          const firestoreContents = new Set(msgs.map((m) => m.content));
          const remaining = prev.filter((om) => !firestoreContents.has(om.content));
          return remaining;
        });

        setLoading(false);
        setInitialLoadDone(true);
        console.log("[useAIChat] Firestore updated");
      },
      (error) => {
        console.error("[useAIChat] AI Chat listener error:", error);
        setLoading(false);
        setInitialLoadDone(true);
      }
    );

    return () => {
      console.log("[useAIChat] Listener detached for project:", projectId);
      unsub();
    };
  }, [projectId, userId]);

  // ── Compose displayed messages: welcome + firestore + optimistic ──────────

  const messages: ChatMessage[] = (() => {
    if (!initialLoadDone) return [];

    // Combine Firestore messages with optimistic local ones
    const combined = [...firestoreMessages, ...optimisticMessages];

    if (combined.length === 0) {
      return [
        {
          id: "welcome",
          projectId: projectId || "",
          userId: "system",
          role: "assistant" as const,
          content: WELCOME_MESSAGE,
          provider: "",
          timestamp: null,
          isLocal: true,
        },
      ];
    }

    return combined;
  })();

  // ── Send message AND get AI response ──────────────────────────────────────

  const sendAndRespond = useCallback(
    async (
      content: string,
      aiSettings: {
        geminiApiKey: string;
        openRouterApiKey: string;
        preferredProvider: "gemini" | "openrouter" | "none";
        fallbackProvider: "gemini" | "openrouter" | "none";
      },
      systemPrompt: string
    ) => {
      if (!projectId || !userId || !content.trim()) return;

      const trimmed = content.trim();

      // 1. Immediately add optimistic user message to UI
      const optimisticId = `optimistic-user-${++optimisticIdCounter.current}`;
      const optimisticUserMsg: ChatMessage = {
        id: optimisticId,
        projectId,
        userId,
        role: "user",
        content: trimmed,
        provider: "",
        timestamp: null,
        isLocal: true,
      };
      setOptimisticMessages((prev) => [...prev, optimisticUserMsg]);

      // 2. Save user message to Firestore (will trigger realtime update)
      setSending(true);
      try {
        await addDoc(collection(db, "aiChats"), {
          projectId,
          userId,
          role: "user",
          content: trimmed,
          provider: "",
          timestamp: serverTimestamp(),
        });
        console.log("[useAIChat] User message saved to Firestore");
      } catch (err) {
        console.error("[useAIChat] Failed to save user message:", err);
      } finally {
        setSending(false);
      }

      // 3. Build conversation history for AI (last 20 messages for context)
      const recentMessages = [
        ...firestoreMessages.slice(-20).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user" as const, content: trimmed },
      ];

      // 4. Call AI API
      setAiResponding(true);
      try {
        const res = await fetch("/api/ai-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: recentMessages,
            geminiApiKey: aiSettings.geminiApiKey,
            openRouterApiKey: aiSettings.openRouterApiKey,
            preferredProvider: aiSettings.preferredProvider,
            fallbackProvider: aiSettings.fallbackProvider,
            systemPrompt,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(
            errData.error || `API request failed (${res.status})`
          );
        }

        const data = await res.json();
        console.log("[useAIChat] AI response received, provider:", data.provider);

        // 5. Save AI response to Firestore (triggers realtime update for all clients)
        await addDoc(collection(db, "aiChats"), {
          projectId,
          userId: "ai-assistant",
          role: "assistant",
          content: data.response,
          provider: data.provider || "gemini",
          timestamp: serverTimestamp(),
        });
        console.log("[useAIChat] AI response saved to Firestore");
      } catch (error) {
        console.error("[useAIChat] AI API error:", error);
        // Save error message as an assistant response
        await addDoc(collection(db, "aiChats"), {
          projectId,
          userId: "ai-assistant",
          role: "assistant",
          content: "⚠️ Unable to connect to AI provider. Check API keys in Settings.",
          provider: "",
          timestamp: serverTimestamp(),
        });
      } finally {
        setAiResponding(false);
      }
    },
    [projectId, userId, firestoreMessages]
  );

  // ── Legacy helpers (kept for compatibility) ───────────────────────────────

  const sendMessage = useCallback(
    async (content: string) => {
      if (!projectId || !userId || !content.trim()) return;
      setSending(true);
      try {
        await addDoc(collection(db, "aiChats"), {
          projectId,
          userId,
          role: "user",
          content: content.trim(),
          provider: "",
          timestamp: serverTimestamp(),
        });
      } finally {
        setSending(false);
      }
    },
    [projectId, userId]
  );

  const appendAssistant = useCallback(
    async (content: string) => {
      if (!projectId || !userId) return;
      await addDoc(collection(db, "aiChats"), {
        projectId,
        userId,
        role: "assistant",
        content,
        provider: "",
        timestamp: serverTimestamp(),
      });
    },
    [projectId, userId]
  );

  return {
    messages,
    loading,
    sending,
    aiResponding,
    initialLoadDone,
    sendMessage,
    appendAssistant,
    sendAndRespond,
  };
}
