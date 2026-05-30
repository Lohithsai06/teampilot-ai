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
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { type Task } from "@/lib/aiSystemPrompt";
import {
  Calendar,
  Clock,
  AlertTriangle,
  Trash2,
  Edit2,
  User,
} from "lucide-react";

export interface TaskDetailsModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (taskId: string, updates: Partial<Task>) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  teamMembers: Array<{ id: string; name: string; role: string }>;
  isLeader: boolean;
}

export function TaskDetailsModal({
  task,
  isOpen,
  onClose,
  onUpdate,
  onDelete,
  teamMembers,
  isLeader,
}: TaskDetailsModalProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [updatedTask, setUpdatedTask] = useState<Partial<Task>>({});

  if (!task) return null;

  const handleSave = async () => {
    if (task.id) {
      await onUpdate(task.id, updatedTask);
      setIsEditing(false);
      setUpdatedTask({});
    }
  };

  const handleDelete = async () => {
    if (task.id) {
      await onDelete(task.id);
      onClose();
    }
  };

  const displayTask = isEditing ? { ...task, ...updatedTask } : task;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-screen overflow-y-auto">
          <DialogHeader>
            <div className="flex items-start justify-between">
              <DialogTitle className="text-2xl">{displayTask.title}</DialogTitle>
              <div className="flex gap-2">
                {isLeader && !isEditing && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                    >
                      <Edit2 className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowDeleteDialog(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                  </>
                )}
                {isEditing && (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setIsEditing(false);
                        setUpdatedTask({});
                      }}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave}>
                      Save
                    </Button>
                  </>
                )}
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Priority & Status */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase">
                  Priority
                </label>
                {isEditing ? (
                  <Select
                    value={updatedTask.priority || displayTask.priority}
                    onValueChange={(value) =>
                      setUpdatedTask({
                        ...updatedTask,
                        priority: value as Task["priority"],
                      })
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge
                    variant="outline"
                    className="mt-2 capitalize"
                  >
                    {displayTask.priority}
                  </Badge>
                )}
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase">
                  Status
                </label>
                {isEditing ? (
                  <Select
                    value={updatedTask.status || displayTask.status}
                    onValueChange={(value) =>
                      setUpdatedTask({
                        ...updatedTask,
                        status: value as Task["status"],
                      })
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="backlog">Backlog</SelectItem>
                      <SelectItem value="todo">Todo</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="review">Review</SelectItem>
                      <SelectItem value="testing">Testing</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="default" className="mt-2 capitalize">
                    {displayTask.status}
                  </Badge>
                )}
              </div>
            </div>

            <Separator />

            {/* Description */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase">
                Description
              </label>
              {isEditing ? (
                <Textarea
                  value={updatedTask.description || displayTask.description || ""}
                  onChange={(e) =>
                    setUpdatedTask({ ...updatedTask, description: e.target.value })
                  }
                  className="mt-2 min-h-24"
                  placeholder="Enter task description..."
                />
              ) : (
                <p className="mt-2 text-sm text-muted-foreground">
                  {displayTask.description || "No description provided"}
                </p>
              )}
            </div>

            <Separator />

            {/* Phase & Sprint */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase">
                  Phase
                </label>
                <p className="mt-2 text-sm font-medium">Phase {displayTask.phase}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground uppercase">
                  Sprint
                </label>
                <p className="mt-2 text-sm font-medium">Sprint {displayTask.sprint}</p>
              </div>
            </div>

            <Separator />

            {/* Assigned To */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1">
                <User className="h-3 w-3" />
                Assigned To
              </label>
              {isEditing ? (
                <Select
                  value={updatedTask.assignedTo || displayTask.assignedTo}
                  onValueChange={(value) => {
                    const member = teamMembers.find((m) => m.id === value);
                    setUpdatedTask({
                      ...updatedTask,
                      assignedTo: value,
                      assignedToName: member?.name || "",
                      assignedToRole: member?.role || "",
                    });
                  }}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {teamMembers.map((member) => (
                      <SelectItem key={member.id} value={member.id}>
                        {member.name} ({member.role})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <div className="mt-2 flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs">
                      {displayTask.assignedToName?.[0] || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <p className="text-sm font-medium">{displayTask.assignedToName}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {displayTask.assignedToRole}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <Separator />

            {/* Estimated Hours */}
            <div>
              <label className="text-xs font-medium text-muted-foreground uppercase flex items-center gap-1">
                <Clock className="h-3 w-3" />
                Estimated Hours
              </label>
              {isEditing ? (
                <input
                  type="number"
                  value={updatedTask.estimatedHours || displayTask.estimatedHours || ""}
                  onChange={(e) =>
                    setUpdatedTask({
                      ...updatedTask,
                      estimatedHours: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  className="mt-2 w-20 px-2 py-1 text-sm border rounded"
                  placeholder="0"
                />
              ) : (
                <p className="mt-2 text-sm font-medium">
                  {displayTask.estimatedHours ? `${displayTask.estimatedHours}h` : "Not estimated"}
                </p>
              )}
            </div>

            <Separator />

            {/* Created Info */}
            <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
              <div>
                <p className="font-medium uppercase mb-1">Created By</p>
                <p>{displayTask.createdBy}</p>
              </div>
              <div>
                <p className="font-medium uppercase mb-1">Created At</p>
                <p>
                  {displayTask.createdAt
                    ? new Date(
                        displayTask.createdAt.toMillis?.() ||
                          displayTask.createdAt
                      ).toLocaleDateString()
                    : "Unknown"}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Delete Task?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{task.title}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
