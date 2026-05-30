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
  userId: string | undefined        // the signed-in user's uid
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
      console.log("[useAIChat] Skipping listener – no projectId or userId", { projectId, userId });
      setFirestoreMessages([]);
      setOptimisticMessages([]);
      setLoading(false);
      setInitialLoadDone(false);
      return;
    }

    setLoading(true);
    console.log(`[useAIChat] ── Attaching listener ──`);
    console.log(`[useAIChat]   projectId : ${projectId}`);
    console.log(`[useAIChat]   userId    : ${userId}`);
    console.log(`[useAIChat]   collection: aiChats`);
    console.log(`[useAIChat]   filter    : projectId == "${projectId}"`);
    console.log(`[useAIChat]   orderBy   : timestamp asc`);
    console.log(`[useAIChat]   queryPattern: collection("aiChats") -> where("projectId","==",projectId) -> orderBy("timestamp","asc")`);

    const q = query(
      collection(db, "aiChats"),
      where("projectId", "==", projectId),
      orderBy("timestamp", "asc")
    );

    let retryCount = 0;
    const MAX_RETRIES = 3;

    const setupListener = () => {
      const unsub = onSnapshot(
        q,
        (snap) => {
          console.log(`[useAIChat] ── Snapshot received ──`);
          console.log(`[useAIChat]   docs count    : ${snap.docs.length}`);
          console.log(`[useAIChat]   fromCache     : ${snap.metadata.fromCache}`);
          console.log(`[useAIChat]   pendingWrites : ${snap.metadata.hasPendingWrites}`);

          const msgs: ChatMessage[] = snap.docs.map((d) => {
            const data = d.data() as Omit<ChatMessage, "id">;
            console.log(
              `[useAIChat]   doc[${d.id.slice(0, 8)}] role=${data.role} | userId=${data.userId} | provider=${data.provider ?? ""} | ts=${data.timestamp ? "yes" : "null"} | len=${data.content?.length ?? 0}`
            );
            return { id: d.id, ...data };
          });

          if (msgs.length > 0) {
            console.log(`[useAIChat]   first: role=${msgs[0].role}, content="${msgs[0].content.slice(0, 60)}..."`);
            console.log(`[useAIChat]   last : role=${msgs[msgs.length - 1].role}, content="${msgs[msgs.length - 1].content.slice(0, 60)}..."`);
          }

          // Reset retry count on successful snapshot
          retryCount = 0;

          setFirestoreMessages(msgs);

          // Drop optimistic messages that are now confirmed in Firestore
          setOptimisticMessages((prev) => {
            if (prev.length === 0) return prev;
            const firestoreContents = new Set(msgs.map((m) => m.content));
            const remaining = prev.filter((om) => !firestoreContents.has(om.content));
            if (remaining.length !== prev.length) {
              console.log(`[useAIChat] Cleared ${prev.length - remaining.length} optimistic message(s)`);
            }
            return remaining;
          });

          setLoading(false);
          setInitialLoadDone(true);
        },
        (error) => {
          console.error(`[useAIChat] ── Listener ERROR ──`);
          console.error(`[useAIChat]   code   : ${error.code}`);
          console.error(`[useAIChat]   message: ${error.message}`);
          console.error(`[useAIChat]   query  : projectId="${projectId}", orderBy=timestamp`);

          // Handle failed-precondition: index not ready yet
          if (error.code === "failed-precondition") {
            console.warn(`[useAIChat] ⚠️  Composite index not yet available (error: ${error.message})`);
            console.warn(`[useAIChat]    Required index: collection=aiChats, fields=[projectId ASC, timestamp ASC]`);
            console.warn(`[useAIChat]    Please deploy firestore.indexes.json or check Firestore console`);

            // Retry with exponential backoff
            if (retryCount < MAX_RETRIES) {
              const delayMs = Math.pow(2, retryCount) * 2000;
              retryCount++;
              console.log(`[useAIChat] Retrying in ${delayMs}ms (attempt ${retryCount}/${MAX_RETRIES})`);

              const timeout = setTimeout(() => {
                console.log(`[useAIChat] Retrying listener setup...`);
                setupListener();
              }, delayMs);

              // Store timeout for cleanup
              (setupListener as any).__timeout = timeout;
            } else {
              console.error(`[useAIChat] ❌ Max retries (${MAX_RETRIES}) exceeded. Index creation may be delayed.`);
              setLoading(false);
              setInitialLoadDone(true);
            }
          } else {
            // Other errors: mark as done to prevent infinite loading
            console.error(`[useAIChat] ❌ Unrecoverable listener error:`, error);
            setLoading(false);
            setInitialLoadDone(true);
          }
        }
      );

      return unsub;
    };

    const unsub = setupListener();

    return () => {
      console.log(`[useAIChat] Detaching listener for project: ${projectId}`);
      if ((setupListener as any).__timeout) {
        clearTimeout((setupListener as any).__timeout);
      }
      unsub?.();
    };
  }, [projectId, userId]);

  // ── Compose displayed messages ─────────────────────────────────────────────
  // Always: firestoreMessages + optimisticMessages (deduped by content).
  // If the combined list is empty → show the welcome message card.

  const messages: ChatMessage[] = (() => {
    // While initial load is pending, return nothing (prevents flicker)
    if (!initialLoadDone) return [];

    const combined = [...firestoreMessages, ...optimisticMessages];

    if (combined.length === 0) {
      // Empty chat — return welcome sentinel so the page can show the welcome card
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
  //
  // KEY FIX: AI assistant responses are saved with userId = the real signed-in
  // user's uid (not "ai-assistant") so that Firestore rules accept the write.
  // The `role` field already distinguishes user vs assistant messages.

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

      // ── Step 1: Show user message instantly (optimistic) ──────────────────
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
      console.log("[useAIChat] Optimistic user message added instantly");

      // ── Step 2: Persist user message to Firestore ─────────────────────────
      setSending(true);
      try {
        const userDocRef = await addDoc(collection(db, "aiChats"), {
          projectId,
          userId,           // ✅ real user uid — satisfies Firestore rules
          role: "user",
          content: trimmed,
          provider: "",
          timestamp: serverTimestamp(),
        });
        console.log(`[useAIChat] User message saved → doc: ${userDocRef.id}`);
      } catch (err) {
        console.error("[useAIChat] ❌ Failed to save user message:", err);
        // Remove the optimistic message if write failed
        setOptimisticMessages((prev) =>
          prev.filter((m) => m.id !== optimisticId)
        );
        setSending(false);
        return;
      } finally {
        setSending(false);
      }

      // ── Step 3: Build conversation history for AI context ─────────────────
      const recentMessages = [
        ...firestoreMessages.slice(-20).map((m) => ({
          role: m.role,
          content: m.content,
        })),
        { role: "user" as const, content: trimmed },
      ];
      console.log(
        `[useAIChat] Sending ${recentMessages.length} messages to AI API (last 20 + current)`
      );

      // ── Step 4: Call AI API ───────────────────────────────────────────────
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
          throw new Error(errData.error || `API error (${res.status})`);
        }

        const data = await res.json();
        console.log(`[useAIChat] AI response received. provider=${data.provider}, len=${data.response?.length}`);

        // ── Step 5: Persist AI response to Firestore ──────────────────────
        // CRITICAL: userId must be the signed-in user's uid (not "ai-assistant")
        // because Firestore rules enforce: request.resource.data.userId == request.auth.uid
        const aiDocRef = await addDoc(collection(db, "aiChats"), {
          projectId,
          userId,                           // ✅ real user uid
          role: "assistant",                // role distinguishes it as AI output
          content: data.response,
          provider: data.provider || "gemini",
          timestamp: serverTimestamp(),
        });
        console.log(`[useAIChat] AI response saved → doc: ${aiDocRef.id}`);

      } catch (error) {
        console.error("[useAIChat] ❌ AI API / save error:", error);
        // Save an error message so the user can see it in the chat
        try {
          await addDoc(collection(db, "aiChats"), {
            projectId,
            userId,                         // ✅ real user uid
            role: "assistant",
            content: "⚠️ Unable to connect to AI provider. Please check your API keys in Settings.",
            provider: "",
            timestamp: serverTimestamp(),
          });
        } catch (saveErr) {
          console.error("[useAIChat] ❌ Could not even save error message:", saveErr);
        }
      } finally {
        setAiResponding(false);
      }
    },
    [projectId, userId, firestoreMessages]
  );

  // ── Legacy helpers ────────────────────────────────────────────────────────

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
        userId,   // ✅ real user uid
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
