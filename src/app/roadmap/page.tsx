"use client";

import React from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/common/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Map, CircleCheck as CheckCircle2, Circle, Clock, ArrowRight, Rocket, Lock, Zap, GitBranch, Globe } from "lucide-react";

const phases = [
  {
    id: 1,
    title: "Project Setup",
    description: "Initialize project structure and configure development environment",
    status: "completed",
    icon: Rocket,
    tasks: ["Next.js setup", "TypeScript config", "Tailwind CSS", "ESLint & Prettier"],
    duration: "1 week",
  },
  {
    id: 2,
    title: "Authentication System",
    description: "Implement secure user authentication with Firebase",
    status: "completed",
    icon: Lock,
    tasks: ["Email/password auth", "OAuth integration", "Protected routes", "Session management"],
    duration: "2 weeks",
  },
  {
    id: 3,
    title: "Core Features",
    description: "Build main application features and functionality",
    status: "in_progress",
    icon: Zap,
    tasks: ["Dashboard UI", "Project management", "Task system", "Team collaboration"],
    duration: "3 weeks",
  },
  {
    id: 4,
    title: "AI Integration",
    description: "Integrate AI capabilities for intelligent assistance",
    status: "upcoming",
    icon: GitBranch,
    tasks: ["AI chat interface", "Prompt generation", "Context memory", "Smart suggestions"],
    duration: "2 weeks",
  },
  {
    id: 5,
    title: "GitHub Integration",
    description: "Connect repositories and enable workflow tracking",
    status: "upcoming",
    icon: GitBranch,
    tasks: ["OAuth connection", "Commit tracking", "Branch analysis", "AI summaries"],
    duration: "1.5 weeks",
  },
  {
    id: 6,
    title: "Deployment",
    description: "Deploy to production and optimize performance",
    status: "upcoming",
    icon: Globe,
    tasks: ["CI/CD pipeline", "Performance optimization", "Monitoring setup", "Go live"],
    duration: "1 week",
  },
];

export default function RoadmapPage() {
  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-8"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Map className="h-8 w-8 text-primary" />
              Roadmap
            </h1>
            <p className="text-muted-foreground mt-1">
              Your project journey from idea to deployment
            </p>
          </div>
          <Button className="gap-2">
            Generate with AI
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative">
          <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border" />

          <div className="space-y-6">
            {phases.map((phase, index) => {
              const Icon = phase.icon;
              const isCompleted = phase.status === "completed";
              const isInProgress = phase.status === "in_progress";

              return (
                <motion.div
                  key={phase.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative pl-20"
                >
                  <div
                    className={`absolute left-5 h-6 w-6 rounded-full border-2 ${
                      isCompleted
                        ? "bg-success border-success"
                        : isInProgress
                        ? "bg-primary border-primary"
                        : "bg-background border-border"
                    } flex items-center justify-center`}
                  >
                    {isCompleted ? (
                      <CheckCircle2 className="h-4 w-4 text-success-foreground" />
                    ) : isInProgress ? (
                      <Clock className="h-3 w-3 text-primary-foreground animate-pulse" />
                    ) : (
                      <Circle className="h-3 w-3 text-muted-foreground" />
                    )}
                  </div>

                  <Card
                    className={`${
                      isInProgress ? "border-primary shadow-soft" : ""
                    } hover:shadow-soft-lg transition-shadow`}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-10 w-10 rounded-lg ${
                              isCompleted
                                ? "bg-success/10"
                                : isInProgress
                                ? "bg-primary/10"
                                : "bg-muted"
                            } flex items-center justify-center`}
                          >
                            <Icon
                              className={`h-5 w-5 ${
                                isCompleted
                                  ? "text-success"
                                  : isInProgress
                                  ? "text-primary"
                                  : "text-muted-foreground"
                              }`}
                            />
                          </div>
                          <div>
                            <CardTitle className="text-lg">{phase.title}</CardTitle>
                            <p className="text-sm text-muted-foreground">
                              {phase.description}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="gap-1">
                            <Clock className="h-3 w-3" />
                            {phase.duration}
                          </Badge>
                          <Badge
                            variant={
                              isCompleted
                                ? "success"
                                : isInProgress
                                ? "default"
                                : "secondary"
                            }
                          >
                            {isCompleted ? "Completed" : isInProgress ? "In Progress" : "Upcoming"}
                          </Badge>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent>
                      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
                        {phase.tasks.map((task) => (
                          <div
                            key={task}
                            className="flex items-center gap-2 p-3 rounded-lg bg-muted/50"
                          >
                            {isCompleted ? (
                              <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                            ) : isInProgress ? (
                              <Clock className="h-4 w-4 text-primary shrink-0" />
                            ) : (
                              <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            <span className="text-sm">{task}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
