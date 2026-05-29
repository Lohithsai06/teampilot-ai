"use client";

import React from "react";
import { motion } from "framer-motion";
import { DashboardLayout } from "@/components/common/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Users, UserPlus, Mail, Shield, Code, Palette, Brain, Clock, CircleCheck as CheckCircle2, CircleAlert as AlertCircle } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const teamMembers = [
  {
    id: 1,
    name: "Team Member",
    role: "Lead Developer",
    avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop",
    email: "member@teampilot.ai",
    tasks: { assigned: 8, completed: 6 },
    status: "active",
    workload: 75,
  },
  {
    id: 2,
    name: "Sarah Chen",
    role: "Frontend Developer",
    avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop",
    email: "sarah@teampilot.ai",
    tasks: { assigned: 12, completed: 10 },
    status: "active",
    workload: 90,
  },
  {
    id: 3,
    name: "Mike Johnson",
    role: "Backend Developer",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop",
    email: "mike@teampilot.ai",
    tasks: { assigned: 6, completed: 4 },
    status: "active",
    workload: 60,
  },
  {
    id: 4,
    name: "Emily Davis",
    role: "UI/UX Designer",
    avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop",
    email: "emily@teampilot.ai",
    tasks: { assigned: 5, completed: 5 },
    status: "available",
    workload: 30,
  },
  {
    id: 5,
    name: "Alex Kim",
    role: "AI Engineer",
    avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop",
    email: "alex@teampilot.ai",
    tasks: { assigned: 10, completed: 8 },
    status: "active",
    workload: 85,
  },
];

const roleIcons: Record<string, React.ElementType> = {
  "Team Lead": Shield,
  "Frontend Developer": Code,
  "Backend Developer": Code,
  "UI/UX Designer": Palette,
  "AI Engineer": Brain,
};

export default function TeamPage() {
  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="space-y-8"
      >
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Users className="h-8 w-8 text-primary" />
              Team
            </h1>
            <p className="text-muted-foreground mt-1">
              Manage team members and track workload distribution
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" className="gap-2">
              <Mail className="h-4 w-4" />
              Room Code: TEAM-2847
            </Button>
            <Button className="gap-2">
              <UserPlus className="h-4 w-4" />
              Invite Member
            </Button>
          </div>
        </div>

        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              AI Team Assignment Insights
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
                  <AlertCircle className="h-5 w-5 text-warning" />
                </div>
                <div>
                  <p className="font-medium text-warning">High Workload</p>
                  <p className="text-sm text-muted-foreground">
                    Sarah is at 90% capacity. Consider redistributing tasks.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="font-medium text-success">Available</p>
                  <p className="text-sm text-muted-foreground">
                    Emily has capacity for new assignments.
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Brain className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Recommended</p>
                  <p className="text-sm text-muted-foreground">
                    Assign new AI features to Alex for optimal efficiency.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {teamMembers.map((member, index) => {
            const RoleIcon = roleIcons[member.role] || Users;
            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="hover:shadow-soft-lg transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={member.avatar} alt={member.name} />
                          <AvatarFallback>{member.name[0]}</AvatarFallback>
                        </Avatar>
                        <div>
                          <h3 className="font-semibold">{member.name}</h3>
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <RoleIcon className="h-3 w-3" />
                            {member.role}
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={member.status === "active" ? "default" : "secondary"}
                      >
                        {member.status}
                      </Badge>
                    </div>

                    <div className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Workload</span>
                        <span className={`font-medium ${
                          member.workload > 80 ? "text-warning" :
                          member.workload < 40 ? "text-success" : ""
                        }`}>
                          {member.workload}%
                        </span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            member.workload > 80 ? "bg-warning" :
                            member.workload < 40 ? "bg-success" : "bg-primary"
                          }`}
                          style={{ width: `${member.workload}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {member.tasks.assigned} assigned
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4 text-success" />
                          <span className="text-success">
                            {member.tasks.completed} done
                          </span>
                        </div>
                      </div>

                      <div className="pt-3 border-t flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1">
                          View Tasks
                        </Button>
                        <Button variant="ghost" size="sm">
                          Message
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <Card className="bg-muted/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                <strong>Shared Context:</strong> All team members share the same project memory and can access role-specific guidance from the AI.
              </div>
              <Button variant="outline" size="sm">Manage Context</Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </DashboardLayout>
  );
}
