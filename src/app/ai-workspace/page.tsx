"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/common/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Send, Sparkles, Copy, Check, Code, Map, Users, GitBranch, MessageSquare, Loader as Loader2, Lightbulb } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function AIWorkspacePage() {
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleSend = () => {
    if (!message.trim()) return;
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setMessage("");
    }, 1500);
  };

  const sessions = [
    { id: 1, title: "E-commerce Project Planning", date: "Today" },
    { id: 2, title: "Authentication System", date: "Yesterday" },
    { id: 3, title: "Mobile App Architecture", date: "2 days ago" },
  ];

  const messages = [
    {
      role: "user",
      content: "I want to build a Next.js application with Firebase authentication and real-time features.",
    },
    {
      role: "assistant",
      content: "Great choice! Let me help you plan this. Here's a high-level roadmap:\n\n**Phase 1: Setup & Configuration**\n- Initialize Next.js with TypeScript\n- Configure Firebase project\n- Set up environment variables\n\n**Phase 2: Authentication**\n- Implement email/password auth\n- Add Google OAuth\n- Create protected routes\n\n**Phase 3: Real-time Features**\n- Set up Firestore listeners\n- Implement real-time sync\n- Add presence indicators\n\nWould you like me to generate detailed code prompts for any of these phases?",
    },
  ];

  const generatedPrompt = `# Phase 1: Firebase Authentication Setup

## Step 1: Install Dependencies
\`\`\`bash
npm install firebase @firebase/auth
npm install zod react-hook-form @hookform/resolvers
\`\`\`

## Step 2: Initialize Firebase
\`\`\`typescript
// src/lib/firebase.ts
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
\`\`\`

## Step 3: Create Auth Context
\`\`\`typescript
// src/context/AuthContext.tsx
import { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '@/lib/firebase';

// ... implementation
\`\`\``;

  return (
    <DashboardLayout>
      <div className="h-[calc(100vh-8rem)] flex flex-col lg:flex-row gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden lg:block w-64 shrink-0"
        >
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="text-base">Session History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {sessions.map((session) => (
                <Button
                  key={session.id}
                  variant="ghost"
                  className="w-full justify-start text-left h-auto py-2"
                >
                  <div className="truncate">
                    <p className="text-sm font-medium truncate">{session.title}</p>
                    <p className="text-xs text-muted-foreground">{session.date}</p>
                  </div>
                </Button>
              ))}
              <Button variant="outline" className="w-full gap-2">
                <Sparkles className="h-4 w-4" />
                New Session
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        <div className="flex-1 flex flex-col gap-4 min-h-0">
          <div className="flex items-center gap-2">
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

          <Card className="flex-1 flex flex-col min-h-0">
            <CardHeader className="border-b">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">AI Workspace</CardTitle>
              </div>
            </CardHeader>

            <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}
                >
                  {msg.role === "assistant" && (
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className="bg-primary text-primary-foreground">
                        <Brain className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div
                    className={`rounded-lg p-4 max-w-[80%] ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    }`}
                  >
                    <pre className="whitespace-pre-wrap text-sm font-sans">{msg.content}</pre>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-primary text-primary-foreground">
                      <Brain className="h-4 w-4" />
                    </AvatarFallback>
                  </Avatar>
                  <div className="rounded-lg p-4 bg-muted">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </CardContent>

            <div className="border-t p-4">
              <div className="flex gap-2">
                <Textarea
                  placeholder="Describe your project idea, ask for a roadmap, or request code prompts..."
                  className="min-h-[60px] max-h-[120px]"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                />
                <Button className="h-auto" onClick={handleSend} disabled={isLoading}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </Card>
        </div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="hidden xl:block w-80 shrink-0"
        >
          <Card className="h-full flex flex-col">
            <CardHeader className="border-b">
              <Tabs defaultValue="prompts">
                <TabsList className="w-full">
                  <TabsTrigger value="prompts" className="flex-1">Prompts</TabsTrigger>
                  <TabsTrigger value="roadmap" className="flex-1">Roadmap</TabsTrigger>
                </TabsList>

                <TabsContent value="prompts" className="mt-4 space-y-4">
                  <div className="relative">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 z-10"
                      onClick={() => copyToClipboard(generatedPrompt, "prompt")}
                    >
                      {copied === "prompt" ? (
                        <Check className="h-4 w-4 text-success" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                    <pre className="p-4 bg-muted rounded-lg text-xs overflow-x-auto max-h-96">
                      <code>{generatedPrompt}</code>
                    </pre>
                  </div>
                </TabsContent>

                <TabsContent value="roadmap" className="mt-4 space-y-3">
                  {["Setup & Config", "Authentication", "Real-time Features", "Deployment"].map((phase, i) => (
                    <div key={phase} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold">
                        {i + 1}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{phase}</p>
                        <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${(i + 1) * 25}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </CardHeader>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
