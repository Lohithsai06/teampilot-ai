"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/common/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Brain,
  Send,
  Sparkles,
  Code,
  Map,
  GitBranch,
  Loader2,
  Settings,
  FolderKanban,
  Users,
  Shield,
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Clock,
  Rocket,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { useAISettings } from "@/lib/useAISettings";
import { useAIChat } from "@/lib/useAIChat";
import Link from "next/link";
import { Timestamp } from "firebase/firestore";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(ts: Timestamp | null): string {
  if (!ts) return "";
  try {
    return ts.toDate().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function formatDate(ts: Timestamp | null): string {
  if (!ts) return "";
  try {
    const d = ts.toDate();
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return "Today";
    if (diff < 172800000) return "Yesterday";
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NoProjectState() {
  return (
    <div className="h-[calc(100vh-8rem)] flex items-center justify-center">
      <div className="text-center space-y-4 max-w-sm">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
          <FolderKanban className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold">No Project Selected</h2>
        <p className="text-muted-foreground text-sm">
          Select or create a project first to use the AI Workspace.
        </p>
        <Link href="/projects">
          <Button className="gap-2">
            <FolderKanban className="h-4 w-4" />
            Go to Projects
          </Button>
        </Link>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AIWorkspacePage() {
  const { user } = useAuth();
  const { activeProject, activeProjectMembers, userRole } = useProject();
  const { settings, loading: settingsLoading, geminiConfigured, openRouterConfigured, anyProviderConfigured, activeProvider } = useAISettings();
  const { messages, loading: chatLoading, sending, sendMessage } = useAIChat(
    activeProject?.projectId,
    user?.uid
  );

  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || sending) return;
    const text = message;
    setMessage("");
    await sendMessage(text);
    // AI response will be implemented in Chapter 4
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── No project → gate the whole page ──────────────────────────────────────
  if (!activeProject) {
    return (
      <DashboardLayout>
        <NoProjectState />
      </DashboardLayout>
    );
  }

  // Derived project info
  const progress =
    (activeProject.totalTasks ?? 0) === 0
      ? 0
      : Math.round(((activeProject.completedTasks ?? 0) / (activeProject.totalTasks ?? 1)) * 100);

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-6">

        {/* ── LEFT PANEL: Project Context ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden lg:flex w-64 shrink-0 flex-col gap-4"
        >
          {/* Project Context Card */}
          <Card className="flex-shrink-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <FolderKanban className="h-4 w-4 text-primary" />
                Project Context
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Project</p>
                <p className="font-semibold truncate">{activeProject.projectName}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Description</p>
                <p className="text-xs text-muted-foreground line-clamp-2">{activeProject.projectDescription || "—"}</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Role</p>
                  <p className="font-medium capitalize text-xs">{userRole ?? "—"}</p>
                </div>
                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Phase</p>
                  <p className="font-medium text-xs">{activeProject.currentPhase}</p>
                </div>
                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Members</p>
                  <p className="font-medium text-xs">{activeProject.totalMembers}</p>
                </div>
                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Progress</p>
                  <p className="font-medium text-xs">{progress}%</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Leader</p>
                <p className="text-xs font-medium flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-primary" />
                  {activeProject.leaderName}
                </p>
              </div>
              <div className="pt-1 border-t">
                <p className="text-[10px] text-muted-foreground font-mono">{activeProject.projectCode}</p>
              </div>
            </CardContent>
          </Card>

          {/* AI Provider Status Card */}
          <Card className="flex-shrink-0">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                AI Provider
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {settingsLoading ? (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span className="text-xs">Loading...</span>
                </div>
              ) : (
                <>
                  {/* Gemini */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs">Gemini</span>
                    {geminiConfigured ? (
                      <Badge variant="success" className="text-[10px] px-1.5 gap-1">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Connected
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] px-1.5 gap-1">
                        <XCircle className="h-2.5 w-2.5" /> Not set
                      </Badge>
                    )}
                  </div>
                  {/* OpenRouter */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs">OpenRouter</span>
                    {openRouterConfigured ? (
                      <Badge variant="success" className="text-[10px] px-1.5 gap-1">
                        <CheckCircle2 className="h-2.5 w-2.5" /> Connected
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-[10px] px-1.5 gap-1">
                        <XCircle className="h-2.5 w-2.5" /> Not set
                      </Badge>
                    )}
                  </div>

                  {anyProviderConfigured ? (
                    <div className="pt-2 border-t space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Primary</span>
                        <span className="font-medium capitalize">{activeProvider}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">Ready</span>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t">
                      <Link href="/settings?tab=ai">
                        <Button size="sm" variant="outline" className="w-full gap-1.5 h-7 text-xs">
                          <Settings className="h-3 w-3" />
                          Configure Keys
                        </Button>
                      </Link>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Team Members Panel */}
          <Card className="flex-1 overflow-hidden flex flex-col">
            <CardHeader className="pb-3 shrink-0">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Team ({activeProject.totalMembers})
              </CardTitle>
            </CardHeader>
            <CardContent className="overflow-y-auto flex-1 space-y-2 pb-3">
              {activeProjectMembers.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">No members loaded</p>
              ) : (
                activeProjectMembers.map((member) => (
                  <div key={member.userId} className="flex items-center gap-2">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="text-[10px] font-semibold">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{member.name}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{member.role}</p>
                    </div>
                    {member.role === "leader" && (
                      <Shield className="h-3 w-3 text-primary shrink-0" />
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* ── CENTER PANEL: Chat ───────────────────────────────────────────── */}
        <div className="flex-1 flex flex-col gap-4 min-h-0">
          {/* Mode badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="default" className="gap-1">
              <Brain className="h-3 w-3" />
              Architect Mode
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Map className="h-3 w-3" />
              PM Mode
            </Badge>
            <Badge variant="outline" className="gap-1">
              <Code className="h-3 w-3" />
              Vibe Coding
            </Badge>
            <Badge variant="outline" className="gap-1">
              <GitBranch className="h-3 w-3" />
              GitHub Analyst
            </Badge>
          </div>

          {/* Chat Card */}
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="border-b py-3 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-primary" />
                  <CardTitle className="text-base">AI Workspace</CardTitle>
                  <Badge variant="outline" className="text-[10px] font-mono">
                    {activeProject.projectName}
                  </Badge>
                </div>
                <Badge
                  variant={anyProviderConfigured ? "success" : "secondary"}
                  className="gap-1 text-[10px]"
                >
                  {anyProviderConfigured ? (
                    <><CheckCircle2 className="h-2.5 w-2.5" />{activeProvider}</>
                  ) : (
                    <><AlertCircle className="h-2.5 w-2.5" />No AI</>
                  )}
                </Badge>
              </div>
            </CardHeader>

            {/* Messages */}
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
              {chatLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-3">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
                    <Brain className="h-7 w-7 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold">Start a conversation</p>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Ask the AI to generate a roadmap, create tasks, or analyze your project.
                    </p>
                    {!anyProviderConfigured && (
                      <Link href="/settings?tab=ai">
                        <Button size="sm" variant="outline" className="mt-3 gap-2">
                          <Settings className="h-3.5 w-3.5" />
                          Configure AI Provider First
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                  >
                    {msg.role === "assistant" && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          <Brain className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className="max-w-[80%] space-y-1">
                      <div
                        className={`rounded-lg p-3 text-sm ${
                          msg.role === "user"
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted"
                        }`}
                      >
                        <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
                      </div>
                      <p className="text-[10px] text-muted-foreground px-1">
                        {formatTime(msg.timestamp)}
                      </p>
                    </div>
                    {msg.role === "user" && (
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="text-xs font-semibold">
                          {getInitials(user?.displayName || user?.email || "U")}
                        </AvatarFallback>
                      </Avatar>
                    )}
                  </div>
                ))
              )}
              {sending && (
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Brain className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="rounded-lg p-3 bg-muted">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </CardContent>

            {/* Input area */}
            <div className="border-t p-4 shrink-0">
              {!anyProviderConfigured && !settingsLoading ? (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-700 dark:text-amber-400 flex-1">
                    No AI provider configured. Add an API key in Settings.
                  </p>
                  <Link href="/settings?tab=ai">
                    <Button size="sm" variant="outline" className="gap-1.5 shrink-0">
                      <Settings className="h-3.5 w-3.5" />
                      Settings
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="flex gap-2">
                  <Textarea
                    placeholder={
                      anyProviderConfigured
                        ? "Describe your project idea, ask for a roadmap, or request code prompts..."
                        : "Configure an AI provider to start chatting..."
                    }
                    className="min-h-[60px] max-h-[120px] resize-none"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={sending || !anyProviderConfigured}
                  />
                  <Button
                    className="h-auto px-4"
                    onClick={handleSend}
                    disabled={sending || !message.trim() || !anyProviderConfigured}
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* ── RIGHT PANEL: Prompts / Roadmap / Team Context ────────────────── */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden xl:flex w-80 shrink-0 flex-col gap-4"
        >
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="border-b pb-0 shrink-0">
              <Tabs defaultValue="context">
                <TabsList className="w-full">
                  <TabsTrigger value="context" className="flex-1 text-xs">Context</TabsTrigger>
                  <TabsTrigger value="roadmap" className="flex-1 text-xs">Roadmap</TabsTrigger>
                  <TabsTrigger value="prompts" className="flex-1 text-xs">Prompts</TabsTrigger>
                </TabsList>

                {/* ── Team Context Tab ── */}
                <TabsContent value="context" className="mt-4 space-y-3 pb-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                      Shared Team Context
                    </p>
                    <div className="space-y-2">
                      {/* Project summary */}
                      <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                        <p className="text-xs font-medium">{activeProject.projectName}</p>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">
                          {activeProject.projectDescription || "No description"}
                        </p>
                      </div>

                      {/* Phase + Tasks */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-muted/50 p-2 text-center">
                          <p className="text-lg font-bold text-primary">{activeProject.currentPhase}</p>
                          <p className="text-[10px] text-muted-foreground">Current Phase</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-2 text-center">
                          <p className="text-lg font-bold text-primary">{activeProject.totalTasks ?? 0}</p>
                          <p className="text-[10px] text-muted-foreground">Total Tasks</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-2 text-center">
                          <p className="text-lg font-bold text-green-600">{activeProject.completedTasks ?? 0}</p>
                          <p className="text-[10px] text-muted-foreground">Completed</p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-2 text-center">
                          <p className="text-lg font-bold">{activeProject.totalMembers}</p>
                          <p className="text-[10px] text-muted-foreground">Members</p>
                        </div>
                      </div>

                      {/* Member list */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">Team</p>
                        {activeProjectMembers.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">No members</p>
                        ) : (
                          activeProjectMembers.map((m) => (
                            <div key={m.userId} className="flex items-center gap-2">
                              <Avatar className="h-5 w-5">
                                <AvatarFallback className="text-[8px] font-bold">
                                  {getInitials(m.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs flex-1 truncate">{m.name}</span>
                              <Badge variant="secondary" className="text-[9px] px-1 py-0 capitalize">
                                {m.role}
                              </Badge>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </TabsContent>

                {/* ── Roadmap Tab ── */}
                <TabsContent value="roadmap" className="mt-4 pb-4">
                  <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                      <Map className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">No roadmap generated yet</p>
                      <p className="text-xs text-muted-foreground max-w-[200px]">
                        This roadmap will be generated by the AI Agent once you start a conversation.
                      </p>
                    </div>
                    {userRole === "leader" && (
                      <Button size="sm" variant="outline" className="gap-1.5" disabled>
                        <Rocket className="h-3.5 w-3.5" />
                        Generate Roadmap
                      </Button>
                    )}
                  </div>
                </TabsContent>

                {/* ── Prompts Tab ── */}
                <TabsContent value="prompts" className="mt-4 pb-4">
                  <div className="flex flex-col items-center justify-center py-8 text-center space-y-3">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
                      <Code className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-sm font-medium">No prompts generated</p>
                      <p className="text-xs text-muted-foreground max-w-[200px]">
                        Prompts will be generated after project analysis. Start a conversation to begin.
                      </p>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1.5" disabled>
                      <Sparkles className="h-3.5 w-3.5" />
                      Generate Prompts
                    </Button>
                  </div>
                </TabsContent>
              </Tabs>
            </CardHeader>
          </Card>
        </motion.div>

      </div>
    </DashboardLayout>
  );
}
