"use client";

import React, { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  deleteDoc,
  setDoc,
  serverTimestamp,
  increment,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { Check, X, UserPlus, Mail, Calendar, Loader2 } from "lucide-react";

interface JoinRequest {
  requestId: string;
  projectId: string;
  projectName: string;
  userId: string;
  userName: string;
  userEmail: string;
  status: string;
  createdAt: Timestamp | null;
}

function formatDate(ts: Timestamp | null): string {
  if (!ts) return "Just now";
  try {
    return ts.toDate().toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Recently";
  }
}

export function PendingRequests() {
  const { user } = useAuth();
  const { projects } = useProject();
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  // Per-card loading state: requestId -> "approve" | "reject" | null
  const [actionLoading, setActionLoading] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user || projects.length === 0) return;

    // Only listen for projects where the current user is the leader
    const leaderProjectIds = projects
      .filter((p) => p.leaderId === user.uid)
      .map((p) => p.projectId);

    if (leaderProjectIds.length === 0) {
      setRequests([]);
      return;
    }

    const q = query(
      collection(db, "joinRequests"),
      where("projectId", "in", leaderProjectIds),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map((d) => d.data() as JoinRequest);
      setRequests(data);
    });

    return () => unsubscribe();
  }, [user, projects]);

  const handleApprove = async (request: JoinRequest) => {
    setActionLoading((prev) => ({ ...prev, [request.requestId]: "approve" }));
    try {
      // 1. Add to projectMembers
      await setDoc(doc(db, "projectMembers", `${request.projectId}_${request.userId}`), {
        projectId: request.projectId,
        userId: request.userId,
        name: request.userName,
        email: request.userEmail,
        role: "member",
        joinedAt: serverTimestamp(),
      });

      // 2. Increment project totalMembers
      await updateDoc(doc(db, "projects", request.projectId), {
        totalMembers: increment(1),
        updatedAt: serverTimestamp(),
      });

      // 3. Remove the join request (real-time listener removes card automatically)
      await deleteDoc(doc(db, "joinRequests", request.requestId));
    } catch (error) {
      console.error("Error approving request:", error);
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[request.requestId];
        return next;
      });
    }
  };

  const handleReject = async (request: JoinRequest) => {
    setActionLoading((prev) => ({ ...prev, [request.requestId]: "reject" }));
    try {
      await deleteDoc(doc(db, "joinRequests", request.requestId));
    } catch (error) {
      console.error("Error rejecting request:", error);
    } finally {
      setActionLoading((prev) => {
        const next = { ...prev };
        delete next[request.requestId];
        return next;
      });
    }
  };

  if (requests.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <UserPlus className="h-5 w-5 text-primary" />
        <h3 className="text-lg font-semibold">Pending Join Requests</h3>
        <Badge variant="secondary">{requests.length}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {requests.map((request) => {
          const isActioning = !!actionLoading[request.requestId];
          const approving = actionLoading[request.requestId] === "approve";
          const rejecting = actionLoading[request.requestId] === "reject";
          const initials = (request.userName || "?")
            .split(" ")
            .map((n) => n[0])
            .join("")
            .toUpperCase()
            .slice(0, 2);

          return (
            <Card key={request.requestId} className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="text-sm font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-sm truncate">{request.userName}</CardTitle>
                    <CardDescription className="text-xs flex items-center gap-1 truncate">
                      <Mail className="h-3 w-3 shrink-0" />
                      {request.userEmail}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pb-3 space-y-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">
                    Wants to join:{" "}
                    <span className="font-medium text-foreground">
                      {request.projectName}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3 shrink-0" />
                    {formatDate(request.createdAt)}
                  </p>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1 h-8 gap-1"
                    onClick={() => handleApprove(request)}
                    disabled={isActioning}
                  >
                    {approving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Check className="h-3.5 w-3.5" />
                    )}
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-8 gap-1"
                    onClick={() => handleReject(request)}
                    disabled={isActioning}
                  >
                    {rejecting ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <X className="h-3.5 w-3.5" />
                    )}
                    Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
