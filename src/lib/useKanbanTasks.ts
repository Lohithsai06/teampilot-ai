"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  updateDoc,
  doc,
  getDocs,
  serverTimestamp,
  Timestamp,
  addDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { type Task } from "@/lib/aiSystemPrompt";

export interface KanbanStats {
  total: number;
  backlog: number;
  todo: number;
  inProgress: number;
  review: number;
  testing: number;
  completed: number;
  blocked: number;
  completionRate: number;
}

export interface KanbanColumn {
  tasks: Task[];
  count: number;
}

export type KanbanColumns = Record<Task["status"], KanbanColumn>;

export function useKanbanTasks(
  projectId: string | undefined,
  userId: string | undefined,
  currentPhaseNumber?: number
) {
  const [columns, setColumns] = useState<KanbanColumns>({
    backlog: { tasks: [], count: 0 },
    todo: { tasks: [], count: 0 },
    "in-progress": { tasks: [], count: 0 },
    review: { tasks: [], count: 0 },
    testing: { tasks: [], count: 0 },
    completed: { tasks: [], count: 0 },
  });

  const [allTasks, setAllTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // ── 1. Real-time listener for all project tasks ────────────────────────

  useEffect(() => {
    if (!projectId) {
      setAllTasks([]);
      setColumns({
        backlog: { tasks: [], count: 0 },
        todo: { tasks: [], count: 0 },
        "in-progress": { tasks: [], count: 0 },
        review: { tasks: [], count: 0 },
        testing: { tasks: [], count: 0 },
        completed: { tasks: [], count: 0 },
      });
      setLoading(false);
      return;
    }

    setLoading(true);
    console.log(`[useKanbanTasks] ── Attaching tasks listener ──`);
    console.log(`[useKanbanTasks]   projectId: ${projectId}`);
    console.log(`[useKanbanTasks]   currentPhaseNumber: ${currentPhaseNumber}`);

    // Simple query: only where(), NO orderBy() — avoids composite index
    const q = query(
      collection(db, "tasks"),
      where("projectId", "==", projectId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        console.log(`[useKanbanTasks] ── Tasks snapshot received ──`);
        console.log(`[useKanbanTasks]   docs count: ${snap.docs.length}`);

        const tasks = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Task[];

        // Sort by createdAt descending (newest first)
        tasks.sort((a, b) => {
          const aTime = a.createdAt?.toMillis?.() ?? 0;
          const bTime = b.createdAt?.toMillis?.() ?? 0;
          return bTime - aTime;
        });

        console.log(`[useKanbanTasks]   Organizing ${tasks.length} tasks by status`);

        // Organize by status
        const newColumns: KanbanColumns = {
          backlog: { tasks: [], count: 0 },
          todo: { tasks: [], count: 0 },
          "in-progress": { tasks: [], count: 0 },
          review: { tasks: [], count: 0 },
          testing: { tasks: [], count: 0 },
          completed: { tasks: [], count: 0 },
        };

        tasks.forEach((task) => {
          const status = task.status;
          newColumns[status].tasks.push(task);
          newColumns[status].count += 1;
        });

        setAllTasks(tasks);
        setColumns(newColumns);
        setLoading(false);
        setError(null);

        console.log(`[useKanbanTasks] ✅ Tasks organized:`, {
          backlog: newColumns.backlog.count,
          todo: newColumns.todo.count,
          "in-progress": newColumns["in-progress"].count,
          review: newColumns.review.count,
          testing: newColumns.testing.count,
          completed: newColumns.completed.count,
        });
      },
      (err) => {
        console.error(`[useKanbanTasks] ── Tasks listener ERROR ──`);
        console.error(`[useKanbanTasks]   code: ${err.code}`);
        console.error(`[useKanbanTasks]   message: ${err.message}`);

        if (err.code === "permission-denied") {
          setError("You don't have permission to view these tasks.");
        } else if (err.code === "unavailable") {
          setError("Network error. Please check your connection.");
        } else {
          setError(`Failed to load tasks: ${err.message}`);
        }
        setLoading(false);
      }
    );

    unsubscribeRef.current = unsubscribe;

    return () => {
      console.log(`[useKanbanTasks] Detaching tasks listener for project: ${projectId}`);
      unsubscribe?.();
    };
  }, [projectId]);

  // ── 2. Update task status (drag-drop) ───────────────────────────────────

  const updateTaskStatus = useCallback(
    async (taskId: string, newStatus: Task["status"]) => {
      try {
        console.log(`[useKanbanTasks] ── Updating task status ──`);
        console.log(`[useKanbanTasks]   taskId: ${taskId}`);
        console.log(`[useKanbanTasks]   newStatus: ${newStatus}`);

        await updateDoc(doc(db, "tasks", taskId), {
          status: newStatus,
          updatedAt: serverTimestamp(),
        });

        console.log(`[useKanbanTasks] ✅ Task status updated`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`[useKanbanTasks] ❌ Failed to update task status:`, message);
        setError(`Failed to update task: ${message}`);
      }
    },
    []
  );

  // ── 2b. Update task (for editing from details modal) ───────────────────

  const updateTask = useCallback(
    async (taskId: string, updates: Partial<Task>) => {
      try {
        console.log(`[useKanbanTasks] ── Updating task ──`);
        console.log(`[useKanbanTasks]   taskId: ${taskId}`);
        console.log(`[useKanbanTasks]   updates:`, Object.keys(updates).join(", "));

        await updateDoc(doc(db, "tasks", taskId), {
          ...updates,
          updatedAt: serverTimestamp(),
        });

        console.log(`[useKanbanTasks] ✅ Task updated`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`[useKanbanTasks] ❌ Failed to update task:`, message);
        setError(`Failed to update task: ${message}`);
      }
    },
    []
  );

  // ── 3. Update task assignee ────────────────────────────────────────────

  const updateTaskAssignee = useCallback(
    async (taskId: string, assigneeId: string, assigneeName: string, assigneeRole: string) => {
      try {
        console.log(`[useKanbanTasks] ── Updating task assignee ──`);
        console.log(`[useKanbanTasks]   taskId: ${taskId}`);
        console.log(`[useKanbanTasks]   assigneeId: ${assigneeId}`);

        await updateDoc(doc(db, "tasks", taskId), {
          assignedTo: assigneeId,
          assignedToName: assigneeName,
          assignedToRole: assigneeRole,
          updatedAt: serverTimestamp(),
        });

        console.log(`[useKanbanTasks] ✅ Task assignee updated`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`[useKanbanTasks] ❌ Failed to update task assignee:`, message);
        setError(`Failed to reassign task: ${message}`);
      }
    },
    []
  );

  // ── 4. Create new task ─────────────────────────────────────────────────

  const createTask = useCallback(
    async (taskData: Omit<Task, "id" | "createdAt">) => {
      if (!projectId || !userId) return null;

      try {
        console.log(`[useKanbanTasks] ── Creating new task ──`);
        console.log(`[useKanbanTasks]   title: ${taskData.title}`);
        console.log(`[useKanbanTasks]   assignedTo: ${taskData.assignedTo}`);

        const docRef = await addDoc(collection(db, "tasks"), {
          ...taskData,
          projectId,
          createdBy: userId,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        console.log(`[useKanbanTasks] ✅ Task created: ${docRef.id}`);
        return docRef.id;
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error(`[useKanbanTasks] ❌ Failed to create task:`, message);
        setError(`Failed to create task: ${message}`);
        return null;
      }
    },
    [projectId, userId]
  );

  // ── 5. Delete task (leader only) ────────────────────────────────────────

  const deleteTask = useCallback(async (taskId: string) => {
    try {
      console.log(`[useKanbanTasks] ── Deleting task ──`);
      console.log(`[useKanbanTasks]   taskId: ${taskId}`);

      await deleteDoc(doc(db, "tasks", taskId));

      console.log(`[useKanbanTasks] ✅ Task deleted`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.error(`[useKanbanTasks] ❌ Failed to delete task:`, message);
      setError(`Failed to delete task: ${message}`);
    }
  }, []);

  // ── 6. Filter tasks by phase ───────────────────────────────────────────

  const getTasksByPhase = useCallback(
    (phaseNumber: number) => {
      return allTasks.filter((t) => t.phase === phaseNumber || t.status === "backlog");
    },
    [allTasks]
  );

  // ── 7. Filter tasks by member ──────────────────────────────────────────

  const getTasksByMember = useCallback(
    (memberId: string) => {
      return allTasks.filter((t) => t.assignedTo === memberId);
    },
    [allTasks]
  );

  // ── 8. Calculate analytics ─────────────────────────────────────────────

  const getAnalytics = useCallback((): KanbanStats => {
    const stats: KanbanStats = {
      total: allTasks.length,
      backlog: columns.backlog.count,
      todo: columns.todo.count,
      inProgress: columns["in-progress"].count,
      review: columns.review.count,
      testing: columns.testing.count,
      completed: columns.completed.count,
      blocked: 0,
      completionRate: 0,
    };

    // Calculate completion rate
    if (stats.total > 0) {
      stats.completionRate = Math.round((stats.completed / stats.total) * 100);
    }

    console.log(`[useKanbanTasks] Analytics:`, stats);
    return stats;
  }, [columns, allTasks]);

  return {
    columns,
    allTasks,
    loading,
    error,
    updateTaskStatus,
    updateTask,
    updateTaskAssignee,
    createTask,
    deleteTask,
    getTasksByPhase,
    getTasksByMember,
    getAnalytics,
  };
}
