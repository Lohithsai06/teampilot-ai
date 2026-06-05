"use client";

/**
 * TeamPilot AI — WebRTC Video Call Room (Fireship Architecture)
 *
 * Architecture:
 *   - Both Offer and Answer are stored directly in the `meetings/{meetingId}` document.
 *   - ICE candidates are stored in a root collection `meetingCandidates`.
 *   - Caller writes `offer` to the meeting doc, and ICE candidates to `meetingCandidates` with type="caller".
 *   - Receiver reads `offer`, writes `answer` to the meeting doc, and ICE candidates with type="receiver".
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
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  AlertCircle,
  ArrowLeft,
  Clock,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  User,
  Video,
  VideoOff,
  Wifi,
  WifiOff,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";

// ─── WebRTC STUN configuration ────────────────────────────────────────────────
const RTC_CONFIG: RTCConfiguration = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
      ],
    },
  ],
  iceCandidatePoolSize: 10,
};

// ─── Types ────────────────────────────────────────────────────────────────────
type CallRole = "caller" | "receiver" | null;
type ConnState = "idle" | "requesting-media" | "creating-offer" | "waiting" | "connecting" | "connected" | "disconnected" | "failed" | "error";

interface ErrorInfo {
  title: string;
  detail: string;
  recoverable: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
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

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MeetingRoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const meetingId = params?.roomId as string;
  const projectId = searchParams?.get("projectId") || "";
  const meetingName = decodeURIComponent(searchParams?.get("name") || "Team Meeting");

  // ── Refs ───────────────────────────────────────────────────────────────────
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const unsubscribersRef = useRef<Array<() => void>>([]);
  const joinedAtRef = useRef<number>(Date.now());
  const hasStartedRef = useRef(false);
  // Stores the real Firestore auto-generated document ID (different from the
  // custom meetingId code used in the URL, e.g. "PPY13J")
  const firestoreDocIdRef = useRef<string>("");

  // ── State ──────────────────────────────────────────────────────────────────
  const [connState, setConnState] = useState<ConnState>("idle");
  const [error, setError] = useState<ErrorInfo | null>(null);
  const [role, setRole] = useState<CallRole>(null);
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);
  const [duration, setDuration] = useState(0);
  const [remoteJoined, setRemoteJoined] = useState(false);
  const [localReady, setLocalReady] = useState(false);
  const [showDebug, setShowDebug] = useState(false);

  // ── Debug State ────────────────────────────────────────────────────────────
  const [offerStatus, setOfferStatus] = useState("None");
  const [answerStatus, setAnswerStatus] = useState("None");
  const [iceCandidateCount, setIceCandidateCount] = useState(0);
  const [pcConnState, setPcConnState] = useState("");
  const [pcSignalingState, setPcSignalingState] = useState("");
  const [pcIceConnState, setPcIceConnState] = useState("");

  const userId = user?.uid || "";
  const userName = user?.displayName || user?.email?.split("@")[0] || "Anonymous";

  // ── Duration timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (connState !== "connected") return;
    const id = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(id);
  }, [connState]);

  // ── Cleanup helper ─────────────────────────────────────────────────────────
  const cleanup = useCallback(async (saveHistory = true) => {
    unsubscribersRef.current.forEach((unsub) => unsub());
    unsubscribersRef.current = [];

    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;

    if (pcRef.current) {
      pcRef.current.onicecandidate = null;
      pcRef.current.ontrack = null;
      pcRef.current.onconnectionstatechange = null;
      pcRef.current.onsignalingstatechange = null;
      pcRef.current.oniceconnectionstatechange = null;
      pcRef.current.close();
      pcRef.current = null;
    }

    if (saveHistory && userId) {
      try {
        const durationSecs = Math.floor((Date.now() - joinedAtRef.current) / 1000);
        await addDoc(collection(db, "meetingHistory"), {
          projectId,
          meetingId,
          participantId: userId,
          participantName: userName,
          duration: durationSecs,
          endedAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn("[WebRTC] Could not save meeting history:", e);
      }
    }
  }, [meetingId, projectId, userId, userName]);

  // ── Media access ───────────────────────────────────────────────────────────
  const getLocalMedia = useCallback(async (): Promise<MediaStream> => {
    setConnState("requesting-media");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      setLocalReady(true);
      return stream;
    } catch (err: any) {
      const name = err?.name || "";
      if (name === "NotAllowedError" || name === "PermissionDeniedError") {
        throw Object.assign(new Error("Camera/microphone permission denied"), {
          friendlyTitle: "Permission Denied",
          friendlyDetail: "Allow camera and microphone access in your browser settings, then reload.",
          recoverable: false,
        });
      }
      if (name === "NotFoundError" || name === "DevicesNotFoundError") {
        throw Object.assign(new Error("No camera/microphone found"), {
          friendlyTitle: "No Media Devices",
          friendlyDetail: "No camera or microphone was detected. Please connect a device and try again.",
          recoverable: false,
        });
      }
      throw Object.assign(err, {
        friendlyTitle: "Media Error",
        friendlyDetail: err?.message || "Could not access your camera or microphone.",
        recoverable: true,
      });
    }
  }, []);

  // ── Create RTCPeerConnection ───────────────────────────────────────────────
  const createPC = useCallback((
    stream: MediaStream,
    onIceCandidate: (candidate: RTCIceCandidate) => void
  ): RTCPeerConnection => {
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    stream.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        setIceCandidateCount((prev) => prev + 1);
        onIceCandidate(event.candidate);
      }
    };

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setRemoteJoined(true);
        setConnState("connected");
      }
    };

    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      setPcConnState(state);
      console.log("[WebRTC] Connection state:", state);
      if (state === "connected") setConnState("connected");
      if (state === "connecting") setConnState("connecting");
      if (state === "disconnected" || state === "closed") setConnState("disconnected");
      if (state === "failed") setConnState("failed");
    };

    pc.onsignalingstatechange = () => {
      setPcSignalingState(pc.signalingState);
    };

    pc.oniceconnectionstatechange = () => {
      setPcIceConnState(pc.iceConnectionState);
    };

    setPcConnState(pc.connectionState);
    setPcSignalingState(pc.signalingState);
    setPcIceConnState(pc.iceConnectionState);

    return pc;
  }, []);

  // ── ICE candidate writer ───────────────────────────────────────────────────
  const writeIceCandidate = useCallback(async (candidate: RTCIceCandidate, type: "caller" | "receiver") => {
    try {
      await addDoc(collection(db, "meetingCandidates"), {
        meetingId,
        userId,
        type,
        candidate: candidate.toJSON(),
        createdAt: serverTimestamp(),
      });
    } catch (e) {
      console.warn("[WebRTC] Failed to write ICE candidate:", e);
    }
  }, [meetingId, userId]);

  // ── ICE candidate reader ───────────────────────────────────────────────────
  const listenForIceCandidates = useCallback((listenForType: "caller" | "receiver") => {
    const q = query(
      collection(db, "meetingCandidates"),
      where("meetingId", "==", meetingId),
      where("type", "==", listenForType)
    );
    const unsub = onSnapshot(q, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === "added" && pcRef.current) {
          const data = change.doc.data();
          const candidate = new RTCIceCandidate(data.candidate);
          pcRef.current.addIceCandidate(candidate).catch((e) => {
            console.warn("[WebRTC] addIceCandidate error:", e);
          });
        }
      });
    });
    unsubscribersRef.current.push(unsub);
  }, [meetingId]);

  // ── CALLER FLOW ────────────────────────────────────────────────────────────
  // firestoreDocId = the real Firestore auto-generated document ID
  const startAsCaller = useCallback(async (firestoreDocId: string) => {
    try {
      const stream = await getLocalMedia();
      setConnState("creating-offer");

      const pc = createPC(stream, (candidate) => writeIceCandidate(candidate, "caller"));

      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const offerData = { sdp: offer.sdp, type: offer.type, createdBy: userId };
      console.log("[WebRTC] Writing offer to Firestore doc:", firestoreDocId);
      await updateDoc(doc(db, "meetings", firestoreDocId), { offer: offerData });
      setOfferStatus("Created");

      setConnState("waiting");
      setRole("caller");

      // Listen for the receiver's answer on the same Firestore document
      const meetingUnsub = onSnapshot(doc(db, "meetings", firestoreDocId), async (snapshot) => {
        if (!snapshot.exists() || !pcRef.current) return;
        const data = snapshot.data();
        if (data?.answer && pcRef.current.signalingState !== "stable") {
          try {
            console.log("[WebRTC] Answer received, setting remote description");
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
            setAnswerStatus("Received");
            setConnState("connecting");
          } catch (e) {
            console.error("[WebRTC] setRemoteDescription (answer) error:", e);
          }
        }
      });
      unsubscribersRef.current.push(meetingUnsub);

      listenForIceCandidates("receiver");
    } catch (err: any) {
      console.error("[WebRTC] Caller setup error:", err);
      setError({
        title: err?.friendlyTitle || "Setup Failed",
        detail: err?.friendlyDetail || err?.message || "Could not start the call.",
        recoverable: err?.recoverable ?? true,
      });
      setConnState("error");
    }
  }, [createPC, getLocalMedia, listenForIceCandidates, userId, writeIceCandidate]);

  // ── RECEIVER FLOW ──────────────────────────────────────────────────────────
  // firestoreDocId = the real Firestore auto-generated document ID
  const startAsReceiver = useCallback(async (offerData: { sdp: string; type: RTCSdpType }, firestoreDocId: string) => {
    try {
      const stream = await getLocalMedia();
      setOfferStatus("Received");

      const pc = createPC(stream, (candidate) => writeIceCandidate(candidate, "receiver"));

      await pc.setRemoteDescription(new RTCSessionDescription(offerData));

      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);

      const answerData = { sdp: answer.sdp, type: answer.type, createdBy: userId };
      console.log("[WebRTC] Writing answer to Firestore doc:", firestoreDocId);
      await updateDoc(doc(db, "meetings", firestoreDocId), { answer: answerData });
      setAnswerStatus("Created");

      setConnState("connecting");
      setRole("receiver");

      listenForIceCandidates("caller");
    } catch (err: any) {
      console.error("[WebRTC] Receiver setup error:", err);
      setError({
        title: err?.friendlyTitle || "Join Failed",
        detail: err?.friendlyDetail || err?.message || "Could not join the call.",
        recoverable: err?.recoverable ?? true,
      });
      setConnState("error");
    }
  }, [createPC, getLocalMedia, listenForIceCandidates, userId, writeIceCandidate]);

  // ── Entry point ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!meetingId || !userId || hasStartedRef.current) return;
    hasStartedRef.current = true;

    const init = async () => {
      try {
        // ── DEBUG LOGGING ──────────────────────────────────────────────────
        console.log("[WebRTC] roomId from URL:", meetingId);
        console.log("[WebRTC] projectId from URL:", projectId);
        console.log("[WebRTC] Querying Firestore: meetings WHERE meetingId ==", meetingId);

        // Meetings are created with addDoc (auto Firestore doc ID) + a custom
        // `meetingId` field (the short code like PPY13J used in the URL).
        // We MUST query by field, not by doc ID.
        const q = query(
          collection(db, "meetings"),
          where("meetingId", "==", meetingId)
        );
        const snap = await getDocs(q);

        console.log("[WebRTC] Firestore query results — docs found:", snap.size);

        if (snap.empty) {
          console.error("[WebRTC] No meeting found with meetingId ==", meetingId);
          throw new Error(`Meeting "${meetingId}" not found. Make sure you have the correct meeting code.`);
        }

        const meetingDocSnap = snap.docs[0];
        const firestoreDocId = meetingDocSnap.id;
        firestoreDocIdRef.current = firestoreDocId;
        const data = meetingDocSnap.data();

        console.log("[WebRTC] Firestore doc ID:", firestoreDocId);
        console.log("[WebRTC] Meeting data:", JSON.stringify({ status: data.status, hasOffer: !!data.offer, hasAnswer: !!data.answer }));

        // Decide role: if an offer already exists and it's not ours, we are receiver
        if (data.offer && data.offer.createdBy !== userId) {
          console.log("[WebRTC] Role: RECEIVER — offer found from another user");
          await startAsReceiver(data.offer as { sdp: string; type: RTCSdpType }, firestoreDocId);
        } else {
          console.log("[WebRTC] Role: CALLER — no offer found or offer is ours");
          await startAsCaller(firestoreDocId);
        }
      } catch (err: any) {
        console.error("[WebRTC] Init error:", err);
        setError({
          title: "Initialization Error",
          detail: err?.message || "Could not initialize the call.",
          recoverable: true,
        });
        setConnState("error");
      }
    };

    init();

    return () => {
      cleanup(false);
    };
  }, [meetingId, projectId, userId, startAsCaller, startAsReceiver, cleanup]);

  // ── Leave call ─────────────────────────────────────────────────────────────
  const handleLeave = useCallback(async () => {
    await cleanup(true);
    router.push("/meetings");
  }, [cleanup, router]);

  // ── Toggles ────────────────────────────────────────────────────────────────
  const toggleMic = useCallback(() => {
    if (!localStreamRef.current) return;
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setMicEnabled(audioTrack.enabled);
    }
  }, []);

  const toggleCam = useCallback(() => {
    if (!localStreamRef.current) return;
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setCamEnabled(videoTrack.enabled);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // ── RENDER ────────────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────────────────────

  const isConnected = connState === "connected";
  const isWaiting = connState === "waiting";
  const isError = connState === "error" || connState === "failed";
  const isLoading = ["idle", "requesting-media", "creating-offer", "connecting"].includes(connState);

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
              <span className="font-semibold text-white truncate">{meetingName}</span>
              <span className="hidden sm:inline text-xs text-white/40 font-mono shrink-0">
                #{meetingId}
              </span>
            </div>
            <div className={cn("flex items-center gap-1.5 text-xs mt-0.5", CONN_STATE_COLOR[connState])}>
              {isConnected
                ? <><div className="h-1.5 w-1.5 rounded-full bg-green-400 animate-pulse" />{CONN_STATE_LABEL.connected}</>
                : isWaiting
                  ? <><Wifi className="h-3 w-3 animate-pulse" />{CONN_STATE_LABEL.waiting}</>
                  : isError
                    ? <><WifiOff className="h-3 w-3" />{CONN_STATE_LABEL[connState]}</>
                    : <><Loader2 className="h-3 w-3 animate-spin" />{CONN_STATE_LABEL[connState]}</>
              }
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Debug Panel Toggle */}
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => setShowDebug(!showDebug)}
            className="text-white/40 hover:text-white hover:bg-white/10 h-8"
            title="Toggle Debugging Panel"
          >
            <Terminal className="h-4 w-4" />
          </Button>

          {/* Duration */}
          {isConnected && (
            <div className="flex items-center gap-1.5 text-sm font-mono text-white/60 shrink-0">
              <Clock className="h-3.5 w-3.5" />
              {formatDuration(duration)}
            </div>
          )}
        </div>
      </header>

      {/* ── Debugging Panel ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {showDebug && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-16 right-4 z-50 bg-black/80 backdrop-blur border border-white/20 p-4 rounded-xl shadow-2xl text-xs font-mono text-green-400 w-72"
          >
            <div className="flex justify-between items-center border-b border-white/20 pb-2 mb-2">
              <span className="font-bold text-white">WebRTC Debug</span>
              <span className="text-white/50">Role: {role || "None"}</span>
            </div>
            <div className="space-y-1.5">
              <div className="flex justify-between"><span>Offer Status:</span><span className="text-white">{offerStatus}</span></div>
              <div className="flex justify-between"><span>Answer Status:</span><span className="text-white">{answerStatus}</span></div>
              <div className="flex justify-between"><span>ICE Cand Count:</span><span className="text-white">{iceCandidateCount}</span></div>
              <div className="flex justify-between"><span>PC Conn State:</span><span className="text-white">{pcConnState || "None"}</span></div>
              <div className="flex justify-between"><span>PC Signaling:</span><span className="text-white">{pcSignalingState || "None"}</span></div>
              <div className="flex justify-between"><span>PC ICE Conn:</span><span className="text-white">{pcIceConnState || "None"}</span></div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Video Area ───────────────────────────────────────────────────────── */}
      <main className="flex-1 relative overflow-hidden bg-zinc-900 z-10">

        {/* ── Remote video (full screen) ─────────────────────────────────────── */}
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className={cn(
            "absolute inset-0 h-full w-full object-cover transition-opacity duration-500",
            remoteJoined ? "opacity-100" : "opacity-0"
          )}
        />

        {/* ── Waiting / Loading overlay ──────────────────────────────────────── */}
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
                  {isWaiting ? "Waiting for participant…" : CONN_STATE_LABEL[connState]}
                </p>
                <p className="text-white/40 text-sm">
                  {isWaiting
                    ? "Share the meeting ID with your colleague to connect."
                    : "Please wait while we set up your connection."}
                </p>
                {isWaiting && (
                  <div className="mt-2 inline-flex items-center gap-2 bg-white/5 border border-white/10 rounded-lg px-4 py-2">
                    <span className="text-white/50 text-xs">Meeting ID</span>
                    <span className="text-white font-mono font-semibold tracking-wider">{meetingId}</span>
                  </div>
                )}
              </div>

              {(isLoading) && (
                <Loader2 className="h-6 w-6 text-primary/60 animate-spin mt-2" />
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Error overlay ──────────────────────────────────────────────────── */}
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
                <p className="text-white font-semibold text-xl">{error.title}</p>
                <p className="text-white/60 text-sm leading-relaxed">{error.detail}</p>
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

        {/* ── Local video (PiP bottom-right) ────────────────────────────────── */}
        <AnimatePresence>
          {localReady && (
            <motion.div
              key="local-pip"
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className={cn(
                "absolute bottom-24 right-4 sm:bottom-28 sm:right-6",
                "w-28 sm:w-36 md:w-44 aspect-video",
                "rounded-xl overflow-hidden",
                "border-2 border-white/20 shadow-2xl",
                "bg-zinc-800 z-20"
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
                <div className="absolute inset-0 bg-zinc-800 flex items-center justify-center">
                  <VideoOff className="h-6 w-6 text-white/40" />
                </div>
              )}
              <div className="absolute bottom-1 left-1 right-1">
                <span className="text-[10px] text-white/70 bg-black/50 rounded px-1 py-0.5 truncate block text-center">
                  You {!micEnabled && "· Muted"}
                </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Remote name label ─────────────────────────────────────────────── */}
        {remoteJoined && (
          <div className="absolute top-4 left-4 z-20">
            <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-1.5">
              <div className="h-2 w-2 rounded-full bg-green-400" />
              <span className="text-xs text-white font-medium">Participant</span>
            </div>
          </div>
        )}
      </main>

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
          {micEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
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
          {camEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
        </Button>

        <Button
          onClick={handleLeave}
          title="Leave call"
          className="h-12 w-12 sm:w-auto sm:px-6 rounded-full bg-red-600 hover:bg-red-700 text-white gap-2 transition-all duration-200 shrink-0"
        >
          <PhoneOff className="h-5 w-5" />
          <span className="hidden sm:inline font-medium">Leave</span>
        </Button>
      </footer>
    </div>
  );
}
