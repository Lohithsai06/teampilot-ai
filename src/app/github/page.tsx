"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/common/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import {
  GitBranch,
  ExternalLink,
  Link2,
  Link2Off,
  Shield,
  Activity,
  Users,
  BarChart3,
  CheckCircle2,
  Circle,
  AlertTriangle,
  Clock,
  Rocket,
  Brain,
  Kanban,
  Database,
  Globe,
  Map,
  Star,
  Crown,
  UserCheck,
  CalendarDays,
  TrendingUp,
  Info,
  Loader2,
  FolderGit2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import {
  collection,
  query,
  where,
  onSnapshot,
  addDoc,
  deleteDoc,
  getDocs,
  doc,
  serverTimestamp,
  Timestamp,
  getDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ─── Types ────────────────────────────────────────────────────────────────────

interface GitHubRepo {
  id: string;
  projectId: string;
  repoName: string;
  repoUrl: string;
  defaultBranch: string;
  connectedBy: string;
  connectedAt: Timestamp | null;
}

interface RoadmapData {
  id: string;
  totalPhases: number;
  currentPhase: number;
  status: string;
  generatedAt: Timestamp | null;
}

interface PhaseData {
  id: string;
  status: string;
  phaseNumber: number;
  title: string;
}

interface ActivityItem {
  id: string;
  label: string;
  time: Timestamp | null;
  icon: React.ReactNode;
  color: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTimestamp(ts: Timestamp | null | undefined): string {
  if (!ts) return "Unknown date";
  try {
    const d = ts.toDate();
    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    if (diff < 2_592_000_000) return `${Math.floor(diff / 86_400_000)}d ago`;
    return d.toLocaleDateString();
  } catch {
    return "Unknown date";
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ─── Health Score Calculation ─────────────────────────────────────────────────

function computeHealthScore({
  roadmapExists,
  completedPhases,
  totalPhases,
  taskTotal,
  taskCompleted,
  teamSize,
  repoConnected,
  aiUsed,
}: {
  roadmapExists: boolean;
  completedPhases: number;
  totalPhases: number;
  taskTotal: number;
  taskCompleted: number;
  teamSize: number;
  repoConnected: boolean;
  aiUsed: boolean;
}): number {
  let score = 0;

  // Roadmap progress (35 pts)
  if (roadmapExists) {
    score += 15;
    if (totalPhases > 0) {
      score += Math.round((completedPhases / totalPhases) * 20);
    }
  }

  // Kanban progress (25 pts)
  if (taskTotal > 0) {
    score += Math.round((taskCompleted / taskTotal) * 25);
  }

  // Team size (15 pts)
  if (teamSize >= 1) score += 5;
  if (teamSize >= 2) score += 5;
  if (teamSize >= 3) score += 5;

  // Repo connected (15 pts)
  if (repoConnected) score += 15;

  // AI workspace usage (10 pts)
  if (aiUsed) score += 10;

  return Math.min(score, 100);
}

function getHealthStatus(score: number): {
  label: string;
  color: string;
  bg: string;
  ring: string;
} {
  if (score >= 80)
    return {
      label: "Excellent",
      color: "text-emerald-400",
      bg: "bg-emerald-400/10",
      ring: "border-emerald-400/30",
    };
  if (score >= 60)
    return {
      label: "Good",
      color: "text-blue-400",
      bg: "bg-blue-400/10",
      ring: "border-blue-400/30",
    };
  if (score >= 40)
    return {
      label: "Average",
      color: "text-amber-400",
      bg: "bg-amber-400/10",
      ring: "border-amber-400/30",
    };
  return {
    label: "Needs Attention",
    color: "text-red-400",
    bg: "bg-red-400/10",
    ring: "border-red-400/30",
  };
}

// ─── Connect Repository Form ───────────────────────────────────────────────────

function ConnectRepoForm({
  projectId,
  userId,
  onConnected,
}: {
  projectId: string;
  userId: string;
  onConnected: () => void;
}) {
  const [form, setForm] = useState({
    repoUrl: "",
    repoName: "",
    defaultBranch: "main",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!form.repoUrl.trim() || !form.repoName.trim()) {
      setError("Repository URL and name are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await addDoc(collection(db, "githubRepositories"), {
        projectId,
        repoName: form.repoName.trim(),
        repoUrl: form.repoUrl.trim(),
        defaultBranch: form.defaultBranch.trim() || "main",
        connectedBy: userId,
        connectedAt: serverTimestamp(),
      });
      onConnected();
    } catch (err) {
      setError("Failed to save repository. Please try again.");
      console.error("[GitHub] Connect repo error:", err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-3 mb-2">
        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Link2 className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-base">Connect Repository</h3>
          <p className="text-sm text-muted-foreground">
            Link your project to a GitHub repository
          </p>
        </div>
      </div>

      <div className="grid gap-3">
        <div className="space-y-1.5">
          <label htmlFor="repoUrl" className="text-sm font-medium leading-none">
            Repository URL
          </label>
          <Input
            id="repoUrl"
            placeholder="https://github.com/org/repo"
            value={form.repoUrl}
            onChange={(e) => setForm((f) => ({ ...f, repoUrl: e.target.value }))}
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="repoName" className="text-sm font-medium leading-none">
            Repository Name
          </label>
          <Input
            id="repoName"
            placeholder="my-awesome-project"
            value={form.repoName}
            onChange={(e) =>
              setForm((f) => ({ ...f, repoName: e.target.value }))
            }
          />
        </div>
        <div className="space-y-1.5">
          <label htmlFor="defaultBranch" className="text-sm font-medium leading-none">
            Default Branch
          </label>
          <Input
            id="defaultBranch"
            placeholder="main"
            value={form.defaultBranch}
            onChange={(e) =>
              setForm((f) => ({ ...f, defaultBranch: e.target.value }))
            }
          />
        </div>
      </div>

      {error && (
        <p className="text-sm text-destructive flex items-center gap-1.5">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      <Button onClick={handleSave} disabled={saving} className="w-full gap-2">
        {saving ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Link2 className="h-4 w-4" />
        )}
        {saving ? "Connecting…" : "Save Repository"}
      </Button>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function GithubPage() {
  const { user } = useAuth();
  const { activeProject, activeProjectMembers } = useProject();

  const [repo, setRepo] = useState<GitHubRepo | null>(null);
  const [repoLoading, setRepoLoading] = useState(true);
  const [showConnectForm, setShowConnectForm] = useState(false);

  const [roadmap, setRoadmap] = useState<RoadmapData | null>(null);
  const [phases, setPhases] = useState<PhaseData[]>([]);

  const [taskTotal, setTaskTotal] = useState(0);
  const [taskCompleted, setTaskCompleted] = useState(0);
  const [aiUsed, setAiUsed] = useState(false);

  const [activities, setActivities] = useState<ActivityItem[]>([]);

  const projectId = activeProject?.projectId;

  // ── 1. Repository ────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!projectId) {
      setRepo(null);
      setRepoLoading(false);
      return;
    }
    setRepoLoading(true);

    const q = query(
      collection(db, "githubRepositories"),
      where("projectId", "==", projectId)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) {
        setRepo(null);
      } else {
        setRepo({ id: snap.docs[0].id, ...snap.docs[0].data() } as GitHubRepo);
      }
      setRepoLoading(false);
    });
    return () => unsub();
  }, [projectId]);

  // ── 2. Roadmap & Phases ──────────────────────────────────────────────────────

  useEffect(() => {
    if (!projectId) {
      setRoadmap(null);
      setPhases([]);
      return;
    }

    const q = query(
      collection(db, "roadmaps"),
      where("projectId", "==", projectId)
    );
    const unsub = onSnapshot(q, (snap) => {
      if (snap.empty) {
        setRoadmap(null);
        setPhases([]);
        return;
      }
      const docs = snap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as RoadmapData[];
      docs.sort((a, b) => {
        const at = a.generatedAt?.toMillis?.() ?? 0;
        const bt = b.generatedAt?.toMillis?.() ?? 0;
        return bt - at;
      });
      setRoadmap(docs[0]);
    });
    return () => unsub();
  }, [projectId]);

  useEffect(() => {
    if (!roadmap?.id) {
      setPhases([]);
      return;
    }
    const q = query(
      collection(db, "roadmapPhases"),
      where("roadmapId", "==", roadmap.id)
    );
    const unsub = onSnapshot(q, (snap) => {
      const p = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as PhaseData))
        .sort((a, b) => a.phaseNumber - b.phaseNumber);
      setPhases(p);
    });
    return () => unsub();
  }, [roadmap?.id]);

  // ── 3. Kanban task counts ────────────────────────────────────────────────────

  useEffect(() => {
    if (!projectId) return;
    const q = query(
      collection(db, "kanbanTasks"),
      where("projectId", "==", projectId)
    );
    const unsub = onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => d.data());
      setTaskTotal(all.length);
      setTaskCompleted(all.filter((t) => t.status === "done").length);
    });
    return () => unsub();
  }, [projectId]);

  // ── 4. AI usage check ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!projectId) return;
    // Check both aiChats and agentSessions collections
    const checkAI = async () => {
      try {
        const aiQ = query(
          collection(db, "aiChats"),
          where("projectId", "==", projectId)
        );
        const snap = await getDocs(aiQ);
        if (!snap.empty) {
          setAiUsed(true);
          return;
        }
        const agQ = query(
          collection(db, "agentSessions"),
          where("projectId", "==", projectId)
        );
        const agSnap = await getDocs(agQ);
        setAiUsed(!agSnap.empty);
      } catch {
        setAiUsed(false);
      }
    };
    checkAI();
  }, [projectId]);

  // ── 5. Recent Activity ───────────────────────────────────────────────────────

  useEffect(() => {
    if (!activeProject) {
      setActivities([]);
      return;
    }

    const items: ActivityItem[] = [];

    // Project created
    if (activeProject.createdAt) {
      items.push({
        id: "project-created",
        label: `Project "${activeProject.projectName}" created`,
        time: activeProject.createdAt,
        icon: <FolderGit2 className="h-4 w-4" />,
        color: "text-blue-400",
      });
    }

    // Members joined (from activeProjectMembers)
    activeProjectMembers.forEach((m) => {
      if (m.joinedAt) {
        items.push({
          id: `member-${m.userId}`,
          label: `${m.name} joined as ${m.role}`,
          time: m.joinedAt,
          icon: <Users className="h-4 w-4" />,
          color: "text-violet-400",
        });
      }
    });

    // Roadmap generated
    if (roadmap?.generatedAt) {
      items.push({
        id: "roadmap-generated",
        label: "AI Roadmap generated",
        time: roadmap.generatedAt,
        icon: <Map className="h-4 w-4" />,
        color: "text-emerald-400",
      });
    }

    // Repo connected
    if (repo?.connectedAt) {
      items.push({
        id: "repo-connected",
        label: `Repository "${repo.repoName}" connected`,
        time: repo.connectedAt,
        icon: <GitBranch className="h-4 w-4" />,
        color: "text-orange-400",
      });
    }

    // Sort newest first
    items.sort((a, b) => {
      const at = a.time?.toMillis?.() ?? 0;
      const bt = b.time?.toMillis?.() ?? 0;
      return bt - at;
    });

    setActivities(items.slice(0, 8));
  }, [activeProject, activeProjectMembers, roadmap, repo]);

  // ── Derived values ────────────────────────────────────────────────────────────

  const completedPhases = phases.filter((p) => p.status === "completed").length;
  const totalPhases = roadmap?.totalPhases ?? phases.length;
  const roadmapProgress =
    totalPhases > 0 ? Math.round((completedPhases / totalPhases) * 100) : 0;

  const kanbanProgress =
    taskTotal > 0 ? Math.round((taskCompleted / taskTotal) * 100) : 0;

  const teamSize = activeProjectMembers.length;
  const leader = activeProjectMembers.find((m) => m.role === "leader");
  const members = activeProjectMembers.filter((m) => m.role === "member");

  const healthScore = computeHealthScore({
    roadmapExists: !!roadmap,
    completedPhases,
    totalPhases,
    taskTotal,
    taskCompleted,
    teamSize,
    repoConnected: !!repo,
    aiUsed,
  });
  const health = getHealthStatus(healthScore);

  // Deployment readiness items
  const readiness = [
    {
      label: "Authentication",
      ready: !!user,
      icon: <Shield className="h-4 w-4" />,
    },
    {
      label: "Firebase Integration",
      ready: true,
      icon: <Database className="h-4 w-4" />,
    },
    {
      label: "Roadmap Generated",
      ready: !!roadmap,
      icon: <Map className="h-4 w-4" />,
    },
    {
      label: "Kanban Board",
      ready: taskTotal > 0,
      icon: <Kanban className="h-4 w-4" />,
    },
    {
      label: "AI Workspace",
      ready: aiUsed,
      icon: <Brain className="h-4 w-4" />,
    },
    {
      label: "Repository Connected",
      ready: !!repo,
      icon: <GitBranch className="h-4 w-4" />,
    },
  ];

  const readyCount = readiness.filter((r) => r.ready).length;

  // ── No project selected guard ─────────────────────────────────────────────────

  if (!activeProject) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64 text-center gap-4">
          <FolderGit2 className="h-12 w-12 text-muted-foreground/40" />
          <div>
            <h2 className="text-xl font-semibold">No Project Selected</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Select or create a project to view the intelligence dashboard.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        {/* ── Header ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <GitBranch className="h-8 w-8 text-primary" />
              Project Intelligence
            </h1>
            <p className="text-muted-foreground mt-1">
              Repository center &amp; project health for{" "}
              <span className="text-foreground font-medium">
                {activeProject.projectName}
              </span>
            </p>
          </div>
          {repo && (
            <Button
              variant="outline"
              className="gap-2 shrink-0"
              onClick={() => window.open(repo.repoUrl, "_blank")}
            >
              <ExternalLink className="h-4 w-4" />
              Open Repository
            </Button>
          )}
        </div>

        {/* ── Repository Connection ───────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
        >
          <Card>
            <CardContent className="p-5">
              {repoLoading ? (
                <div className="flex items-center gap-3 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Loading repository…</span>
                </div>
              ) : repo ? (
                /* Connected state */
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                      <GitBranch className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{repo.repoName}</h3>
                      <a
                        href={repo.repoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-primary hover:underline flex items-center gap-1"
                      >
                        {repo.repoUrl}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Badge variant="outline" className="gap-1">
                      <GitBranch className="h-3 w-3" />
                      {repo.defaultBranch}
                    </Badge>
                    <Badge variant="default" className="gap-1 bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Connected
                    </Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1 text-muted-foreground hover:text-destructive text-xs"
                      onClick={async () => {
                        await deleteDoc(doc(db, "githubRepositories", repo.id));
                      }}
                    >
                      <Link2Off className="h-3 w-3" />
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : showConnectForm ? (
                <div>
                  <ConnectRepoForm
                    projectId={projectId!}
                    userId={user!.uid}
                    onConnected={() => setShowConnectForm(false)}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-3 text-muted-foreground"
                    onClick={() => setShowConnectForm(false)}
                  >
                    Cancel
                  </Button>
                </div>
              ) : (
                /* Not connected state */
                <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="h-10 w-10 rounded-xl bg-muted flex items-center justify-center shrink-0">
                      <Link2Off className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <h3 className="font-semibold">No Repository Connected</h3>
                      <p className="text-sm text-muted-foreground">
                        Link a GitHub repository to track your project
                      </p>
                    </div>
                  </div>
                  <Button
                    className="gap-2 shrink-0"
                    onClick={() => setShowConnectForm(true)}
                  >
                    <Link2 className="h-4 w-4" />
                    Connect Repository
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Top 3 Cards ─────────────────────────────────────────────────────── */}
        <div className="grid gap-5 lg:grid-cols-3">

          {/* Repository Overview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  Repository Overview
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2.5">
                  <Row label="Project" value={activeProject.projectName} />
                  <Row
                    label="Repository"
                    value={repo ? repo.repoName : "—"}
                    valueClass={repo ? "" : "text-muted-foreground"}
                  />
                  <Row
                    label="Branch"
                    value={repo ? repo.defaultBranch : "—"}
                    valueClass={repo ? "" : "text-muted-foreground"}
                  />
                  <Row
                    label="Current Phase"
                    value={
                      roadmap
                        ? `Phase ${roadmap.currentPhase} of ${roadmap.totalPhases}`
                        : "No roadmap yet"
                    }
                    valueClass={roadmap ? "" : "text-muted-foreground"}
                  />
                  <Row label="Team Size" value={`${teamSize} member${teamSize !== 1 ? "s" : ""}`} />
                  {repo && (
                    <Row
                      label="Connected By"
                      value={
                        activeProjectMembers.find(
                          (m) => m.userId === repo.connectedBy
                        )?.name ?? "Unknown"
                      }
                    />
                  )}
                </div>

                {roadmap && (
                  <div className="pt-2 border-t">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-muted-foreground">Roadmap Progress</span>
                      <span className="text-xs font-medium">{roadmapProgress}%</span>
                    </div>
                    <Progress value={roadmapProgress} className="h-1.5" />
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Project Health */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className={`h-full border ${health.ring}`}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Project Health
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center justify-center pt-2 pb-4 gap-3">
                {/* Score ring */}
                <div className={`relative flex items-center justify-center h-28 w-28 rounded-full border-4 ${health.ring} ${health.bg}`}>
                  <span className={`text-4xl font-bold ${health.color}`}>
                    {healthScore}
                  </span>
                  <span className={`absolute bottom-3 text-[10px] font-medium ${health.color}`}>
                    / 100
                  </span>
                </div>
                <Badge className={`${health.bg} ${health.color} border ${health.ring} font-semibold`}>
                  {health.label}
                </Badge>

                <div className="w-full space-y-1.5 mt-1 text-xs">
                  <HealthFactor label="Roadmap" done={!!roadmap} />
                  <HealthFactor label="Repository" done={!!repo} />
                  <HealthFactor label="Team Formed" done={teamSize >= 1} />
                  <HealthFactor label="Tasks Tracked" done={taskTotal > 0} />
                  <HealthFactor label="AI Workspace" done={aiUsed} />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Team Contribution */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Team Contribution
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {teamSize === 0 ? (
                  <p className="text-sm text-muted-foreground">No members yet.</p>
                ) : (
                  <>
                    {/* Leader */}
                    {leader && (
                      <div className="flex items-center gap-3 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                        <Avatar className="h-8 w-8 shrink-0">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {getInitials(leader.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{leader.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{leader.email}</p>
                        </div>
                        <Badge variant="outline" className="gap-1 text-xs shrink-0">
                          <Crown className="h-3 w-3 text-amber-400" />
                          Leader
                        </Badge>
                      </div>
                    )}

                    {/* Members */}
                    {members.length > 0 && (
                      <div className="space-y-1.5">
                        {members.map((m) => (
                          <div
                            key={m.userId}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <Avatar className="h-7 w-7 shrink-0">
                              <AvatarFallback className="text-xs">
                                {getInitials(m.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{m.name}</p>
                            </div>
                            <Badge variant="secondary" className="text-xs shrink-0">
                              Member
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Stats row */}
                    <div className="pt-2 border-t grid grid-cols-2 gap-2 text-center">
                      <div>
                        <p className="text-lg font-bold">{teamSize}</p>
                        <p className="text-xs text-muted-foreground">Total Members</p>
                      </div>
                      <div>
                        <p className="text-lg font-bold">
                          {members.length > 0
                            ? leader?.name?.split(" ")[0] ?? "—"
                            : leader?.name?.split(" ")[0] ?? "—"}
                        </p>
                        <p className="text-xs text-muted-foreground">Leader</p>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* ── Bottom 3 Cards ─────────────────────────────────────────────────── */}
        <div className="grid gap-5 lg:grid-cols-3">

          {/* Project Status */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
          >
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Project Status
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {!roadmap ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
                    <Map className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">
                      No roadmap generated yet
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                      Visit the Roadmap page to generate one
                    </p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <StatusStat
                        label="Current Phase"
                        value={`${roadmap.currentPhase}`}
                        color="text-blue-400"
                      />
                      <StatusStat
                        label="Completed"
                        value={`${completedPhases}`}
                        color="text-emerald-400"
                      />
                      <StatusStat
                        label="Remaining"
                        value={`${totalPhases - completedPhases}`}
                        color="text-amber-400"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between mb-1.5 text-xs">
                        <span className="text-muted-foreground">Roadmap Progress</span>
                        <span className="font-medium">{roadmapProgress}%</span>
                      </div>
                      <Progress value={roadmapProgress} className="h-2" />
                    </div>

                    {taskTotal > 0 && (
                      <div>
                        <div className="flex justify-between mb-1.5 text-xs">
                          <span className="text-muted-foreground">Kanban Progress</span>
                          <span className="font-medium">{kanbanProgress}%</span>
                        </div>
                        <Progress value={kanbanProgress} className="h-2" />
                      </div>
                    )}

                    {/* Phase list */}
                    <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                      {phases.map((ph) => (
                        <div key={ph.id} className="flex items-center gap-2 text-sm">
                          <PhaseStatusIcon status={ph.status} />
                          <span className="truncate flex-1">{ph.title}</span>
                          <PhaseStatusBadge status={ph.status} />
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Deployment Readiness */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Rocket className="h-4 w-4" />
                  Deployment Readiness
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between pb-2 border-b">
                  <span className="text-sm font-medium">
                    {readyCount} / {readiness.length} Ready
                  </span>
                  <Progress
                    value={(readyCount / readiness.length) * 100}
                    className="w-24 h-1.5"
                  />
                </div>

                {readiness.map((item) => (
                  <div
                    key={item.label}
                    className="flex items-center gap-3"
                  >
                    <div
                      className={`h-7 w-7 rounded-lg flex items-center justify-center shrink-0 ${
                        item.ready
                          ? "bg-emerald-500/10 text-emerald-400"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {item.icon}
                    </div>
                    <span className="text-sm flex-1">{item.label}</span>
                    <Badge
                      variant={item.ready ? "default" : "secondary"}
                      className={`text-xs ${
                        item.ready
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                          : "text-muted-foreground"
                      }`}
                    >
                      {item.ready ? "Ready" : "Pending"}
                    </Badge>
                  </div>
                ))}

                {/* GitHub API notice */}
                <div className="mt-3 p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      GitHub API integration can be enabled in future versions
                      for advanced repository analytics (commits, PRs, issues).
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Recent Activity */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
          >
            <Card className="h-full">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                {activities.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
                    <Clock className="h-8 w-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">
                      No activity yet
                    </p>
                  </div>
                ) : (
                  <div className="relative space-y-0">
                    {/* Timeline */}
                    <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" />
                    {activities.map((act, i) => (
                      <motion.div
                        key={act.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.05 * i }}
                        className="flex items-start gap-3 pl-1 pb-4 last:pb-0"
                      >
                        <div
                          className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 z-10 bg-background border ${act.color} border-current/20`}
                        >
                          <span className={act.color}>{act.icon}</span>
                        </div>
                        <div className="pt-1 min-w-0">
                          <p className="text-sm font-medium leading-tight truncate">
                            {act.label}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {formatTimestamp(act.time)}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}

// ─── Small Helper Components ──────────────────────────────────────────────────

function Row({
  label,
  value,
  valueClass = "",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className={`text-sm font-medium text-right truncate max-w-[60%] ${valueClass}`}>
        {value}
      </span>
    </div>
  );
}

function HealthFactor({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {done ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
      ) : (
        <Circle className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
      )}
      <span className={done ? "text-foreground" : "text-muted-foreground"}>
        {label}
      </span>
    </div>
  );
}

function StatusStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="p-2 rounded-lg bg-muted/50">
      <p className={`text-xl font-bold ${color}`}>{value}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}

function PhaseStatusIcon({ status }: { status: string }) {
  if (status === "completed")
    return <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />;
  if (status === "in_progress")
    return <TrendingUp className="h-4 w-4 text-blue-400 shrink-0" />;
  if (status === "blocked")
    return <AlertTriangle className="h-4 w-4 text-red-400 shrink-0" />;
  return <Circle className="h-4 w-4 text-muted-foreground/30 shrink-0" />;
}

function PhaseStatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    completed: { label: "Done", cls: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    in_progress: { label: "Active", cls: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
    blocked: { label: "Blocked", cls: "bg-red-500/10 text-red-400 border-red-500/20" },
    not_started: { label: "Pending", cls: "bg-muted text-muted-foreground border-border" },
  };
  const s = map[status] ?? map.not_started;
  return (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 border shrink-0 ${s.cls}`}>
      {s.label}
    </Badge>
  );
}
