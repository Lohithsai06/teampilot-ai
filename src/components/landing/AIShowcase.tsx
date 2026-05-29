"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Brain, Code, Copy, Check } from "lucide-react";

const prompts = {
  cursor: `# Phase 1: Setup Project Structure

Create a Next.js 14 application with the following structure:
- App Router (src/app/)
- TypeScript configuration
- Tailwind CSS styling
- Shadcn UI components

## Commands to run:
\`\`\`bash
npx create-next-app@latest teampilot-ai --typescript --tailwind --app
cd teampilot-ai
npx shadcn-ui@latest init
\`\`\`

## Files to create:
- src/lib/firebase.ts
- src/context/AuthContext.tsx
- src/components/ui/`,
  trae: `# Authentication Module

Implement Firebase Authentication with:
- Email/password login
- Google OAuth integration
- Session persistence
- Protected route middleware

## Key Components:
1. src/components/auth/LoginForm.tsx
2. src/components/auth/SignupForm.tsx
3. src/hooks/useAuth.ts

## Authentication Flow:
User enters credentials -> Firebase validates -> Store session -> Redirect to dashboard`,
  bolt: `# Dashboard Implementation

Build the main dashboard with:
- Project overview cards
- Activity feed
- Team member list
- Sprint progress visualization

## Layout Structure:
- Left sidebar navigation
- Top navbar with search
- Main content area with grid layouts
- Responsive mobile drawer`,
};

export function AIShowcase() {
  const [copied, setCopied] = React.useState<string | null>(null);

  const copyToClipboard = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <section className="py-20 md:py-32">
      <div className="container mx-auto px-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <div className="inline-flex items-center gap-2 text-primary mb-4">
            <Brain className="h-6 w-6" />
            <span className="text-sm font-semibold">AI-Powered Prompts</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Generate IDE-Ready Prompts Instantly
          </h2>
          <p className="text-lg text-muted-foreground">
            Get structured prompts for Cursor, TRAE, Bolt, and v0. Copy and paste
            directly into your AI coding assistant.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
        >
          <Card className="overflow-hidden">
            <Tabs defaultValue="cursor">
              <div className="bg-muted/50 border-b px-4 pt-3">
                <TabsList className="bg-transparent">
                  <TabsTrigger value="cursor" className="gap-2">
                    <Code className="h-4 w-4" />
                    Cursor
                  </TabsTrigger>
                  <TabsTrigger value="trae" className="gap-2">
                    <Code className="h-4 w-4" />
                    TRAE
                  </TabsTrigger>
                  <TabsTrigger value="bolt" className="gap-2">
                    <Code className="h-4 w-4" />
                    Bolt
                  </TabsTrigger>
                </TabsList>
              </div>

              {Object.entries(prompts).map(([key, content]) => (
                <TabsContent key={key} value={key} className="mt-0">
                  <CardContent className="p-0">
                    <div className="relative">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-3 right-3 z-10"
                        onClick={() => copyToClipboard(content, key)}
                      >
                        {copied === key ? (
                          <Check className="h-4 w-4 text-success" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <pre className="p-6 text-sm overflow-x-auto bg-muted/30 max-h-96 overflow-y-auto">
                        <code>{content}</code>
                      </pre>
                    </div>
                  </CardContent>
                </TabsContent>
              ))}
            </Tabs>
          </Card>
        </motion.div>
      </div>
    </section>
  );
}
