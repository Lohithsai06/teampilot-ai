"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { DashboardLayout } from "@/components/common/DashboardLayout";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
  Rocket,
  Bot,
  Zap,
  MessageSquare,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { useAISettings } from "@/lib/useAISettings";
import { useAIChat } from "@/lib/useAIChat";
import {
  buildSystemPrompt,
  type AgentMode,
  type ProjectContext,
} from "@/lib/aiSystemPrompt";
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
    return ts
      .toDate()
      .toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

// ─── Simple markdown renderer ─────────────────────────────────────────────────
// Renders bold, headers, bullet points, inline code, and code blocks.

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLang = "";

  const processInline = (line: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    // Process bold, inline code
    const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(line)) !== null) {
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }
      const token = match[0];
      if (token.startsWith("**") && token.endsWith("**")) {
        parts.push(
          <strong key={match.index} className="font-semibold">
            {token.slice(2, -2)}
          </strong>
        );
      } else if (token.startsWith("`") && token.endsWith("`")) {
        parts.push(
          <code
            key={match.index}
            className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono"
          >
            {token.slice(1, -1)}
          </code>
        );
      }
      lastIndex = match.index + token.length;
    }

    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }
    return parts.length > 0 ? parts : [line];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block toggle
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <div key={`code-${i}`} className="my-2">
            {codeBlockLang && (
              <div className="text-[10px] text-muted-foreground bg-muted/80 px-3 py-1 rounded-t border border-b-0 font-mono">
                {codeBlockLang}
              </div>
            )}
            <pre
              className={`bg-muted/60 border p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap ${
                codeBlockLang ? "rounded-b" : "rounded"
              }`}
            >
              {codeBlockContent.join("\n")}
            </pre>
          </div>
        );
        codeBlockContent = [];
        codeBlockLang = "";
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Headers
    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={i} className="font-semibold text-sm mt-3 mb-1">
          {processInline(line.slice(4))}
        </h4>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h3 key={i} className="font-bold text-sm mt-3 mb-1">
          {processInline(line.slice(3))}
        </h3>
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h2 key={i} className="font-bold text-base mt-3 mb-1">
          {processInline(line.slice(2))}
        </h2>
      );
    }
    // Bullet points
    else if (line.match(/^[\s]*[•\-\*]\s/)) {
      const indent = line.match(/^(\s*)/)?.[1]?.length || 0;
      const content = line.replace(/^[\s]*[•\-\*]\s/, "");
      elements.push(
        <div
          key={i}
          className="flex gap-2 items-start"
          style={{ paddingLeft: `${Math.min(indent, 4) * 8}px` }}
        >
          <span className="text-primary mt-1 text-xs shrink-0">•</span>
          <span className="text-sm">{processInline(content)}</span>
        </div>
      );
    }
    // Numbered lists
    else if (line.match(/^\d+\.\s/)) {
      const content = line.replace(/^\d+\.\s/, "");
      const num = line.match(/^(\d+)\./)?.[1];
      elements.push(
        <div key={i} className="flex gap-2 items-start">
          <span className="text-primary text-xs font-semibold shrink-0 w-4 text-right">
            {num}.
          </span>
          <span className="text-sm">{processInline(content)}</span>
        </div>
      );
    }
    // Empty lines
    else if (line.trim() === "") {
      elements.push(<div key={i} className="h-1.5" />);
    }
    // Regular text
    else {
      elements.push(
        <p key={i} className="text-sm">
          {processInline(line)}
        </p>
      );
    }
  }

  return elements;
}

// ─── Mode config ──────────────────────────────────────────────────────────────

const MODES: {
  id: AgentMode;
  label: string;
  icon: React.ReactNode;
  description: string;
}[] = [
  {
    id: "architect",
    label: "Architect",
    icon: <Brain className="h-3 w-3" />,
    description: "Architecture, Tech Stack, Database, Infrastructure",
  },
  {
    id: "pm",
    label: "PM Mode",
    icon: <Map className="h-3 w-3" />,
    description: "Roadmap, Sprint Planning, Task Assignment, Kanban",
  },
  {
    id: "vibe-coding",
    label: "Vibe Coding",
    icon: <Code className="h-3 w-3" />,
    description: "Cursor, TRAE, Bolt, v0 Prompts",
  },
  {
    id: "github",
    label: "GitHub",
    icon: <GitBranch className="h-3 w-3" />,
    description: "Repository, Branches, Commits, CI/CD",
  },
];

// ─── No Project State ─────────────────────────────────────────────────────────

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
  const {
    settings,
    loading: settingsLoading,
    geminiConfigured,
    openRouterConfigured,
    anyProviderConfigured,
    activeProvider,
  } = useAISettings();
  const {
    messages,
    loading: chatLoading,
    sending,
    aiResponding,
    initialLoadDone,
    sendAndRespond,
  } = useAIChat(activeProject?.projectId, user?.uid);

  const [message, setMessage] = useState("");
  const [activeMode, setActiveMode] = useState<AgentMode>("architect");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive or AI starts responding
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiResponding]);

  // ── Build project context for the system prompt ───────────────────────────

  const buildProjectContext = useCallback((): ProjectContext => {
    return {
      projectName: activeProject?.projectName || "",
      projectDescription: activeProject?.projectDescription || "",
      currentPhase: activeProject?.currentPhase || 1,
      totalMembers: activeProject?.totalMembers || 0,
      totalTasks: activeProject?.totalTasks || 0,
      completedTasks: activeProject?.completedTasks || 0,
      leaderName: activeProject?.leaderName || "",
      projectCode: activeProject?.projectCode || "",
      members: activeProjectMembers.map((m) => ({
        name: m.name,
        role: m.role,
      })),
      userRole: userRole,
      userName: user?.displayName || user?.email || "User",
    };
  }, [activeProject, activeProjectMembers, userRole, user]);

  // ── Handle sending a message ──────────────────────────────────────────────

  const handleSend = async () => {
    if (!message.trim() || sending || aiResponding) return;
    if (!anyProviderConfigured) return;

    const text = message;
    setMessage("");

    const context = buildProjectContext();
    const systemPrompt = buildSystemPrompt(context, activeMode);

    await sendAndRespond(text, settings, systemPrompt);
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
      : Math.round(
          ((activeProject.completedTasks ?? 0) /
            (activeProject.totalTasks ?? 1)) *
            100
        );

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
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">
                  Project
                </p>
                <p className="font-semibold truncate">
                  {activeProject.projectName}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">
                  Description
                </p>
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {activeProject.projectDescription || "—"}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Role
                  </p>
                  <p className="font-medium capitalize text-xs">
                    {userRole ?? "—"}
                  </p>
                </div>
                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Phase
                  </p>
                  <p className="font-medium text-xs">
                    {activeProject.currentPhase}
                  </p>
                </div>
                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Members
                  </p>
                  <p className="font-medium text-xs">
                    {activeProject.totalMembers}
                  </p>
                </div>
                <div className="rounded-md bg-muted/50 p-2">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    Progress
                  </p>
                  <p className="font-medium text-xs">{progress}%</p>
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                  Leader
                </p>
                <p className="text-xs font-medium flex items-center gap-1">
                  <ShieldCheck className="h-3 w-3 text-primary" />
                  {activeProject.leaderName}
                </p>
              </div>
              <div className="pt-1 border-t">
                <p className="text-[10px] text-muted-foreground font-mono">
                  {activeProject.projectCode}
                </p>
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
                      <Badge
                        variant="success"
                        className="text-[10px] px-1.5 gap-1"
                      >
                        <CheckCircle2 className="h-2.5 w-2.5" /> Connected
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 gap-1"
                      >
                        <XCircle className="h-2.5 w-2.5" /> Not set
                      </Badge>
                    )}
                  </div>
                  {/* OpenRouter */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs">OpenRouter</span>
                    {openRouterConfigured ? (
                      <Badge
                        variant="success"
                        className="text-[10px] px-1.5 gap-1"
                      >
                        <CheckCircle2 className="h-2.5 w-2.5" /> Connected
                      </Badge>
                    ) : (
                      <Badge
                        variant="secondary"
                        className="text-[10px] px-1.5 gap-1"
                      >
                        <XCircle className="h-2.5 w-2.5" /> Not set
                      </Badge>
                    )}
                  </div>

                  {anyProviderConfigured ? (
                    <div className="pt-2 border-t space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">Primary</span>
                        <span className="font-medium capitalize">
                          {activeProvider}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <div className="h-1.5 w-1.5 rounded-full bg-green-500" />
                        <span className="text-[10px] text-green-600 dark:text-green-400 font-medium">
                          Ready
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t">
                      <Link href="/settings?tab=ai">
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full gap-1.5 h-7 text-xs"
                        >
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
                <p className="text-xs text-muted-foreground italic">
                  No members loaded
                </p>
              ) : (
                activeProjectMembers.map((member) => (
                  <div key={member.userId} className="flex items-center gap-2">
                    <Avatar className="h-7 w-7 shrink-0">
                      <AvatarFallback className="text-[10px] font-semibold">
                        {getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">
                        {member.name}
                      </p>
                      <p className="text-[10px] text-muted-foreground capitalize">
                        {member.role}
                      </p>
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
          {/* Mode selector badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {MODES.map((mode) => (
              <button
                key={mode.id}
                onClick={() => setActiveMode(mode.id)}
                className="focus:outline-none"
                title={mode.description}
              >
                <Badge
                  variant={activeMode === mode.id ? "default" : "outline"}
                  className={`gap-1 cursor-pointer transition-all duration-200 ${
                    activeMode === mode.id
                      ? "shadow-md scale-105"
                      : "hover:bg-muted"
                  }`}
                >
                  {mode.icon}
                  {mode.label}
                </Badge>
              </button>
            ))}

            {/* Active mode description */}
            <span className="text-[10px] text-muted-foreground hidden sm:inline ml-1">
              {MODES.find((m) => m.id === activeMode)?.description}
            </span>
          </div>

          {/* Chat Card */}
          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="border-b py-3 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      TeamPilot AI
                      <Badge
                        variant="outline"
                        className="text-[10px] font-mono"
                      >
                        {activeProject.projectName}
                      </Badge>
                    </CardTitle>
                    <p className="text-[10px] text-muted-foreground">
                      AI Project Execution Architect
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {aiResponding && (
                    <Badge
                      variant="secondary"
                      className="gap-1 text-[10px] animate-pulse"
                    >
                      <Zap className="h-2.5 w-2.5" />
                      Thinking...
                    </Badge>
                  )}
                  <Badge
                    variant={anyProviderConfigured ? "success" : "secondary"}
                    className="gap-1 text-[10px]"
                  >
                    {anyProviderConfigured ? (
                      <>
                        <CheckCircle2 className="h-2.5 w-2.5" />
                        {activeProvider}
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-2.5 w-2.5" />
                        No AI
                      </>
                    )}
                  </Badge>
                </div>
              </div>
            </CardHeader>

            {/* Messages */}
            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
              {!initialLoadDone ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Loading conversation...
                  </p>
                </div>
              ) : (
                <>
                  <AnimatePresence initial={false}>
                    {messages.map((msg, idx) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.3, delay: idx < 2 ? idx * 0.1 : 0 }}
                        className={`flex gap-3 ${
                          msg.role === "user" ? "justify-end" : ""
                        }`}
                      >
                        {(msg.role === "assistant" ||
                          msg.role === "system") && (
                          <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                            <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
                              <Bot className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div
                          className={`max-w-[80%] space-y-1 ${
                            msg.role === "user" ? "items-end" : ""
                          }`}
                        >
                          <div
                            className={`rounded-xl p-4 text-sm ${
                              msg.role === "user"
                                ? "bg-primary text-primary-foreground rounded-br-sm"
                                : "bg-muted/60 border rounded-bl-sm"
                            }`}
                          >
                            {msg.role === "user" ? (
                              <pre className="whitespace-pre-wrap font-sans">
                                {msg.content}
                              </pre>
                            ) : (
                              <div className="space-y-1">
                                {renderMarkdown(msg.content)}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2 px-1">
                            {msg.timestamp && (
                              <p className="text-[10px] text-muted-foreground">
                                {formatTime(msg.timestamp)}
                              </p>
                            )}
                            {msg.role === "assistant" && msg.provider === "openrouter" && (
                              <Badge
                                variant="outline"
                                className="text-[9px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 px-1.5 py-0 h-4"
                              >
                                Fallback Provider Active
                              </Badge>
                            )}
                          </div>
                        </div>
                        {msg.role === "user" && (
                          <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                            <AvatarFallback className="text-xs font-semibold">
                              {getInitials(
                                user?.displayName || user?.email || "U"
                              )}
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {/* AI thinking indicator */}
                  {aiResponding && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-3"
                    >
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
                          <Bot className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="rounded-xl p-4 bg-muted/60 border rounded-bl-sm">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-4 w-4 animate-spin text-primary" />
                          <span className="text-sm text-muted-foreground">
                            TeamPilot AI is analyzing your request...
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </>
              )}
              <div ref={messagesEndRef} />
            </CardContent>

            {/* Input area */}
            <div className="border-t p-4 shrink-0">
              {!anyProviderConfigured && !settingsLoading ? (
                <div className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                  <p className="text-sm text-amber-700 dark:text-amber-400 flex-1">
                    No AI provider configured. Add an API key in Settings to
                    start chatting.
                  </p>
                  <Link href="/settings?tab=ai">
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 shrink-0"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      Settings
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {/* Mode indicator */}
                  <div className="flex items-center gap-2 px-1">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <MessageSquare className="h-3 w-3" />
                      <span>
                        {MODES.find((m) => m.id === activeMode)?.label} •{" "}
                        {activeProvider}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Textarea
                      placeholder={
                        anyProviderConfigured
                          ? "Describe your project idea, ask for architecture advice, or request coding prompts..."
                          : "Configure an AI provider to start chatting..."
                      }
                      className="min-h-[60px] max-h-[120px] resize-none"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={
                        sending || aiResponding || !anyProviderConfigured
                      }
                    />
                    <Button
                      className="h-auto px-4"
                      onClick={handleSend}
                      disabled={
                        sending ||
                        aiResponding ||
                        !message.trim() ||
                        !anyProviderConfigured
                      }
                    >
                      {sending || aiResponding ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
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
                  <TabsTrigger value="context" className="flex-1 text-xs">
                    Context
                  </TabsTrigger>
                  <TabsTrigger value="roadmap" className="flex-1 text-xs">
                    Roadmap
                  </TabsTrigger>
                  <TabsTrigger value="prompts" className="flex-1 text-xs">
                    Prompts
                  </TabsTrigger>
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
                        <p className="text-xs font-medium">
                          {activeProject.projectName}
                        </p>
                        <p className="text-[11px] text-muted-foreground line-clamp-2">
                          {activeProject.projectDescription || "No description"}
                        </p>
                      </div>

                      {/* Phase + Tasks */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="rounded-lg bg-muted/50 p-2 text-center">
                          <p className="text-lg font-bold text-primary">
                            {activeProject.currentPhase}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Current Phase
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-2 text-center">
                          <p className="text-lg font-bold text-primary">
                            {activeProject.totalTasks ?? 0}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Total Tasks
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-2 text-center">
                          <p className="text-lg font-bold text-green-600">
                            {activeProject.completedTasks ?? 0}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Completed
                          </p>
                        </div>
                        <div className="rounded-lg bg-muted/50 p-2 text-center">
                          <p className="text-lg font-bold">
                            {activeProject.totalMembers}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            Members
                          </p>
                        </div>
                      </div>

                      {/* Active AI Mode */}
                      <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 space-y-1">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                          Active AI Mode
                        </p>
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                            {MODES.find((m) => m.id === activeMode)?.icon}
                          </div>
                          <div>
                            <p className="text-xs font-semibold">
                              {MODES.find((m) => m.id === activeMode)?.label}
                            </p>
                            <p className="text-[10px] text-muted-foreground">
                              {
                                MODES.find((m) => m.id === activeMode)
                                  ?.description
                              }
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Member list */}
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
                          Team
                        </p>
                        {activeProjectMembers.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">
                            No members
                          </p>
                        ) : (
                          activeProjectMembers.map((m) => (
                            <div
                              key={m.userId}
                              className="flex items-center gap-2"
                            >
                              <Avatar className="h-5 w-5">
                                <AvatarFallback className="text-[8px] font-bold">
                                  {getInitials(m.name)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs flex-1 truncate">
                                {m.name}
                              </span>
                              <Badge
                                variant="secondary"
                                className="text-[9px] px-1 py-0 capitalize"
                              >
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
                      <p className="text-sm font-medium">
                        No roadmap generated yet
                      </p>
                      <p className="text-xs text-muted-foreground max-w-[200px]">
                        Ask TeamPilot AI to generate a roadmap for your project
                        in PM Mode.
                      </p>
                    </div>
                    {userRole === "leader" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        disabled
                      >
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
                      <p className="text-sm font-medium">
                        No prompts generated
                      </p>
                      <p className="text-xs text-muted-foreground max-w-[200px]">
                        Switch to Vibe Coding mode and describe your project to
                        generate implementation prompts.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      disabled
                    >
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
