"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Roadmap {
  id: string;
  projectId: string;
  generatedBy: string;
  generatedAt: Timestamp | null;
  projectSummary: string;
  status: "active" | "completed" | "archived";
  currentPhase: number;
  totalPhases: number;
}

export type PhaseStatus = "not_started" | "in_progress" | "completed" | "blocked";

export interface RoadmapPhase {
  id: string;
  roadmapId: string;
  projectId: string;
  phaseNumber: number;
  title: string;
  description: string;
  objectives: string[];
  deliverables: string[];
  estimatedDuration: string;
  status: PhaseStatus;
  dependencies: string[];
  risks: string[];
  createdAt: Timestamp | null;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useRoadmap(
  projectId: string | undefined,
  userId: string | undefined
) {
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  const [phases, setPhases] = useState<RoadmapPhase[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // ── 1. Listen to roadmaps for this project ────────────────────────────────
  //
  // NOTE: We intentionally avoid orderBy("generatedAt","desc") here.
  // That combination with where("projectId","==",…) requires a composite
  // index (projectId ASC, generatedAt DESC).  If the index hasn't been
  // deployed or is still building, Firestore throws "failed-precondition".
  // Instead we fetch all roadmaps for the project (typically just 1) and
  // sort client-side to pick the latest.

  useEffect(() => {
    if (!projectId) {
      setRoadmap(null);
      setPhases([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    console.log(`[useRoadmap] ── Attaching roadmap listener ──`);
    console.log(`[useRoadmap]   projectId : ${projectId}`);
    console.log(`[useRoadmap]   userId    : ${userId}`);
    console.log(`[useRoadmap]   collection: roadmaps`);
    console.log(`[useRoadmap]   filter    : projectId == "${projectId}"`);
    console.log(`[useRoadmap]   sort      : client-side by generatedAt DESC`);

    // Simple query: only where(), NO orderBy() — avoids composite index requirement
    const q = query(
      collection(db, "roadmaps"),
      where("projectId", "==", projectId)
    );

    let retryCount = 0;
    const MAX_RETRIES = 3;

    const setupListener = () => {
      const unsub = onSnapshot(
        q,
        (snap) => {
          console.log(`[useRoadmap] ── Roadmap snapshot received ──`);
          console.log(`[useRoadmap]   docs count    : ${snap.docs.length}`);
          console.log(`[useRoadmap]   fromCache     : ${snap.metadata.fromCache}`);

          retryCount = 0; // Reset on success

          if (snap.empty) {
            console.log(`[useRoadmap]   result: no roadmaps found`);
            setRoadmap(null);
            setPhases([]);
            setLoading(false);
          } else {
            // Sort client-side: pick the most recently generated roadmap
            const allRoadmaps = snap.docs.map((d) => ({
              id: d.id,
              ...d.data(),
            })) as Roadmap[];

            allRoadmaps.sort((a, b) => {
              const aTime = a.generatedAt?.toMillis?.() ?? 0;
              const bTime = b.generatedAt?.toMillis?.() ?? 0;
              return bTime - aTime; // DESC — newest first
            });

            const latest = allRoadmaps[0];
            console.log(`[useRoadmap]   latest roadmap: ${latest.id} (${latest.totalPhases} phases, status=${latest.status})`);
            setRoadmap(latest);
          }
          setLoading(false);
        },
        (err) => {
          console.error(`[useRoadmap] ── Roadmap listener ERROR ──`);
          console.error(`[useRoadmap]   code   : ${err.code}`);
          console.error(`[useRoadmap]   message: ${err.message}`);

          if (err.code === "failed-precondition") {
            console.warn(`[useRoadmap] ⚠️  Composite index not available yet`);
            console.warn(`[useRoadmap]    This should not happen with the simplified query.`);
            console.warn(`[useRoadmap]    If it does, check Firestore rules or index deployment.`);

            if (retryCount < MAX_RETRIES) {
              const delayMs = Math.pow(2, retryCount) * 2000;
              retryCount++;
              console.log(`[useRoadmap] Retrying in ${delayMs}ms (attempt ${retryCount}/${MAX_RETRIES})`);
              retryTimeoutRef.current = setTimeout(() => {
                setupListener();
              }, delayMs);
            } else {
              console.error(`[useRoadmap] ❌ Max retries exceeded.`);
              setError("Roadmap index is still building. Please try again in a few minutes.");
              setLoading(false);
            }
          } else if (err.code === "permission-denied") {
            console.error(`[useRoadmap] ❌ Permission denied — user may not be a project member`);
            setError("You don't have permission to view this roadmap.");
            setLoading(false);
          } else if (err.code === "not-found") {
            console.error(`[useRoadmap] ❌ Collection or document not found`);
            setRoadmap(null);
            setLoading(false);
          } else if (err.code === "unavailable") {
            console.error(`[useRoadmap] ❌ Network unavailable`);
            setError("Network error. Please check your connection.");
            setLoading(false);
          } else {
            console.error(`[useRoadmap] ❌ Unrecoverable error:`, err);
            setError(`Failed to load roadmap: ${err.message}`);
            setLoading(false);
          }
        }
      );

      return unsub;
    };

    const unsub = setupListener();

    return () => {
      console.log(`[useRoadmap] Detaching roadmap listener for project: ${projectId}`);
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      unsub?.();
    };
  }, [projectId, userId]);

  // ── 2. Listen to phases when roadmap exists ───────────────────────────────
  //
  // Same approach: avoid orderBy() in query, sort client-side by phaseNumber.

  useEffect(() => {
    if (!roadmap) {
      setPhases([]);
      return;
    }

    console.log(`[useRoadmap] ── Attaching phases listener ──`);
    console.log(`[useRoadmap]   roadmapId : ${roadmap.id}`);
    console.log(`[useRoadmap]   collection: roadmapPhases`);
    console.log(`[useRoadmap]   filter    : roadmapId == "${roadmap.id}"`);
    console.log(`[useRoadmap]   sort      : client-side by phaseNumber ASC`);

    // Simple query: only where(), NO orderBy()
    const q = query(
      collection(db, "roadmapPhases"),
      where("roadmapId", "==", roadmap.id)
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        console.log(`[useRoadmap] ── Phases snapshot received ──`);
        console.log(`[useRoadmap]   docs count: ${snap.docs.length}`);

        const phaseDocs = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as RoadmapPhase[];

        // Sort client-side by phaseNumber ascending
        phaseDocs.sort((a, b) => a.phaseNumber - b.phaseNumber);

        console.log(`[useRoadmap]   phases (sorted): ${phaseDocs.map((p) => `${p.phaseNumber}:${p.title}`).join(", ")}`);
        setPhases(phaseDocs);
      },
      (err) => {
        console.error(`[useRoadmap] ── Phases listener ERROR ──`);
        console.error(`[useRoadmap]   code   : ${err.code}`);
        console.error(`[useRoadmap]   message: ${err.message}`);

        if (err.code === "failed-precondition") {
          console.warn(`[useRoadmap] ⚠️  Phase index issue — should not happen with simplified query`);
        } else if (err.code === "permission-denied") {
          setError("You don't have permission to view roadmap phases.");
        } else {
          setError(`Failed to load phases: ${err.message}`);
        }
      }
    );

    return () => unsub();
  }, [roadmap?.id]);

  // ── 3. Generate roadmap via AI ────────────────────────────────────────────

  const generateRoadmap = useCallback(
    async (
      aiSettings: {
        geminiApiKey: string;
        openRouterApiKey: string;
        preferredProvider: "gemini" | "openrouter" | "none";
        fallbackProvider: "gemini" | "openrouter" | "none";
      },
      projectContext: {
        projectName: string;
        projectDescription: string;
        teamMembers: { name: string; role: string }[];
        leaderName: string;
        projectCode: string;
      }
    ) => {
      if (!projectId || !userId) return;

      setGenerating(true);
      setError(null);

      try {
        // Step 1: Call the AI API to generate the roadmap
        console.log(`[useRoadmap] ── Generating roadmap ──`);
        console.log(`[useRoadmap]   projectId: ${projectId}`);
        console.log(`[useRoadmap]   userId   : ${userId}`);
        console.log(`[useRoadmap]   project  : ${projectContext.projectName}`);

        const res = await fetch("/api/generate-roadmap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            geminiApiKey: aiSettings.geminiApiKey,
            openRouterApiKey: aiSettings.openRouterApiKey,
            preferredProvider: aiSettings.preferredProvider,
            fallbackProvider: aiSettings.fallbackProvider,
            projectContext,
          }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || `API error (${res.status})`);
        }

        const data = await res.json();
        const { projectSummary, phases: aiPhases } = data;

        console.log(`[useRoadmap]   AI returned ${aiPhases?.length ?? 0} phases`);

        if (!aiPhases || !Array.isArray(aiPhases) || aiPhases.length === 0) {
          throw new Error("AI returned empty or invalid roadmap data");
        }

        // Step 2: Delete existing roadmap + phases for this project (replace)
        // Uses simple where() only — no composite index needed
        const existingRoadmaps = await getDocs(
          query(
            collection(db, "roadmaps"),
            where("projectId", "==", projectId)
          )
        );

        console.log(`[useRoadmap]   Cleaning up ${existingRoadmaps.docs.length} existing roadmap(s)`);

        for (const rdoc of existingRoadmaps.docs) {
          const existingPhases = await getDocs(
            query(
              collection(db, "roadmapPhases"),
              where("roadmapId", "==", rdoc.id)
            )
          );
          for (const pdoc of existingPhases.docs) {
            await deleteDoc(doc(db, "roadmapPhases", pdoc.id));
          }
          await deleteDoc(doc(db, "roadmaps", rdoc.id));
        }

        // Step 3: Create new roadmap document
        const roadmapRef = await addDoc(collection(db, "roadmaps"), {
          projectId,
          generatedBy: userId,
          generatedAt: serverTimestamp(),
          projectSummary: projectSummary || "",
          status: "active",
          currentPhase: 1,
          totalPhases: aiPhases.length,
        });

        console.log(`[useRoadmap]   Created roadmap doc: ${roadmapRef.id}`);

        // Step 4: Create phase documents
        for (let i = 0; i < aiPhases.length; i++) {
          const phase = aiPhases[i];
          const phaseRef = await addDoc(collection(db, "roadmapPhases"), {
            roadmapId: roadmapRef.id,
            projectId,
            phaseNumber: phase.phaseNumber || i + 1,
            title: phase.title || `Phase ${i + 1}`,
            description: phase.description || "",
            objectives: Array.isArray(phase.objectives) ? phase.objectives : [],
            deliverables: Array.isArray(phase.deliverables) ? phase.deliverables : [],
            estimatedDuration: phase.estimatedDuration || "TBD",
            status: i === 0 ? "in_progress" : "not_started",
            dependencies: Array.isArray(phase.dependencies) ? phase.dependencies : [],
            risks: Array.isArray(phase.risks) ? phase.risks : [],
            createdAt: serverTimestamp(),
          });
          console.log(`[useRoadmap]   Created phase ${i + 1}: ${phase.title} (${phaseRef.id})`);
        }

        console.log(`[useRoadmap] ✅ Roadmap generated successfully with ${aiPhases.length} phases`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        console.error("[useRoadmap] ❌ Generation error:", message);
        setError(message);
      } finally {
        setGenerating(false);
      }
    },
    [projectId, userId]
  );

  // ── 4. Mark a phase as completed ──────────────────────────────────────────

  const completePhase = useCallback(
    async (phaseId: string) => {
      if (!roadmap) return;

      try {
        // Mark this phase as completed
        await updateDoc(doc(db, "roadmapPhases", phaseId), {
          status: "completed",
        });

        // Find the next phase and set it to in_progress
        const completedPhase = phases.find((p) => p.id === phaseId);
        if (completedPhase) {
          const nextPhase = phases.find(
            (p) => p.phaseNumber === completedPhase.phaseNumber + 1
          );

          if (nextPhase) {
            await updateDoc(doc(db, "roadmapPhases", nextPhase.id), {
              status: "in_progress",
            });

            // Update the roadmap's currentPhase
            await updateDoc(doc(db, "roadmaps", roadmap.id), {
              currentPhase: nextPhase.phaseNumber,
            });
          } else {
            // All phases completed
            await updateDoc(doc(db, "roadmaps", roadmap.id), {
              status: "completed",
            });
          }
        }

        console.log(`[useRoadmap] ✅ Phase ${phaseId} marked as completed`);
      } catch (err) {
        console.error("[useRoadmap] ❌ Failed to complete phase:", err);
        if (err instanceof Error && err.message.includes("permission")) {
          setError("You don't have permission to update this phase.");
        }
      }
    },
    [roadmap, phases]
  );

  // ── 5. Update phase status ────────────────────────────────────────────────

  const updatePhaseStatus = useCallback(
    async (phaseId: string, status: PhaseStatus) => {
      try {
        await updateDoc(doc(db, "roadmapPhases", phaseId), { status });
        console.log(`[useRoadmap] ✅ Phase ${phaseId} status → ${status}`);
      } catch (err) {
        console.error("[useRoadmap] ❌ Failed to update phase status:", err);
        if (err instanceof Error && err.message.includes("permission")) {
          setError("You don't have permission to update this phase.");
        }
      }
    },
    []
  );

  // ── 6. Computed values ────────────────────────────────────────────────────

  const completedPhases = phases.filter((p) => p.status === "completed").length;
  const totalPhases = roadmap?.totalPhases ?? phases.length;
  const progressPercentage =
    totalPhases === 0 ? 0 : Math.round((completedPhases / totalPhases) * 100);
  const currentActivePhase = phases.find((p) => p.status === "in_progress") || null;
  const remainingPhases = totalPhases - completedPhases;

  return {
    roadmap,
    phases,
    loading,
    generating,
    error,
    generateRoadmap,
    completePhase,
    updatePhaseStatus,
    completedPhases,
    totalPhases,
    progressPercentage,
    currentActivePhase,
    remainingPhases,
  };
}
