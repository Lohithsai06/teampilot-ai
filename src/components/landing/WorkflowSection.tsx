"use client";

import React from "react";
import { motion } from "framer-motion";
import { Lightbulb, MessageSquare, Map, ListTodo, Users, Kanban, GitBranch, ChartBar as BarChart3, Rocket } from "lucide-react";

const workflowSteps = [
  { icon: Lightbulb, label: "Idea", description: "Start with your vision" },
  { icon: MessageSquare, label: "AI Discussion", description: "Refine with AI" },
  { icon: Map, label: "Roadmap", description: "Plan your journey" },
  { icon: ListTodo, label: "Task Breakdown", description: "Split into tasks" },
  { icon: Users, label: "Team Assignment", description: "Assign roles" },
  { icon: Kanban, label: "Kanban Execution", description: "Track progress" },
  { icon: GitBranch, label: "GitHub Tracking", description: "Monitor commits" },
  { icon: BarChart3, label: "AI Insights", description: "Get recommendations" },
  { icon: Rocket, label: "Deployment", description: "Ship to production" },
];

export function WorkflowSection() {
  return (
    <section id="workflow" className="py-20 md:py-32">
      <div className="container mx-auto px-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-2xl mx-auto mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            From Idea to Deployment
          </h2>
          <p className="text-lg text-muted-foreground">
            A clear, step-by-step workflow that guides your team from concept to
            production.
          </p>
        </motion.div>

        <div className="relative">
          <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-border -translate-y-1/2 hidden lg:block" />

          <div className="grid grid-cols-3 lg:grid-cols-9 gap-6 lg:gap-4">
            {workflowSteps.map((step, index) => (
              <motion.div
                key={step.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="relative flex flex-col items-center text-center"
              >
                <div className="relative z-10 h-16 w-16 rounded-full bg-background border-2 border-primary flex items-center justify-center mb-3">
                  <step.icon className="h-6 w-6 text-primary" />
                </div>
                <h3 className="text-sm font-semibold">{step.label}</h3>
                <p className="text-xs text-muted-foreground mt-1 hidden md:block">
                  {step.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
