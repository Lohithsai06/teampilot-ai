"use client";

import React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { SignupForm } from "@/components/auth/SignupForm";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function RegisterPage() {
  return (
<<<<<<< HEAD
    <div className="min-h-screen flex flex-col relative">
      <div className="p-4 relative z-10">
=======
    <div className="min-h-screen flex flex-col">
      <div className="p-4">
>>>>>>> 34e35ede3dbaf79d7f530c46a21eb58646c938b3
        <Link href="/">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to home
          </Button>
        </Link>
      </div>

<<<<<<< HEAD
      <div className="flex-1 flex items-center justify-center p-4 relative z-10">
=======
      <div className="flex-1 flex items-center justify-center p-4">
>>>>>>> 34e35ede3dbaf79d7f530c46a21eb58646c938b3
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <SignupForm />
        </motion.div>
      </div>

<<<<<<< HEAD
      <div className="hidden lg:block fixed right-0 top-0 h-full w-1/2 bg-gradient-to-br from-primary/5 via-primary/10 to-transparent pointer-events-none" />
=======
      <div className="hidden lg:block fixed right-0 top-0 h-full w-1/2 bg-gradient-to-br from-primary/5 via-primary/10 to-transparent" />
>>>>>>> 34e35ede3dbaf79d7f530c46a21eb58646c938b3
    </div>
  );
}
