"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles } from "lucide-react";

export function CTASection() {
  return (
    <section className="py-20 md:py-32 bg-primary text-primary-foreground">
      <div className="container mx-auto px-4 md:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center max-w-3xl mx-auto space-y-8"
        >
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-2xl bg-primary-foreground/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8" />
            </div>
          </div>

          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold">
            Ready to Transform Your Development Workflow?
          </h2>

          <p className="text-lg md:text-xl opacity-90 max-w-2xl mx-auto">
            Join teams who are already building faster with AI-powered project
            management. Start your journey today.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
            <Link href="/register">
              <Button
                size="lg"
                variant="secondary"
                className="gap-2 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
              >
                Get Started Free
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Button
              size="lg"
              variant="outline"
              className="gap-2 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
            >
              Schedule Demo
            </Button>
          </div>

          <p className="text-sm opacity-75 pt-4">
            No credit card required. Start building in minutes.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
