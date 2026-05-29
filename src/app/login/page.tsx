"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { LoginForm } from "@/components/auth/LoginForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Rocket } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row relative overflow-hidden bg-background">
      {/* Branded Sidebar Section */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-primary/5 items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/10 blur-3xl animate-pulse" />
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
          <div className="absolute top-[20%] right-[10%] w-[20%] h-[20%] rounded-full bg-accent/10 blur-2xl" />
        </div>

        <div className="relative z-10 w-full max-w-lg space-y-8">
          <div className="space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
              <Rocket className="h-10 w-10 text-primary-foreground" />
            </div>
            <h2 className="text-4xl font-bold tracking-tight">
              Scale your project with <span className="text-primary">TeamPilot AI</span>
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              The next generation of project management powered by artificial intelligence. 
              Collaborate, track, and ship faster than ever before.
            </p>
          </div>

          {/* Strategic Image Container */}
          <div className="relative aspect-[16/10] w-full rounded-3xl overflow-hidden border border-primary/10 bg-muted/50 shadow-2xl group transition-transform duration-500 hover:scale-[1.02]">
            <Image
              src="/loginimg.png"
              alt="TeamPilot AI Dashboard"
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-t from-background/20 to-transparent" />
          </div>

          <div className="flex items-center gap-8 pt-8 border-t border-primary/10">
            <div className="space-y-1">
              <p className="text-2xl font-bold">10k+</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Active Users</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold">99.9%</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Uptime</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl font-bold">24/7</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">AI Support</p>
            </div>
          </div>
        </div>
      </div>

      {/* Form Section */}
      <div className="flex-1 flex flex-col relative bg-background">
        <div className="p-4 lg:p-8 relative z-10 flex justify-between items-center">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2 group">
              <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
              Back to home
            </Button>
          </Link>
          
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <Rocket className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-bold">TeamPilot</span>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center p-4 lg:p-12 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-md"
          >
            <LoginForm />
          </motion.div>
        </div>

        {/* Decorative elements for the form side */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl -ml-32 -mb-32 pointer-events-none" />
      </div>
    </div>
  );
}
