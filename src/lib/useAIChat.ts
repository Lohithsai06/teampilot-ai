"use client";

import { useState, useEffect, useRef } from "react";
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

export interface ChatMessage {
  id: string;
  projectId: string;
  userId: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: Timestamp | null;
}

export function useAIChat(projectId: string | undefined, userId: string | undefined) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!projectId || !userId) {
      setMessages([]);
      return;
    }

    setLoading(true);

    const q = query(
      collection(db, "aiChats"),
      where("projectId", "==", projectId),
      orderBy("timestamp", "asc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const msgs = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<ChatMessage, "id">),
      }));
      setMessages(msgs);
      setLoading(false);
    });

    return () => unsub();
  }, [projectId, userId]);

  const sendMessage = async (content: string) => {
    if (!projectId || !userId || !content.trim()) return;
    setSending(true);
    try {
      await addDoc(collection(db, "aiChats"), {
        projectId,
        userId,
        role: "user",
        content: content.trim(),
        timestamp: serverTimestamp(),
      });
    } finally {
      setSending(false);
    }
  };

  // Helper to append an assistant message (called when AI responds later)
  const appendAssistant = async (content: string) => {
    if (!projectId || !userId) return;
    await addDoc(collection(db, "aiChats"), {
      projectId,
      userId,
      role: "assistant",
      content,
      timestamp: serverTimestamp(),
    });
  };

  return { messages, loading, sending, sendMessage, appendAssistant };
}
