"use client";

import { useCallback } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { type GeneratedPrompt, type PromptType, type CodeTool } from "@/lib/aiSystemPrompt";

/**
 * Hook to manage generated prompts in Vibe Coding Mode.
 * Handles creation, updating, retrieval, and deletion of prompts.
 */
export function useVibePrompts(projectId: string | undefined) {
  // Save a generated prompt to Firestore
  const savePrompt = useCallback(
    async (
      prompt: Omit<GeneratedPrompt, "id" | "createdAt">,
      userId: string
    ) => {
      if (!projectId) return null;

      try {
        const docRef = await addDoc(collection(db, "generatedPrompts"), {
          ...prompt,
          projectId,
          createdBy: userId,
          createdAt: serverTimestamp(),
        });

        console.log(
          `[useVibePrompts] Saved prompt: ${docRef.id} (${prompt.promptType} - ${prompt.title})`
        );
        return docRef.id;
      } catch (error) {
        console.error("[useVibePrompts] Failed to save prompt:", error);
        return null;
      }
    },
    [projectId]
  );

  // Update prompt metadata
  const updatePrompt = useCallback(
    async (promptId: string, updates: Partial<GeneratedPrompt>) => {
      try {
        await updateDoc(doc(db, "generatedPrompts", promptId), updates);
        console.log(`[useVibePrompts] Updated prompt ${promptId}`);
      } catch (error) {
        console.error("[useVibePrompts] Failed to update prompt:", error);
      }
    },
    []
  );

  // Delete a prompt
  const deletePrompt = useCallback(async (promptId: string) => {
    try {
      await deleteDoc(doc(db, "generatedPrompts", promptId));
      console.log(`[useVibePrompts] Deleted prompt ${promptId}`);
    } catch (error) {
      console.error("[useVibePrompts] Failed to delete prompt:", error);
    }
  }, []);

  // Get all prompts for a project
  const getPrompts = useCallback(
    (callback: (prompts: (GeneratedPrompt & { id: string })[]) => void) => {
      if (!projectId) return () => {};

      const q = query(
        collection(db, "generatedPrompts"),
        where("projectId", "==", projectId)
      );

      const unsubscribe = onSnapshot(
        q,
        (snap) => {
          const prompts = snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          } as GeneratedPrompt & { id: string }));
          callback(prompts);
        },
        (error) => {
          console.error("[useVibePrompts] Failed to get prompts:", error);
        }
      );

      return unsubscribe;
    },
    [projectId]
  );

  // Filter prompts by type
  const getPromptsByType = useCallback(
    (type: PromptType, callback: (prompts: (GeneratedPrompt & { id: string })[]) => void) => {
      if (!projectId) return () => {};

      const q = query(
        collection(db, "generatedPrompts"),
        where("projectId", "==", projectId),
        where("promptType", "==", type)
      );

      const unsubscribe = onSnapshot(
        q,
        (snap) => {
          const prompts = snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          } as GeneratedPrompt & { id: string }));
          callback(prompts);
        },
        (error) => {
          console.error("[useVibePrompts] Failed to filter prompts:", error);
        }
      );

      return unsubscribe;
    },
    [projectId]
  );

  // Filter prompts by tool
  const getPromptsByTool = useCallback(
    (tool: CodeTool, callback: (prompts: (GeneratedPrompt & { id: string })[]) => void) => {
      if (!projectId) return () => {};

      const q = query(
        collection(db, "generatedPrompts"),
        where("projectId", "==", projectId),
        where("tool", "==", tool)
      );

      const unsubscribe = onSnapshot(
        q,
        (snap) => {
          const prompts = snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          } as GeneratedPrompt & { id: string }));
          callback(prompts);
        },
        (error) => {
          console.error("[useVibePrompts] Failed to get prompts by tool:", error);
        }
      );

      return unsubscribe;
    },
    [projectId]
  );

  return {
    savePrompt,
    updatePrompt,
    deletePrompt,
    getPrompts,
    getPromptsByType,
    getPromptsByTool,
  };
}
