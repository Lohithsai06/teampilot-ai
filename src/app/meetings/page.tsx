"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  getDocs,
  deleteDoc,
} from "firebase/firestore";
import {
  Calendar,
  Check,
  CheckCircle2,
  Circle,
  Clock,
  FolderKanban,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Plus,
  Shield,
  Trash2,
  User,
  Users,
  Video,
  VideoOff,
  X,
  XCircle,
  AlertTriangle,
  LogIn,
  Hourglass,
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
  /** Firestore document ID — used as the roomId in the URL */
  docId: string;
  projectId: string;
  meetingName: string;
  hostId: string;
  hostName: string;
  status: "waiting" | "active" | "ended";
  createdAt: Timestamp | null;
  participantCount: number;
}

interface JoinRequest {
  docId: string;
  meetingId: string;
  userId: string;
  userName: string;
  userRole: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: Timestamp | null;
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

// ─── Create Meeting Dialog ──────────────────────────────────────────────────────

function CreateMeetingDialog({
  projectId,
  userId,
  userName,
  userRole,
  onClose,
  onCreated,
}: {
  projectId: string;
  userId: string;
  userName: string;
  userRole: string;
  onClose: () => void;
  onCreated: (docId: string, meetingName: string) => void;
}) {
  const [meetingName, setMeetingName] = useState("");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!meetingName.trim()) return;
    setCreating(true);
    try {
      // 1. Create the meeting document
      const meetingRef = await addDoc(collection(db, "meetings"), {
        projectId,
        meetingName: meetingName.trim(),
        hostId: userId,
        hostName: userName,
        status: "waiting",
        createdAt: serverTimestamp(),
        participantCount: 1,
      });

      const docId = meetingRef.id;

      // 2. Auto-approve host as first participant
      await addDoc(collection(db, "meetingParticipants"), {
        meetingId: docId,
        projectId,
        userId,
        userName,
        role: userRole,
        isHost: true,
        joinedAt: serverTimestamp(),
        micEnabled: true,
        camEnabled: true,
      });

      console.log("[Meeting] Created meeting:", docId, "Host auto-approved");
      onCreated(docId, meetingName.trim());
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
              <p className="text-xs text-muted-foreground">
                Team members will see and request to join
              </p>
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
              value={meetingName}
              onChange={(e) => setMeetingName(e.target.value)}
              placeholder="e.g. Sprint Planning, Design Review…"
              onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              autoFocus
            />
          </div>

          {/* Info callout */}
          <div className="rounded-lg bg-primary/5 border border-primary/20 p-3 flex items-start gap-2.5">
            <Shield className="h-4 w-4 text-primary shrink-0 mt-0.5" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              You will automatically enter as host. Team members must{" "}
              <strong>request to join</strong> and you will approve or reject them.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 border-t p-4">
          <Button variant="outline" onClick={onClose} disabled={creating}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!meetingName.trim() || creating}
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

// ─── Delete Confirmation Dialog ─────────────────────────────────────────────────

function DeleteConfirmDialog({
  meetingName,
  onConfirm,
  onCancel,
  deleting,
}: {
  meetingName: string;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm rounded-2xl border bg-background shadow-2xl"
      >
        <div className="p-6 text-center space-y-4">
          <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <AlertTriangle className="h-7 w-7 text-destructive" />
          </div>
          <div>
            <h2 className="font-semibold text-lg">Delete Meeting?</h2>
            <p className="text-sm text-muted-foreground mt-1">
              <strong>"{meetingName}"</strong> and all its data will be permanently deleted.
              This action cannot be undone.
            </p>
          </div>
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={onCancel}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="flex-1 gap-2"
              onClick={onConfirm}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </>
              )}
            </Button>
          </div>
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
  joinRequest,
  onRequestJoin,
  onEndMeeting,
  onDeleteMeeting,
  enteringMeetingId,
  requestingMeetingId,
}: {
  meeting: Meeting;
  currentUserId: string;
  userRole: string | null;
  joinRequest: JoinRequest | null;
  onRequestJoin: (meeting: Meeting) => void;
  onEndMeeting: (docId: string) => void;
  onDeleteMeeting: (meeting: Meeting) => void;
  enteringMeetingId: string | null;
  requestingMeetingId: string | null;
}) {
  const router = useRouter();
  const isHost = meeting.hostId === currentUserId;
  const isLeader = userRole === "leader";
  const isActive = meeting.status === "active" || meeting.status === "waiting";
  const isEnding = meeting.status === "ended";

  const handleEnter = () => {
    router.push(
      `/meetings/${meeting.docId}?projectId=${meeting.projectId}&name=${encodeURIComponent(meeting.meetingName)}`
    );
  };

  const renderActionButton = () => {
    if (!isActive) {
      return (
        <Button
          variant="outline"
          disabled
          className="flex-1 gap-2 cursor-not-allowed opacity-60"
        >
          <VideoOff className="h-4 w-4" />
          Meeting Ended
        </Button>
      );
    }

    if (isHost) {
      // Host enters directly
      return (
        <Button
          className="flex-1 gap-2"
          onClick={handleEnter}
          disabled={enteringMeetingId === meeting.docId}
        >
          {enteringMeetingId === meeting.docId ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Shield className="h-4 w-4" />
          )}
          Enter as Host
        </Button>
      );
    }

    if (joinRequest?.status === "approved") {
      return (
        <Button
          className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
          onClick={handleEnter}
        >
          <LogIn className="h-4 w-4" />
          Enter Meeting
        </Button>
      );
    }

    if (joinRequest?.status === "pending") {
      return (
        <Button
          variant="outline"
          disabled
          className="flex-1 gap-2 text-yellow-600 border-yellow-400/40"
        >
          <Hourglass className="h-4 w-4 animate-pulse" />
          Request Pending…
        </Button>
      );
    }

    if (joinRequest?.status === "rejected") {
      return (
        <Button variant="outline" disabled className="flex-1 gap-2 text-destructive border-destructive/30 opacity-70">
          <XCircle className="h-4 w-4" />
          Request Rejected
        </Button>
      );
    }

    // No request yet
    return (
      <Button
        variant="outline"
        className="flex-1 gap-2 border-primary/40 text-primary hover:bg-primary/10"
        onClick={() => onRequestJoin(meeting)}
        disabled={requestingMeetingId === meeting.docId}
      >
        {requestingMeetingId === meeting.docId ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <LogIn className="h-4 w-4" />
        )}
        Request to Join
      </Button>
    );
  };

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
            <div
              className={cn(
                "h-11 w-11 rounded-xl flex items-center justify-center shrink-0",
                isActive ? "bg-primary/10" : "bg-muted"
              )}
            >
              {isActive ? (
                <Video className="h-5 w-5 text-primary" />
              ) : (
                <VideoOff className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0">
              <p className="font-semibold truncate">{meeting.meetingName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                {isHost && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-primary/30 text-primary">
                    Host
                  </Badge>
                )}
              </div>
            </div>
          </div>
          <Badge
            variant={isActive ? "default" : "secondary"}
            className={cn("shrink-0 gap-1", isActive && "animate-pulse")}
          >
            {isActive ? (
              <>
                <Circle className="h-2 w-2 fill-current" /> Live
              </>
            ) : (
              <>
                <CheckCircle2 className="h-3 w-3" /> Ended
              </>
            )}
          </Badge>
        </div>

        {/* Meta */}
        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
          <div className="flex items-center gap-1.5">
            <Avatar className="h-5 w-5">
              <AvatarFallback className="text-[9px]">
                {getInitials(meeting.hostName)}
              </AvatarFallback>
            </Avatar>
            <span>{meeting.hostName}</span>
            <Shield className="h-3 w-3 text-primary" />
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatTime(meeting.createdAt)}
          </div>
          {isActive && meeting.participantCount > 0 && (
            <div className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              <span>{meeting.participantCount} participant{meeting.participantCount !== 1 ? "s" : ""}</span>
            </div>
          )}
        </div>

        {/* Rejected message */}
        {joinRequest?.status === "rejected" && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-destructive/5 border border-destructive/20 px-3 py-2">
            <XCircle className="h-3.5 w-3.5 text-destructive shrink-0" />
            <p className="text-xs text-destructive">Host rejected your join request.</p>
          </div>
        )}

        {/* Approved — waiting to enter */}
        {joinRequest?.status === "approved" && !isHost && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-green-500/5 border border-green-500/20 px-3 py-2">
            <Check className="h-3.5 w-3.5 text-green-500 shrink-0" />
            <p className="text-xs text-green-600 dark:text-green-400">Host approved your request! Click Enter Meeting.</p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2">
          {renderActionButton()}

          {/* Host: End meeting */}
          {isHost && isActive && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onEndMeeting(meeting.docId)}
              className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/30 gap-1.5"
            >
              <PhoneOff className="h-3.5 w-3.5" />
              End
            </Button>
          )}

          {/* Leader: Delete ended meeting */}
          {(isLeader || isHost) && isEnding && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onDeleteMeeting(meeting)}
              className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Delete meeting"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function MeetingsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { activeProject, userRole } = useProject();

  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [enteringMeetingId, setEnteringMeetingId] = useState<string | null>(null);
  const [requestingMeetingId, setRequestingMeetingId] = useState<string | null>(null);

  // Delete confirmation state
  const [deletingMeeting, setDeletingMeeting] = useState<Meeting | null>(null);
  const [deleting, setDeleting] = useState(false);

  const projectId = activeProject?.projectId || "";
  const userId = user?.uid || "";
  const userName =
    user?.displayName || user?.email?.split("@")[0] || "Anonymous";

  // ── Listen to meetings for this project ──────────────────────────────────
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
      const data: Meeting[] = snap.docs.map((d) => {
        const raw = d.data();
        return {
          docId: d.id,
          projectId: raw.projectId || "",
          meetingName: raw.meetingName || raw.roomName || "Untitled Meeting",
          hostId: raw.hostId || raw.createdBy || "",
          hostName: raw.hostName || raw.createdByName || "Unknown",
          status: raw.status || "ended",
          createdAt: raw.createdAt || null,
          participantCount: raw.participantCount || 0,
        };
      });
      setMeetings(data);
      setLoading(false);
    });

    return () => unsub();
  }, [projectId]);

  // ── Listen to current user's join requests for this project ──────────────
  useEffect(() => {
    if (!userId || !projectId) return;

    const q = query(
      collection(db, "meetingJoinRequests"),
      where("userId", "==", userId),
      where("projectId", "==", projectId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const data: JoinRequest[] = snap.docs.map((d) => ({
        docId: d.id,
        ...(d.data() as Omit<JoinRequest, "docId">),
      }));
      setJoinRequests(data);
    });

    return () => unsub();
  }, [userId, projectId]);

  // Build a map: meetingId -> JoinRequest (for fast lookup per card)
  const joinRequestMap = new Map<string, JoinRequest>();
  joinRequests.forEach((jr) => joinRequestMap.set(jr.meetingId, jr));

  // ── Request to join a meeting ─────────────────────────────────────────────
  const handleRequestJoin = useCallback(
    async (meeting: Meeting) => {
      if (!userId || !userName) return;
      setRequestingMeetingId(meeting.docId);
      try {
        await addDoc(collection(db, "meetingJoinRequests"), {
          meetingId: meeting.docId,
          projectId: meeting.projectId,
          userId,
          userName,
          userRole: userRole || "member",
          requestedAt: serverTimestamp(),
          status: "pending",
        });
        console.log("[Meeting] Join request created for:", meeting.docId);
      } catch (err) {
        console.error("Failed to create join request:", err);
      } finally {
        setRequestingMeetingId(null);
      }
    },
    [userId, userName, userRole]
  );

  // ── End a meeting (host only) ─────────────────────────────────────────────
  const handleEndMeeting = useCallback(async (docId: string) => {
    try {
      await updateDoc(doc(db, "meetings", docId), { status: "ended" });
    } catch (err) {
      console.error("Failed to end meeting:", err);
    }
  }, []);

  // ── Delete a meeting (leader/host only) ───────────────────────────────────
  const handleDeleteMeeting = useCallback(async () => {
    if (!deletingMeeting) return;
    setDeleting(true);
    const docId = deletingMeeting.docId;

    try {
      const deleteCollection = async (
        collName: string,
        field: string,
        value: string
      ) => {
        const q = query(
          collection(db, collName),
          where(field, "==", value)
        );
        const snap = await getDocs(q);
        await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
      };

      // Delete all related sub-collections
      await deleteCollection("meetingJoinRequests", "meetingId", docId);
      await deleteCollection("meetingParticipants", "meetingId", docId);
      await deleteCollection("meetingCandidates", "meetingId", docId);
      await deleteCollection("meetingHistory", "meetingId", docId);

      // Finally delete the meeting itself
      await deleteDoc(doc(db, "meetings", docId));
      console.log("[Meeting] Deleted meeting:", docId);
    } catch (err) {
      console.error("Failed to delete meeting:", err);
    } finally {
      setDeleting(false);
      setDeletingMeeting(null);
    }
  }, [deletingMeeting]);

  // ── Navigate host into meeting on create ──────────────────────────────────
  const handleMeetingCreated = useCallback(
    (docId: string, name: string) => {
      setShowCreate(false);
      router.push(
        `/meetings/${docId}?projectId=${projectId}&name=${encodeURIComponent(name)}`
      );
    },
    [projectId, router]
  );

  const activeMeetings = meetings.filter(
    (m) => m.status === "active" || m.status === "waiting"
  );
  const recentMeetings = meetings.filter((m) => m.status === "ended");

  // ── No project state ───────────────────────────────────────────────────────
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
          <Button
            onClick={() => router.push("/projects")}
            className="gap-2"
          >
            <FolderKanban className="h-4 w-4" />
            Go to Projects
          </Button>
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
                  {activeProject?.projectName} · Project video calls
                </p>
              </div>
            </div>
          </div>
          {(userRole === "leader" || userRole === "member") && (
            <Button onClick={() => setShowCreate(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              New Meeting
            </Button>
          )}
        </motion.div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Active / Waiting Meetings */}
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
                  key={meeting.docId}
                  meeting={meeting}
                  currentUserId={userId}
                  userRole={userRole}
                  joinRequest={joinRequestMap.get(meeting.docId) || null}
                  onRequestJoin={handleRequestJoin}
                  onEndMeeting={handleEndMeeting}
                  onDeleteMeeting={setDeletingMeeting}
                  enteringMeetingId={enteringMeetingId}
                  requestingMeetingId={requestingMeetingId}
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
              Team members will see it and request to join.
            </p>
            <Button
              onClick={() => setShowCreate(true)}
              className="mt-5 gap-2"
            >
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
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                  Recent Meetings ({recentMeetings.length})
                </h2>
              </div>
              {userRole === "leader" && (
                <p className="text-xs text-muted-foreground">
                  Click the trash icon to delete a meeting.
                </p>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {recentMeetings.map((meeting) => (
                <MeetingCard
                  key={meeting.docId}
                  meeting={meeting}
                  currentUserId={userId}
                  userRole={userRole}
                  joinRequest={null}
                  onRequestJoin={handleRequestJoin}
                  onEndMeeting={handleEndMeeting}
                  onDeleteMeeting={setDeletingMeeting}
                  enteringMeetingId={null}
                  requestingMeetingId={null}
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
            projectId={projectId}
            userId={userId}
            userName={userName}
            userRole={userRole || "member"}
            onClose={() => setShowCreate(false)}
            onCreated={handleMeetingCreated}
          />
        )}
      </AnimatePresence>

      {/* Delete Confirmation Dialog */}
      <AnimatePresence>
        {deletingMeeting && (
          <DeleteConfirmDialog
            meetingName={deletingMeeting.meetingName}
            onConfirm={handleDeleteMeeting}
            onCancel={() => setDeletingMeeting(null)}
            deleting={deleting}
          />
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
