"use client";

import { useEffect } from "react";
import {
  collection,
  doc,
  setDoc,
  serverTimestamp,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { type AgentMode, type AgentSession } from "@/lib/aiSystemPrompt";

/**
 * Hook to persist and restore active agent mode for a project.
 * Stores in Firestore agentSessions collection.
 */
export function useAgentMode(
  projectId: string | undefined,
  userId: string | undefined,
  activeMode: AgentMode
) {
  // Save mode to Firestore when it changes
  useEffect(() => {
    if (!projectId || !userId) return;

    const saveMode = async () => {
      try {
        const sessionDocRef = doc(
          db,
          "agentSessions",
          `${projectId}_${userId}`
        );

        await setDoc(
          sessionDocRef,
          {
            projectId,
            userId,
            activeMode,
            updatedAt: serverTimestamp(),
          } as AgentSession,
          { merge: true }
        );

        console.log(`[useAgentMode] Saved mode "${activeMode}" for project ${projectId}`);
      } catch (error) {
        console.error("[useAgentMode] Failed to save mode:", error);
      }
    };

    saveMode();
  }, [projectId, userId, activeMode]);

  // Load saved mode from Firestore (when component mounts or projectId changes)
  useEffect(() => {
    if (!projectId || !userId) return;

    const q = query(
      collection(db, "agentSessions"),
      where("projectId", "==", projectId),
      where("userId", "==", userId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        if (!snap.empty) {
          const session = snap.docs[0].data() as AgentSession;
          console.log(`[useAgentMode] Loaded mode from Firestore: ${session.activeMode}`);
        }
      },
      (error) => {
        console.error("[useAgentMode] Failed to load mode:", error);
      }
    );

    return () => unsubscribe();
  }, [projectId, userId]);
}
