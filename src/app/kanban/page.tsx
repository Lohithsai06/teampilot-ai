"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { DashboardLayout } from "@/components/common/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Plus,
  GripVertical,
  Calendar,
  CircleAlert as AlertCircle,
  CircleCheck as CheckCircle2,
  Clock,
  ListFilter as Filter,
  MoveVertical as MoreVertical,
  Loader2,
  TrendingUp,
  AlertTriangle,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { useRoadmap } from "@/lib/useRoadmap";
import { useKanbanTasks } from "@/lib/useKanbanTasks";
import { type Task } from "@/lib/aiSystemPrompt";
import { Progress } from "@/components/ui/progress";

const COLUMN_ORDER = ["backlog", "todo", "in-progress", "review", "testing", "completed"] as const;
const COLUMN_TITLES: Record<Task["status"], string> = {
  backlog: "Backlog",
  todo: "Todo",
  "in-progress": "In Progress",
  review: "Review",
  testing: "Testing",
  completed: "Completed",
};

const PRIORITY_COLORS = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  low: "bg-success/10 text-success border-success/20",
};

// ─── Draggable Task Card Component ──────────────────────────────────────────

interface TaskCardProps {
  task: Task;
  onMenuAction: (action: "edit" | "delete", task: Task) => void;
  isDragging?: boolean;
}

function TaskCard({ task, onMenuAction, isDragging }: TaskCardProps) {
  return (
    <Card
      className={`cursor-grab active:cursor-grabbing hover:shadow-soft transition-all ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <Badge variant="outline" className={PRIORITY_COLORS[task.priority]}>
            {task.priority}
          </Badge>
          <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
        </div>

        <h3 className="text-sm font-medium line-clamp-2">{task.title}</h3>

        {task.description && (
          <p className="text-xs text-muted-foreground line-clamp-1">
            {task.description}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          {task.phase && (
            <Badge variant="secondary" className="text-xs">
              Phase {task.phase}
            </Badge>
          )}
          {task.estimatedHours && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {task.estimatedHours}h
            </div>
          )}
        </div>

        <div className="flex items-center justify-between pt-2 border-t">
          <div className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs">
                {task.assignedToName?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground truncate">
              {task.assignedToName || "Unassigned"}
            </span>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6">
                <MoreVertical className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => onMenuAction("edit", task)}>
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive"
                onClick={() => onMenuAction("delete", task)}
              >
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Kanban Column Component ────────────────────────────────────────────────

interface KanbanColumnProps {
  status: Task["status"];
  tasks: Task[];
  onMenuAction: (action: "edit" | "delete", task: Task) => void;
  onAddTask: (status: Task["status"]) => void;
}

function KanbanColumn({ status, tasks, onMenuAction, onAddTask }: KanbanColumnProps) {
  return (
    <div className="space-y-4 bg-muted/30 rounded-lg p-4 min-h-[600px]">
      <div className="flex items-center justify-between sticky top-0 bg-background/80 backdrop-blur -mx-4 px-4 py-2 z-10">
        <div className="flex items-center gap-2">
          <CardTitle className="text-base">{COLUMN_TITLES[status]}</CardTitle>
          <Badge variant="secondary" className="font-mono text-xs">
            {tasks.length}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => onAddTask(status)}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <SortableContext items={tasks.map((t) => t.id!)} strategy={verticalListSortingStrategy}>
        <div className="space-y-3">
          <AnimatePresence>
            {tasks.map((task, index) => (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ delay: index * 0.05 }}
              >
                <TaskCard
                  task={task}
                  onMenuAction={onMenuAction}
                />
              </motion.div>
            ))}
          </AnimatePresence>
          {tasks.length === 0 && (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <p className="text-sm">No tasks yet</p>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// ─── Main Kanban Page ──────────────────────────────────────────────────────

export default function KanbanPage() {
  const { user } = useAuth();
  const { activeProject, userRole } = useProject();
  const { roadmap, currentActivePhase } = useRoadmap(activeProject?.projectId, user?.uid);
  const { columns, loading, error, updateTaskStatus, getAnalytics } = useKanbanTasks(
    activeProject?.projectId,
    user?.uid
  );

  const isLeader = userRole === "leader";
  const [activeId, setActiveId] = useState<string | null>(null);
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    inProgress: 0,
    pending: 0,
    completionRate: 0,
  });

  // Update analytics
  useEffect(() => {
    const analytics = getAnalytics();
    setStats({
      total: analytics.total,
      completed: analytics.completed,
      inProgress: analytics.inProgress,
      pending: analytics.total - analytics.completed,
      completionRate: analytics.completionRate,
    });
  }, [columns, getAnalytics]);

  // Drag-drop sensor configuration
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      if (!over) return;

      const activeTask = Array.from(Object.values(columns))
        .flatMap((col) => col.tasks)
        .find((t) => t.id === active.id);

      if (!activeTask) return;

      // Determine new status from which column the task was dropped into
      let newStatus = activeTask.status;

      // Find which column the task is in based on task ID
      for (const [status, column] of Object.entries(columns)) {
        if (column.tasks.some((t) => t.id === over.id)) {
          newStatus = status as Task["status"];
          break;
        }
      }

      if (newStatus !== activeTask.status) {
        console.log(`[KanbanPage] Moving task ${activeTask.id} to ${newStatus}`);
        updateTaskStatus(activeTask.id!, newStatus);
      }

      setActiveId(null);
    },
    [columns, updateTaskStatus]
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Loading kanban board...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!activeProject) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center space-y-4">
            <AlertTriangle className="h-8 w-8 text-warning mx-auto" />
            <p className="text-sm text-muted-foreground">Please select a project first</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
        {/* ─ Header ─ */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Kanban Board</h1>
            <p className="text-muted-foreground mt-1">
              {currentActivePhase
                ? `Phase ${currentActivePhase.phaseNumber}: ${currentActivePhase.title}`
                : "Drag and drop tasks to manage your project workflow"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filter
            </Button>
            {isLeader && (
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Task
              </Button>
            )}
          </div>
        </div>

        {/* ─ Error Display ─ */}
        {error && (
          <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm">{error}</p>
          </div>
        )}

        {/* ─ Phase Progress ─ */}
        {currentActivePhase && (
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="text-sm font-medium">Phase Progress</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {currentActivePhase.objectives?.length || 0} objectives,{" "}
                    {currentActivePhase.deliverables?.length || 0} deliverables
                  </p>
                </div>
                <Badge variant="default">{currentActivePhase.status}</Badge>
              </div>
              <Progress value={50} className="h-2" />
            </CardContent>
          </Card>
        )}

        {/* ─ Kanban Board ─ */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragEnd={handleDragEnd}
          onDragStart={(event) => setActiveId(event.active.id as string)}
        >
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            {COLUMN_ORDER.map((status) => (
              <KanbanColumn
                key={status}
                status={status}
                tasks={columns[status].tasks}
                onMenuAction={() => {}}
                onAddTask={() => {}}
              />
            ))}
          </div>

          <DragOverlay>
            {activeId ? (
              <div className="bg-white shadow-lg rounded-lg p-4 opacity-90">
                {Array.from(Object.values(columns))
                  .flatMap((col) => col.tasks)
                  .find((t) => t.id === activeId) && <div>Dragging...</div>}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* ─ Analytics Footer ─ */}
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div>
                <p className="text-xs text-muted-foreground font-medium">Total Tasks</p>
                <p className="text-2xl font-bold mt-1">{stats.total}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Completed</p>
                <p className="text-2xl font-bold text-success mt-1">{stats.completed}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">In Progress</p>
                <p className="text-2xl font-bold text-primary mt-1">{stats.inProgress}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Pending</p>
                <p className="text-2xl font-bold text-warning mt-1">{stats.pending}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Completion</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-2xl font-bold">{stats.completionRate}%</span>
                  <TrendingUp className="h-5 w-5 text-success" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </DashboardLayout>
  );
}
