"use client";

import { useState, useEffect, useCallback } from "react";
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
  provider?: string; // Stored provider name
  timestamp: Timestamp | null;
  isLocal?: boolean; // Used for the welcome message (not persisted)
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAIChat(
  projectId: string | undefined,
  userId: string | undefined
) {
  const [firestoreMessages, setFirestoreMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [aiResponding, setAiResponding] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // ── Firestore real-time listener ──────────────────────────────────────────

  useEffect(() => {
    if (!projectId || !userId) {
      setFirestoreMessages([]);
      setLoading(false);
      setInitialLoadDone(false);
      return;
    }

    setLoading(true);

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
        setFirestoreMessages(msgs);
        setLoading(false);
        setInitialLoadDone(true);
      },
      (error) => {
        console.error("AI Chat listener error:", error);
        setLoading(false);
        setInitialLoadDone(true);
      }
    );

    return () => unsub();
  }, [projectId, userId]);

  // ── Compose displayed messages: welcome + firestore ───────────────────────

  const messages: ChatMessage[] = (() => {
    // While loading, return empty to avoid flicker
    if (!initialLoadDone) return [];

    // If no Firestore messages, prepend the welcome message
    if (firestoreMessages.length === 0) {
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

    return firestoreMessages;
  })();

  // ── Send a user message ───────────────────────────────────────────────────

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

  // ── Append an assistant response ──────────────────────────────────────────

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

      // 1. Save user message
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

      // 2. Build conversation history for AI (last 20 messages for context)
      const recentMessages = [
        ...firestoreMessages.slice(-20).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user" as const, content: content.trim() },
      ];

      // 3. Call AI API
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

        // 4. Save AI response to Firestore
        await addDoc(collection(db, "aiChats"), {
          projectId,
          userId: "ai-assistant",
          role: "assistant",
          content: data.response,
          provider: data.provider || "gemini",
          timestamp: serverTimestamp(),
        });
      } catch (error) {
        // Save error message as an assistant response so the user can see it
        await addDoc(collection(db, "aiChats"), {
          projectId,
          userId: "ai-assistant",
          role: "assistant",
          content: "Unable to connect to AI provider. Check API keys in Settings.",
          provider: "",
          timestamp: serverTimestamp(),
        });
      } finally {
        setAiResponding(false);
      }
    },
    [projectId, userId, firestoreMessages]
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
