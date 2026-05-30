"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import {
  collection,
  doc,
  setDoc,
  getDoc,
  addDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Rocket, GitBranch, CheckCircle2 } from "lucide-react";

// ─── Auto Roadmap Generation (fire-and-forget after project creation) ─────────

async function autoGenerateRoadmap(
  projectId: string,
  userId: string,
  projectName: string,
  projectDescription: string,
  leaderName: string,
  projectCode: string
) {
  try {
    console.log(`[AutoRoadmap] ── Starting auto-generation ──`);
    console.log(`[AutoRoadmap]   projectId: ${projectId}`);
    console.log(`[AutoRoadmap]   project  : ${projectName}`);

    // Step 1: Read user's AI settings from Firestore
    const userDoc = await getDoc(doc(db, "users", userId));
    if (!userDoc.exists()) {
      console.warn("[AutoRoadmap] User doc not found, skipping auto-generation");
      return;
    }

    const userData = userDoc.data();
    const geminiApiKey = userData.geminiApiKey || "";
    const openRouterApiKey = userData.openRouterApiKey || "";
    const preferredProvider = userData.preferredProvider || "gemini";
    const fallbackProvider = userData.fallbackProvider || "openrouter";

    if (!geminiApiKey && !openRouterApiKey) {
      console.warn("[AutoRoadmap] No AI API keys configured, skipping auto-generation");
      console.warn("[AutoRoadmap] User can generate manually from the Roadmap page");
      return;
    }

    // Step 2: Call the AI roadmap generation API
    const res = await fetch("/api/generate-roadmap", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        geminiApiKey,
        openRouterApiKey,
        preferredProvider,
        fallbackProvider,
        projectContext: {
          projectName,
          projectDescription,
          teamMembers: [{ name: leaderName, role: "leader" }],
          leaderName,
          projectCode,
        },
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error("[AutoRoadmap] API error:", errData.error || res.status);
      return;
    }

    const data = await res.json();
    const { projectSummary, phases } = data;

    if (!phases || !Array.isArray(phases) || phases.length === 0) {
      console.error("[AutoRoadmap] AI returned empty/invalid roadmap");
      return;
    }

    // Step 3: Write roadmap document to Firestore
    const roadmapRef = await addDoc(collection(db, "roadmaps"), {
      projectId,
      generatedBy: userId,
      generatedAt: serverTimestamp(),
      projectSummary: projectSummary || "",
      status: "active",
      currentPhase: 1,
      totalPhases: phases.length,
    });

    console.log(`[AutoRoadmap]   Created roadmap doc: ${roadmapRef.id}`);

    // Step 4: Write phase documents
    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      await addDoc(collection(db, "roadmapPhases"), {
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
    }

    console.log(`[AutoRoadmap] ✅ Auto-generated roadmap with ${phases.length} phases`);
  } catch (err) {
    // Fire-and-forget: log but don't throw
    console.error("[AutoRoadmap] ❌ Auto-generation failed:", err);
  }
}

// ─── Create Project Modal ─────────────────────────────────────────────────────

interface CreateProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreateProjectModal({ open, onOpenChange }: CreateProjectModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    projectName: "",
    projectDescription: "",
    githubRepo: "",
  });

  const generateProjectCode = () => {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let code = "TP-";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.projectName) return;

    setLoading(true);
    try {
      const projectId = crypto.randomUUID();
      const projectCode = generateProjectCode();
      const leaderName = user.displayName || "Anonymous";

      // 1. Create project document
      const projectRef = doc(db, "projects", projectId);
      await setDoc(projectRef, {
        projectId,
        projectName: formData.projectName,
        projectDescription: formData.projectDescription,
        projectCode,
        leaderId: user.uid,
        leaderName,
        githubRepo: formData.githubRepo,
        status: "active",
        currentPhase: 1,
        totalMembers: 1,
        // Task tracking — starts at 0 for every new project
        totalTasks: 0,
        completedTasks: 0,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // 2. Create projectMember document (Leader)
      await setDoc(doc(db, "projectMembers", `${projectId}_${user.uid}`), {
        projectId,
        userId: user.uid,
        name: leaderName,
        email: user.email,
        role: "leader",
        joinedAt: serverTimestamp(),
      });

      // 3. Auto-generate roadmap in the background (fire-and-forget)
      //    This runs asynchronously — modal closes immediately
      autoGenerateRoadmap(
        projectId,
        user.uid,
        formData.projectName,
        formData.projectDescription,
        leaderName,
        projectCode
      );

      onOpenChange(false);
      setFormData({ projectName: "", projectDescription: "", githubRepo: "" });
    } catch (error) {
      console.error("Error creating project:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Rocket className="h-5 w-5 text-primary" />
            Create New Project
          </DialogTitle>
          <DialogDescription>
            Start a new collaborative journey. Define your project details below.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreate} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Project Name</label>
            <Input
              required
              placeholder="e.g., TeamPilot AI Dashboard"
              value={formData.projectName}
              onChange={(e) => setFormData((prev) => ({ ...prev, projectName: e.target.value }))}
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium">Description</label>
            <Textarea
              required
              placeholder="What is this project about?"
              className="min-h-[100px]"
              value={formData.projectDescription}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, projectDescription: e.target.value }))
              }
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <GitBranch className="h-4 w-4" />
              GitHub Repository (Optional)
            </label>
            <Input
              placeholder="https://github.com/username/repo"
              value={formData.githubRepo}
              onChange={(e) => setFormData((prev) => ({ ...prev, githubRepo: e.target.value }))}
            />
          </div>
          <DialogFooter className="pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading || !formData.projectName}>
              {loading ? <LoadingSpinner className="mr-2 h-4 w-4" /> : null}
              Create Project
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Join Project Modal ───────────────────────────────────────────────────────

interface JoinProjectModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JoinProjectModal({ open, onOpenChange }: JoinProjectModalProps) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [projectCode, setProjectCode] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    onOpenChange(false);
    setSuccess(false);
    setProjectCode("");
    setError(null);
  };

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !projectCode) return;

    setLoading(true);
    setError(null);

    try {
      // 1. Find project by code
      const q = query(
        collection(db, "projects"),
        where("projectCode", "==", projectCode.toUpperCase())
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        setError("Invalid project code. Please check and try again.");
        return;
      }

      const projectData = querySnapshot.docs[0].data();

      // 2. Guard: cannot join own project
      if (projectData.leaderId === user.uid) {
        setError("You cannot join your own project. Share the code with teammates.");
        return;
      }

      // 3. Guard: already a member
      const memberSnap = await getDocs(
        query(
          collection(db, "projectMembers"),
          where("projectId", "==", projectData.projectId),
          where("userId", "==", user.uid)
        )
      );
      if (!memberSnap.empty) {
        setError("You are already a member of this project.");
        return;
      }

      // 4. Guard: duplicate pending request
      const requestSnap = await getDocs(
        query(
          collection(db, "joinRequests"),
          where("projectId", "==", projectData.projectId),
          where("userId", "==", user.uid),
          where("status", "==", "pending")
        )
      );
      if (!requestSnap.empty) {
        setError("You already have a pending join request for this project.");
        return;
      }

      // 5. Create join request
      const requestId = `${projectData.projectId}_${user.uid}`;
      await setDoc(doc(db, "joinRequests", requestId), {
        requestId,
        projectId: projectData.projectId,
        projectName: projectData.projectName,
        projectCode: projectData.projectCode,
        userId: user.uid,
        userName: user.displayName || "Anonymous",
        userEmail: user.email,
        status: "pending",
        createdAt: serverTimestamp(),
      });

      setSuccess(true);
    } catch (err) {
      console.error("Error joining project:", err);
      setError("An error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Join Project</DialogTitle>
          <DialogDescription>
            Enter the unique project code shared by your team leader.
          </DialogDescription>
        </DialogHeader>

        {success ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-4">
            <div className="h-12 w-12 rounded-full bg-success/10 flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-success" />
            </div>
            <div>
              <p className="font-semibold text-lg">Request Sent!</p>
              <p className="text-sm text-muted-foreground">
                Your join request has been sent successfully. The project leader
                will review it shortly.
              </p>
            </div>
            <Button onClick={handleClose} variant="outline" className="mt-2">
              Close
            </Button>
          </div>
        ) : (
          <form onSubmit={handleJoin} className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Project Code</label>
              <Input
                required
                placeholder="e.g., TP-A8F2D4"
                className="uppercase font-mono tracking-widest"
                value={projectCode}
                onChange={(e) => setProjectCode(e.target.value.toUpperCase())}
              />
              {error && <p className="text-xs text-destructive">{error}</p>}
            </div>
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !projectCode}>
                {loading ? <LoadingSpinner className="mr-2 h-4 w-4" /> : null}
                Send Request
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
