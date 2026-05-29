"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Play, ArrowRight, Sparkles, Brain, FolderKanban, GitBranch } from "lucide-react";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden py-20 md:py-32">
      <div className="container mx-auto px-4 md:px-8">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="space-y-8"
          >
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="gap-1">
                  <Sparkles className="h-3 w-3" />
                  AI-Powered
                </Badge>
                <Badge variant="secondary">Beta</Badge>
              </div>

              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight">
                Transform Ideas Into{" "}
                <span className="text-gradient">Intelligent Execution</span>{" "}
                Workflows Using AI
              </h1>

              <p className="text-lg md:text-xl text-muted-foreground max-w-lg">
                TeamPilot AI helps teams plan, collaborate, and execute software
                projects intelligently. From idea to deployment, powered by AI.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link href="/register">
                <Button size="lg" className="gap-2 w-full sm:w-auto">
                  Start Building
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="gap-2 w-full sm:w-auto">
                <Play className="h-4 w-4" />
                Watch Demo
              </Button>
            </div>

            <div className="flex flex-wrap gap-3 pt-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Brain className="h-4 w-4 text-primary" />
                AI Roadmaps
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <GitBranch className="h-4 w-4 text-primary" />
                GitHub Tracking
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FolderKanban className="h-4 w-4 text-primary" />
                Team Collaboration
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="relative hidden lg:block"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-transparent rounded-2xl blur-3xl" />
            <div className="relative glass rounded-2xl p-6 shadow-glass-lg border">
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-3 border-b">
                  <div className="h-3 w-3 rounded-full bg-destructive" />
                  <div className="h-3 w-3 rounded-full bg-warning" />
                  <div className="h-3 w-3 rounded-full bg-success" />
                </div>

                <div className="space-y-3">
                  <div className="bg-muted rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <Brain className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-muted-foreground">
                          Let&apos;s design your authentication system...
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-primary text-primary-foreground rounded-lg p-3 ml-12">
                    <p className="text-sm">
                      Build Firebase auth with social login support
                    </p>
                  </div>

                  <div className="bg-muted rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                        <Brain className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0 space-y-2">
                        <p className="text-sm">Generated Roadmap:</p>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="h-16 bg-card rounded border p-2 text-xs">
                            Setup
                          </div>
                          <div className="h-16 bg-card rounded border p-2 text-xs">
                            Auth
                          </div>
                          <div className="h-16 bg-card rounded border p-2 text-xs">
                            Features
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="absolute -bottom-6 -left-6 glass rounded-xl p-4 shadow-lg"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-success/20 flex items-center justify-center">
                  <GitBranch className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Latest commit</p>
                  <p className="text-sm font-medium">feat: authentication flow</p>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
