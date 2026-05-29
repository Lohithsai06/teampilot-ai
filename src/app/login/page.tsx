"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { LoginForm } from "@/components/auth/LoginForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="p-4">
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Button>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <LoginForm />
        </motion.div>
      </div>

      <div className="hidden lg:block fixed right-0 top-0 h-full w-1/2 bg-gradient-to-br from-primary/5 via-primary/10 to-transparent" />
    </div>
  );
}
