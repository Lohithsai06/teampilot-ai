"use client";

import React, { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/common/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Map,
  CircleCheck as CheckCircle2,
  Circle,
  Clock,
  ArrowRight,
  Rocket,
  Zap,
  Target,
  AlertTriangle,
  Loader2,
  Sparkles,
  Shield,
  Package,
  TrendingUp,
  FolderKanban,
  XCircle,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { useAISettings } from "@/lib/useAISettings";
import { useRoadmap, type PhaseStatus, type RoadmapPhase } from "@/lib/useRoadmap";
import Link from "next/link";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { PhaseDetailsModal } from "@/components/roadmap/PhaseDetailsModal";
import { type Task } from "@/lib/aiSystemPrompt";

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  PhaseStatus,
  { label: string; variant: "success" | "default" | "secondary" | "destructive"; icon: React.ReactNode }
> = {
  completed: {
    label: "Completed",
    variant: "success",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  in_progress: {
    label: "In Progress",
    variant: "default",
    icon: <Clock className="h-3.5 w-3.5 animate-pulse" />,
  },
  not_started: {
    label: "Not Started",
    variant: "secondary",
    icon: <Circle className="h-3.5 w-3.5" />,
  },
  blocked: {
    label: "Blocked",
    variant: "destructive",
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
};

// ─── Phase icon mapping ───────────────────────────────────────────────────────

function getPhaseIcon(phaseNumber: number, total: number) {
  if (phaseNumber === 1) return Rocket;
  if (phaseNumber === total) return Target;
  if (phaseNumber <= Math.ceil(total / 2)) return Zap;
  return Package;
}

// ─── No Project State ─────────────────────────────────────────────────────────

function NoProjectState() {
  return (
    <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
      <div className="text-center space-y-4 max-w-sm">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <FolderKanban className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold">No Project Selected</h2>
        <p className="text-muted-foreground text-sm">
          Select or create a project first to view the roadmap.
        </p>
        <Link href="/projects">
          <Button className="gap-2">
            <FolderKanban className="h-4 w-4" />
            Go to Projects
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ─── Empty Roadmap State ──────────────────────────────────────────────────────

function EmptyRoadmapState({
  isLeader,
  generating,
  onGenerate,
  error,
}: {
  isLeader: boolean;
  generating: boolean;
  onGenerate: () => void;
  error: string | null;
}) {
  return (
    <div className="h-[calc(100vh-12rem)] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="text-center space-y-6 max-w-md"
      >
        <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center mx-auto">
          <Map className="h-10 w-10 text-primary" />
        </div>
        <div>
          <h2 className="text-2xl font-bold">No roadmap generated yet</h2>
          <p className="text-muted-foreground text-sm mt-2">
            {isLeader
              ? "Generate an AI-powered roadmap to plan your project execution phases, milestones, and deliverables."
              : "Your project leader hasn't generated a roadmap yet. Check back soon."}
          </p>
        </div>

        {isLeader && (
          <Button
            size="lg"
            className="gap-2 px-8"
            onClick={onGenerate}
            disabled={generating}
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating Roadmap...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Generate Roadmap
              </>
            )}
          </Button>
        )}

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 rounded-lg p-4 space-y-2">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="text-left">
                <p className="font-medium">Generation Error</p>
                <p className="text-xs mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Generating State ─────────────────────────────────────────────────────────

function GeneratingState() {
  return (
    <div className="h-[calc(100vh-12rem)] flex items-center justify-center">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center space-y-6 max-w-md"
      >
        <div className="relative h-20 w-20 mx-auto">
          <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="h-10 w-10 text-primary animate-spin" />
          </div>
        </div>
        <div>
          <h2 className="text-xl font-bold">Generating Project Roadmap</h2>
          <p className="text-muted-foreground text-sm mt-2">
            The PM Agent is analyzing your project and creating an execution plan...
          </p>
        </div>
        <div className="flex justify-center gap-1">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2 w-2 rounded-full bg-primary/70 animate-bounce"
              style={{ animationDelay: `${i * 160}ms` }}
            />
          ))}
        </div>
      </motion.div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function RoadmapPage() {
  const { user } = useAuth();
  const { activeProject, activeProjectMembers, userRole } = useProject();
  const { settings, anyProviderConfigured } = useAISettings();

  const {
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
  } = useRoadmap(activeProject?.projectId, user?.uid);

  const isLeader = userRole === "leader";

  // Modal and real-time task subscription
  const [selectedPhaseId, setSelectedPhaseId] = React.useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [tasks, setTasks] = React.useState<Task[]>([]);
  const [tasksLoading, setTasksLoading] = React.useState(true);

  const selectedPhase = React.useMemo(() => {
    if (!selectedPhaseId) return null;
    return phases.find((p) => p.id === selectedPhaseId) || null;
  }, [selectedPhaseId, phases]);

  React.useEffect(() => {
    if (!activeProject?.projectId) {
      setTasks([]);
      setTasksLoading(false);
      return;
    }

    setTasksLoading(true);
    const q = query(
      collection(db, "tasks"),
      where("projectId", "==", activeProject.projectId)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        })) as Task[];
        setTasks(items);
        setTasksLoading(false);
      },
      (err) => {
        console.error("[RoadmapPage] Tasks listener error:", err);
        setTasksLoading(false);
      }
    );
    return () => unsub();
  }, [activeProject?.projectId]);

  const handlePhaseClick = (phase: RoadmapPhase) => {
    setSelectedPhaseId(phase.id);
    setIsModalOpen(true);
  };

  // Debug logging for button visibility
  React.useEffect(() => {
    console.log(`[RoadmapPage] ── Button Visibility Debug ──`);
    console.log(`[RoadmapPage]   user.uid: ${user?.uid}`);
    console.log(`[RoadmapPage]   userRole: ${userRole}`);
    console.log(`[RoadmapPage]   isLeader: ${isLeader}`);
    console.log(`[RoadmapPage]   activeProject: ${activeProject?.projectId}`);
    console.log(`[RoadmapPage]   roadmap exists: ${!!roadmap}`);
    console.log(`[RoadmapPage]   anyProviderConfigured: ${anyProviderConfigured}`);
    console.log(`[RoadmapPage]   geminiApiKey exists: ${!!settings.geminiApiKey}`);
    console.log(`[RoadmapPage]   openRouterApiKey exists: ${!!settings.openRouterApiKey}`);
    console.log(`[RoadmapPage]   preferredProvider: ${settings.preferredProvider}`);
  }, [user?.uid, userRole, isLeader, activeProject?.projectId, roadmap, anyProviderConfigured, settings]);

  // ── Generate handler ────────────────────────────────────────────────────

  const handleGenerate = useCallback(() => {
    console.log(`[RoadmapPage] ── Generate button clicked ──`);
    console.log(`[RoadmapPage]   activeProject: ${!!activeProject}`);
    console.log(`[RoadmapPage]   anyProviderConfigured: ${anyProviderConfigured}`);

    if (!activeProject) {
      console.warn(`[RoadmapPage]   ❌ No active project`);
      return;
    }

    if (!anyProviderConfigured) {
      console.warn(`[RoadmapPage]   ❌ No AI provider configured`);
      return;
    }

    console.log(`[RoadmapPage]   ✅ Calling generateRoadmap`);
    generateRoadmap(
      {
        geminiApiKey: settings.geminiApiKey,
        openRouterApiKey: settings.openRouterApiKey,
        preferredProvider: settings.preferredProvider,
        fallbackProvider: settings.fallbackProvider,
      },
      {
        projectName: activeProject.projectName,
        projectDescription: activeProject.projectDescription || "",
        teamMembers: activeProjectMembers.map((m) => ({
          name: m.name,
          role: m.role,
        })),
        leaderName: activeProject.leaderName,
        projectCode: activeProject.projectCode,
      }
    );
  }, [activeProject, activeProjectMembers, settings, anyProviderConfigured, generateRoadmap]);

  // ── Gate: no project ────────────────────────────────────────────────────

  if (!activeProject) {
    return (
      <DashboardLayout>
        <NoProjectState />
      </DashboardLayout>
    );
  }

  // ── Gate: loading ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <DashboardLayout>
        <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Loading roadmap...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ── Gate: generating ────────────────────────────────────────────────────

  if (generating) {
    return (
      <DashboardLayout>
        <GeneratingState />
      </DashboardLayout>
    );
  }

  // ── Gate: no roadmap ────────────────────────────────────────────────────

  if (!roadmap || phases.length === 0) {
    return (
      <DashboardLayout>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="space-y-8"
        >
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Map className="h-8 w-8 text-primary" />
              Roadmap
            </h1>
            <p className="text-muted-foreground mt-1">
              AI-generated project execution roadmap
            </p>
          </div>

          <EmptyRoadmapState
            isLeader={isLeader}
            generating={generating}
            onGenerate={handleGenerate}
            error={error}
          />
        </motion.div>
      </DashboardLayout>
    );
  }

  // ── Main Roadmap View ───────────────────────────────────────────────────

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-8"
      >
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Map className="h-8 w-8 text-primary" />
              Roadmap
            </h1>
            <p className="text-muted-foreground mt-1">
              AI-generated project execution roadmap
            </p>
          </div>

          {isLeader && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Regenerate Roadmap
            </Button>
          )}
        </div>

        {/* ── Project Health Summary ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border bg-card/60 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="grid grid-cols-2 md:grid-cols-5 gap-6">
                {/* Current Phase */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                    Current Phase
                  </p>
                  <p className="text-lg font-bold">
                    {currentActivePhase
                      ? `Phase ${currentActivePhase.phaseNumber}`
                      : roadmap.status === "completed"
                      ? "All Done"
                      : "—"}
                  </p>
                  {currentActivePhase && (
                    <p className="text-xs text-muted-foreground truncate">
                      {currentActivePhase.title}
                    </p>
                  )}
                </div>

                {/* Completed */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                    Completed
                  </p>
                  <p className="text-lg font-bold text-emerald-500">
                    {completedPhases}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      / {totalPhases}
                    </span>
                  </p>
                </div>

                {/* Remaining */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                    Remaining
                  </p>
                  <p className="text-lg font-bold">
                    {remainingPhases}{" "}
                    <span className="text-sm font-normal text-muted-foreground">
                      phases
                    </span>
                  </p>
                </div>

                {/* Status */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                    Status
                  </p>
                  <Badge
                    variant={
                      roadmap.status === "completed"
                        ? "success"
                        : roadmap.status === "active"
                        ? "default"
                        : "secondary"
                    }
                    className="capitalize"
                  >
                    {roadmap.status}
                  </Badge>
                </div>

                {/* Progress */}
                <div className="space-y-2 col-span-2 md:col-span-1">
                  <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">
                    Progress
                  </p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold">{progressPercentage}%</span>
                      <TrendingUp className="h-4 w-4 text-primary" />
                    </div>
                    <Progress value={progressPercentage} className="h-2" />
                  </div>
                </div>
              </div>

              {/* Project Summary */}
              {roadmap.projectSummary && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {roadmap.projectSummary}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── Phase Timeline ─────────────────────────────────────────────── */}
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-6">
            <AnimatePresence>
              {phases.map((phase, index) => {
                const Icon = getPhaseIcon(phase.phaseNumber, totalPhases);
                const statusConfig = STATUS_CONFIG[phase.status];
                const isCompleted = phase.status === "completed";
                const isInProgress = phase.status === "in_progress";
                const isBlocked = phase.status === "blocked";

                return (
                  <motion.div
                    key={phase.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="relative pl-20"
                  >
                    {/* Timeline node */}
                    <div
                      className={`absolute left-5 h-6 w-6 rounded-full border-2 ${
                        isCompleted
                          ? "bg-success border-success"
                          : isInProgress
                          ? "bg-primary border-primary"
                          : isBlocked
                          ? "bg-destructive border-destructive"
                          : "bg-background border-border"
                      } flex items-center justify-center`}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="h-4 w-4 text-success-foreground" />
                      ) : isInProgress ? (
                        <Clock className="h-3 w-3 text-primary-foreground animate-pulse" />
                      ) : isBlocked ? (
                        <XCircle className="h-3 w-3 text-destructive-foreground" />
                      ) : (
                        <Circle className="h-3 w-3 text-muted-foreground" />
                      )}
                    </div>

                    <Card
                      className={`${
                        isInProgress
                          ? "border-primary shadow-soft"
                          : isBlocked
                          ? "border-destructive/50"
                          : ""
                      } hover:shadow-soft-lg transition-shadow cursor-pointer`}
                      onClick={() => handlePhaseClick(phase)}
                    >
                      <CardHeader>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex items-center gap-3">
                            <div
                              className={`h-10 w-10 rounded-lg ${
                                isCompleted
                                  ? "bg-success/10"
                                  : isInProgress
                                  ? "bg-primary/10"
                                  : isBlocked
                                  ? "bg-destructive/10"
                                  : "bg-muted"
                              } flex items-center justify-center`}
                            >
                              <Icon
                                className={`h-5 w-5 ${
                                  isCompleted
                                    ? "text-success"
                                    : isInProgress
                                    ? "text-primary"
                                    : isBlocked
                                    ? "text-destructive"
                                    : "text-muted-foreground"
                                }`}
                              />
                            </div>
                            <div>
                              <CardTitle className="text-lg">
                                <span className="text-muted-foreground font-normal mr-2">
                                  Phase {phase.phaseNumber}
                                </span>
                                {phase.title}
                              </CardTitle>
                              <p className="text-sm text-muted-foreground mt-0.5">
                                {phase.description}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="outline" className="gap-1">
                              <Clock className="h-3 w-3" />
                              {phase.estimatedDuration}
                            </Badge>
                            <Badge variant={statusConfig.variant} className="gap-1">
                              {statusConfig.icon}
                              {statusConfig.label}
                            </Badge>
                          </div>
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        {/* Objectives */}
                        {phase.objectives.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                              Objectives
                            </p>
                            <div className="grid md:grid-cols-2 gap-2">
                              {phase.objectives.map((obj, i) => (
                                <div
                                  key={i}
                                  className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/50"
                                >
                                  <Target className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                                  <span className="text-sm">{obj}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Deliverables */}
                        {phase.deliverables.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                              Deliverables
                            </p>
                            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
                              {phase.deliverables.map((del, i) => (
                                <div
                                  key={i}
                                  className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50"
                                >
                                  {isCompleted ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                                  ) : isInProgress ? (
                                    <Clock className="h-3.5 w-3.5 text-primary shrink-0" />
                                  ) : (
                                    <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                                  )}
                                  <span className="text-sm">{del}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Risks & Dependencies */}
                        {(phase.risks.length > 0 || phase.dependencies.length > 0) && (
                          <div className="grid md:grid-cols-2 gap-4">
                            {phase.dependencies.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                  Dependencies
                                </p>
                                <div className="space-y-1.5">
                                  {phase.dependencies.map((dep, i) => (
                                    <div
                                      key={i}
                                      className="flex items-start gap-2 text-sm"
                                    >
                                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                                      <span className="text-muted-foreground">{dep}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {phase.risks.length > 0 && (
                              <div>
                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                                  Risks
                                </p>
                                <div className="space-y-1.5">
                                  {phase.risks.map((risk, i) => (
                                    <div
                                      key={i}
                                      className="flex items-start gap-2 text-sm"
                                    >
                                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500 mt-0.5 shrink-0" />
                                      <span className="text-muted-foreground">{risk}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Leader Actions */}
                        {isLeader && isInProgress && (
                          <div className="pt-2 border-t flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Shield className="h-3.5 w-3.5" />
                              Leader actions
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-1 h-8 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updatePhaseStatus(phase.id, "blocked");
                                }}
                              >
                                <XCircle className="h-3 w-3" />
                                Mark Blocked
                              </Button>
                              <Button
                                size="sm"
                                className="gap-1 h-8 text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  completePhase(phase.id);
                                }}
                              >
                                <CheckCircle2 className="h-3 w-3" />
                                Mark Complete
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Leader can unblock */}
                        {isLeader && isBlocked && (
                          <div className="pt-2 border-t flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Shield className="h-3.5 w-3.5" />
                              Leader actions
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1 h-8 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                updatePhaseStatus(phase.id, "in_progress");
                              }}
                            >
                              <ArrowRight className="h-3 w-3" />
                              Resume Phase
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>

      <PhaseDetailsModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedPhaseId(null);
        }}
        phase={selectedPhase}
        tasks={tasks}
        projectId={activeProject.projectId}
        projectMembers={activeProjectMembers}
        isLeader={isLeader}
        onCompletePhase={completePhase}
        onUpdatePhaseStatus={updatePhaseStatus}
        aiSettings={{
          geminiApiKey: settings.geminiApiKey,
          openRouterApiKey: settings.openRouterApiKey,
          preferredProvider: settings.preferredProvider,
          fallbackProvider: settings.fallbackProvider,
        }}
      />
    </DashboardLayout>
  );
}
