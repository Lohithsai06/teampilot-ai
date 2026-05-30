"use client";

import React, { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Search } from "lucide-react";
import { type Task } from "@/lib/aiSystemPrompt";

export interface TaskFilterState {
  search: string;
  phase: number | null;
  priority: Task["priority"] | null;
  status: Task["status"] | null;
  assignee: string | null;
}

export interface TaskFiltersProps {
  filters: TaskFilterState;
  onFiltersChange: (filters: TaskFilterState) => void;
  phases: Array<{ number: number; title: string }>;
  assignees: Array<{ id: string; name: string }>;
}

export function TaskFilters({
  filters,
  onFiltersChange,
  phases,
  assignees,
}: TaskFiltersProps) {
  const hasActiveFilters =
    filters.search ||
    filters.phase !== null ||
    filters.priority !== null ||
    filters.status !== null ||
    filters.assignee !== null;

  const handleClearFilters = useCallback(() => {
    onFiltersChange({
      search: "",
      phase: null,
      priority: null,
      status: null,
      assignee: null,
    });
  }, [onFiltersChange]);

  return (
    <div className="space-y-3">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search tasks..."
          value={filters.search}
          onChange={(e) =>
            onFiltersChange({ ...filters, search: e.target.value })
          }
          className="pl-9"
        />
      </div>

      {/* Filter Dropdowns */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {/* Phase Filter */}
        <Select
          value={filters.phase?.toString() || ""}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              phase: value ? parseInt(value) : null,
            })
          }
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Phase" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Phases</SelectItem>
            {phases.map((phase) => (
              <SelectItem key={phase.number} value={phase.number.toString()}>
                Phase {phase.number}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Priority Filter */}
        <Select
          value={filters.priority || ""}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              priority: (value as Task["priority"]) || null,
            })
          }
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Priorities</SelectItem>
            <SelectItem value="high">High</SelectItem>
            <SelectItem value="medium">Medium</SelectItem>
            <SelectItem value="low">Low</SelectItem>
          </SelectContent>
        </Select>

        {/* Status Filter */}
        <Select
          value={filters.status || ""}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              status: (value as Task["status"]) || null,
            })
          }
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Statuses</SelectItem>
            <SelectItem value="backlog">Backlog</SelectItem>
            <SelectItem value="todo">Todo</SelectItem>
            <SelectItem value="in-progress">In Progress</SelectItem>
            <SelectItem value="review">Review</SelectItem>
            <SelectItem value="testing">Testing</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>

        {/* Assignee Filter */}
        <Select
          value={filters.assignee || ""}
          onValueChange={(value) =>
            onFiltersChange({
              ...filters,
              assignee: value || null,
            })
          }
        >
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Members</SelectItem>
            {assignees.map((assignee) => (
              <SelectItem key={assignee.id} value={assignee.id}>
                {assignee.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Active Filters Display & Clear Button */}
      {hasActiveFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          {filters.search && (
            <Badge variant="secondary" className="gap-1">
              Search: {filters.search}
              <X className="h-3 w-3 cursor-pointer" />
            </Badge>
          )}
          {filters.phase && (
            <Badge variant="secondary" className="gap-1">
              Phase {filters.phase}
              <X className="h-3 w-3 cursor-pointer" />
            </Badge>
          )}
          {filters.priority && (
            <Badge variant="secondary" className="gap-1">
              {filters.priority}
              <X className="h-3 w-3 cursor-pointer" />
            </Badge>
          )}
          {filters.status && (
            <Badge variant="secondary" className="gap-1">
              {filters.status}
              <X className="h-3 w-3 cursor-pointer" />
            </Badge>
          )}
          {filters.assignee && (
            <Badge variant="secondary" className="gap-1">
              {assignees.find((a) => a.id === filters.assignee)?.name}
              <X className="h-3 w-3 cursor-pointer" />
            </Badge>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={handleClearFilters}
          >
            Clear All
          </Button>
        </div>
      )}
    </div>
  );
}
