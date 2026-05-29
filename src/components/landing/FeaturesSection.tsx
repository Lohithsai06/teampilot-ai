"use client";

import React from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import {
  Brain,
  Map,
  Users,
  GitBranch,
  Sparkles,
  Zap,
  Code,
  Target,
} from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "AI-Powered Planning",
    description:
      "Discuss your ideas with AI and get intelligent roadmaps, sprint plans, and task breakdowns.",
  },
  {
    icon: Map,
    title: "Visual Roadmaps",
    description:
      "See your project journey from idea to deployment with timeline visualization.",
  },
  {
    icon: Users,
    title: "Team Collaboration",
    description:
      "Assign roles, track workload, and keep everyone aligned with shared context.",
  },
  {
    icon: GitBranch,
    title: "GitHub Integration",
    description:
      "Track commits, analyze changes, and get AI summaries of your repository activity.",
  },
  {
    icon: Sparkles,
    title: "Prompt Generation",
    description:
      "Generate IDE-ready prompts for Cursor, TRAE, Bolt, and other AI coding tools.",
  },
  {
    icon: Target,
    title: "Kanban Execution",
    description:
      "Drag and drop tasks, track sprint progress, and manage work visually.",
  },
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 md:py-32 bg-muted/30">
      <div className="container mx-auto px-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Everything You Need to Execute Projects
          </h2>
          <p className="text-lg text-muted-foreground">
            From planning to deployment, TeamPilot AI provides all the tools
            your team needs to build software efficiently.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
            >
              <Card className="h-full hover:shadow-soft-lg transition-shadow duration-300">
                <CardContent className="p-6">
                  <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
