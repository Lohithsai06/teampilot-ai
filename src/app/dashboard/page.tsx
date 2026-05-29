"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/common/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FolderKanban,
  Brain,
  Plus,
  ArrowRight,
  UserPlus,
  Rocket,
  ShieldCheck,
  Users,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { CreateProjectModal, JoinProjectModal } from "@/components/project/ProjectModals";
import { PendingRequests } from "@/components/project/PendingRequests";
import Link from "next/link";

export default function DashboardPage() {
  const { user } = useAuth();
  const { projects, activeProject, userRole } = useProject();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  // Derived stats
  const totalProjects = projects.length;

  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-8"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Welcome back, {user?.displayName?.split(" ")[0] || "User"}</h1>
            <p className="text-muted-foreground mt-1">
              {totalProjects > 0 
                ? `You have ${totalProjects} active project${totalProjects > 1 ? "s" : ""}`
                : "Get started by creating or joining a project"}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2" onClick={() => setShowJoinModal(true)}>
              <UserPlus className="h-4 w-4" />
              Join Project
            </Button>
            <Button className="gap-2" onClick={() => setShowCreateModal(true)}>
              <Plus className="h-4 w-4" />
              New Project
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[
            { 
              icon: FolderKanban, 
              label: "Total Projects", 
              value: totalProjects.toString(), 
              change: "Across all teams" 
            },
            { 
              icon: ShieldCheck, 
              label: "Project Role", 
              value: userRole ? (userRole.charAt(0).toUpperCase() + userRole.slice(1)) : "None", 
              change: activeProject ? `In ${activeProject.projectName}` : "Select a project" 
            },
            { 
              icon: Users, 
              label: "Team Members", 
              value: activeProject ? activeProject.totalMembers.toString() : "0", 
              change: "Active in current" 
            },
            { 
              icon: Brain, 
              label: "Current Phase", 
              value: activeProject ? `Phase ${activeProject.currentPhase}` : "-", 
              change: activeProject ? "Project status" : "No active project" 
            },
          ].map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <stat.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  <p className="text-xs text-muted-foreground mt-1">{stat.change}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Pending Requests for Leaders */}
        <PendingRequests />

        <div className="grid gap-6 lg:grid-cols-3">
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Your Projects</CardTitle>
                  <CardDescription>Recently accessed projects</CardDescription>
                </div>
                <Link href="/projects">
                  <Button variant="ghost" size="sm" className="gap-1">
                    View All <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {projects.length > 0 ? (
                  projects.slice(0, 3).map((project) => (
                    <div key={project.projectId} className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors border border-transparent hover:border-border">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-sm font-medium truncate">{project.projectName}</p>
                          <Badge variant={project.status === "active" ? "default" : "secondary"}>
                            {project.status}
                          </Badge>
                        </div>
                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-muted-foreground">
                            <span>{project.projectCode}</span>
                            <span>{project.totalMembers} members</span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{project.projectDescription}</p>
                        </div>
                      </div>
                      <Link href="/ai-workspace">
                        <Button size="sm" variant="outline">Open</Button>
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed rounded-xl">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Rocket className="h-6 w-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-semibold">No projects found</p>
                      <p className="text-sm text-muted-foreground max-w-[200px]">Create your first project to start building.</p>
                    </div>
                    <Button size="sm" onClick={() => setShowCreateModal(true)}>Create Project</Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Active Project</CardTitle>
                {activeProject && (
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {activeProject.projectCode}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {activeProject ? (
                <div className="space-y-6">
                  <div className="space-y-2">
                    <h4 className="font-semibold text-lg">{activeProject.projectName}</h4>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {activeProject.projectDescription}
                    </p>
                  </div>
                  
                  <div className="space-y-4">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Project Progress</span>
                      <span className="font-medium">{activeProject.currentPhase * 20}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-500" 
                        style={{ width: `${activeProject.currentPhase * 20}%` }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Leader</p>
                      <p className="text-sm font-medium truncate">{activeProject.leaderName}</p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Members</p>
                      <p className="text-sm font-medium">{activeProject.totalMembers}</p>
                    </div>
                  </div>

                  <Link href="/ai-workspace" className="block">
                    <Button className="w-full gap-2">
                      Go to Workspace
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="py-12 flex flex-col items-center justify-center text-center space-y-4">
                  <p className="text-sm text-muted-foreground italic">No project selected</p>
                  <Link href="/projects">
                    <Button variant="link" size="sm">Select a project</Button>
                  </Link>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Project Modals */}
        <CreateProjectModal open={showCreateModal} onOpenChange={setShowCreateModal} />
        <JoinProjectModal open={showJoinModal} onOpenChange={setShowJoinModal} />
      </motion.div>
    </DashboardLayout>
  );
}
