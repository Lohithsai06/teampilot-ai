"use client";

import React, { useState, useEffect } from "react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
  updateDoc
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { Check, X, UserPlus, Mail } from "lucide-react";

interface JoinRequest {
  requestId: string;
  projectId: string;
  projectName: string;
  userId: string;
  name: string;
  email: string;
  status: string;
}

export function PendingRequests() {
  const { user } = useAuth();
  const { projects } = useProject();
  const [requests, setRequests] = useState<JoinRequest[]>([]);

  useEffect(() => {
    if (!user || projects.length === 0) return;

    // Only look for projects where user is leader
    const leaderProjectIds = projects
      .filter(p => p.leaderId === user.uid)
      .map(p => p.projectId);

    if (leaderProjectIds.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRequests([]);
      return;
    }

    const q = query(
      collection(db, "joinRequests"),
      where("projectId", "in", leaderProjectIds),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requestsData = snapshot.docs.map(doc => doc.data() as JoinRequest);
      setRequests(requestsData);
    });

    return () => unsubscribe();
  }, [user, projects]);

  const handleApprove = async (request: JoinRequest) => {
    try {
      // 1. Add to projectMembers
      const memberRef = doc(db, "projectMembers", `${request.projectId}_${request.userId}`);
      await setDoc(memberRef, {
        projectId: request.projectId,
        userId: request.userId,
        name: request.name,
        email: request.email,
        role: "member",
        joinedAt: serverTimestamp(),
      });

      // 2. Update project totalMembers
      const projectRef = doc(db, "projects", request.projectId);
      await updateDoc(projectRef, {
        totalMembers: increment(1),
        updatedAt: serverTimestamp(),
      });

      // 3. Delete join request
      await deleteDoc(doc(db, "joinRequests", request.requestId));
    } catch (error) {
      console.error("Error approving request:", error);
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      await deleteDoc(doc(db, "joinRequests", requestId));
    } catch (error) {
      console.error("Error rejecting request:", error);
    }
  };

  if (requests.length === 0) return null;

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold flex items-center gap-2">
        <UserPlus className="h-5 w-5 text-primary" />
        Join Requests
      </h3>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {requests.map((request) => (
          <Card key={request.requestId} className="border-primary/20 bg-primary/5">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                  <AvatarFallback>{request.name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-sm truncate">{request.name}</CardTitle>
                  <CardDescription className="text-xs flex items-center gap-1 truncate">
                    <Mail className="h-3 w-3" />
                    {request.email}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pb-3">
              <p className="text-xs text-muted-foreground mb-3">
                Wants to join: <span className="font-medium text-foreground">{request.projectName}</span>
              </p>
              <div className="flex gap-2">
                <Button 
                  size="sm" 
                  className="flex-1 h-8 gap-1" 
                  onClick={() => handleApprove(request)}
                >
                  <Check className="h-3.5 w-3.5" />
                  Approve
                </Button>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1 h-8 gap-1"
                  onClick={() => handleReject(request.requestId)}
                >
                  <X className="h-3.5 w-3.5" />
                  Reject
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
