"use client";

import React from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/common/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { GitBranch, GitCommitVertical as GitCommit, GitPullRequest, FileCode, Brain, Clock, User, Plus, RefreshCw, ExternalLink } from "lucide-react";

const commits = [
  {
    id: "a3f2b1c",
    message: "feat: add authentication flow with Firebase",
    author: "Developer",
    time: "2 minutes ago",
    branch: "main",
    files: 5,
    additions: 234,
    deletions: 12,
    aiSummary: "Implemented complete authentication flow including email/password and OAuth support. Ready for integration testing.",
  },
  {
    id: "d4e5f6g",
    message: "refactor: optimize database queries for better performance",
    author: "Sarah Chen",
    time: "1 hour ago",
    branch: "feature/performance",
    files: 3,
    additions: 45,
    deletions: 89,
    aiSummary: "Database query performance improved by 40%. Includes indexing recommendations for production.",
  },
  {
    id: "h7i8j9k",
    message: "fix: resolve login redirect issue on mobile devices",
    author: "Mike Johnson",
    time: "3 hours ago",
    branch: "hotfix/mobile",
    files: 1,
    additions: 8,
    deletions: 3,
    aiSummary: "Mobile login flow now correctly redirects users to intended destination.",
  },
  {
    id: "l1m2n3o",
    message: "docs: update API documentation for v2 endpoints",
    author: "Emily Davis",
    time: "1 day ago",
    branch: "docs/api",
    files: 4,
    additions: 156,
    deletions: 23,
    aiSummary: "API documentation updated with new v2 endpoints. Includes authentication examples.",
  },
];

const stats = [
  { label: "Total Commits", value: "156", icon: GitCommit },
  { label: "Open PRs", value: "8", icon: GitPullRequest },
  { label: "Branches", value: "12", icon: GitBranch },
  { label: "Contributors", value: "5", icon: User },
];

export default function GithubPage() {
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
              <GitBranch className="h-8 w-8 text-primary" />
              GitHub Integration
            </h1>
            <p className="text-muted-foreground mt-1">
              Track commits, analyze changes, and get AI-powered insights
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Sync
            </Button>
            <Button className="gap-2">
              <ExternalLink className="h-4 w-4" />
              Open Repository
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          {stats.map((stat, index) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">{stat.label}</p>
                      <p className="text-2xl font-bold">{stat.value}</p>
                    </div>
                    <stat.icon className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <GitBranch className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">team-pilot-app</h3>
                  <p className="text-sm text-muted-foreground">
                    Connected to main branch
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="success" className="gap-1">
                  <div className="h-2 w-2 rounded-full bg-success-foreground" />
                  Synced
                </Badge>
                <Button variant="outline" size="sm">Change Repository</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold">Recent Commits</h2>
              <Button variant="ghost" size="sm">View All</Button>
            </div>

            {commits.map((commit, index) => (
              <motion.div
                key={commit.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <GitCommit className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="font-medium">{commit.message}</h3>
                            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
                              <span className="font-mono">{commit.id}</span>
                              <Badge variant="outline" className="gap-1">
                                <GitBranch className="h-3 w-3" />
                                {commit.branch}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <Badge variant="success" className="gap-1">
                              +{commit.additions}
                            </Badge>
                            <Badge variant="destructive" className="gap-1">
                              -{commit.deletions}
                            </Badge>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center gap-3 text-sm">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">{commit.author[0]}</AvatarFallback>
                          </Avatar>
                          <span className="text-muted-foreground">{commit.author}</span>
                          <span className="text-muted-foreground">committed {commit.time}</span>
                          <span className="text-muted-foreground ml-auto flex items-center gap-1">
                            <FileCode className="h-4 w-4" />
                            {commit.files} files
                          </span>
                        </div>

                        <div className="mt-3 p-3 rounded-lg bg-muted/50 border border-primary/10">
                          <div className="flex items-start gap-2">
                            <Brain className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                            <div>
                              <p className="text-xs font-medium text-primary mb-1">AI Summary</p>
                              <p className="text-sm text-muted-foreground">{commit.aiSummary}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Branches</h2>

            <Card>
              <CardContent className="p-4 space-y-3">
                {[
                  { name: "main", status: "default", commits: 45 },
                  { name: "feature/performance", status: "active", commits: 12 },
                  { name: "hotfix/mobile", status: "active", commits: 3 },
                  { name: "docs/api", status: "active", commits: 7 },
                ].map((branch) => (
                  <div key={branch.name} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-2">
                      <GitBranch className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium">{branch.name}</span>
                      {branch.status === "default" && (
                        <Badge variant="default" className="text-xs">default</Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">{branch.commits} commits</span>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Brain className="h-5 w-5 text-primary shrink-0" />
                  <div>
                    <p className="font-medium text-sm">AI Analysis</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Your team has been actively developing. Consider merging feature/performance branch as it&apos;s 3 commits ahead of main.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </DashboardLayout>
  );
}
