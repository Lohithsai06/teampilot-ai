"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { SignupForm } from "@/components/auth/SignupForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Rocket, Check } from "lucide-react";

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row relative overflow-hidden bg-background">
      {/* Branded Sidebar Section */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-primary/5 items-center justify-center p-12 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute top-[10%] right-[10%] w-[50%] h-[50%] rounded-full bg-primary/10 blur-3xl animate-pulse" />
          <div className="absolute bottom-[-5%] left-[-5%] w-[40%] h-[40%] rounded-full bg-accent/10 blur-3xl animate-pulse" style={{ animationDelay: "1.5s" }} />
          <div className="absolute top-[40%] left-[20%] w-[15%] h-[15%] rounded-full bg-primary/5 blur-2xl" />
        </div>

        <div className="relative z-10 w-full max-w-lg space-y-8">
          <div className="space-y-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-lg shadow-primary/20">
              <Rocket className="h-10 w-10 text-primary-foreground" />
            </div>
            <h2 className="text-4xl font-bold tracking-tight">
              Join the <span className="text-primary">Future</span> of Work
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Create your account today and experience the power of AI-driven collaboration. 
              Manage tasks, automate workflows, and empower your team.
            </p>
          </div>

          {/* Strategic Image Container */}
          <div className="relative aspect-[16/10] w-full rounded-3xl overflow-hidden border border-primary/10 bg-muted/50 shadow-2xl group transition-transform duration-500 hover:scale-[1.02]">
            <Image
              src="/loginimg.png"
              alt="TeamPilot AI Collaboration"
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent" />
          </div>

          <div className="grid grid-cols-2 gap-6 pt-8 border-t border-primary/10">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Check className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-medium">Free 14-day trial</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Check className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-medium">No credit card</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Check className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-medium">Unlimited projects</p>
            </div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Check className="h-5 w-5 text-primary" />
              </div>
              <p className="text-sm font-medium">AI integrations</p>
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

        <div className="flex-1 flex items-center justify-center p-4 lg:p-12 relative z-10 overflow-y-auto">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="w-full max-w-md my-8"
          >
            <SignupForm />
          </motion.div>
        </div>

        {/* Decorative elements for the form side */}
        <div className="absolute top-1/2 right-0 w-96 h-96 bg-primary/5 rounded-full blur-3xl -mr-48 -translate-y-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-accent/5 rounded-full blur-3xl pointer-events-none" />
      </div>
    </div>
  );
}
