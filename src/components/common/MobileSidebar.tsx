"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Brain,
  FolderKanban,
  Map,
  Kanban,
  MessageSquare,
  Users,
  GitBranch,
  Settings,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/ai-workspace", label: "AI Workspace", icon: Brain },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/roadmap", label: "Roadmap", icon: Map },
  { href: "/kanban", label: "Kanban", icon: Kanban },
  { href: "/team-chat", label: "Team Chat", icon: MessageSquare },
  { href: "/team", label: "Team", icon: Users },
  { href: "/github", label: "GitHub", icon: GitBranch },
  { href: "/settings", label: "Settings", icon: Settings },
];

interface MobileSidebarProps {
  onNavigate?: () => void;
}

export function MobileSidebar({ onNavigate }: MobileSidebarProps) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      await logout();
      onNavigate?.();
      router.push("/login");
    } catch (error) {
      console.error("Failed to logout:", error);
    }
  };

  const handleNavClick = () => {
    onNavigate?.();
  };

  return (
    <motion.aside
      initial={{ x: -240 }}
      animate={{ x: 0 }}
      exit={{ x: -240 }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
      className="flex flex-col h-full w-full bg-background border-r"
    >
      {/* Header */}
      <div className="p-4 border-b">
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="text-sm font-semibold text-muted-foreground"
        >
          Navigation
        </motion.span>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
        {navItems.map((item, index) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Link
                href={item.href}
                onClick={handleNavClick}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200",
                  "hover:bg-accent hover:text-accent-foreground",
                  isActive && "bg-accent text-accent-foreground font-medium"
                )}
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="text-sm">{item.label}</span>
              </Link>
            </motion.div>
          );
        })}
      </nav>

      {/* Logout Button */}
      <div className="p-2 border-t">
        <Button
          variant="ghost"
          onClick={handleLogout}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-200 text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-5 w-5 shrink-0" />
          <span className="text-sm">Logout</span>
        </Button>
      </div>
    </motion.aside>
  );
}
