"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/common/DashboardLayout";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Plus, GripVertical, Calendar, CircleAlert as AlertCircle, CircleCheck as CheckCircle2, Clock, ListFilter as Filter, MoveVertical as MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Task = {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  assignee: string;
  dueDate: string;
  sprint: string;
};

const initialColumns: Record<string, { title: string; tasks: Task[] }> = {
  todo: {
    title: "Todo",
    tasks: [
      {
        id: "1",
        title: "Design authentication flow",
        priority: "high",
        assignee: "John",
        dueDate: "May 30",
        sprint: "Sprint 2",
      },
      {
        id: "2",
        title: "Implement password reset",
        priority: "medium",
        assignee: "Sarah",
        dueDate: "May 31",
        sprint: "Sprint 2",
      },
    ],
  },
  "in-progress": {
    title: "In Progress",
    tasks: [
      {
        id: "3",
        title: "Build dashboard layout",
        priority: "high",
        assignee: "Mike",
        dueDate: "May 29",
        sprint: "Sprint 2",
      },
      {
        id: "4",
        title: "Set up Firebase project",
        priority: "low",
        assignee: "John",
        dueDate: "May 29",
        sprint: "Sprint 2",
      },
    ],
  },
  review: {
    title: "Review",
    tasks: [
      {
        id: "5",
        title: "API endpoint documentation",
        priority: "medium",
        assignee: "Sarah",
        dueDate: "May 28",
        sprint: "Sprint 1",
      },
    ],
  },
  done: {
    title: "Done",
    tasks: [
      {
        id: "6",
        title: "Project structure setup",
        priority: "high",
        assignee: "Mike",
        dueDate: "May 25",
        sprint: "Sprint 1",
      },
      {
        id: "7",
        title: "Tailwind configuration",
        priority: "low",
        assignee: "John",
        dueDate: "May 25",
        sprint: "Sprint 1",
      },
    ],
  },
};

export default function KanbanPage() {
  const [columns] = useState(initialColumns);

  const priorityColors = {
    high: "bg-destructive/10 text-destructive border-destructive/20",
    medium: "bg-warning/10 text-warning border-warning/20",
    low: "bg-success/10 text-success border-success/20",
  };

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-6"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Kanban Board</h1>
            <p className="text-muted-foreground mt-1">
              Drag and drop tasks to manage your sprint workflow
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filter
            </Button>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Task
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          {Object.entries(columns).map(([columnId, column]) => (
            <div key={columnId} className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-base">{column.title}</CardTitle>
                  <Badge variant="secondary">{column.tasks.length}</Badge>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-3">
                {column.tasks.map((task, index) => (
                  <motion.div
                    key={task.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <Card className="cursor-grab active:cursor-grabbing hover:shadow-soft transition-shadow">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <Badge
                            variant="outline"
                            className={priorityColors[task.priority]}
                          >
                            {task.priority}
                          </Badge>
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        </div>

                        <h3 className="text-sm font-medium">{task.title}</h3>

                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="text-xs">
                            {task.sprint}
                          </Badge>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {task.dueDate}
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarFallback className="text-xs">
                                {task.assignee[0]}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-xs text-muted-foreground">
                              {task.assignee}
                            </span>
                          </div>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-6 w-6">
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem>Edit</DropdownMenuItem>
                              <DropdownMenuItem>Move</DropdownMenuItem>
                              <DropdownMenuItem className="text-destructive">
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-warning" />
                  <span className="text-sm">
                    <strong>3 tasks</strong> due this week
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  <span className="text-sm">
                    <strong>2 tasks</strong> in progress
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-success" />
                  <span className="text-sm">
                    <strong>2 tasks</strong> completed
                  </span>
                </div>
              </div>
              <Badge variant="success">Sprint 2 - On Track</Badge>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </DashboardLayout>
  );
}
