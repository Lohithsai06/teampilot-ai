"use client";

import React, { useState, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  collection,
  addDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  Target,
  CheckCircle2,
  Clock,
  Circle,
  AlertTriangle,
  ArrowRight,
  Shield,
  Users,
  Sparkles,
  Loader2,
  XCircle,
  TrendingUp,
  Briefcase,
  Layers,
  Calendar,
} from "lucide-react";
import { type RoadmapPhase, type PhaseStatus } from "@/lib/useRoadmap";
import { type Task } from "@/lib/aiSystemPrompt";
import { type ProjectMember } from "@/context/ProjectContext";

// ─── Status Configuration ──────────────────────────────────────────────────

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

const PRIORITY_BADGES = {
  high: "bg-red-500/10 text-red-400 border border-red-500/20",
  medium: "bg-amber-500/10 text-amber-400 border border-amber-500/20",
  low: "bg-blue-500/10 text-blue-400 border border-blue-500/20",
};

interface PhaseDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  phase: RoadmapPhase | null;
  tasks: Task[]; // All tasks for the project (we filter by phase number client-side)
  projectId: string;
  projectMembers: ProjectMember[];
  isLeader: boolean;
  onCompletePhase: (phaseId: string) => Promise<void>;
  onUpdatePhaseStatus: (phaseId: string, status: PhaseStatus) => Promise<void>;
  aiSettings: {
    geminiApiKey: string;
    openRouterApiKey: string;
    preferredProvider: "gemini" | "openrouter" | "none";
    fallbackProvider: "gemini" | "openrouter" | "none";
  };
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function PhaseDetailsModal({
  isOpen,
  onClose,
  phase,
  tasks,
  projectId,
  projectMembers,
  isLeader,
  onCompletePhase,
  onUpdatePhaseStatus,
  aiSettings,
}: PhaseDetailsModalProps) {
  const [generatingTasks, setGeneratingTasks] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 1. Filter tasks related to this phase
  const phaseTasks = useMemo(() => {
    if (!phase) return [];
    return tasks.filter((t) => t.phase === phase.phaseNumber);
  }, [tasks, phase]);

  // 2. Group phase tasks by assigned member
  const teamAssignments = useMemo(() => {
    if (!phase || phaseTasks.length === 0) return [];

    const memberMap = new Map<
      string,
      { member: ProjectMember; taskCount: number }
    >();

    phaseTasks.forEach((task) => {
      const assignedUserId = task.assignedTo;
      if (!assignedUserId) return;

      const projectMember = projectMembers.find((m) => m.userId === assignedUserId);
      if (!projectMember) return;

      if (!memberMap.has(assignedUserId)) {
        memberMap.set(assignedUserId, { member: projectMember, taskCount: 0 });
      }
      memberMap.get(assignedUserId)!.taskCount += 1;
    });

    return Array.from(memberMap.values()).sort((a, b) => b.taskCount - a.taskCount);
  }, [phaseTasks, projectMembers, phase]);

  // 3. Compute phase progress
  const progressMetrics = useMemo(() => {
    const total = phaseTasks.length;
    const completed = phaseTasks.filter(
      (t) => t.status === "completed"
    ).length;
    const remaining = total - completed;
    const percentage = total === 0 ? 0 : Math.round((completed / total) * 100);

    return { total, completed, remaining, percentage };
  }, [phaseTasks]);

  if (!phase) return null;

  const statusConfig = STATUS_CONFIG[phase.status];

  // Derive purpose & expectedOutcome fallbacks for existing data
  const derivedPurpose =
    phase.purpose ||
    `Establish the core modules, configuration, and dependencies required to support "${phase.title.toLowerCase()}".`;
  const derivedExpectedOutcome =
    phase.expectedOutcome ||
    `All deliverables associated with ${phase.title.toLowerCase()} are verified and ready for integration.`;

  // 4. Generate Tasks handler
  const handleGenerateTasks = async () => {
    setGeneratingTasks(true);
    setError(null);
    try {
      const res = await fetch("/api/generate-tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          geminiApiKey: aiSettings.geminiApiKey,
          openRouterApiKey: aiSettings.openRouterApiKey,
          preferredProvider: aiSettings.preferredProvider,
          fallbackProvider: aiSettings.fallbackProvider,
          phase: {
            phaseNumber: phase.phaseNumber,
            title: phase.title,
            description: phase.description,
            objectives: phase.objectives,
            deliverables: phase.deliverables,
          },
          teamMembers: projectMembers.map((m) => ({
            id: m.userId,
            name: m.name,
            role: m.role,
          })),
          projectId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || errorData.details || "Failed to generate tasks.");
      }

      const data = await res.json();
      const generatedTasks = data.tasks;

      if (!generatedTasks || !Array.isArray(generatedTasks) || generatedTasks.length === 0) {
        throw new Error("No tasks returned by the AI.");
      }

      // Add each generated task to Firestore
      for (const t of generatedTasks) {
        await addDoc(collection(db, "tasks"), {
          ...t,
          projectId,
          createdAt: serverTimestamp(),
        });
      }

      console.log(`[PhaseDetailsModal] Successfully created ${generatedTasks.length} tasks`);
    } catch (err: any) {
      const errMsg = err.message || "Failed to generate tasks.";
      console.error("[PhaseDetailsModal] Error generating tasks:", errMsg);
      setError(errMsg);
    } finally {
      setGeneratingTasks(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] md:w-full border bg-background/95 backdrop-blur-md shadow-2xl rounded-2xl p-6">
        
        {/* Header */}
        <DialogHeader className="border-b pb-4 mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Layers className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <span className="text-muted-foreground font-normal">
                    Phase {phase.phaseNumber}:
                  </span>
                  {phase.title}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  Estimated Duration: {phase.estimatedDuration}
                </DialogDescription>
              </div>
            </div>
            
            <div className="flex items-center gap-2 self-start sm:self-auto">
              <Badge variant={statusConfig.variant} className="gap-1 px-2.5 py-1 text-xs shrink-0">
                {statusConfig.icon}
                {statusConfig.label}
              </Badge>
            </div>
          </div>
        </DialogHeader>

        {/* Error Alert */}
        {error && (
          <div className="mb-4 text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg p-3 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* SECTION 1: Phase Overview */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" />
                Phase Overview
              </h3>
              <div className="bg-muted/30 rounded-xl p-4 border border-border/50 space-y-3 text-sm">
                <div>
                  <span className="font-semibold block mb-0.5 text-xs text-muted-foreground uppercase tracking-wide">
                    Description
                  </span>
                  <p className="leading-relaxed text-foreground">{phase.description}</p>
                </div>
                <div className="pt-2 border-t border-border/50">
                  <span className="font-semibold block mb-0.5 text-xs text-muted-foreground uppercase tracking-wide">
                    Purpose
                  </span>
                  <p className="leading-relaxed text-foreground">{derivedPurpose}</p>
                </div>
                <div className="pt-2 border-t border-border/50">
                  <span className="font-semibold block mb-0.5 text-xs text-muted-foreground uppercase tracking-wide">
                    Expected Outcome
                  </span>
                  <p className="leading-relaxed text-foreground">{derivedExpectedOutcome}</p>
                </div>
              </div>
            </div>

            {/* SECTION 2: Objectives */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Objectives
              </h3>
              {phase.objectives.length === 0 ? (
                <p className="text-sm text-muted-foreground italic pl-2">No objectives available</p>
              ) : (
                <div className="grid md:grid-cols-2 gap-2">
                  {phase.objectives.map((obj, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 p-3 rounded-xl bg-muted/20 border border-border/40 hover:border-primary/20 transition-all"
                    >
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span className="text-sm text-foreground">{obj}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION 3: Deliverables */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Deliverables
              </h3>
              {phase.deliverables.length === 0 ? (
                <p className="text-sm text-muted-foreground italic pl-2">No deliverables defined</p>
              ) : (
                <div className="grid md:grid-cols-2 gap-2">
                  {phase.deliverables.map((del, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/20 border border-border/40 hover:border-primary/20 transition-all"
                    >
                      <div className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      <span className="text-sm text-foreground">{del}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* SECTION 4: Tasks */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  Phase Tasks
                </h3>
                <Badge variant="secondary" className="text-xs">
                  {phaseTasks.length} Task{phaseTasks.length !== 1 ? "s" : ""}
                </Badge>
              </div>
              
              {phaseTasks.length === 0 ? (
                <div className="text-center py-6 border border-dashed rounded-xl bg-muted/10 space-y-2">
                  <p className="text-sm text-muted-foreground italic">No tasks assigned yet</p>
                  {isLeader && (
                    <p className="text-xs text-muted-foreground/75">
                      Generate dynamic tasks for this phase using TeamPilot PM AI below.
                    </p>
                  )}
                </div>
              ) : (
                <div className="border border-border/60 rounded-xl overflow-hidden bg-muted/10">
                  <div className="max-h-60 overflow-y-auto divide-y divide-border/50">
                    {phaseTasks.map((task) => (
                      <div
                        key={task.id}
                        className="p-3 hover:bg-muted/30 transition-all flex items-center justify-between gap-4 text-sm"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-foreground truncate">{task.title}</p>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {task.description}
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs text-muted-foreground font-medium hidden sm:inline">
                            {task.assignedToName || "Unassigned"}
                          </span>
                          
                          <Badge variant="outline" className={`capitalize text-[10px] ${PRIORITY_BADGES[task.priority || "medium"]}`}>
                            {task.priority || "medium"}
                          </Badge>
                          
                          <Badge variant="secondary" className="capitalize text-[10px] font-mono px-1.5 py-0">
                            {task.status}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* SECTION 7: Risks & Dependencies */}
            {(phase.risks.length > 0 || phase.dependencies.length > 0) && (
              <div className="grid md:grid-cols-2 gap-4 pt-2">
                {/* Dependencies */}
                {phase.dependencies.length > 0 && (
                  <div className="space-y-2 bg-muted/10 border border-border/40 p-4 rounded-xl">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      Dependencies
                    </h4>
                    <div className="space-y-1.5">
                      {phase.dependencies.map((dep, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <div className="h-1 w-1 bg-muted-foreground/60 rounded-full mt-1.5 shrink-0" />
                          <span className="text-muted-foreground leading-relaxed">{dep}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Risks */}
                {phase.risks.length > 0 && (
                  <div className="space-y-2 bg-muted/10 border border-border/40 p-4 rounded-xl">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                      Potential Risks
                    </h4>
                    <div className="space-y-1.5">
                      {phase.risks.map((risk, i) => (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <div className="h-1 w-1 bg-amber-500/70 rounded-full mt-1.5 shrink-0" />
                          <span className="text-muted-foreground leading-relaxed">{risk}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          {/* Sidebar Area */}
          <div className="space-y-6">
            
            {/* SECTION 6: Progress */}
            <Card className="border bg-card/40 backdrop-blur-sm">
              <CardHeader className="p-4 pb-2 border-b">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Phase Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-baseline">
                    <span className="text-3xl font-black text-primary">
                      {progressMetrics.percentage}%
                    </span>
                    <span className="text-xs text-muted-foreground">Completion</span>
                  </div>
                  <Progress value={progressMetrics.percentage} className="h-2" />
                </div>
                
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="bg-muted/30 p-2.5 rounded-lg border">
                    <p className="font-bold text-base text-emerald-400">
                      {progressMetrics.completed}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">Done</p>
                  </div>
                  <div className="bg-muted/30 p-2.5 rounded-lg border">
                    <p className="font-bold text-base text-muted-foreground">
                      {progressMetrics.remaining}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">Pending</p>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-xs pt-1">
                  <span className="text-muted-foreground">Current Status</span>
                  <span className="font-semibold capitalize text-foreground">{phase.status.replace("_", " ")}</span>
                </div>
              </CardContent>
            </Card>

            {/* SECTION 5: Team Assignments */}
            <Card className="border bg-card/40 backdrop-blur-sm">
              <CardHeader className="p-4 pb-2 border-b">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <Users className="h-3.5 w-3.5" />
                  Team Assignments
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {teamAssignments.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic text-center py-2">
                    No members assigned tasks in this phase.
                  </p>
                ) : (
                  teamAssignments.map(({ member, taskCount }) => (
                    <div
                      key={member.userId}
                      className="flex items-center justify-between gap-3 p-2 rounded-lg bg-muted/20 border border-border/40 hover:bg-muted/30 transition-all text-xs"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Avatar className="h-6 w-6 shrink-0 shadow-sm border border-background">
                          <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="font-semibold truncate text-foreground">{member.name}</p>
                          <p className="text-[10px] text-muted-foreground capitalize truncate">{member.role}</p>
                        </div>
                      </div>
                      <Badge variant="secondary" className="px-2 py-0.5 shrink-0 text-[10px] font-medium">
                        {taskCount} task{taskCount !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

            {/* LEADER ACTIONS */}
            {isLeader && (
              <Card className="border border-primary/20 bg-primary/5 dark:bg-primary/5">
                <CardHeader className="p-4 pb-2 border-b border-primary/10">
                  <CardTitle className="text-xs font-semibold text-primary uppercase tracking-wider flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-primary" />
                    Leader Controls
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  
                  {/* Generate Tasks Action */}
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-muted-foreground">
                      Let AI analyze this phase's objectives and deliverables to generate actionable tasks.
                    </p>
                    <Button
                      className="w-full gap-2 text-xs h-9 font-medium"
                      onClick={handleGenerateTasks}
                      disabled={generatingTasks}
                    >
                      {generatingTasks ? (
                        <>
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Sparkles className="h-3.5 w-3.5" />
                          Generate Tasks
                        </>
                      )}
                    </Button>
                  </div>

                  <div className="h-px bg-primary/10" />

                  {/* Update Status Actions */}
                  <div className="space-y-2">
                    <p className="text-[11px] text-muted-foreground">Update Phase Status:</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      {phase.status !== "completed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-normal"
                          onClick={() => onCompletePhase(phase.id)}
                        >
                          Mark Complete
                        </Button>
                      )}
                      
                      {phase.status !== "in_progress" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-normal"
                          onClick={() => onUpdatePhaseStatus(phase.id, "in_progress")}
                        >
                          Resume Phase
                        </Button>
                      )}

                      {phase.status !== "blocked" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-normal text-destructive hover:bg-destructive/10"
                          onClick={() => onUpdatePhaseStatus(phase.id, "blocked")}
                        >
                          Mark Blocked
                        </Button>
                      )}

                      {phase.status !== "not_started" && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-normal text-muted-foreground"
                          onClick={() => onUpdatePhaseStatus(phase.id, "not_started")}
                        >
                          Reset Status
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
