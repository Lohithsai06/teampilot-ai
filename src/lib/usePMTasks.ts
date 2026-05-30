"use client";

import { useCallback } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { type Task } from "@/lib/aiSystemPrompt";

/**
 * Hook to manage tasks in PM Mode.
 * Handles creation, updating, and real-time retrieval of tasks.
 */
export function usePMTasks(projectId: string | undefined) {
  // Save a new task to Firestore
  const createTask = useCallback(
    async (task: Omit<Task, "id" | "createdAt">) => {
      if (!projectId) return null;

      try {
        const docRef = await addDoc(collection(db, "tasks"), {
          ...task,
          projectId,
          createdAt: serverTimestamp(),
        });

        console.log(`[usePMTasks] Created task: ${docRef.id} (${task.title})`);
        return docRef.id;
      } catch (error) {
        console.error("[usePMTasks] Failed to create task:", error);
        return null;
      }
    },
    [projectId]
  );

  // Update task status
  const updateTaskStatus = useCallback(
    async (taskId: string, status: Task["status"]) => {
      try {
        await updateDoc(doc(db, "tasks", taskId), { status });
        console.log(`[usePMTasks] Updated task ${taskId} status to ${status}`);
      } catch (error) {
        console.error("[usePMTasks] Failed to update task:", error);
      }
    },
    []
  );

  // Batch create multiple tasks
  const createMultipleTasks = useCallback(
    async (tasks: Omit<Task, "id" | "createdAt">[]) => {
      if (!projectId) return [];

      const taskIds: string[] = [];

      for (const task of tasks) {
        const taskId = await createTask(task);
        if (taskId) {
          taskIds.push(taskId);
        }
      }

      console.log(`[usePMTasks] Created ${taskIds.length} tasks`);
      return taskIds;
    },
    [projectId, createTask]
  );

  return {
    createTask,
    createMultipleTasks,
    updateTaskStatus,
  };
}
