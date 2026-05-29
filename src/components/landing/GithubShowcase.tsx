"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GitBranch, GitCommitVertical as GitCommit, FileCode, Brain } from "lucide-react";

export function GithubShowcase() {
  return (
    <section id="github" className="py-20 md:py-32 bg-muted/30">
      <div className="container mx-auto px-4 md:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="space-y-6"
          >
            <div className="inline-flex items-center gap-2 text-primary">
              <GitBranch className="h-6 w-6" />
              <span className="text-sm font-semibold">GitHub Integration</span>
            </div>

            <h2 className="text-3xl md:text-4xl font-bold">
              Track Every Commit with AI Insights
            </h2>

            <p className="text-lg text-muted-foreground">
              Connect your repositories and get AI-powered analysis of every
              commit. Understand what changed, why it matters, and how it fits
              into your project timeline.
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <GitBranch className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Branch Tracking</h3>
                  <p className="text-sm text-muted-foreground">
                    Monitor all branches and their status in real-time
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <GitCommit className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Commit Analysis</h3>
                  <p className="text-sm text-muted-foreground">
                    Get AI summaries of changes and their impact
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Brain className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="font-semibold">Smart Insights</h3>
                  <p className="text-sm text-muted-foreground">
                    Receive recommendations based on commit history
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-muted/50">
                <div className="flex items-center gap-2">
                  <GitBranch className="h-5 w-5" />
                  <span className="font-semibold">team-pilot-app</span>
                  <Badge variant="secondary" className="ml-auto">
                    main
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {[
                    {
                      message: "feat: add authentication flow",
                      files: 5,
                      additions: 234,
                      deletions: 12,
                      summary:
                        "Authentication flow has been implemented and is ready for integration.",
                    },
                    {
                      message: "refactor: optimize database queries",
                      files: 3,
                      additions: 45,
                      deletions: 89,
                      summary:
                        "Database performance improved by 40% after query optimization.",
                    },
                    {
                      message: "fix: resolve login redirect issue",
                      files: 1,
                      additions: 8,
                      deletions: 3,
                      summary:
                        "Login redirect now correctly routes users to dashboard.",
                    },
                  ].map((commit, index) => (
                    <div key={index} className="p-4 hover:bg-muted/30 transition-colors">
                      <div className="flex items-start gap-3">
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                          <GitCommit className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {commit.message}
                          </p>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <FileCode className="h-3 w-3" />
                              {commit.files} files
                            </span>
                            <span className="text-success">+{commit.additions}</span>
                            <span className="text-destructive">-{commit.deletions}</span>
                          </div>
                          <div className="mt-2 p-2 bg-muted rounded text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">AI:</span>{" "}
                            {commit.summary}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
