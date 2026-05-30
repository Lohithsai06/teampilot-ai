"use client";

import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle, Loader2 } from "lucide-react";
import { type Task } from "@/lib/aiSystemPrompt";

export interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (task: Omit<Task, "id" | "createdAt">) => Promise<void>;
  projectId: string;
  userId: string;
  roadmapPhases: Array<{ number: number; title: string }>;
  teamMembers: Array<{ id: string; name: string; role: string }>;
  currentPhase: number;
}

export function CreateTaskModal({
  isOpen,
  onClose,
  onSubmit,
  projectId,
  userId,
  roadmapPhases,
  teamMembers,
  currentPhase,
}: CreateTaskModalProps) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    priority: "medium" as Task["priority"],
    phase: currentPhase || 1,
    sprint: 1,
    status: "todo" as Task["status"],
    estimatedHours: "",
    assignedTo: "",
    assignedToName: "",
    assignedToRole: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.title.trim()) {
      newErrors.title = "Title is required";
    } else if (formData.title.length < 3) {
      newErrors.title = "Title must be at least 3 characters";
    }

    if (!formData.assignedTo) {
      newErrors.assignedTo = "Please assign this task to a team member";
    }

    if (formData.estimatedHours && isNaN(parseInt(formData.estimatedHours))) {
      newErrors.estimatedHours = "Must be a valid number";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      await onSubmit({
        projectId,
        title: formData.title.trim(),
        description: formData.description.trim(),
        priority: formData.priority,
        phase: formData.phase,
        sprint: formData.sprint,
        status: formData.status,
        estimatedHours: formData.estimatedHours ? parseInt(formData.estimatedHours) : undefined,
        assignedTo: formData.assignedTo,
        assignedToName: formData.assignedToName,
        assignedToRole: formData.assignedToRole,
        createdBy: userId,
        dependencies: [],
      });

      // Reset form
      setFormData({
        title: "",
        description: "",
        priority: "medium",
        phase: currentPhase || 1,
        sprint: 1,
        status: "todo",
        estimatedHours: "",
        assignedTo: "",
        assignedToName: "",
        assignedToRole: "",
      });
      setErrors({});
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleAssigneeChange = (memberId: string) => {
    const member = teamMembers.find((m) => m.id === memberId);
    setFormData({
      ...formData,
      assignedTo: memberId,
      assignedToName: member?.name || "",
      assignedToRole: member?.role || "",
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Title */}
          <div>
            <label className="text-sm font-medium">Task Title *</label>
            <Input
              placeholder="Enter task title..."
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              className={errors.title ? "border-destructive" : ""}
            />
            {errors.title && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.title}
              </p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              placeholder="Enter task description..."
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="min-h-24"
            />
          </div>

          {/* Grid: Priority, Phase, Sprint, Estimated Hours */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-sm font-medium">Priority</label>
              <Select
                value={formData.priority}
                onValueChange={(value) =>
                  setFormData({ ...formData, priority: value as Task["priority"] })
                }
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Phase</label>
              <Select
                value={formData.phase.toString()}
                onValueChange={(value) =>
                  setFormData({ ...formData, phase: parseInt(value) })
                }
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {roadmapPhases.map((phase) => (
                    <SelectItem key={phase.number} value={phase.number.toString()}>
                      Phase {phase.number}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Sprint</label>
              <Select
                value={formData.sprint.toString()}
                onValueChange={(value) =>
                  setFormData({ ...formData, sprint: parseInt(value) })
                }
              >
                <SelectTrigger className="mt-1.5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((num) => (
                    <SelectItem key={num} value={num.toString()}>
                      Sprint {num}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Estimated Hours</label>
              <Input
                type="number"
                placeholder="e.g., 8"
                value={formData.estimatedHours}
                onChange={(e) =>
                  setFormData({ ...formData, estimatedHours: e.target.value })
                }
                min="0"
                className={errors.estimatedHours ? "border-destructive mt-1.5" : "mt-1.5"}
              />
              {errors.estimatedHours && (
                <p className="text-xs text-destructive mt-1">{errors.estimatedHours}</p>
              )}
            </div>
          </div>

          {/* Assign To */}
          <div>
            <label className="text-sm font-medium">Assign To *</label>
            <Select
              value={formData.assignedTo}
              onValueChange={handleAssigneeChange}
            >
              <SelectTrigger className={`mt-1.5 ${errors.assignedTo ? "border-destructive" : ""}`}>
                <SelectValue placeholder="Select team member..." />
              </SelectTrigger>
              <SelectContent>
                {teamMembers.map((member) => (
                  <SelectItem key={member.id} value={member.id}>
                    {member.name} ({member.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.assignedTo && (
              <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.assignedTo}
              </p>
            )}
          </div>

          {/* Status */}
          <div>
            <label className="text-sm font-medium">Initial Status</label>
            <div className="mt-2 flex gap-2 flex-wrap">
              {(["backlog", "todo", "in-progress"] as const).map((status) => (
                <Badge
                  key={status}
                  variant={formData.status === status ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setFormData({ ...formData, status })}
                >
                  {status.split("-").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                </Badge>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {loading ? "Creating..." : "Create Task"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
