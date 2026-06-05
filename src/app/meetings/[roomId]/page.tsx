"use client";

/**
 * TeamPilot AI — WebRTC Video Call Room
 *
 * NEW ARCHITECTURE (Project-Based):
 *   - roomId in URL = Firestore document ID (direct doc reference, no where-query)
 *   - Entry Gate: Check meetingParticipants for approval before starting WebRTC
 *   - Host: Auto-approved, sees approval panel for pending join requests
 *   - Member: Must request join from dashboard, waits for host approval here
 *   - WebRTC starts ONLY after entryStatus === "host" | "approved"
 *
 * Signaling Architecture (unchanged):
 *   - Offer/Answer stored directly in meetings/{docId}
 *   - ICE candidates stored in root meetingCandidates collection
 */

import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  addDoc,
  collection,
  doc,
  getDocs,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  deleteDoc,
} from "firebase/firestore";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Clock,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Shield,
  Terminal,
  User,
  Users,
  Video,
  VideoOff,
  Wifi,
  WifiOff,
  X,
  XCircle,
  Hourglass,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";

// ─── WebRTC Configuration ─────────────────────────────────────────────────────
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
        "stun:stun2.l.google.com:19302",
        "stun:stun3.l.google.com:19302",
        "stun:stun4.l.google.com:19302",
      ],
    },
  ],
  iceCandidatePoolSize: 10,
};

// ─── Types ────────────────────────────────────────────────────────────────────
type CallRole = "caller" | "receiver" | null;
type EntryStatus =
  | "checking"       // verifying participant status
  | "host"           // user is the host — auto approved
  | "waiting"        // join request pending
  | "approved"       // join request approved, entering WebRTC
  | "rejected"       // join request rejected
  | "error";         // something went wrong

type ConnState =
  | "idle"
  | "requesting-media"
  | "creating-offer"
  | "waiting"
  | "connecting"
  | "connected"
  | "disconnected"
  | "failed"
  | "error";

interface ErrorInfo {
  title: string;
  detail: string;
  recoverable: boolean;
}

interface LogEntry {
  time: string;
  msg: string;
  level: "info" | "ok" | "warn" | "error";
}

interface JoinRequest {
  docId: string;
  meetingId: string;
  userId: string;
  userName: string;
  userRole: string;
  status: "pending" | "approved" | "rejected";
  requestedAt: any;
}

interface Participant {
  docId: string;
  meetingId: string;
  userId: string;
  userName: string;
  role: string;
  isHost: boolean;
  micEnabled: boolean;
  camEnabled: boolean;
  joinedAt: any;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0)
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

const CONN_STATE_LABEL: Record<ConnState, string> = {
  idle: "Initializing",
  "requesting-media": "Requesting camera & mic…",
  "creating-offer": "Setting up call…",
  waiting: "Waiting for participant…",
  connecting: "Connecting…",
  connected: "Connected",
  disconnected: "Disconnected",
  failed: "Connection Failed",
  error: "Error",
};

const CONN_STATE_COLOR: Record<ConnState, string> = {
  idle: "text-white/50",
  "requesting-media": "text-yellow-400",
  "creating-offer": "text-yellow-400",
  waiting: "text-blue-400",
  connecting: "text-yellow-400",
  connected: "text-green-400",
  disconnected: "text-orange-400",
  failed: "text-red-400",
  error: "text-red-400",
};

// ─── Entry Gate Screen ────────────────────────────────────────────────────────

function EntryGateScreen({
  entryStatus,
  meetingName,
  onBack,
}: {
  entryStatus: EntryStatus;
  meetingName: string;
  onBack: () => void;
}) {
  return (
    <div className="h-screen w-screen bg-zinc-950 flex flex-col items-center justify-center gap-6 p-8">
      <button
        onClick={onBack}
        className="absolute top-4 left-4 flex items-center gap-2 text-white/50 hover:text-white text-sm"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      {entryStatus === "checking" && (
        <>
          <Loader2 className="h-12 w-12 text-primary animate-spin" />
          <div className="text-center">
            <p className="text-white font-semibold text-xl">Checking access…</p>
            <p className="text-white/40 text-sm mt-1">Verifying your participation status</p>
          </div>
        </>
      )}

      {entryStatus === "waiting" && (
        <>
          <div className="h-24 w-24 rounded-full bg-yellow-500/10 flex items-center justify-center ring-4 ring-yellow-500/20">
            <Hourglass className="h-10 w-10 text-yellow-400 animate-pulse" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-white font-semibold text-xl">Waiting for host approval</p>
            <p className="text-white/50 text-sm max-w-sm">
              Your request to join <strong className="text-white">{meetingName}</strong> is pending.
              The host will approve or reject it shortly.
            </p>
          </div>
          <div className="flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-4 py-2">
            <div className="h-1.5 w-1.5 rounded-full bg-yellow-400 animate-pulse" />
            <span className="text-yellow-400 text-sm">Listening for host response…</span>
          </div>
        </>
      )}

      {entryStatus === "rejected" && (
        <>
          <div className="h-24 w-24 rounded-full bg-red-500/10 flex items-center justify-center ring-4 ring-red-500/20">
            <XCircle className="h-10 w-10 text-red-400" />
          </div>
          <div className="text-center space-y-2">
            <p className="text-white font-semibold text-xl">Request Rejected</p>
            <p className="text-white/50 text-sm max-w-sm">
              The host rejected your request to join <strong className="text-white">{meetingName}</strong>.
            </p>
          </div>
          <Button onClick={onBack} variant="outline" className="border-white/20 text-white hover:bg-white/10 gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Meetings
          </Button>
        </>
      )}

      {entryStatus === "error" && (
        <>
          <div className="h-24 w-24 rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertCircle className="h-10 w-10 text-red-400" />
          </div>
          <div className="text-center">
            <p className="text-white font-semibold text-xl">Meeting Not Found</p>
            <p className="text-white/40 text-sm mt-1">This meeting may have ended or been deleted.</p>
          </div>
          <Button onClick={onBack} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Meetings
          </Button>
        </>
      )}
    </div>
  );
}

// ─── Host Approval Panel ──────────────────────────────────────────────────────

function HostApprovalPanel({
  meetingDocId,
  projectId,
}: {
  meetingDocId: string;
  projectId: string;
}) {
  const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([]);
  const [processing, setProcessing] = useState<string | null>(null);

  useEffect(() => {
    if (!meetingDocId) return;

    const q = query(
      collection(db, "meetingJoinRequests"),
      where("meetingId", "==", meetingDocId),
      where("status", "==", "pending")
    );

    const unsub = onSnapshot(q, (snap) => {
      const data: JoinRequest[] = snap.docs.map((d) => ({
        docId: d.id,
        ...(d.data() as Omit<JoinRequest, "docId">),
      }));
      setPendingRequests(data);
    });

    return () => unsub();
  }, [meetingDocId]);

  const handleApprove = async (request: JoinRequest) => {
    setProcessing(request.docId);
    try {
      // 1. Update join request status
      await updateDoc(doc(db, "meetingJoinRequests", request.docId), {
        status: "approved",
      });

      // 2. Create participant document
      await addDoc(collection(db, "meetingParticipants"), {
        meetingId: meetingDocId,
        projectId,
        userId: request.userId,
        userName: request.userName,
        role: request.userRole,
        isHost: false,
        joinedAt: serverTimestamp(),
        micEnabled: true,
        camEnabled: true,
      });

      console.log("[Host] Approved:", request.userName);
    } catch (err) {
      console.error("Failed to approve request:", err);
    } finally {
      setProcessing(null);
    }
  };

  const handleReject = async (request: JoinRequest) => {
    setProcessing(request.docId);
    try {
      await updateDoc(doc(db, "meetingJoinRequests", request.docId), {
        status: "rejected",
      });
      console.log("[Host] Rejected:", request.userName);
    } catch (err) {
      console.error("Failed to reject request:", err);
    } finally {
      setProcessing(null);
    }
  };

  if (pendingRequests.length === 0) return null;

  return (
    <div className="absolute top-20 right-4 z-30 w-72 space-y-2">
      {pendingRequests.map((req) => (
        <motion.div
          key={req.docId}
          initial={{ opacity: 0, x: 30, scale: 0.95 }}
          animate={{ opacity: 1, x: 0, scale: 1 }}
          exit={{ opacity: 0, x: 30 }}
          className="bg-zinc-900/95 border border-white/10 rounded-xl p-3 shadow-xl backdrop-blur-md"
        >
          <div className="flex items-center gap-2.5 mb-3">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="text-xs bg-primary/20 text-primary">
                {getInitials(req.userName)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="text-white text-sm font-medium truncate">{req.userName}</p>
              <p className="text-white/40 text-xs capitalize">{req.userRole}</p>
            </div>
            <Badge variant="outline" className="ml-auto shrink-0 text-[10px] border-yellow-500/40 text-yellow-400">
              Wants to join
            </Badge>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="flex-1 h-8 gap-1.5 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => handleApprove(req)}
              disabled={processing === req.docId}
            >
              {processing === req.docId ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5" />
              )}
              Accept
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-400"
              onClick={() => handleReject(req)}
              disabled={processing === req.docId}
            >
              <X className="h-3.5 w-3.5" />
              Reject
            </Button>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

// ─── Participants Panel ───────────────────────────────────────────────────────

function ParticipantsPanel({
  participants,
  hostId,
  currentUserId,
}: {
  participants: Participant[];
  hostId: string;
  currentUserId: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Participants toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "absolute top-4 right-4 z-20 flex items-center gap-2",
          "bg-black/60 hover:bg-black/80 backdrop-blur-md",
          "border border-white/10 rounded-lg px-3 py-1.5",
          "text-white text-sm transition-colors"
        )}
      >
        <Users className="h-3.5 w-3.5" />
        <span>{participants.length}</span>
      </button>

      {/* Participants drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="absolute top-14 right-4 z-20 w-64 bg-zinc-900/95 border border-white/10 rounded-xl shadow-2xl backdrop-blur-md overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-white/10">
              <span className="text-white/70 text-xs font-semibold uppercase tracking-wider">
                Participants ({participants.length})
              </span>
              <button
                onClick={() => setOpen(false)}
                className="text-white/40 hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="divide-y divide-white/5 max-h-64 overflow-y-auto">
              {participants.length === 0 && (
                <div className="py-6 text-center text-white/30 text-sm">
                  No participants yet
                </div>
              )}
              {participants.map((p) => {
                const isThisHost = p.userId === hostId || p.isHost;
                const isMe = p.userId === currentUserId;
                return (
                  <div key={p.docId} className="flex items-center gap-2.5 px-3 py-2">
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className={cn(
                        "text-[10px]",
                        isThisHost ? "bg-primary/20 text-primary" : "bg-white/10 text-white"
                      )}>
                        {getInitials(p.userName)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-white text-xs font-medium truncate">
                          {p.userName}{isMe ? " (You)" : ""}
                        </span>
                        {isThisHost && (
                          <Shield className="h-3 w-3 text-primary shrink-0" />
                        )}
                      </div>
                      <span className="text-white/40 text-[10px] capitalize">{p.role}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {p.micEnabled ? (
                        <Mic className="h-3 w-3 text-green-400" />
                      ) : (
                        <MicOff className="h-3 w-3 text-red-400" />
                      )}
                      {p.camEnabled ? (
                        <Video className="h-3 w-3 text-green-400" />
                      ) : (
                        <VideoOff className="h-3 w-3 text-red-400" />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MeetingRoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { userRole } = useProject();

  // roomId = Firestore document ID (new architecture)
  const meetingDocId = params?.roomId as string;
  const projectId = searchParams?.get("projectId") || "";
  const meetingName = decodeURIComponent(
    searchParams?.get("name") || "Team Meeting"
  );

  // ── Refs ────────────────────────────────────────────────────────────────────
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const unsubscribersRef = useRef<Array<() => void>>([]);
  const joinedAtRef = useRef<number>(Date.now());
  const hasStartedRef = useRef(false);
  const participantDocIdRef = useRef<string>("");
  const sessionIdRef = useRef<string>("");
  const roleRef = useRef<CallRole>(null);
  const isRecoveringRef = useRef<boolean>(false);
  const handleConnectionFailureRef = useRef<() => Promise<void>>(async () => {});

  // ── State ───────────────────────────────────────────────────────────────────
  const [entryStatus, setEntryStatus] = useState<EntryStatus>("checking");
  const [connState, setConnState] = useState<ConnState>("idle");
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [role, setRoleState] = useState<CallRole>(null);
  const setRole = (newRole: CallRole) => {
    setRoleState(newRole);
    roleRef.current = newRole;
  };
  const [sessionId, setSessionId] = useState<string>("");
  const [meetingStartedAt, setMeetingStartedAt] = useState<number | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [meetingSessionId, setMeetingSessionId] = useState<string>("");
  const [offerSessionId, setOfferSessionId] = useState<string>("");
  const [answerSessionId, setAnswerSessionId] = useState<string>("");
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [duration, setDuration] = useState(0);
  const [remoteJoined, setRemoteJoined] = useState(false);
  const [localReady, setLocalReady] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [remoteName, setRemoteName] = useState("Participant");
  const [remoteMicEnabled, setRemoteMicEnabled] = useState(true);
  const [remoteCamEnabled, setRemoteCamEnabled] = useState(true);
  const [localVideoPlaying, setLocalVideoPlaying] = useState(false);
  const [remoteVideoPlaying, setRemoteVideoPlaying] = useState(false);
  const [hostId, setHostId] = useState("");
  const [meetingDocExists, setMeetingDocExists] = useState(false);

  // ── Debug State ─────────────────────────────────────────────────────────────
  const [debugLogs, setDebugLogs] = useState<LogEntry[]>([]);
  const [offerStatus, setOfferStatus] = useState("None");
  const [answerStatus, setAnswerStatus] = useState("None");
  const [callerIceGenCount, setCallerIceGenCount] = useState(0);
  const [callerIceRecvCount, setCallerIceRecvCount] = useState(0);
  const [callerIceAddCount, setCallerIceAddCount] = useState(0);
  const [receiverIceGenCount, setReceiverIceGenCount] = useState(0);
  const [receiverIceRecvCount, setReceiverIceRecvCount] = useState(0);
  const [receiverIceAddCount, setReceiverIceAddCount] = useState(0);
  const [pcConnState, setPcConnState] = useState("new");
  const [pcSignalingState, setPcSignalingState] = useState("stable");
  const [pcIceConnState, setPcIceConnState] = useState("new");
  const [pcIceGatherState, setPcIceGatherState] = useState("new");
  const [localTrackCount, setLocalTrackCount] = useState(0);
  const [remoteTrackCount, setRemoteTrackCount] = useState(0);
  const [localStreamReady, setLocalStreamReady] = useState(false);
  const [remoteStreamReady, setRemoteStreamReady] = useState(false);

  const userId = user?.uid || "";
  const userName =
    user?.displayName || user?.email?.split("@")[0] || "Anonymous";

  // ── Debug logger ────────────────────────────────────────────────────────────
  const addLog = useCallback(
    (msg: string, level: LogEntry["level"] = "info") => {
      const time = new Date().toLocaleTimeString("en-US", {
        hour12: false,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      console.log(`[WebRTC][${level.toUpperCase()}] ${msg}`);
      setDebugLogs((prev) => [...prev.slice(-49), { time, msg, level }]);
    },
    []
  );

  // ── Listen to meeting participants ──────────────────────────────────────────
  useEffect(() => {
    if (!meetingDocId) return;

    const q = query(
      collection(db, "meetingParticipants"),
      where("meetingId", "==", meetingDocId)
    );

    const unsub = onSnapshot(q, (snap) => {
      const data: Participant[] = snap.docs.map((d) => ({
        docId: d.id,
        ...(d.data() as Omit<Participant, "docId">),
      }));
      setParticipants(data);
    });

    return () => unsub();
  }, [meetingDocId]);

  // ── Duration timer ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!meetingStartedAt) return;
    const id = setInterval(() => {
      const elapsed = Math.floor((Date.now() - meetingStartedAt) / 1000);
      setDuration(elapsed >= 0 ? elapsed : 0);
    }, 1000);
    return () => clearInterval(id);
  }, [meetingStartedAt]);

  // ── Cleanup helper ──────────────────────────────────────────────────────────
  const cleanup = useCallback(
    async (saveHistory = true, keepLocalStream = false) => {
      addLog(`Cleanup: stopping resources (keepLocalStream=${keepLocalStream})`, "info");
      unsubscribersRef.current.forEach((unsub) => unsub());
      unsubscribersRef.current = [];

      if (!keepLocalStream && localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => {
          t.stop();
          addLog(`Stopped track: ${t.kind}`, "info");
        });
        localStreamRef.current = null;
        setLocalTrackCount(0);
        setLocalStreamReady(false);
      }

      if (!keepLocalStream && localVideoRef.current) localVideoRef.current.srcObject = null;
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;

      if (pcRef.current) {
        pcRef.current.onicecandidate = null;
        pcRef.current.ontrack = null;
        pcRef.current.onconnectionstatechange = null;
        pcRef.current.onsignalingstatechange = null;
        pcRef.current.oniceconnectionstatechange = null;
        pcRef.current.onicegatheringstatechange = null;
        pcRef.current.close();
        pcRef.current = null;
        addLog("PeerConnection closed", "info");
      }

      // Remove from participants
      if (participantDocIdRef.current) {
        try {
          await deleteDoc(
            doc(db, "meetingParticipants", participantDocIdRef.current)
          );
          addLog("Removed from meetingParticipants", "info");
        } catch (e) {
          console.warn("[WebRTC] Could not remove participant doc:", e);
        }
        participantDocIdRef.current = "";
      }

      if (saveHistory && userId) {
        try {
          const durationSecs = Math.floor(
            (Date.now() - joinedAtRef.current) / 1000
          );
          await addDoc(collection(db, "meetingHistory"), {
            projectId,
            meetingId: meetingDocId,
            participantId: userId,
            participantName: userName,
            duration: durationSecs,
            endedAt: serverTimestamp(),
          });
        } catch (e) {
          console.warn("[WebRTC] Could not save meeting history:", e);
        }
      }
    },
    [meetingDocId, projectId, userId, userName, addLog]
  );

  // ── Log CSS dimensions ──────────────────────────────────────────────────────
  const logVideoDimensions = useCallback(() => {
    if (remoteVideoRef.current) {
      const el = remoteVideoRef.current;
      const computed = window.getComputedStyle(el);
      addLog(
        `[CSS] Remote video: clientWidth=${el.clientWidth} clientHeight=${el.clientHeight} videoWidth=${el.videoWidth} videoHeight=${el.videoHeight}`,
        "info"
      );
      addLog(
        `[CSS] Remote style: display=${computed.display} visibility=${computed.visibility} opacity=${computed.opacity}`,
        "info"
      );
    }
  }, [addLog]);

  // ── Get local media ─────────────────────────────────────────────────────────
  const getLocalMedia = useCallback(async (): Promise<MediaStream> => {
    setConnState("requesting-media");
    addLog("Requesting camera and microphone…", "info");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: "user",
        },
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();
      addLog(
        `Camera tracks: ${videoTracks.length} | Audio tracks: ${audioTracks.length}`,
        "ok"
      );
      videoTracks.forEach((t) =>
        addLog(`Video track: "${t.label}" enabled=${t.enabled}`, "ok")
      );

      localStreamRef.current = stream;
      setLocalTrackCount(stream.getTracks().length);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        addLog("LOCAL STREAM ATTACHED to video element ✓", "ok");
        localVideoRef.current
          .play()
          .then(() => {
            setLocalVideoPlaying(true);
            addLog("LOCAL VIDEO PLAY SUCCESS ✓", "ok");
          })
          .catch((e) => {
            setLocalVideoPlaying(false);
            addLog(`Local video play() error: ${e.message}`, "warn");
          });
      } else {
        addLog(
          "WARNING: localVideoRef.current is null — stream NOT attached!",
          "error"
        );
      }

      setLocalReady(true);
      setLocalStreamReady(true);
      return stream;
    } catch (err: any) {
      const name = err?.name || "";
      addLog(`getUserMedia error: ${name} — ${err?.message}`, "error");

      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        throw Object.assign(
          new Error("Camera/microphone permission denied"),
          {
            friendlyTitle: "Permission Denied",
            friendlyDetail:
              "Allow camera and microphone access in your browser settings, then reload.",
            recoverable: false,
          }
        );
      }
      if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        throw Object.assign(new Error("No camera/microphone found"), {
          friendlyTitle: "No Media Devices",
          friendlyDetail:
            "No camera or microphone was detected. Please connect a device and try again.",
          recoverable: false,
        });
      }
      throw Object.assign(err, {
        friendlyTitle: "Media Error",
        friendlyDetail:
          err?.message || "Could not access your camera or microphone.",
        recoverable: true,
      });
    }
  }, [addLog]);

  // ── Create RTCPeerConnection ────────────────────────────────────────────────
  const createPC = useCallback(
    (
      stream: MediaStream,
      onIceCandidate: (candidate: RTCIceCandidate) => void,
      myRole: "caller" | "receiver"
    ): RTCPeerConnection => {
      addLog(
        "Creating RTCPeerConnection with Google STUN servers",
        "info"
      );
      const pc = new RTCPeerConnection(RTC_CONFIG);
      pcRef.current = pc;

      stream.getTracks().forEach((track) => {
        pc.addTrack(track, stream);
        addLog(`Track added to PC: ${track.kind} (${track.label})`, "ok");
      });

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          if (myRole === "caller") setCallerIceGenCount((prev) => prev + 1);
          else setReceiverIceGenCount((prev) => prev + 1);

          if (myRole === "caller") {
            addLog(
              `Caller Generated ICE: ${event.candidate.type} / ${event.candidate.protocol}`,
              "info"
            );
          } else {
            addLog(
              `Receiver Generated ICE: ${event.candidate.type} / ${event.candidate.protocol}`,
              "info"
            );
          }
          onIceCandidate(event.candidate);
        } else {
          addLog("ICE gathering complete (null candidate)", "ok");
        }
      };

      pc.onicegatheringstatechange = () => {
        setPcIceGatherState(pc.iceGatheringState);
        addLog(`ICE Gathering State: ${pc.iceGatheringState}`, "info");
      };

      pc.ontrack = (event) => {
        const track = event.track;
        const remoteStream = event.streams[0];
        const streamId = remoteStream ? remoteStream.id : "unknown";

        addLog(
          `[ontrack] REMOTE TRACK RECEIVED: kind=${track.kind} | ID=${track.id} | readyState=${track.readyState} | enabled=${track.enabled} | muted=${track.muted} | StreamID=${streamId}`,
          "ok"
        );

        if (!remoteStreamRef.current) {
          remoteStreamRef.current = new MediaStream();
          addLog(
            `REMOTE STREAM CREATED: id=${remoteStreamRef.current.id}`,
            "info"
          );
        }

        remoteStreamRef.current.addTrack(track);

        const tracks = remoteStreamRef.current.getTracks();
        addLog(
          `[RemoteStream] ID=${remoteStreamRef.current.id} | Track count=${tracks.length} | Kinds=[${tracks.map((t) => t.kind).join(", ")}]`,
          "info"
        );
        setRemoteTrackCount(tracks.length);

        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current;
          addLog("REMOTE STREAM ATTACHED TO VIDEO ✓", "ok");

          remoteVideoRef.current.style.opacity = "1";
          remoteVideoRef.current.style.display = "block";

          remoteVideoRef.current
            .play()
            .then(() => {
              setRemoteVideoPlaying(true);
              addLog("VIDEO PLAY SUCCESS ✓", "ok");
            })
            .catch((e) => {
              setRemoteVideoPlaying(false);
              addLog(`VIDEO PLAY FAILED: ${e.message}`, "error");
            });

          setRemoteJoined(true);
          setRemoteStreamReady(true);
          setConnState("connected");

          setTimeout(() => {
            logVideoDimensions();
          }, 1000);
        } else {
          addLog(
            "WARNING: remoteVideoRef.current is null — remote stream NOT attached!",
            "error"
          );
        }
      };

      pc.onconnectionstatechange = () => {
        const state = pc.connectionState;
        setPcConnState(state);
        addLog(
          `PC Connection State → ${state}`,
          state === "connected"
            ? "ok"
            : state === "failed"
            ? "error"
            : "info"
        );

        if (state === "connected") {
          setConnState("connected");
        } else if (state === "connecting") {
          setConnState("connecting");
        } else if (state === "disconnected" || state === "closed") {
          setConnState("disconnected");
        } else if (state === "failed") {
          setConnState("failed");
          handleConnectionFailureRef.current();
        }
      };

      pc.onsignalingstatechange = () => {
        setPcSignalingState(pc.signalingState);
        addLog(`Signaling State → ${pc.signalingState}`, "info");
      };

      pc.oniceconnectionstatechange = () => {
        setPcIceConnState(pc.iceConnectionState);
        addLog(
          `ICE Connection State → ${pc.iceConnectionState}`,
          pc.iceConnectionState === "connected" ||
            pc.iceConnectionState === "completed"
            ? "ok"
            : pc.iceConnectionState === "failed"
            ? "error"
            : "info"
        );
        if (
          pc.iceConnectionState === "connected" ||
          pc.iceConnectionState === "completed"
        ) {
          setConnState("connected");
          setRemoteJoined(true);
        }
        if (pc.iceConnectionState === "failed") {
          addLog(
            "ICE FAILED — peers cannot reach each other. Check network/firewall.",
            "error"
          );
          handleConnectionFailureRef.current();
        }
      };

      setPcConnState(pc.connectionState);
      setPcSignalingState(pc.signalingState);
      setPcIceConnState(pc.iceConnectionState);
      addLog(
        `PC created. Initial state: conn=${pc.connectionState} signal=${pc.signalingState} ice=${pc.iceConnectionState}`,
        "info"
      );

      return pc;
    },
    [addLog, logVideoDimensions]
  );

  // ── ICE candidate writer ────────────────────────────────────────────────────
  const writeIceCandidate = useCallback(
    async (candidate: RTCIceCandidate, type: "caller" | "receiver", activeSessionId: string) => {
      try {
        await addDoc(collection(db, "meetingCandidates"), {
          meetingId: meetingDocId,
          userId,
          type,
          candidate: candidate.toJSON(),
          createdAt: serverTimestamp(),
          sessionId: activeSessionId,
        });
        addLog(`ICE candidate written to Firestore: type=${type} session=${activeSessionId}`, "info");
      } catch (e: any) {
        addLog(`Failed to write ICE candidate: ${e?.message}`, "error");
      }
    },
    [meetingDocId, userId, addLog]
  );

  // ── ICE candidate reader ────────────────────────────────────────────────────
  const listenForIceCandidates = useCallback(
    (
      listenForType: "caller" | "receiver",
      myRole: "caller" | "receiver",
      activeSessionId: string
    ) => {
      addLog(`Listening for ICE candidates (type=${listenForType}, session=${activeSessionId})`, "info");
      const q = query(
        collection(db, "meetingCandidates"),
        where("meetingId", "==", meetingDocId),
        where("type", "==", listenForType),
        where("sessionId", "==", activeSessionId)
      );
      const unsub = onSnapshot(q, (snap) => {
        snap.docChanges().forEach((change) => {
          if (change.type === "added") {
            if (myRole === "caller") {
              setCallerIceRecvCount((prev) => prev + 1);
              addLog("Caller Received ICE", "info");
            } else {
              setReceiverIceRecvCount((prev) => prev + 1);
              addLog("Receiver Received ICE", "info");
            }

            const data = change.doc.data();
            const candidate = new RTCIceCandidate(data.candidate);

            if (pcRef.current && pcRef.current.remoteDescription) {
              try {
                pcRef.current
                  .addIceCandidate(candidate)
                  .then(() => {
                    if (myRole === "caller") {
                      setCallerIceAddCount((prev) => prev + 1);
                      addLog("Caller Added ICE", "info");
                    } else {
                      setReceiverIceAddCount((prev) => prev + 1);
                      addLog("Receiver Added ICE", "info");
                    }
                    addLog("Candidate Added Successfully", "ok");
                  })
                  .catch((e) => {
                    addLog(
                      `Candidate Add Failed: ${e?.message || e}`,
                      "error"
                    );
                  });
              } catch (e: any) {
                addLog(
                  `Candidate Add Failed: ${e?.message || e}`,
                  "error"
                );
              }
            } else {
              addLog(
                `ICE candidate received but PC not ready (remoteDescription=${!!pcRef.current?.remoteDescription})`,
                "warn"
              );
            }
          }
        });
      });
      unsubscribersRef.current.push(unsub);
    },
    [meetingDocId, addLog]
  );

  // ── CALLER FLOW ─────────────────────────────────────────────────────────────
  const startAsCaller = useCallback(async (forcedSessionId?: string) => {
    try {
      const activeSessionId = forcedSessionId || crypto.randomUUID();
      setSessionId(activeSessionId);
      sessionIdRef.current = activeSessionId;
      addLog(`=== CALLER FLOW STARTED (Session=${activeSessionId}) ===`, "info");
      
      const stream = localStreamRef.current || await getLocalMedia();
      setConnState("creating-offer");

      const pc = createPC(
        stream,
        (candidate) => writeIceCandidate(candidate, "caller", activeSessionId),
        "caller"
      );

      addLog("Creating SDP offer…", "info");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      addLog(
        `setLocalDescription done. Signaling state: ${pc.signalingState}`,
        "ok"
      );

      const offerData = {
        sdp: offer.sdp,
        type: offer.type,
        createdBy: userId,
        callerName: userName,
        sessionId: activeSessionId,
      };
      addLog(`Writing offer to Firestore doc: ${meetingDocId}`, "info");
      
      const meetingRef = doc(db, "meetings", meetingDocId);
      const meetingSnap = await getDoc(meetingRef);
      const meetingData = meetingSnap.exists() ? meetingSnap.data() : {};
      
      const updates: any = {
        offer: offerData,
        sessionId: activeSessionId,
        callerMicEnabled: micEnabled,
        callerCamEnabled: camEnabled,
      };
      
      if (!meetingData.meetingStartedAt) {
        updates.meetingStartedAt = Date.now();
      }
      
      await updateDoc(meetingRef, updates);
      setOfferStatus("Created ✓");
      addLog("Offer written to Firestore ✓", "ok");

      setConnState("waiting");
      setRole("caller");

      listenForIceCandidates("receiver", "caller", activeSessionId);
    } catch (err: any) {
      addLog(`Caller setup error: ${err?.message}`, "error");
      setError({
        title: err?.friendlyTitle || "Setup Failed",
        detail:
          err?.friendlyDetail || err?.message || "Could not start the call.",
        recoverable: err?.recoverable ?? true,
      });
      setConnState("error");
    }
  }, [
    addLog,
    createPC,
    getLocalMedia,
    listenForIceCandidates,
    meetingDocId,
    userId,
    userName,
    writeIceCandidate,
    micEnabled,
    camEnabled,
  ]);

  // ── RECEIVER FLOW ───────────────────────────────────────────────────────────
  const startAsReceiver = useCallback(
    async (offerData: {
      sdp: string;
      type: RTCSdpType;
      callerName?: string;
      sessionId: string;
    }) => {
      try {
        const activeSessionId = offerData.sessionId;
        setSessionId(activeSessionId);
        sessionIdRef.current = activeSessionId;
        addLog(`=== RECEIVER FLOW STARTED (Session=${activeSessionId}) ===`, "info");
        
        if (offerData.callerName) setRemoteName(offerData.callerName);

        const stream = localStreamRef.current || await getLocalMedia();
        setOfferStatus("Received ✓");

        const pc = createPC(
          stream,
          (candidate) => writeIceCandidate(candidate, "receiver", activeSessionId),
          "receiver"
        );

        addLog("Setting remote description (offer)…", "info");
        await pc.setRemoteDescription(new RTCSessionDescription(offerData));
        addLog(
          `setRemoteDescription (offer) done. Signaling state: ${pc.signalingState}`,
          "ok"
        );

        addLog("Creating SDP answer…", "info");
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        addLog(
          `setLocalDescription (answer) done. Signaling state: ${pc.signalingState}`,
          "ok"
        );

        const answerData = {
          sdp: answer.sdp,
          type: answer.type,
          createdBy: userId,
          receiverName: userName,
          sessionId: activeSessionId,
        };
        addLog(
          `Writing answer to Firestore doc: ${meetingDocId}`,
          "info"
        );
        await updateDoc(doc(db, "meetings", meetingDocId), {
          answer: answerData,
          receiverMicEnabled: micEnabled,
          receiverCamEnabled: camEnabled,
        });
        setAnswerStatus("Created ✓");
        addLog("Answer written to Firestore ✓", "ok");

        setConnState("connecting");
        setRole("receiver");

        listenForIceCandidates("caller", "receiver", activeSessionId);
      } catch (err: any) {
        addLog(`Receiver setup error: ${err?.message}`, "error");
        setError({
          title: err?.friendlyTitle || "Join Failed",
          detail:
            err?.friendlyDetail ||
            err?.message ||
            "Could not join the call.",
          recoverable: err?.recoverable ?? true,
        });
        setConnState("error");
      }
    },
    [
      addLog,
      createPC,
      getLocalMedia,
      listenForIceCandidates,
      meetingDocId,
      userId,
      userName,
      writeIceCandidate,
      micEnabled,
      camEnabled,
    ]
  );

  // ── ENTRY GATE: Check participant status ────────────────────────────────────
  useEffect(() => {
    if (!meetingDocId || !userId) return;

    const checkEntry = async () => {
      addLog(`Checking entry for meetingDocId=${meetingDocId}`, "info");

      try {
        // 1. Verify meeting exists
        const meetingSnap = await getDoc(doc(db, "meetings", meetingDocId));
        if (!meetingSnap.exists()) {
          addLog("Meeting document does not exist", "error");
          setEntryStatus("error");
          return;
        }

        const meetingData = meetingSnap.data();
        const resolvedHostId = meetingData.hostId || meetingData.createdBy || "";
        setHostId(resolvedHostId);
        setMeetingDocExists(true);
        addLog(`Meeting found. hostId=${resolvedHostId}`, "ok");

        // 2. Check if current user is the host
        if (userId === resolvedHostId) {
          addLog("User is HOST — auto-approved", "ok");
          setEntryStatus("host");
          return;
        }

        // 3. Check if already in meetingParticipants
        const participantsQ = query(
          collection(db, "meetingParticipants"),
          where("meetingId", "==", meetingDocId),
          where("userId", "==", userId)
        );
        const participantsSnap = await getDocs(participantsQ);
        if (!participantsSnap.empty) {
          const pDoc = participantsSnap.docs[0];
          participantDocIdRef.current = pDoc.id;
          addLog("User found in meetingParticipants — approved", "ok");
          setEntryStatus("approved");
          return;
        }

        // 4. Check existing join request
        const jrQ = query(
          collection(db, "meetingJoinRequests"),
          where("meetingId", "==", meetingDocId),
          where("userId", "==", userId)
        );
        const jrSnap = await getDocs(jrQ);

        if (jrSnap.empty) {
          // No request yet — redirect back (should have clicked from dashboard)
          addLog("No join request found — redirecting to meetings", "warn");
          router.push(`/meetings?projectId=${projectId}`);
          return;
        }

        const jrDoc = jrSnap.docs[0];
        const jrData = jrDoc.data();

        if (jrData.status === "rejected") {
          addLog("Join request was rejected", "warn");
          setEntryStatus("rejected");
          return;
        }

        if (jrData.status === "approved") {
          // Create participant doc if not yet created
          const newPDoc = await addDoc(collection(db, "meetingParticipants"), {
            meetingId: meetingDocId,
            projectId,
            userId,
            userName,
            role: userRole || "member",
            isHost: false,
            joinedAt: serverTimestamp(),
            micEnabled: true,
            camEnabled: true,
          });
          participantDocIdRef.current = newPDoc.id;
          addLog("Participant doc created — entering approved flow", "ok");
          setEntryStatus("approved");
          return;
        }

        // Status is "pending" — show waiting screen & listen for changes
        addLog("Join request is pending — waiting for host approval", "info");
        setEntryStatus("waiting");

        // Realtime listener on join request document
        const jrUnsub = onSnapshot(doc(db, "meetingJoinRequests", jrDoc.id), async (snap) => {
          if (!snap.exists()) return;
          const data = snap.data();

          if (data.status === "approved") {
            addLog("Join request APPROVED by host! Entering room…", "ok");

            // Create participant doc
            const newPDoc = await addDoc(collection(db, "meetingParticipants"), {
              meetingId: meetingDocId,
              projectId,
              userId,
              userName,
              role: userRole || "member",
              isHost: false,
              joinedAt: serverTimestamp(),
              micEnabled: true,
              camEnabled: true,
            });
            participantDocIdRef.current = newPDoc.id;
            setEntryStatus("approved");
          } else if (data.status === "rejected") {
            addLog("Join request REJECTED by host", "warn");
            setEntryStatus("rejected");
          }
        });

        unsubscribersRef.current.push(jrUnsub);
      } catch (err: any) {
        addLog(`Entry check error: ${err?.message}`, "error");
        setEntryStatus("error");
      }
    };

    checkEntry();
  }, [meetingDocId, userId, projectId, userName, userRole, addLog, router]);

  // ── Start WebRTC once entry is approved ─────────────────────────────────────
  useEffect(() => {
    if (
      (entryStatus !== "host" && entryStatus !== "approved") ||
      hasStartedRef.current ||
      !meetingDocId ||
      !userId
    ) {
      return;
    }
    hasStartedRef.current = true;

    const initWebRTC = async () => {
      try {
        addLog(`WebRTC INIT — role check on doc: ${meetingDocId}`, "info");
        addLog(`userId: ${userId} | userName: ${userName}`, "info");

        // Top-level snapshot listener for media state sync, ends, answers, and restarts
        const meetingUnsub = onSnapshot(
          doc(db, "meetings", meetingDocId),
          async (snapshot) => {
            if (!snapshot.exists()) return;
            const docData = snapshot.data();

            // 1. Check if host ended the meeting
            if (docData.status === "ended") {
              addLog("Meeting ended by host", "warn");
              setError({
                title: "Meeting Ended",
                detail: "This meeting has been ended by the host.",
                recoverable: false,
              });
              setConnState("disconnected");
              cleanup(true);
              
              setTimeout(() => {
                router.push(`/meetings?projectId=${projectId}`);
              }, 3000);
              return;
            }

            // Sync meetingStartedAt
            if (docData.meetingStartedAt) {
              const startedAtVal = docData.meetingStartedAt.seconds 
                ? docData.meetingStartedAt.seconds * 1000 
                : docData.meetingStartedAt;
              setMeetingStartedAt(startedAtVal);
            }

            // Sync debug session IDs
            setMeetingSessionId(docData.sessionId || "None");
            setOfferSessionId(docData.offer?.sessionId || "None");
            setAnswerSessionId(docData.answer?.sessionId || "None");

            // 2. Sync media/name state based on roleRef
            const currentRole = roleRef.current;
            const isCaller = currentRole === "caller" || (docData.hostId === userId);

            if (isCaller) {
              if (docData.answer?.receiverName) setRemoteName(docData.answer.receiverName);
              if (docData.receiverMicEnabled !== undefined)
                setRemoteMicEnabled(docData.receiverMicEnabled);
              if (docData.receiverCamEnabled !== undefined)
                setRemoteCamEnabled(docData.receiverCamEnabled);
            } else {
              if (docData.offer?.callerName) setRemoteName(docData.offer.callerName);
              if (docData.callerMicEnabled !== undefined)
                setRemoteMicEnabled(docData.callerMicEnabled);
              if (docData.callerCamEnabled !== undefined)
                setRemoteCamEnabled(docData.callerCamEnabled);
            }

            // 3. Handle caller flow: setting remote description when answer is received
            if (isCaller && docData.answer && pcRef.current) {
              const isCorrectSession = docData.answer.sessionId === sessionIdRef.current;
              const isNotStable = pcRef.current.signalingState !== "stable";
              if (isCorrectSession && isNotStable) {
                addLog("Answer received from Firestore! Setting remote description…", "ok");
                try {
                  await pcRef.current.setRemoteDescription(
                    new RTCSessionDescription(docData.answer)
                  );
                  setAnswerStatus("Received ✓");
                  setConnState("connecting");
                  addLog(
                    `setRemoteDescription (answer) done. Signaling state: ${pcRef.current.signalingState}`,
                    "ok"
                  );
                } catch (e: any) {
                  addLog(
                    `setRemoteDescription (answer) error: ${e?.message}`,
                    "error"
                  );
                }
              }
            }

            // 4. Handle receiver flow: start/restart when new offer is received
            if (!isCaller && docData.offer) {
              const offerSessionId = docData.offer.sessionId;
              const currentSessionId = sessionIdRef.current;

              if (offerSessionId && offerSessionId !== currentSessionId) {
                addLog(`New offer session detected (${offerSessionId}). Recreating receiver connection...`, "info");
                await cleanup(false, true);
                await startAsReceiver(docData.offer);
              }
            }
          }
        );
        unsubscribersRef.current.push(meetingUnsub);

        const meetingSnap = await getDoc(doc(db, "meetings", meetingDocId));
        if (!meetingSnap.exists()) {
          throw new Error("Meeting document not found during WebRTC init");
        }
        const data = meetingSnap.data();
        addLog(
          `Meeting status: ${data.status} | hasOffer: ${!!data.offer} | hasAnswer: ${!!data.answer}`,
          "info"
        );

        if (data.offer && data.offer.createdBy !== userId) {
          addLog(
            `Role: RECEIVER — offer exists from user ${data.offer.createdBy}`,
            "ok"
          );
          await startAsReceiver(data.offer as {
            sdp: string;
            type: RTCSdpType;
            callerName?: string;
            sessionId: string;
          });
        } else {
          if (data.offer) {
            addLog(
              "Role: CALLER — offer exists but it's ours, re-entering as caller",
              "warn"
            );
          } else {
            addLog("Role: CALLER — no offer found yet", "ok");
          }
          await startAsCaller();
        }
      } catch (err: any) {
        addLog(`WebRTC init error: ${err?.message}`, "error");
        setError({
          title: "Initialization Error",
          detail: err?.message || "Could not initialize the call.",
          recoverable: true,
        });
        setConnState("error");
      }
    };

    initWebRTC();

    return () => {
      cleanup(false);
    };
  }, [
    entryStatus,
    meetingDocId,
    userId,
    userName,
    projectId,
    router,
    startAsCaller,
    startAsReceiver,
    cleanup,
    addLog,
  ]);

  // ── Session signaling cleanup helper ─────────────────────────────────────────
  const cleanupSessionSignaling = useCallback(async (sessionToClean: string) => {
    if (!meetingDocId || !sessionToClean) return;
    addLog(`Cleaning up signaling data for session: ${sessionToClean}`, "info");
    try {
      const meetingRef = doc(db, "meetings", meetingDocId);
      const meetingSnap = await getDoc(meetingRef);
      if (meetingSnap.exists()) {
        const meetingData = meetingSnap.data();
        const updates: any = {};
        
        if (meetingData.offer?.sessionId === sessionToClean) {
          updates.offer = null;
          updates.callerMicEnabled = null;
          updates.callerCamEnabled = null;
        }
        if (meetingData.answer?.sessionId === sessionToClean) {
          updates.answer = null;
          updates.receiverMicEnabled = null;
          updates.receiverCamEnabled = null;
        }
        if (meetingData.sessionId === sessionToClean) {
          updates.sessionId = null;
        }
        
        if (Object.keys(updates).length > 0) {
          await updateDoc(meetingRef, updates);
          addLog("Cleared offer/answer in meeting document", "ok");
        }
      }

      const candidatesQ = query(
        collection(db, "meetingCandidates"),
        where("meetingId", "==", meetingDocId),
        where("sessionId", "==", sessionToClean)
      );
      const candidatesSnap = await getDocs(candidatesQ);
      await Promise.all(candidatesSnap.docs.map(d => deleteDoc(d.ref)));
      addLog(`Deleted ${candidatesSnap.size} candidates for session`, "ok");
    } catch (e: any) {
      addLog(`Error during session signaling cleanup: ${e.message}`, "warn");
    }
  }, [meetingDocId, addLog]);

  // ── Leave call ──────────────────────────────────────────────────────────────
  const handleLeave = useCallback(async () => {
    const activeSession = sessionIdRef.current;
    if (activeSession) {
      await cleanupSessionSignaling(activeSession);
    }
    await cleanup(true);
    router.push(`/meetings?projectId=${projectId}`);
  }, [cleanup, cleanupSessionSignaling, router, projectId]);

  // ── End meeting (host only) ──────────────────────────────────────────────────
  const handleEndMeeting = useCallback(async () => {
    addLog("[Host] Ending meeting and cleaning up all temporary signaling...", "info");
    try {
      await updateDoc(doc(db, "meetings", meetingDocId), {
        status: "ended",
        offer: null,
        answer: null,
        callerMicEnabled: null,
        callerCamEnabled: null,
        receiverMicEnabled: null,
        receiverCamEnabled: null,
      });

      const deleteCollection = async (collName: string, field: string, value: string) => {
        const q = query(collection(db, collName), where(field, "==", value));
        const snap = await getDocs(q);
        await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
      };

      await deleteCollection("meetingCandidates", "meetingId", meetingDocId);
      await deleteCollection("meetingParticipants", "meetingId", meetingDocId);
      await deleteCollection("meetingJoinRequests", "meetingId", meetingDocId);

      addLog("[Host] Meeting ended and Firestore cleanup complete.", "ok");
    } catch (e: any) {
      addLog(`Failed to end meeting: ${e.message}`, "error");
    }
  }, [meetingDocId, addLog]);

  // ── Connection Recovery ─────────────────────────────────────────────────────
  const handleConnectionFailure = useCallback(async () => {
    if (isRecoveringRef.current) return;
    isRecoveringRef.current = true;
    addLog("Connection failure detected. Triggering automatic recovery...", "warn");
    
    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.onsignalingstatechange = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.onicegatheringstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    setRemoteJoined(false);
    setRemoteStreamReady(false);
    setConnState("connecting");

    const oldSessionId = sessionIdRef.current;
    try {
      if (roleRef.current === "caller") {
        await updateDoc(doc(db, "meetings", meetingDocId), {
          offer: null,
          answer: null,
          callerMicEnabled: null,
          callerCamEnabled: null,
          receiverMicEnabled: null,
          receiverCamEnabled: null,
        });
      }
      
      if (oldSessionId) {
        const q = query(
          collection(db, "meetingCandidates"),
          where("meetingId", "==", meetingDocId),
          where("sessionId", "==", oldSessionId)
        );
        const snap = await getDocs(q);
        await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
      }
    } catch (e: any) {
      console.warn("Failed to clear old signaling session:", e);
    }

    if (roleRef.current === "caller") {
      const newSessionId = crypto.randomUUID();
      addLog(`[Recovery] Host starting new session: ${newSessionId}`, "info");
      await startAsCaller(newSessionId);
    } else {
      addLog("[Recovery] Guest waiting for host to write new offer session...", "info");
    }
    
    isRecoveringRef.current = false;
  }, [meetingDocId, startAsCaller, addLog]);
  handleConnectionFailureRef.current = handleConnectionFailure;

  // ── Sync local media status to Firestore ────────────────────────────────────
  const updateLocalMediaStatus = useCallback(
    async (newMic: boolean, newCam: boolean) => {
      if (!meetingDocId || !role) return;
      try {
        const fieldPrefix = role === "caller" ? "caller" : "receiver";
        await updateDoc(doc(db, "meetings", meetingDocId), {
          [`${fieldPrefix}MicEnabled`]: newMic,
          [`${fieldPrefix}CamEnabled`]: newCam,
        });

        // Also update participant doc
        if (participantDocIdRef.current) {
          await updateDoc(
            doc(db, "meetingParticipants", participantDocIdRef.current),
            { micEnabled: newMic, camEnabled: newCam }
          );
        }
        addLog(
          `Updated Firestore media status: mic=${newMic}, cam=${newCam}`,
          "info"
        );
      } catch (e: any) {
        addLog(`Failed to update Firestore media status: ${e.message}`, "warn");
      }
    },
    [role, meetingDocId, addLog]
  );

  // ── Toggles ─────────────────────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      const newMic = audioTrack.enabled;
      setMicEnabled(newMic);
      addLog(`Mic ${newMic ? "unmuted" : "muted"}`, "info");
      updateLocalMediaStatus(newMic, camEnabled);
    }
  }, [camEnabled, updateLocalMediaStatus, addLog]);

  const toggleCam = useCallback(() => {
    if (!localStreamRef.current) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      const newCam = videoTrack.enabled;
      setCamEnabled(newCam);
      addLog(`Camera ${newCam ? "on" : "off"}`, "info");
      updateLocalMediaStatus(micEnabled, newCam);
    }
  }, [micEnabled, updateLocalMediaStatus, addLog]);

  // ── Show Entry Gate for non-webrtc states ───────────────────────────────────
  if (
    entryStatus === "checking" ||
    entryStatus === "waiting" ||
    entryStatus === "rejected" ||
    entryStatus === "error"
  ) {
    return (
      <EntryGateScreen
        entryStatus={entryStatus}
        meetingName={meetingName}
        onBack={() => router.push("/meetings")}
      />
    );
  }

  // ── Render Video Room ───────────────────────────────────────────────────────
  const isConnected =
    connState === "connected" ||
    (remoteStreamReady && remoteTrackCount > 0);
  const isWaiting =
    connState === "waiting" && !(remoteStreamReady && remoteTrackCount > 0);
  const isError =
    connState === "error" || connState === "failed";
  const isLoading =
    ["idle", "requesting-media", "creating-offer", "connecting"].includes(
      connState
    ) && !(remoteStreamReady && remoteTrackCount > 0);

  const logLevelIcon = (level: LogEntry["level"]) => {
    if (level === "ok")
      return (
        <CheckCircle2 className="h-3 w-3 text-green-400 shrink-0 mt-0.5" />
      );
    if (level === "error")
      return (
        <XCircle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />
      );
    if (level === "warn")
      return (
        <AlertCircle className="h-3 w-3 text-yellow-400 shrink-0 mt-0.5" />
      );
    return (
      <div className="h-3 w-3 rounded-full bg-white/30 shrink-0 mt-0.5" />
    );
  };

  return (
    <div className="h-screen w-screen bg-zinc-950 flex flex-col overflow-hidden select-none relative">
      {/* ── Top Bar ──────────────────────────────────────────────────────────── */}
      <header className="shrink-0 flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 bg-zinc-900/80 backdrop-blur-sm relative z-20">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push("/meetings")}
            className="gap-2 text-white/60 hover:text-white hover:bg-white/10 shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back</span>
          </Button>

          <div className="h-4 w-px bg-white/20 shrink-0" />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-white truncate">
                {meetingName}
              </span>
              {entryStatus === "host" && (
                <Badge variant="outline" className="shrink-0 text-[10px] border-primary/40 text-primary gap-1">
                  <Shield className="h-2.5 w-2.5" /> Host
                </Badge>
              )}
            </div>
            <div
              className={cn(
                "flex items-center gap-1.5 text-xs mt-0.5",
                CONN_STATE_COLOR[connState]
              )}
            >
              {isConnected ? (
                <>
                  <div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />
                  {CONN_STATE_LABEL.connected}
                </>
              ) : isWaiting ? (
                <>
                  <Wifi className="h-3 w-3 animate-pulse" />
                  {CONN_STATE_LABEL.waiting}
                </>
              ) : isError ? (
                <>
                  <WifiOff className="h-3 w-3" />
                  {CONN_STATE_LABEL[connState]}
                </>
              ) : (
                <>
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {CONN_STATE_LABEL[connState]}
                </>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDebug(!showDebug)}
            className={cn(
              "h-8 gap-1.5 text-xs",
              showDebug
                ? "text-green-400 bg-green-400/10"
                : "text-white/40 hover:text-white hover:bg-white/10"
            )}
            title="Toggle Debug Panel"
          >
            <Terminal className="h-3.5 w-3.5" />
            Debug
          </Button>
          {isConnected && (
            <div className="flex items-center gap-1.5 text-sm font-mono text-white/60 shrink-0">
              <Clock className="h-3.5 w-3.5" />
              {formatDuration(duration)}
            </div>
          )}
        </div>
      </header>

      {/* ── Layout: Video + Debug side-by-side ──────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">
        {/* ── Video Area ───────────────────────────────────────────────────── */}
        <main className="flex-1 relative overflow-hidden bg-zinc-900">
          {/* Host approval panel */}
          {entryStatus === "host" && (
            <AnimatePresence>
              <HostApprovalPanel
                meetingDocId={meetingDocId}
                projectId={projectId}
              />
            </AnimatePresence>
          )}

          {/* Participants panel */}
          {meetingDocExists && (
            <ParticipantsPanel
              participants={participants}
              hostId={hostId}
              currentUserId={userId}
            />
          )}

          {/* ── Remote video — ALWAYS in DOM ──────────────────────────────── */}
          <video
            ref={remoteVideoRef}
            autoPlay
            playsInline
            muted={false}
            controls={false}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
              remoteJoined && remoteCamEnabled ? "opacity-100" : "opacity-0"
            )}
          />

          {/* ── Remote camera off avatar placeholder ─────────────────────── */}
          {remoteJoined && !remoteCamEnabled && (
            <div className="absolute inset-0 bg-zinc-900 flex flex-col items-center justify-center gap-4 z-10 animate-fade-in">
              <div className="h-32 w-32 rounded-full bg-gradient-to-tr from-primary to-purple-600 flex items-center justify-center ring-4 ring-white/10 shadow-2xl">
                <span className="text-white text-4xl font-semibold uppercase select-none">
                  {remoteName ? remoteName.slice(0, 2) : "P"}
                </span>
              </div>
              <div className="text-center">
                <p className="text-white font-medium text-lg">{remoteName}</p>
                <p className="text-white/40 text-xs uppercase tracking-wider mt-1">
                  {role === "caller" ? "Receiver" : "Caller"}
                </p>
              </div>
            </div>
          )}

          {/* ── Waiting / Loading overlay ────────────────────────────────── */}
          <AnimatePresence>
            {!remoteJoined && !isError && (
              <motion.div
                key="waiting-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-5"
              >
                <div className="relative">
                  <div className="h-24 w-24 rounded-full bg-white/10 flex items-center justify-center ring-4 ring-white/10">
                    <User className="h-12 w-12 text-white/40" />
                  </div>
                  {(isLoading || isWaiting) && (
                    <div className="absolute inset-0 rounded-full border-2 border-primary/60 animate-ping" />
                  )}
                </div>
                <div className="text-center space-y-1.5 px-4">
                  <p className="text-white font-semibold text-lg">
                    {isWaiting
                      ? "Waiting for participant…"
                      : CONN_STATE_LABEL[connState]}
                  </p>
                  <p className="text-white/40 text-sm">
                    {isWaiting
                      ? "Share the meeting with your colleague to connect."
                      : "Please wait while we set up your connection."}
                  </p>
                </div>
                {isLoading && (
                  <Loader2 className="h-6 w-6 text-primary/60 animate-spin mt-2" />
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Error overlay ────────────────────────────────────────────── */}
          <AnimatePresence>
            {isError && error && (
              <motion.div
                key="error-overlay"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-8 text-center"
              >
                <div className="h-16 w-16 rounded-2xl bg-red-500/15 flex items-center justify-center">
                  <AlertCircle className="h-8 w-8 text-red-400" />
                </div>
                <div className="space-y-2 max-w-sm">
                  <p className="text-white font-semibold text-xl">
                    {error.title}
                  </p>
                  <p className="text-white/60 text-sm leading-relaxed">
                    {error.detail}
                  </p>
                </div>
                <div className="flex gap-3 mt-2">
                  {error.recoverable && (
                    <Button
                      onClick={() => {
                        hasStartedRef.current = false;
                        setError(null);
                        setConnState("idle");
                        setRemoteJoined(false);
                        setLocalReady(false);
                        setRole(null);
                        window.location.reload();
                      }}
                      className="gap-2"
                    >
                      Retry
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => router.push("/meetings")}
                    className="gap-2 border-white/20 text-white hover:bg-white/10"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Remote participant name badge ──────────────────────────── */}
          {remoteJoined && (
            <div className="absolute top-4 left-4 z-20">
              <div className="flex items-center gap-2 bg-black/70 backdrop-blur-md rounded-lg px-3 py-1.5 border border-white/10 animate-fade-in">
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                <div className="h-5 w-5 rounded-full bg-gradient-to-tr from-primary to-purple-600 flex items-center justify-center text-[10px] text-white font-bold uppercase select-none">
                  {remoteName ? remoteName.slice(0, 1) : "P"}
                </div>
                <span className="text-sm text-white font-medium">
                  {remoteName}
                </span>
                <span className="text-[10px] text-white/40 bg-white/10 rounded px-1.5 py-0.5 uppercase tracking-wider shrink-0">
                  {role === "caller" ? "Receiver" : "Caller"}
                </span>
                <div className="flex items-center gap-1.5 ml-1 border-l border-white/20 pl-2">
                  {remoteMicEnabled ? (
                    <Mic className="h-3.5 w-3.5 text-green-400" />
                  ) : (
                    <MicOff className="h-3.5 w-3.5 text-red-400 animate-pulse" />
                  )}
                  {remoteCamEnabled ? (
                    <Video className="h-3.5 w-3.5 text-green-400" />
                  ) : (
                    <VideoOff className="h-3.5 w-3.5 text-red-400 animate-pulse" />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Local video PiP — ALWAYS in DOM ──────────────────────────── */}
          <div
            className={cn(
              "absolute bottom-24 right-4 sm:bottom-28 sm:right-6 z-20",
              "w-28 sm:w-36 md:w-44 aspect-video",
              "rounded-xl overflow-hidden border-2 shadow-2xl",
              "bg-zinc-800 transition-all duration-300",
              localReady
                ? "opacity-100 translate-y-0 border-white/20"
                : "opacity-0 translate-y-4 pointer-events-none border-transparent"
            )}
          >
            <video
              ref={localVideoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
              style={{ transform: "scaleX(-1)" }}
            />
            {!camEnabled && (
              <div className="absolute inset-0 bg-zinc-800 flex flex-col items-center justify-center gap-1">
                <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center">
                  <VideoOff className="h-4 w-4 text-white/40" />
                </div>
                <span className="text-[10px] text-white/40">Camera Off</span>
              </div>
            )}
            <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between gap-1 bg-black/75 rounded px-2 py-0.5">
              <span className="text-[10px] text-white/90 font-medium truncate max-w-[60%]">
                {userName} (You)
              </span>
              <div className="flex items-center gap-1 shrink-0">
                {micEnabled ? (
                  <Mic className="h-3 w-3 text-green-400" />
                ) : (
                  <MicOff className="h-3 w-3 text-red-400" />
                )}
                {camEnabled ? (
                  <Video className="h-3 w-3 text-green-400" />
                ) : (
                  <VideoOff className="h-3 w-3 text-red-400" />
                )}
              </div>
            </div>
          </div>
        </main>

        {/* ── Debug Panel ─────────────────────────────────────────────────────── */}
        {showDebug && (
          <aside className="w-80 shrink-0 bg-zinc-950 border-l border-white/10 flex flex-col text-xs font-mono overflow-hidden">
            {/* Sessions info */}
            <div className="p-3 border-b border-white/10 space-y-1">
              <div className="text-white/40 text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1">
                <Terminal className="h-3 w-3" /> WebRTC Debug
                <span className="ml-auto text-white/30">
                  Role: {role || "—"} | Entry: {entryStatus}
                </span>
              </div>
              
              <div className="space-y-1.5 text-[10px] bg-black/20 p-2 rounded-lg border border-white/5">
                <div className="flex flex-col">
                  <span className="text-white/30 text-[9px]">Meeting ID</span>
                  <span className="text-white truncate select-all" title={meetingDocId}>{meetingDocId}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-white/30 text-[9px]">Session ID</span>
                  <span className="text-white truncate select-all" title={sessionId}>{sessionId || "None"}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-white/30 text-[9px]">Offer Session ID</span>
                  <span className="text-white truncate select-all" title={offerSessionId}>{offerSessionId || "None"}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-white/30 text-[9px]">Answer Session ID</span>
                  <span className="text-white truncate select-all" title={answerSessionId}>{answerSessionId || "None"}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-white/30 text-[9px]">ICE Candidate Session ID</span>
                  <span className="text-white truncate select-all" title={sessionId}>{sessionId || "None"}</span>
                </div>
              </div>
            </div>

            {/* Status grid */}
            <div className="p-3 border-b border-white/10 space-y-1">
              <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">
                Media Status
              </div>
              {[
                ["Local Stream Ready", localStreamReady],
                ["Remote Stream Ready", remoteStreamReady],
                [
                  "Local Video Attached",
                  !!(
                    localVideoRef.current && localVideoRef.current.srcObject
                  ),
                ],
                [
                  "Remote Video Attached",
                  !!(
                    remoteVideoRef.current && remoteVideoRef.current.srcObject
                  ),
                ],
                ["Local Video Playing", localVideoPlaying],
                ["Remote Video Playing", remoteVideoPlaying],
              ].map(([label, val]) => (
                <div
                  key={label as string}
                  className="flex items-center justify-between"
                >
                  <span className="text-white/50">{label as string}</span>
                  <span className={val ? "text-green-400" : "text-white/30"}>
                    {val ? "✓ Yes" : "No"}
                  </span>
                </div>
              ))}

              <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 pt-2 border-t border-white/5">
                {[
                  ["Offer Doc", offerStatus],
                  ["Answer Doc", answerStatus],
                  ["Caller Gen ICE", callerIceGenCount],
                  ["Caller Recv ICE", callerIceRecvCount],
                  ["Caller Add ICE", callerIceAddCount],
                  ["Receiver Gen ICE", receiverIceGenCount],
                  ["Receiver Recv ICE", receiverIceRecvCount],
                  ["Receiver Add ICE", receiverIceAddCount],
                  ["Tracks Local", localTrackCount],
                  ["Tracks Remote", remoteTrackCount],
                ].map(([label, val]) => (
                  <div key={label as string} className="flex flex-col">
                    <span className="text-white/30 text-[9px]">
                      {label as string}
                    </span>
                    <span className="text-white">{String(val) || "—"}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* State indicators */}
            <div className="p-3 border-b border-white/10 space-y-1">
              <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">
                States & Diagnostics
              </div>
              {[
                ["PC Conn", pcConnState],
                ["Signaling", pcSignalingState],
                ["ICE Conn", pcIceConnState],
                ["ICE Gather", pcIceGatherState],
                ["Participants", participants.length],
                ["Timer", formatDuration(duration)],
              ].map(([label, val]) => {
                const isGood =
                  val === "connected" ||
                  val === "completed" ||
                  val === "stable" ||
                  (label === "Participants" && Number(val) > 0);
                const isBad = val === "failed" || val === "closed";
                return (
                  <div
                    key={label as string}
                    className="flex justify-between items-center"
                  >
                    <span className="text-white/50">{label as string}</span>
                    <span
                      className={cn(
                        "font-medium",
                        isGood
                          ? "text-green-400"
                          : isBad
                          ? "text-red-400"
                          : "text-yellow-400"
                      )}
                    >
                      {String(val) || "—"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Scrollable log */}
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1 px-1">
                Event Log
              </div>
              {debugLogs.length === 0 && (
                <div className="text-white/20 text-center py-4">
                  No events yet…
                </div>
              )}
              {[...debugLogs].reverse().map((entry, i) => (
                <div key={i} className="flex gap-1.5 items-start">
                  {logLevelIcon(entry.level)}
                  <span className="text-white/30 shrink-0">{entry.time}</span>
                  <span
                    className={cn(
                      "break-all",
                      entry.level === "ok"
                        ? "text-green-300"
                        : entry.level === "error"
                        ? "text-red-300"
                        : entry.level === "warn"
                        ? "text-yellow-300"
                        : "text-white/70"
                    )}
                  >
                    {entry.msg}
                  </span>
                </div>
              ))}
            </div>
          </aside>
        )}
      </div>

      {/* ── Bottom Toolbar ───────────────────────────────────────────────────── */}
      <footer className="shrink-0 flex items-center justify-center gap-3 px-4 py-4 bg-zinc-900/95 border-t border-white/10 backdrop-blur-sm relative z-20">
        <Button
          onClick={toggleMic}
          variant="ghost"
          size="icon"
          disabled={!localReady}
          title={micEnabled ? "Mute microphone" : "Unmute microphone"}
          className={cn(
            "h-12 w-12 rounded-full transition-all duration-200",
            micEnabled
              ? "bg-white/10 hover:bg-white/20 text-white"
              : "bg-red-500/20 hover:bg-red-500/30 text-red-400 ring-1 ring-red-500/40"
          )}
        >
          {micEnabled ? (
            <Mic className="h-5 w-5" />
          ) : (
            <MicOff className="h-5 w-5" />
          )}
        </Button>

        <Button
          onClick={toggleCam}
          variant="ghost"
          size="icon"
          disabled={!localReady}
          title={camEnabled ? "Turn off camera" : "Turn on camera"}
          className={cn(
            "h-12 w-12 rounded-full transition-all duration-200",
            camEnabled
              ? "bg-white/10 hover:bg-white/20 text-white"
              : "bg-red-500/20 hover:bg-red-500/30 text-red-400 ring-1 ring-red-500/40"
          )}
        >
          {camEnabled ? (
            <Video className="h-5 w-5" />
          ) : (
            <VideoOff className="h-5 w-5" />
          )}
        </Button>

        {entryStatus === "host" && (
          <Button
            onClick={handleEndMeeting}
            title="End meeting for all"
            className="h-12 w-12 sm:w-auto sm:px-6 rounded-full bg-red-600 hover:bg-red-700 text-white gap-2 transition-all duration-200 shrink-0 font-medium"
          >
            <PhoneOff className="h-5 w-5 animate-pulse" />
            <span className="hidden sm:inline">End Meeting</span>
          </Button>
        )}

        <Button
          onClick={handleLeave}
          variant={entryStatus === "host" ? "outline" : "default"}
          title="Leave call"
          className={cn(
            "h-12 w-12 sm:w-auto sm:px-6 rounded-full gap-2 transition-all duration-200 shrink-0 font-medium",
            entryStatus === "host"
              ? "border-white/20 text-white/70 hover:bg-white/10 hover:text-white"
              : "bg-red-600 hover:bg-red-700 text-white"
          )}
        >
          {entryStatus === "host" ? <X className="h-5 w-5" /> : <PhoneOff className="h-5 w-5" />}
          <span className="hidden sm:inline">
            {entryStatus === "host" ? "Leave Room Only" : "Leave"}
          </span>
        </Button>
      </footer>
    </div>
  );
}
