"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/common/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  FolderKanban, 
  Users, 
  MoveVertical as MoreVertical, 
  ArrowRight,
  ShieldCheck,
  UserPlus,
  Rocket
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useProject } from "@/context/ProjectContext";
import { CreateProjectModal, JoinProjectModal } from "@/components/project/ProjectModals";
import Link from "next/link";

export default function ProjectsPage() {
  const { projects, selectProject, activeProject } = useProject();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-8"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Projects</h1>
            <p className="text-muted-foreground mt-1">
              Manage and track all your team projects
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setShowJoinModal(true)}>
              <UserPlus className="h-4 w-4" />
              Join Project
            </Button>
            <Button className="gap-2" onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4" />
              Create Project
            </Button>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {projects.length > 0 ? (
            projects.map((project, index) => (
              <motion.div
                key={project.projectId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className={`hover:shadow-soft-lg transition-all border-2 ${activeProject?.projectId === project.projectId ? 'border-primary' : 'border-transparent'}`}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2">
                          <FolderKanban className="h-5 w-5 text-primary" />
                          {project.projectName}
                        </CardTitle>
                        <CardDescription className="line-clamp-2">{project.projectDescription}</CardDescription>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => selectProject(project.projectId)}>
                            Select Project
                          </DropdownMenuItem>
                          <DropdownMenuItem>Edit Details</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            Leave Project
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex flex-wrap items-center gap-3 text-sm">
                      <Badge variant={project.status === "active" ? "default" : "secondary"}>
                        {project.status}
                      </Badge>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {project.projectCode}
                      </Badge>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        {project.totalMembers} members
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <ShieldCheck className="h-4 w-4" />
                        {project.leaderName}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">
                          {(project.totalTasks ?? 0) === 0
                            ? "0%"
                            : `${Math.round(((project.completedTasks ?? 0) / (project.totalTasks ?? 1)) * 100)}%`
                          }
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary transition-all duration-300"
                          style={{
                            width: (project.totalTasks ?? 0) === 0
                              ? "0%"
                              : `${Math.round(((project.completedTasks ?? 0) / (project.totalTasks ?? 1)) * 100)}%`
                          }}
                        />
                      </div>
                      {(project.totalTasks ?? 0) === 0 && (
                        <p className="text-xs text-muted-foreground">No tasks created yet</p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button 
                        variant={activeProject?.projectId === project.projectId ? "default" : "outline"} 
                        className="flex-1 gap-2"
                        onClick={() => selectProject(project.projectId)}
                      >
                        {activeProject?.projectId === project.projectId ? 'Current Project' : 'Select Project'}
                      </Button>
                      <Link href="/ai-workspace" className="flex-1">
                        <Button variant="ghost" className="w-full gap-2" onClick={() => selectProject(project.projectId)}>
                          Open <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))
          ) : (
            <div className="md:col-span-2 py-20 flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed rounded-2xl bg-muted/20">
              <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <Rocket className="h-8 w-8 text-primary" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-bold">No Projects Found</h3>
                <p className="text-muted-foreground max-w-[300px] mx-auto">
                  You haven&apos;t created or joined any projects yet. Start by creating a new one!
                </p>
              </div>
              <Button size="lg" className="gap-2" onClick={() => setShowCreateModal(true)}>
                <Plus className="h-5 w-5" />
                Create First Project
              </Button>
            </div>
          )}
        </div>

        {/* Project Modals */}
        <CreateProjectModal open={showCreateModal} onOpenChange={setShowCreateModal} />
        <JoinProjectModal open={showJoinModal} onOpenChange={setShowJoinModal} />

        <Card className="bg-muted/30 mt-8">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <FolderKanban className="h-6 w-6 text-primary" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold">Shared Project Context</h3>
                <p className="text-sm text-muted-foreground">
                  All team members share the same project memory, roadmap, and context for consistent collaboration.
                </p>
              </div>
              <Button variant="outline">Learn More</Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </DashboardLayout>
  );
}
