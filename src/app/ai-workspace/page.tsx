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
  Hash,
  TrendingUp,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { useAISettings } from "@/lib/useAISettings";
import { useAIChat } from "@/lib/useAIChat";
import { useAgentMode } from "@/lib/useAgentMode";
import { usePMTasks } from "@/lib/usePMTasks";
import { useVibePrompts } from "@/lib/useVibePrompts";
import { useGitHub } from "@/lib/useGitHub";
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

function renderMarkdown(text: string) {
  const lines = text.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLang = "";

  const processInline = (line: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
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

    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <div key={`code-${i}`} className="my-3">
            {codeBlockLang && (
              <div className="text-[10px] text-muted-foreground bg-muted/80 px-3 py-1 rounded-t border border-b-0 font-mono">
                {codeBlockLang}
              </div>
            )}
            <pre
              className={`bg-muted/60 border p-4 text-xs font-mono overflow-x-auto whitespace-pre-wrap leading-relaxed ${
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

    if (line.startsWith("### ")) {
      elements.push(
        <h4 key={i} className="font-semibold text-sm mt-4 mb-1.5 text-foreground">
          {processInline(line.slice(4))}
        </h4>
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h3 key={i} className="font-bold text-base mt-4 mb-1.5 text-foreground">
          {processInline(line.slice(3))}
        </h3>
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h2 key={i} className="font-bold text-lg mt-4 mb-2 text-foreground">
          {processInline(line.slice(2))}
        </h2>
      );
    } else if (line.match(/^[\s]*[•\-\*]\s/)) {
      const indent = line.match(/^(\s*)/)?.[1]?.length || 0;
      const content = line.replace(/^[\s]*[•\-\*]\s/, "");
      elements.push(
        <div
          key={i}
          className="flex gap-2 items-start my-0.5"
          style={{ paddingLeft: `${Math.min(indent, 4) * 8}px` }}
        >
          <span className="text-primary mt-1.5 text-xs shrink-0">•</span>
          <span className="text-sm leading-relaxed">{processInline(content)}</span>
        </div>
      );
    } else if (line.match(/^\d+\.\s/)) {
      const content = line.replace(/^\d+\.\s/, "");
      const num = line.match(/^(\d+)\./)?.[1];
      elements.push(
        <div key={i} className="flex gap-2 items-start my-0.5">
          <span className="text-primary text-xs font-semibold shrink-0 w-4 text-right mt-0.5">
            {num}.
          </span>
          <span className="text-sm leading-relaxed">{processInline(content)}</span>
        </div>
      );
    } else if (line.trim() === "") {
      elements.push(<div key={i} className="h-2" />);
    } else {
      elements.push(
        <p key={i} className="text-sm leading-relaxed">
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
  color: string;
}[] = [
  {
    id: "architect",
    label: "Architect",
    icon: <Brain className="h-3.5 w-3.5" />,
    description: "Architecture, Tech Stack, Database, Infrastructure",
    color: "text-violet-500",
  },
  {
    id: "pm",
    label: "PM Mode",
    icon: <Map className="h-3.5 w-3.5" />,
    description: "Roadmap, Sprint Planning, Task Assignment, Kanban",
    color: "text-blue-500",
  },
  {
    id: "vibe-coding",
    label: "Vibe Coding",
    icon: <Code className="h-3.5 w-3.5" />,
    description: "Cursor, TRAE, Bolt, v0 Prompts",
    color: "text-green-500",
  },
  {
    id: "github",
    label: "GitHub",
    icon: <GitBranch className="h-3.5 w-3.5" />,
    description: "Repository, Branches, Commits, CI/CD",
    color: "text-orange-500",
  },
];

// ─── Welcome Card (shown when chat is empty) ──────────────────────────────────

function WelcomeCard({ projectName }: { projectName: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[300px] gap-6 px-4">
      <div className="text-center space-y-3">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mx-auto shadow-lg">
          <Bot className="h-8 w-8 text-primary-foreground" />
        </div>
        <div>
          <h3 className="text-xl font-bold">TeamPilot AI</h3>
          <p className="text-muted-foreground text-sm mt-1">
            AI Project Execution Architect · <span className="font-medium text-foreground">{projectName}</span>
          </p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 max-w-md w-full">
        {[
          { icon: <Brain className="h-4 w-4" />, label: "Architecture Design", desc: "Tech stack & system design" },
          { icon: <Map className="h-4 w-4" />, label: "Roadmap Planning", desc: "Sprints & task breakdown" },
          { icon: <Code className="h-4 w-4" />, label: "Vibe Coding", desc: "AI implementation prompts" },
          { icon: <GitBranch className="h-4 w-4" />, label: "GitHub Workflow", desc: "Repo setup & CI/CD" },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-xl border bg-muted/30 p-3 space-y-1 hover:bg-muted/50 transition-colors"
          >
            <div className="text-primary">{item.icon}</div>
            <p className="text-xs font-semibold">{item.label}</p>
            <p className="text-[11px] text-muted-foreground">{item.desc}</p>
          </div>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        Describe your project idea to begin ✦
      </p>
    </div>
  );
}

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Persist and restore agent mode
  useAgentMode(activeProject?.projectId, user?.uid, activeMode);

  // PM task management
  const { createMultipleTasks } = usePMTasks(activeProject?.projectId);

  // Vibe Coding prompt management
  const { savePrompt, getPrompts, getPromptsByTool } = useVibePrompts(
    activeProject?.projectId
  );

  // GitHub repository and report management
  const { connectRepository, getRepository, saveReport } = useGitHub(
    activeProject?.projectId
  );

  // Determine if fallback is active
  const isFallbackActive = (() => {
    const assistantMsgs = messages.filter((m) => m.role === "assistant" && !m.isLocal);
    if (assistantMsgs.length === 0) return false;
    const lastMsg = assistantMsgs[assistantMsgs.length - 1];
    const preferred =
      settings.preferredProvider && settings.preferredProvider !== "none"
        ? settings.preferredProvider
        : "gemini";
    return lastMsg.provider ? lastMsg.provider !== preferred : false;
  })();

  const providerStatusText = (() => {
    if (!anyProviderConfigured) return "No AI";
    if (isFallbackActive) return "Fallback Active";
    const preferred =
      settings.preferredProvider && settings.preferredProvider !== "none"
        ? settings.preferredProvider
        : "gemini";
    if (preferred === "gemini") return "Gemini";
    if (preferred === "openrouter") return "OpenRouter";
    return "AI Active";
  })();

  // Debug: log message state
  useEffect(() => {
    console.log(
      `[AIWorkspace] Messages state: ${messages.length} total | initialLoadDone=${initialLoadDone} | projectId=${activeProject?.projectId}`
    );
    if (messages.length > 0) {
      console.log("[AIWorkspace] First message:", messages[0]);
      console.log("[AIWorkspace] Last message:", messages[messages.length - 1]);
    }
  }, [messages, initialLoadDone, activeProject?.projectId]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, aiResponding]);

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  };

  // Build project context
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

  // Send handler
  const handleSend = async () => {
    if (!message.trim() || sending || aiResponding) return;
    if (!anyProviderConfigured) return;

    const text = message;
    setMessage("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

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

  // Gate: no project
  if (!activeProject) {
    return (
      <DashboardLayout>
        <NoProjectState />
      </DashboardLayout>
    );
  }

  const progress =
    (activeProject.totalTasks ?? 0) === 0
      ? 0
      : Math.round(
          ((activeProject.completedTasks ?? 0) / (activeProject.totalTasks ?? 1)) * 100
        );

  const currentMode = MODES.find((m) => m.id === activeMode)!;

  // Determine if there are real messages to show (firestore msgs, not just welcome)
  const hasRealMessages = messages.length > 0 && !(messages.length === 1 && messages[0].id === "welcome");

  return (
    <DashboardLayout>
      {/* ── Full page column layout ─────────────────────────────────────────── */}
      <div className="flex flex-col h-[calc(100vh-5rem)] gap-3">

        {/* ── TOP ROW: Compact context cards ────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-3 shrink-0"
        >
          {/* Project Context Card */}
          <Card className="border bg-card/60 backdrop-blur-sm">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <FolderKanban className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-sm truncate">{activeProject.projectName}</p>
                    <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                      {activeProject.projectCode}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground line-clamp-1 mb-2">
                    {activeProject.projectDescription || "No description"}
                  </p>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Role</span>
                      <Badge variant="secondary" className="text-[10px] capitalize px-1.5 py-0">
                        {userRole ?? "—"}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Phase</span>
                      <span className="text-[10px] font-semibold">{activeProject.currentPhase}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] font-semibold">{activeProject.totalMembers} members</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] font-semibold">{progress}%</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3 text-primary" />
                      <span className="text-[10px] text-muted-foreground">{activeProject.leaderName}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Team Context Card */}
          <Card className="border bg-card/60 backdrop-blur-sm">
            <CardContent className="p-3">
              <div className="flex items-start gap-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="font-semibold text-sm">Team Context</p>
                    {/* AI Provider status */}
                    <Badge
                      variant={anyProviderConfigured ? "success" : "secondary"}
                      className="gap-1 text-[10px] ml-auto"
                    >
                      {anyProviderConfigured ? (
                        <>
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          {providerStatusText}
                        </>
                      ) : (
                        <>
                          <XCircle className="h-2.5 w-2.5" />
                          No AI
                        </>
                      )}
                    </Badge>
                    {/* Active mode badge */}
                    <Badge variant="outline" className="gap-1 text-[10px]">
                      {currentMode.icon}
                      {currentMode.label}
                    </Badge>
                  </div>
                  {/* Member avatars */}
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {activeProjectMembers.length === 0 ? (
                      <span className="text-[11px] text-muted-foreground italic">No members loaded</span>
                    ) : (
                      activeProjectMembers.map((member) => (
                        <div key={member.userId} className="flex items-center gap-1.5 bg-muted/50 rounded-full px-2 py-0.5">
                          <Avatar className="h-4 w-4">
                            <AvatarFallback className="text-[8px] font-bold">
                              {getInitials(member.name)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-[11px] font-medium">{member.name.split(" ")[0]}</span>
                          {member.role === "leader" && (
                            <Shield className="h-2.5 w-2.5 text-primary" />
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* ── HERO: Full-width AI Chat ───────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: 0.1 }}
          className="flex-1 flex flex-col min-h-0"
        >
          <Card className="flex-1 flex flex-col min-h-0 overflow-hidden border">

            {/* ── Chat Header ───────────────────────────────────────────────── */}
            <div className="border-b px-5 py-3 shrink-0 flex items-center justify-between gap-4">
              {/* Left: AI identity */}
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-sm">
                    <Bot className="h-5 w-5 text-primary-foreground" />
                  </div>
                  {anyProviderConfigured && (
                    <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-green-500 border-2 border-background" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">TeamPilot AI</span>
                    {aiResponding && (
                      <Badge variant="secondary" className="gap-1 text-[10px] animate-pulse h-5">
                        <Zap className="h-2.5 w-2.5" />
                        Thinking...
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">AI Project Execution Architect</p>
                </div>
              </div>

              {/* Right: Mode selector */}
              <div className="flex items-center gap-1.5 flex-wrap justify-end">
                {MODES.map((mode) => (
                  <button
                    key={mode.id}
                    onClick={() => setActiveMode(mode.id)}
                    title={mode.description}
                    className="focus:outline-none"
                  >
                    <Badge
                      variant={activeMode === mode.id ? "default" : "outline"}
                      className={`gap-1 cursor-pointer transition-all duration-200 h-6 ${
                        activeMode === mode.id
                          ? "shadow-sm"
                          : "hover:bg-muted"
                      }`}
                    >
                      {mode.icon}
                      <span className="hidden sm:inline">{mode.label}</span>
                    </Badge>
                  </button>
                ))}
              </div>
            </div>

            {/* ── Messages Area ─────────────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto min-h-0">
              {/* Loading state */}
              {!initialLoadDone ? (
                <div className="flex flex-col items-center justify-center h-full gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                  <p className="text-sm text-muted-foreground">Loading conversation...</p>
                </div>
              ) : !hasRealMessages ? (
                /* Empty state / Welcome */
                <WelcomeCard projectName={activeProject.projectName} />
              ) : (
                /* Messages */
                <div className="px-4 md:px-8 lg:px-16 xl:px-24 py-6 space-y-6 max-w-4xl mx-auto w-full">
                  <AnimatePresence initial={false}>
                    {messages.map((msg, idx) => {
                      if (msg.id === "welcome") return null; // skip welcome if real messages exist
                      return (
                        <motion.div
                          key={msg.id}
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.25, delay: idx < 4 ? idx * 0.05 : 0 }}
                          className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          {/* AI Avatar */}
                          {(msg.role === "assistant" || msg.role === "system") && (
                            <Avatar className="h-8 w-8 shrink-0 mt-1 shadow-sm">
                              <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
                                <Bot className="h-4 w-4" />
                              </AvatarFallback>
                            </Avatar>
                          )}

                          {/* Content */}
                          <div
                            className={`space-y-1.5 ${
                              msg.role === "user"
                                ? "max-w-[70%] flex flex-col items-end"
                                : "max-w-[75%]"
                            }`}
                          >
                            {/* AI header */}
                            {(msg.role === "assistant" || msg.role === "system") && (
                              <div className="flex items-center gap-2 px-1">
                                <span className="text-xs font-semibold">TeamPilot AI</span>
                                {msg.provider && msg.provider !== "" && (
                                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 capitalize">
                                    {msg.provider}
                                  </Badge>
                                )}
                                {msg.timestamp && (
                                  <span className="text-[10px] text-muted-foreground">
                                    {formatTime(msg.timestamp)}
                                  </span>
                                )}
                              </div>
                            )}

                            {/* Bubble */}
                            <div
                              className={`rounded-2xl px-5 py-3.5 ${
                                msg.role === "user"
                                  ? "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-br-sm shadow-sm"
                                  : "bg-muted/40 border border-border/50 rounded-bl-sm"
                              }`}
                            >
                              {msg.role === "user" ? (
                                <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                                  {msg.content}
                                </pre>
                              ) : (
                                <div className="space-y-1">
                                  {renderMarkdown(msg.content)}
                                </div>
                              )}
                            </div>

                            {/* User footer */}
                            {msg.role === "user" && (
                              <div className="px-1">
                                {msg.timestamp ? (
                                  <span className="text-[10px] text-muted-foreground">
                                    {formatTime(msg.timestamp)}
                                  </span>
                                ) : msg.isLocal ? (
                                  <span className="text-[10px] text-muted-foreground italic">
                                    Sending...
                                  </span>
                                ) : null}
                              </div>
                            )}
                          </div>

                          {/* User Avatar */}
                          {msg.role === "user" && (
                            <Avatar className="h-8 w-8 shrink-0 mt-1">
                              <AvatarFallback className="text-xs font-semibold bg-primary/15">
                                {getInitials(user?.displayName || user?.email || "U")}
                              </AvatarFallback>
                            </Avatar>
                          )}
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {/* AI thinking indicator */}
                  {aiResponding && (
                    <motion.div
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-3 justify-start"
                    >
                      <Avatar className="h-8 w-8 shrink-0 mt-1 shadow-sm">
                        <AvatarFallback className="bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
                          <Bot className="h-4 w-4" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 px-1">
                          <span className="text-xs font-semibold">TeamPilot AI</span>
                        </div>
                        <div className="rounded-2xl px-5 py-3.5 bg-muted/40 border border-border/50 rounded-bl-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">Thinking</span>
                            <span className="flex gap-1">
                              <span
                                className="h-2 w-2 rounded-full bg-primary/70 animate-bounce"
                                style={{ animationDelay: "0ms" }}
                              />
                              <span
                                className="h-2 w-2 rounded-full bg-primary/70 animate-bounce"
                                style={{ animationDelay: "160ms" }}
                              />
                              <span
                                className="h-2 w-2 rounded-full bg-primary/70 animate-bounce"
                                style={{ animationDelay: "320ms" }}
                              />
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* ── Input Area (sticky bottom) ─────────────────────────────────── */}
            <div className="border-t bg-background/95 backdrop-blur-sm shrink-0">
              <div className="px-4 md:px-8 lg:px-16 xl:px-24 py-4 max-w-4xl mx-auto w-full">
                {!anyProviderConfigured && !settingsLoading ? (
                  /* No provider warning */
                  <div className="flex items-center gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                    <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                        No AI provider configured
                      </p>
                      <p className="text-xs text-amber-600 dark:text-amber-500">
                        Add a Gemini or OpenRouter API key in Settings to start chatting.
                      </p>
                    </div>
                    <Link href="/settings?tab=ai">
                      <Button size="sm" variant="outline" className="gap-1.5 shrink-0">
                        <Settings className="h-3.5 w-3.5" />
                        Configure
                      </Button>
                    </Link>
                  </div>
                ) : (
                  /* Input */
                  <div className="relative">
                    {/* Mode + provider hint */}
                    <div className="flex items-center justify-between mb-2 px-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                        <span className={currentMode.color}>{currentMode.icon}</span>
                        <span>{currentMode.label} Mode</span>
                        <span className="text-border">·</span>
                        <span>{providerStatusText}</span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        Enter to send · Shift+Enter for newline
                      </span>
                    </div>

                    {/* Input box */}
                    <div className="flex gap-3 items-end">
                      <div className="flex-1 relative">
                        <textarea
                          ref={textareaRef}
                          placeholder="Describe your project, ask for architecture advice, request a roadmap..."
                          className="w-full resize-none rounded-xl border border-border/70 bg-muted/30 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary/50 placeholder:text-muted-foreground/60 transition-all min-h-[52px] max-h-[200px] overflow-y-auto leading-relaxed"
                          value={message}
                          onChange={handleTextareaChange}
                          onKeyDown={handleKeyDown}
                          disabled={sending || aiResponding || !anyProviderConfigured}
                          rows={1}
                        />
                      </div>
                      <Button
                        className="h-[52px] w-[52px] rounded-xl shrink-0 p-0"
                        onClick={handleSend}
                        disabled={
                          sending || aiResponding || !message.trim() || !anyProviderConfigured
                        }
                      >
                        {sending || aiResponding ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Send className="h-5 w-5" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
