"use client";

import React from "react";
import { LandingNavbar } from "@/components/landing/LandingNavbar";
import { HeroSection } from "@/components/landing/HeroSection";
import { FeaturesSection } from "@/components/landing/FeaturesSection";
import { WorkflowSection } from "@/components/landing/WorkflowSection";
import { GithubShowcase } from "@/components/landing/GithubShowcase";
import { AIShowcase } from "@/components/landing/AIShowcase";
import { CTASection } from "@/components/landing/CTASection";
import { Footer } from "@/components/landing/Footer";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <LandingNavbar />
      <main className="flex-1">
        <HeroSection />
        <FeaturesSection />
        <WorkflowSection />
        <GithubShowcase />
        <AIShowcase />
        <CTASection />
      </main>
      <Footer />
    </div>
  );
}
