"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  Bell,
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
import { TaskFilters, type TaskFilterState } from "@/components/kanban/TaskFilters";
import { TaskDetailsModal } from "@/components/kanban/TaskDetailsModal";
import { CreateTaskModal } from "@/components/kanban/CreateTaskModal";

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
  const { activeProject, activeProjectMembers, userRole } = useProject();
  const { roadmap, phases: roadmapPhases, currentActivePhase, updatePhaseStatus, completePhase } = useRoadmap(
    activeProject?.projectId,
    user?.uid
  );
  const { columns, loading, error, updateTaskStatus, createTask, deleteTask, getAnalytics } = useKanbanTasks(
    activeProject?.projectId,
    user?.uid
  );

  const isLeader = userRole === "leader";
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [showTaskDetails, setShowTaskDetails] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createModalStatus, setCreateModalStatus] = useState<Task["status"]>("todo");
  const [filters, setFilters] = useState<TaskFilterState>({
    search: "",
    phase: null,
    priority: null,
    status: null,
    assignee: null,
  });
  const [showMyTasksOnly, setShowMyTasksOnly] = useState(false);
  const [phaseCompleteNotification, setPhaseCompleteNotification] = useState<boolean>(false);
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

    // Phase 8: Detect phase completion
    if (currentActivePhase && stats.total > 0) {
      const phaseTasksCount = Object.values(columns)
        .flatMap((col) => col.tasks)
        .filter((t) => t.phase === currentActivePhase.phaseNumber).length;

      const completedPhaseTasksCount = columns.completed.tasks.filter(
        (t) => t.phase === currentActivePhase.phaseNumber
      ).length;

      if (phaseTasksCount > 0 && phaseTasksCount === completedPhaseTasksCount) {
        setPhaseCompleteNotification(true);
      }
    }
  }, [columns, getAnalytics]);

  // Phase 5: Filter tasks by current phase + apply user filters
  const filteredAndOrgananizedColumns = useMemo(() => {
    const result: Record<Task["status"], { tasks: Task[]; count: number }> = {
      backlog: { tasks: [], count: 0 },
      todo: { tasks: [], count: 0 },
      "in-progress": { tasks: [], count: 0 },
      review: { tasks: [], count: 0 },
      testing: { tasks: [], count: 0 },
      completed: { tasks: [], count: 0 },
    };

    // Filter tasks
    let tasksToShow = Object.values(columns)
      .flatMap((col) => col.tasks);

    // Phase 5: Filter by current phase (show current phase + backlog)
    tasksToShow = tasksToShow.filter(
      (t) => t.phase === currentActivePhase?.phaseNumber || t.status === "backlog"
    );

    // Phase 6: Filter by "My Tasks" if enabled
    if (showMyTasksOnly && user?.uid) {
      tasksToShow = tasksToShow.filter((t) => t.assignedTo === user.uid);
    }

    // Apply search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      tasksToShow = tasksToShow.filter(
        (t) =>
          t.title.toLowerCase().includes(searchLower) ||
          t.description?.toLowerCase().includes(searchLower)
      );
    }

    // Apply phase filter
    if (filters.phase !== null) {
      tasksToShow = tasksToShow.filter((t) => t.phase === filters.phase || t.status === "backlog");
    }

    // Apply priority filter
    if (filters.priority) {
      tasksToShow = tasksToShow.filter((t) => t.priority === filters.priority);
    }

    // Apply assignee filter
    if (filters.assignee) {
      tasksToShow = tasksToShow.filter((t) => t.assignedTo === filters.assignee);
    }

    // Apply status filter
    if (filters.status) {
      tasksToShow = tasksToShow.filter((t) => t.status === filters.status);
    }

    // Organize by status
    tasksToShow.forEach((task) => {
      result[task.status].tasks.push(task);
      result[task.status].count += 1;
    });

    return result;
  }, [columns, filters, currentActivePhase, showMyTasksOnly, user?.uid]);

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

      const activeTask = Object.values(filteredAndOrgananizedColumns)
        .flatMap((col) => col.tasks)
        .find((t) => t.id === active.id);

      if (!activeTask) return;

      let newStatus = activeTask.status;

      for (const [status, column] of Object.entries(filteredAndOrgananizedColumns)) {
        if (column.tasks.some((t) => t.id === over.id)) {
          newStatus = status as Task["status"];
          break;
        }
      }

      if (newStatus !== activeTask.status) {
        updateTaskStatus(activeTask.id!, newStatus);
      }

      setActiveId(null);
    },
    [filteredAndOrgananizedColumns, updateTaskStatus]
  );

  const handleCreateTask = useCallback(
    async (taskData: Omit<Task, "id" | "createdAt">) => {
      await createTask(taskData);
    },
    [createTask]
  );

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
      await deleteTask(taskId);
      setShowTaskDetails(false);
    },
    [deleteTask]
  );

  const handleMarkPhaseComplete = useCallback(async () => {
    if (currentActivePhase?.id) {
      await completePhase(currentActivePhase.id);
      setPhaseCompleteNotification(false);
    }
  }, [currentActivePhase, completePhase]);

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
        {/* ─ Phase Completion Notification ─ */}
        {phaseCompleteNotification && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between p-4 rounded-lg bg-success/10 border border-success/20"
          >
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-success" />
              <p className="text-sm font-medium">
                ✅ All tasks in Phase {currentActivePhase?.phaseNumber} are complete!
              </p>
            </div>
            {isLeader && (
              <Button size="sm" onClick={handleMarkPhaseComplete}>
                Mark Phase Complete & Advance
              </Button>
            )}
          </motion.div>
        )}

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
          <div className="flex gap-2 flex-wrap">
            <Button
              variant={showMyTasksOnly ? "default" : "outline"}
              className="gap-2"
              onClick={() => setShowMyTasksOnly(!showMyTasksOnly)}
            >
              My Tasks
            </Button>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
            </Button>
            {isLeader && (
              <Button
                className="gap-2"
                onClick={() => {
                  setShowCreateModal(true);
                  setCreateModalStatus("todo");
                }}
              >
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

        {/* ─ Task Filters ─ */}
        <div className="bg-card border rounded-lg p-4">
          <TaskFilters
            filters={filters}
            onFiltersChange={setFilters}
            phases={roadmapPhases.map((p) => ({ number: p.phaseNumber, title: p.title }))}
            assignees={activeProjectMembers.map((m) => ({ id: m.userId, name: m.name }))}
          />
        </div>

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
                tasks={filteredAndOrgananizedColumns[status].tasks}
                onMenuAction={(action, task) => {
                  if (action === "edit") {
                    setSelectedTask(task);
                    setShowTaskDetails(true);
                  } else if (action === "delete") {
                    if (confirm(`Delete task "${task.title}"?`)) {
                      handleDeleteTask(task.id!);
                    }
                  }
                }}
                onAddTask={(status) => {
                  setCreateModalStatus(status);
                  setShowCreateModal(true);
                }}
              />
            ))}
          </div>

          <DragOverlay>
            {activeId ? (
              <div className="bg-white shadow-lg rounded-lg p-4 opacity-90">
                {Object.values(filteredAndOrgananizedColumns)
                  .flatMap((col) => col.tasks)
                  .find((t) => t.id === activeId) && <div>Dragging...</div>}
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>

        {/* ─ Analytics Footer ─ */}
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
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
                <p className="text-xs text-muted-foreground font-medium">Completion %</p>
                <p className="text-2xl font-bold mt-1">{stats.completionRate}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium">Health</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-sm font-bold">
                    {stats.completionRate >= 70 ? "🟢" : stats.completionRate >= 40 ? "🟡" : "🔴"}
                  </span>
                  <span className="text-xs">
                    {stats.completionRate >= 70 ? "On Track" : stats.completionRate >= 40 ? "At Risk" : "Behind"}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Task Details Modal */}
      {selectedTask && (
        <TaskDetailsModal
          task={selectedTask}
          isOpen={showTaskDetails}
          onClose={() => setShowTaskDetails(false)}
          onUpdate={async (taskId, updates) => {
            // Update task in Firestore
            // For now, we update individual fields
            if (updates.priority) {
              // Call updateDoc separately for each field
            }
          }}
          onDelete={handleDeleteTask}
          teamMembers={activeProjectMembers.map((m) => ({
            id: m.userId,
            name: m.name,
            role: m.role,
          }))}
          isLeader={isLeader}
        />
      )}

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreateTask}
        projectId={activeProject.projectId}
        userId={user?.uid || ""}
        roadmapPhases={roadmapPhases.map((p) => ({ number: p.phaseNumber, title: p.title }))}
        teamMembers={activeProjectMembers.map((m) => ({
          id: m.userId,
          name: m.name,
          role: m.role,
        }))}
        currentPhase={currentActivePhase?.phaseNumber || 1}
      />
    </DashboardLayout>
  );
}
