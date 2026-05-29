"use client";

import React from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/common/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Users,
  UserPlus,
  Mail,
  Shield,
  Copy,
  Clock,
  FolderKanban,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { PendingRequests } from "@/components/project/PendingRequests";
import Link from "next/link";
import { Timestamp } from "firebase/firestore";

function formatJoinDate(ts: Timestamp | null | undefined): string {
  if (!ts) return "—";
  try {
    return ts.toDate().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function TeamPage() {
  const { user } = useAuth();
  const { activeProject, activeProjectMembers, membersLoading, userRole } = useProject();
  const [copied, setCopied] = React.useState(false);

  const handleCopyCode = () => {
    if (!activeProject) return;
    navigator.clipboard.writeText(activeProject.projectCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── No active project ──────────────────────────────────────────────────────
  if (!activeProject) {
    return (
      <DashboardLayout>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-8 w-8 text-primary" />
              Team
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage team members and collaboration
            </p>
          </div>

          <div className="py-24 flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed rounded-2xl bg-muted/20">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <FolderKanban className="h-8 w-8 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold">No Project Selected</h3>
              <p className="text-muted-foreground max-w-[280px] mx-auto">
                Select an active project to view and manage your team members.
              </p>
            </div>
            <Link href="/projects">
              <Button className="gap-2">
                <FolderKanban className="h-4 w-4" />
                Go to Projects
              </Button>
            </Link>
          </div>
        </motion.div>
      </DashboardLayout>
    );
  }

  // ── Render team ────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-8 w-8 text-primary" />
              Team
            </h1>
            <p className="text-muted-foreground mt-1">
              {activeProject.projectName} · {activeProject.totalMembers} member
              {activeProject.totalMembers !== 1 ? "s" : ""}
            </p>
          </div>

          {/* Project Code / Invite */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="gap-2 font-mono"
              onClick={handleCopyCode}
            >
              {copied ? (
                <>Copied!</>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  {activeProject.projectCode}
                </>
              )}
            </Button>
            {userRole === "leader" && (
              <Button variant="default" className="gap-2" disabled>
                <UserPlus className="h-4 w-4" />
                Invite via Code
              </Button>
            )}
          </div>
        </div>

        {/* Pending Requests (leader only) */}
        {userRole === "leader" && <PendingRequests />}

        {/* Members Grid */}
        {membersLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : activeProjectMembers.length === 0 ? (
          <div className="py-20 flex flex-col items-center justify-center text-center space-y-4 border-2 border-dashed rounded-2xl bg-muted/20">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-7 w-7 text-primary" />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold">No Members Yet</h3>
              <p className="text-muted-foreground max-w-[260px] mx-auto text-sm">
                Invite teammates using your project code:{" "}
                <span className="font-mono font-semibold text-foreground">
                  {activeProject.projectCode}
                </span>
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {activeProjectMembers.map((member, index) => (
              <motion.div
                key={member.userId}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.07 }}
              >
                <Card className="hover:shadow-soft-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarFallback className="text-base font-semibold">
                            {getInitials(member.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold leading-tight">{member.name}</h3>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <Mail className="h-3 w-3" />
                            <span className="truncate max-w-[140px]">{member.email}</span>
                          </div>
                        </div>
                      </div>

                      <Badge
                        variant={member.role === "leader" ? "default" : "secondary"}
                        className="shrink-0 flex items-center gap-1"
                      >
                        {member.role === "leader" && <Shield className="h-3 w-3" />}
                        {member.role === "leader" ? "Leader" : "Member"}
                      </Badge>
                    </div>

                    {/* Join Date */}
                    <div className="pt-3 border-t flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        Joined {formatJoinDate(member.joinedAt)}
                      </span>
                      {/* Highlight if it's the current user */}
                      {member.userId === user?.uid && (
                        <Badge variant="outline" className="ml-auto text-[10px] px-1.5 py-0">
                          You
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}

        {/* Footer info */}
        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                <strong>Share your project code</strong> with teammates so they can
                request to join.{" "}
                <span className="font-mono font-semibold text-foreground">
                  {activeProject.projectCode}
                </span>
              </div>
              <Button variant="outline" size="sm" onClick={handleCopyCode}>
                {copied ? "Copied!" : "Copy Code"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </DashboardLayout>
  );
}
