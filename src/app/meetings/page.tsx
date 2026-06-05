"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  addDoc,
  collection,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  updateDoc,
  doc,
  where,
} from "firebase/firestore";
import {
  Calendar,
  Clock,
  FolderKanban,
  Loader2,
  Plus,
  Users,
  Video,
  VideoOff,
  X,
  Shield,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { DashboardLayout } from "@/components/common/DashboardLayout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface Meeting {
  meetingId: string;
  projectId: string;
  roomName: string;
  description: string;
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp | null;
  status: "active" | "ended";
  participantCount?: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatTime(ts: Timestamp | null): string {
  if (!ts) return "";
  const d = ts.toDate();
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60_000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function generateMeetingId(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

// ─── Create Meeting Dialog ──────────────────────────────────────────────────────

function CreateMeetingDialog({
  projectId,
  userId,
  userName,
  onClose,
  onCreated,
}: {
  projectId: string;
  userId: string;
  userName: string;
  onClose: () => void;
  onCreated: (meetingId: string) => void;
}) {
  const [roomName, setRoomName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!roomName.trim()) return;
    setCreating(true);
    try {
      const meetingId = generateMeetingId();
      await addDoc(collection(db, "meetings"), {
        meetingId,
        projectId,
        roomName: roomName.trim(),
        description: description.trim(),
        createdBy: userId,
        createdByName: userName,
        createdAt: serverTimestamp(),
        status: "active",
        participantCount: 0,
      });
      onCreated(meetingId);
    } catch (err) {
      console.error("Failed to create meeting:", err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 10 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md rounded-2xl border bg-background shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b p-5">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Video className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="font-semibold">Create Meeting</h2>
              <p className="text-xs text-muted-foreground">Start a video call for your team</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Meeting Name *</label>
            <Input
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
              placeholder="e.g. Sprint Planning, Design Review..."
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Description <span className="text-muted-foreground font-normal">(optional)</span></label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this meeting about?"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t p-4">
          <Button variant="outline" onClick={onClose} disabled={creating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!roomName.trim() || creating}
            className="gap-2"
          >
            {creating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <Video className="h-4 w-4" />
                Start Meeting
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ─── Meeting Card ───────────────────────────────────────────────────────────────

function MeetingCard({
  meeting,
  currentUserId,
  userRole,
  onEnd,
}: {
  meeting: Meeting;
  currentUserId: string;
  userRole: string | null;
  onEnd: (meetingId: string) => void;
}) {
  const isOwner = meeting.createdBy === currentUserId;
  const isActive = meeting.status === "active";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-2xl border bg-background shadow-sm transition-shadow hover:shadow-md overflow-hidden",
        isActive && "border-primary/30 ring-1 ring-primary/10"
      )}
    >
      {/* Active indicator strip */}
      {isActive && (
        <div className="h-1 w-full bg-gradient-to-r from-primary to-primary/60" />
      )}

      <div className="p-5">
        {/* Top row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={cn(
              "h-11 w-11 rounded-xl flex items-center justify-center shrink-0",
              isActive ? "bg-primary/10" : "bg-muted"
            )}>
              {isActive
                ? <Video className="h-5 w-5 text-primary" />
                : <VideoOff className="h-5 w-5 text-muted-foreground" />
              }
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">{meeting.roomName}</p>
              {meeting.description && (
                <p className="text-xs text-muted-foreground truncate mt-0.5">{meeting.description}</p>
              )}
            </div>
          </div>
          <Badge
            variant={isActive ? "default" : "secondary"}
            className={cn("shrink-0 gap-1", isActive && "animate-pulse")}
          >
            {isActive ? <><Circle className="h-2 w-2 fill-current" /> Live</> : <><CheckCircle2 className="h-3 w-3" /> Ended</>}
          </Badge>
        </div>

        {/* Meta */}
        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1.5">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[9px]">{getInitials(meeting.createdByName)}</AvatarFallback>
            </Avatar>
            <span>{meeting.createdByName}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatTime(meeting.createdAt)}
          </div>
          <div className="flex items-center gap-1">
            <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">
              ID: {meeting.meetingId}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2">
          {isActive ? (
            <>
              <Link href={`/meetings/${meeting.meetingId}?projectId=${meeting.projectId}&name=${encodeURIComponent(meeting.roomName)}`} className="flex-1">
                <Button className="w-full gap-2">
                  <Video className="h-4 w-4" />
                  Join Meeting
                </Button>
              </Link>
              {(isOwner || userRole === "leader") && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onEnd(meeting.meetingId)}
                  className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  End
                </Button>
              )}
            </>
          ) : (
            <Button variant="outline" disabled className="flex-1 gap-2 cursor-not-allowed opacity-60">
              <VideoOff className="h-4 w-4" />
              Meeting Ended
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function MeetingsPage() {
  const { user } = useAuth();
  const { activeProject, userRole } = useProject();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const projectId = activeProject?.projectId;
  const userId = user?.uid || "";
  const userName = user?.displayName || user?.email || "Anonymous";

  // ── Listen to meetings for this project ────────────────────────────────────
  useEffect(() => {
    if (!projectId) {
      setLoading(false);
      return;
    }

    const q = query(
      collection(db, "meetings"),
      where("projectId", "==", projectId),
      orderBy("createdAt", "desc")
    );

    const unsub = onSnapshot(q, (snap) => {
      const data = snap.docs.map((d) => ({ ...(d.data() as Omit<Meeting, "meetingId">), meetingId: d.data().meetingId || d.id }));
      setMeetings(data as Meeting[]);
      setLoading(false);
    });

    return () => unsub();
  }, [projectId]);

  const handleEndMeeting = async (meetingId: string) => {
    try {
      // Find the Firestore document for this meeting
      const q = query(collection(db, "meetings"), where("meetingId", "==", meetingId));
      const snap = await new Promise<any>((resolve) => {
        const unsub = onSnapshot(q, (s) => { unsub(); resolve(s); });
      });
      if (!snap.empty) {
        await updateDoc(doc(db, "meetings", snap.docs[0].id), { status: "ended" });
      }
    } catch (err) {
      console.error("Failed to end meeting:", err);
    }
  };

  const handleMeetingCreated = (meetingId: string) => {
    setShowCreate(false);
    window.location.href = `/meetings/${meetingId}?projectId=${projectId}&name=${encodeURIComponent("Meeting")}`;
  };

  const activeMeetings = meetings.filter((m) => m.status === "active");
  const recentMeetings = meetings.filter((m) => m.status === "ended");

  // ── No project state ──────────────────────────────────────────────────────
  if (!activeProject && !loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-[60vh] text-center gap-4">
          <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
            <FolderKanban className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">No Project Selected</h2>
          <p className="text-muted-foreground max-w-sm">
            Select or create a project to access meeting rooms.
          </p>
          <Link href="/projects">
            <Button className="gap-2">
              <FolderKanban className="h-4 w-4" />
              Go to Projects
            </Button>
          </Link>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start justify-between gap-4 flex-wrap"
        >
          <div>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Video className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Meeting Rooms</h1>
                <p className="text-sm text-muted-foreground">
                  {activeProject?.projectName} · Video calls for your team
                </p>
              </div>
            </div>
          </div>
          <Button
            onClick={() => setShowCreate(true)}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            New Meeting
          </Button>
        </motion.div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Active Meetings */}
        {!loading && activeMeetings.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                Active Meetings ({activeMeetings.length})
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {activeMeetings.map((meeting) => (
                <MeetingCard
                  key={meeting.meetingId}
                  meeting={meeting}
                  currentUserId={userId}
                  userRole={userRole}
                  onEnd={handleEndMeeting}
                />
              ))}
            </div>
          </motion.div>
        )}

        {/* Empty state — no active meetings */}
        {!loading && activeMeetings.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border-2 border-dashed bg-muted/20 py-16 text-center"
          >
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 mx-auto">
              <Video className="h-7 w-7 text-primary" />
            </div>
            <h3 className="mt-4 font-semibold text-lg">No Active Meetings</h3>
            <p className="mt-1 text-sm text-muted-foreground max-w-xs mx-auto">
              Start a video meeting to collaborate with your team in real time.
            </p>
            <Button onClick={() => setShowCreate(true)} className="mt-5 gap-2">
              <Plus className="h-4 w-4" />
              Start a Meeting
            </Button>
          </motion.div>
        )}

        {/* Recent / Ended Meetings */}
        {!loading && recentMeetings.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                Recent Meetings ({recentMeetings.length})
              </h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {recentMeetings.slice(0, 6).map((meeting) => (
                <MeetingCard
                  key={meeting.meetingId}
                  meeting={meeting}
                  currentUserId={userId}
                  userRole={userRole}
                  onEnd={handleEndMeeting}
                />
              ))}
            </div>
          </motion.div>
        )}
      </div>

      {/* Create Meeting Dialog */}
      <AnimatePresence>
        {showCreate && (
          <CreateMeetingDialog
            projectId={projectId || ""}
            userId={userId}
            userName={userName}
            onClose={() => setShowCreate(false)}
            onCreated={handleMeetingCreated}
          />
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
