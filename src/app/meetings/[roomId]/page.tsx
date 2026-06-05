"use client";

/**
 * TeamPilot AI — WebRTC Video Call Room (Fireship Architecture)
 *
 * KEY FIX: Video elements are always in the DOM (never conditionally unmounted)
 * so refs are always valid when we do `ref.current.srcObject = stream`.
 *
 * Architecture:
 *   - Offer and Answer stored directly in the `meetings/{firestoreDocId}` document.
 *   - ICE candidates stored in root `meetingCandidates` collection, keyed by meetingId.
 *   - ICE candidates written with type="caller"|"receiver".
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
  Camera,
  CheckCircle2,
  Clock,
  Loader2,
  Mic,
  MicOff,
  PhoneOff,
  Terminal,
  User,
  Video,
  VideoOff,
  Wifi,
  WifiOff,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";

// ─── WebRTC Configuration ─────────────────────────────────────────────────────
// Multiple STUN servers for better connectivity through NATs
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

// ─── Debug log entry ──────────────────────────────────────────────────────────
interface LogEntry {
  time: string;
  msg: string;
  level: "info" | "ok" | "warn" | "error";
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
  // CRITICAL: Video elements are ALWAYS in the DOM so refs are always valid.
  // We use CSS opacity/display to show/hide them.
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const unsubscribersRef = useRef<Array<() => void>>([]);
  const joinedAtRef = useRef<number>(Date.now());
  const hasStartedRef = useRef(false);
  // Real Firestore auto-generated doc ID (different from meetingId code in URL)
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
  const [showDebug, setShowDebug] = useState(true); // Open by default for debugging
  const [remoteName, setRemoteName] = useState("Participant");
  const [remoteMicEnabled, setRemoteMicEnabled] = useState(true);
  const [remoteCamEnabled, setRemoteCamEnabled] = useState(true);
  const [localVideoPlaying, setLocalVideoPlaying] = useState(false);
  const [remoteVideoPlaying, setRemoteVideoPlaying] = useState(false);

  // ── Debug State ────────────────────────────────────────────────────────────
  const [debugLogs, setDebugLogs] = useState<LogEntry[]>([]);
  const [offerStatus, setOfferStatus] = useState("None");
  const [answerStatus, setAnswerStatus] = useState("None");
  const [iceGenCount, setIceGenCount] = useState(0);
  const [iceRecvCount, setIceRecvCount] = useState(0);
  const [iceAddCount, setIceAddCount] = useState(0);
  const [pcConnState, setPcConnState] = useState("new");
  const [pcSignalingState, setPcSignalingState] = useState("stable");
  const [pcIceConnState, setPcIceConnState] = useState("new");
  const [pcIceGatherState, setPcIceGatherState] = useState("new");
  const [localTrackCount, setLocalTrackCount] = useState(0);
  const [remoteTrackCount, setRemoteTrackCount] = useState(0);
  const [localStreamReady, setLocalStreamReady] = useState(false);
  const [remoteStreamReady, setRemoteStreamReady] = useState(false);

  const userId = user?.uid || "";
  const userName = user?.displayName || user?.email?.split("@")[0] || "Anonymous";

  // ── Debug logger ───────────────────────────────────────────────────────────
  const addLog = useCallback((msg: string, level: LogEntry["level"] = "info") => {
    const time = new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
    console.log(`[WebRTC][${level.toUpperCase()}] ${msg}`);
    setDebugLogs((prev) => [...prev.slice(-49), { time, msg, level }]);
  }, []);

  // ── Duration timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (connState !== "connected") return;
    const id = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => clearInterval(id);
  }, [connState]);

  // ── Cleanup helper ─────────────────────────────────────────────────────────
  const cleanup = useCallback(async (saveHistory = true) => {
    addLog("Cleanup: stopping all resources", "info");
    unsubscribersRef.current.forEach((unsub) => unsub());
    unsubscribersRef.current = [];

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => {
        t.stop();
        addLog(`Stopped track: ${t.kind}`, "info");
      });
      localStreamRef.current = null;
    }

    if (localVideoRef.current) localVideoRef.current.srcObject = null;
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
  }, [meetingId, projectId, userId, userName, addLog]);

  // ── Media access ───────────────────────────────────────────────────────────
  // ── Log remote video element properties and dimensions ─────────────────────
  const logVideoDimensions = useCallback(() => {
    if (remoteVideoRef.current) {
      const el = remoteVideoRef.current;
      const computed = window.getComputedStyle(el);
      addLog(`[CSS] Remote video: ` +
        `width=${el.width} height=${el.height} ` +
        `clientWidth=${el.clientWidth} clientHeight=${el.clientHeight} ` +
        `offsetWidth=${el.offsetWidth} offsetHeight=${el.offsetHeight} ` +
        `videoWidth=${el.videoWidth} videoHeight=${el.videoHeight}`, "info");
      addLog(`[CSS] Remote style: ` +
        `display=${computed.display} visibility=${computed.visibility} ` +
        `opacity=${computed.opacity} zIndex=${computed.zIndex} ` +
        `overflow=${computed.overflow}`, "info");
    } else {
      addLog("[CSS] Remote video ref is NULL", "warn");
    }
  }, [addLog]);

  const getLocalMedia = useCallback(async (): Promise<MediaStream> => {
    setConnState("requesting-media");
    addLog("Requesting camera and microphone…", "info");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: "user" },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });

      const videoTracks = stream.getVideoTracks();
      const audioTracks = stream.getAudioTracks();

      addLog(`Camera tracks: ${videoTracks.length} | Audio tracks: ${audioTracks.length}`, "ok");
      videoTracks.forEach((t) => addLog(`Video track: "${t.label}" enabled=${t.enabled}`, "ok"));
      audioTracks.forEach((t) => addLog(`Audio track: "${t.label}" enabled=${t.enabled}`, "ok"));

      localStreamRef.current = stream;
      setLocalTrackCount(stream.getTracks().length);

      // ── CRITICAL FIX: Attach stream to video element ───────────────────────
      // The <video> element is ALWAYS in the DOM (not conditionally rendered),
      // so localVideoRef.current is ALWAYS a valid DOM node here.
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
        addLog("LOCAL STREAM ATTACHED to video element ✓", "ok");
        addLog(`video.autoplay=${localVideoRef.current.autoplay} playsInline=${localVideoRef.current.playsInline} muted=${localVideoRef.current.muted}`, "info");

        // Force play in case autoplay policy blocks it
        localVideoRef.current.play()
          .then(() => {
            setLocalVideoPlaying(true);
            addLog("LOCAL VIDEO PLAY SUCCESS ✓", "ok");
          })
          .catch((e) => {
            setLocalVideoPlaying(false);
            addLog(`Local video play() error: ${e.message}`, "warn");
          });
      } else {
        addLog("WARNING: localVideoRef.current is null — stream NOT attached!", "error");
      }

      setLocalReady(true);
      setLocalStreamReady(true);
      return stream;
    } catch (err: any) {
      const name = err?.name || "";
      addLog(`getUserMedia error: ${name} — ${err?.message}`, "error");

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
  }, [addLog]);

  // ── Create RTCPeerConnection ───────────────────────────────────────────────
  const createPC = useCallback((
    stream: MediaStream,
    onIceCandidate: (candidate: RTCIceCandidate) => void
  ): RTCPeerConnection => {
    addLog("Creating RTCPeerConnection with Google STUN servers", "info");
    const pc = new RTCPeerConnection(RTC_CONFIG);
    pcRef.current = pc;

    // Add local tracks
    stream.getTracks().forEach((track) => {
      pc.addTrack(track, stream);
      addLog(`Track added to PC: ${track.kind} (${track.label})`, "ok");
    });

    // ICE candidate handler — fires as candidates are gathered
    pc.onicecandidate = (event) => {
      if (event.candidate) {
        setIceGenCount((prev) => prev + 1);
        addLog(`ICE candidate generated: ${event.candidate.type} / ${event.candidate.protocol}`, "info");
        onIceCandidate(event.candidate);
      } else {
        addLog("ICE gathering complete (null candidate)", "ok");
      }
    };

    // ICE gathering state
    pc.onicegatheringstatechange = () => {
      setPcIceGatherState(pc.iceGatheringState);
      addLog(`ICE Gathering State: ${pc.iceGatheringState}`, "info");
    };

    // Remote track — fires when the other peer's stream arrives
    pc.ontrack = (event) => {
      // Step 2 & 7: Log detailed track information
      const track = event.track;
      const remoteStream = event.streams[0];
      const streamId = remoteStream ? remoteStream.id : "unknown";

      addLog(`[ontrack] REMOTE TRACK RECEIVED: kind=${track.kind} | ID=${track.id} | readyState=${track.readyState} | enabled=${track.enabled} | muted=${track.muted} | StreamID=${streamId}`, "ok");
      
      if (track.kind === "video") {
        addLog("Video Track Received ✓", "ok");
      } else if (track.kind === "audio") {
        addLog("Audio Track Received ✓", "ok");
      }

      if (!remoteStreamRef.current) {
        remoteStreamRef.current = new MediaStream();
        addLog(`REMOTE STREAM CREATED: id=${remoteStreamRef.current.id}`, "info");
      }
      
      remoteStreamRef.current.addTrack(track);

      // Log remote stream ID, track count, track kinds
      const tracks = remoteStreamRef.current.getTracks();
      addLog(`[RemoteStream] ID=${remoteStreamRef.current.id} | Track count=${tracks.length} | Kinds=[${tracks.map(t => t.kind).join(", ")}]`, "info");
      setRemoteTrackCount(tracks.length);

      // ── CRITICAL: attach to remote video element ────────────────────────────
      if (remoteVideoRef.current) {
        // Force element properties
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
        addLog("REMOTE STREAM ATTACHED TO VIDEO ✓", "ok");
        
        // Force style visibility to bypass CSS latency
        remoteVideoRef.current.style.opacity = "1";
        remoteVideoRef.current.style.display = "block";
        
        remoteVideoRef.current.play()
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
        
        // Trigger style check
        setTimeout(() => {
          logVideoDimensions();
        }, 1000);
      } else {
        addLog("WARNING: remoteVideoRef.current is null — remote stream NOT attached!", "error");
      }
    };

    // Connection state changes
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState;
      setPcConnState(state);
      addLog(`PC Connection State → ${state}`, state === "connected" ? "ok" : state === "failed" ? "error" : "info");
      
      // Do not downgrade state to connecting or disconnected if we are already receiving remote tracks
      const hasTracks = remoteStreamReady && remoteTrackCount > 0;
      if (state === "connected") {
        setConnState("connected");
      } else if (state === "connecting") {
        if (!hasTracks) setConnState("connecting");
      } else if (state === "disconnected" || state === "closed") {
        if (!hasTracks) setConnState("disconnected");
      } else if (state === "failed") {
        setConnState("failed");
      }
    };

    // Signaling state changes
    pc.onsignalingstatechange = () => {
      setPcSignalingState(pc.signalingState);
      addLog(`Signaling State → ${pc.signalingState}`, "info");
    };

    // ICE connection state — critical for diagnosing stuck "Checking"
    pc.oniceconnectionstatechange = () => {
      setPcIceConnState(pc.iceConnectionState);
      addLog(`ICE Connection State → ${pc.iceConnectionState}`, pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed" ? "ok" : pc.iceConnectionState === "failed" ? "error" : "info");
      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        setConnState("connected");
        setRemoteJoined(true);
      }
      if (pc.iceConnectionState === "failed") {
        addLog("ICE FAILED — peers cannot reach each other. Check network/firewall.", "error");
      }
    };

    // Log initial state
    setPcConnState(pc.connectionState);
    setPcSignalingState(pc.signalingState);
    setPcIceConnState(pc.iceConnectionState);
    addLog(`PC created. Initial state: conn=${pc.connectionState} signal=${pc.signalingState} ice=${pc.iceConnectionState}`, "info");

    return pc;
  }, [addLog, logVideoDimensions, remoteStreamReady, remoteTrackCount]);

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
      addLog(`ICE candidate written to Firestore: type=${type}`, "info");
    } catch (e: any) {
      addLog(`Failed to write ICE candidate: ${e?.message}`, "error");
    }
  }, [meetingId, userId, addLog]);

  // ── ICE candidate reader ───────────────────────────────────────────────────
  const listenForIceCandidates = useCallback((listenForType: "caller" | "receiver") => {
    addLog(`Listening for ICE candidates (type=${listenForType})`, "info");
    const q = query(
      collection(db, "meetingCandidates"),
      where("meetingId", "==", meetingId),
      where("type", "==", listenForType)
    );
    const unsub = onSnapshot(q, (snap) => {
      snap.docChanges().forEach((change) => {
        if (change.type === "added") {
          setIceRecvCount((prev) => prev + 1);
          const data = change.doc.data();
          const candidate = new RTCIceCandidate(data.candidate);

          if (pcRef.current && pcRef.current.remoteDescription) {
            pcRef.current.addIceCandidate(candidate)
              .then(() => {
                setIceAddCount((prev) => prev + 1);
                addLog(`ICE candidate added (type=${listenForType})`, "ok");
              })
              .catch((e) => {
                addLog(`addIceCandidate error: ${e?.message}`, "warn");
              });
          } else {
            addLog(`ICE candidate received but PC not ready (remoteDescription=${!!pcRef.current?.remoteDescription})`, "warn");
          }
        }
      });
    });
    unsubscribersRef.current.push(unsub);
  }, [meetingId, addLog]);

  // ── CALLER FLOW ────────────────────────────────────────────────────────────
  const startAsCaller = useCallback(async (firestoreDocId: string) => {
    try {
      addLog("=== CALLER FLOW STARTED ===", "info");
      const stream = await getLocalMedia();
      setConnState("creating-offer");

      const pc = createPC(stream, (candidate) => writeIceCandidate(candidate, "caller"));

      addLog("Creating SDP offer…", "info");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      addLog(`setLocalDescription done. Signaling state: ${pc.signalingState}`, "ok");

      const offerData = { sdp: offer.sdp, type: offer.type, createdBy: userId, callerName: userName };
      addLog(`Writing offer to Firestore doc: ${firestoreDocId}`, "info");
      await updateDoc(doc(db, "meetings", firestoreDocId), {
        offer: offerData,
        callerMicEnabled: micEnabled,
        callerCamEnabled: camEnabled,
      });
      setOfferStatus("Created ✓");
      addLog("Offer written to Firestore ✓", "ok");

      setConnState("waiting");
      setRole("caller");

      // Listen for the receiver's answer on the Firestore meeting document
      const meetingUnsub = onSnapshot(doc(db, "meetings", firestoreDocId), async (snapshot) => {
        if (!snapshot.exists() || !pcRef.current) return;
        const data = snapshot.data();

        if (data?.answer && pcRef.current.signalingState !== "stable") {
          addLog("Answer received from Firestore! Setting remote description…", "ok");
          if (data.answer.receiverName) setRemoteName(data.answer.receiverName);
          try {
            await pcRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
            setAnswerStatus("Received ✓");
            setConnState("connecting");
            addLog(`setRemoteDescription (answer) done. Signaling state: ${pcRef.current.signalingState}`, "ok");
          } catch (e: any) {
            addLog(`setRemoteDescription (answer) error: ${e?.message}`, "error");
          }
        }
      });
      unsubscribersRef.current.push(meetingUnsub);

      listenForIceCandidates("receiver");
    } catch (err: any) {
      addLog(`Caller setup error: ${err?.message}`, "error");
      setError({
        title: err?.friendlyTitle || "Setup Failed",
        detail: err?.friendlyDetail || err?.message || "Could not start the call.",
        recoverable: err?.recoverable ?? true,
      });
      setConnState("error");
    }
  }, [addLog, createPC, getLocalMedia, listenForIceCandidates, userId, userName, writeIceCandidate, micEnabled, camEnabled]);

  // ── RECEIVER FLOW ──────────────────────────────────────────────────────────
  const startAsReceiver = useCallback(async (offerData: { sdp: string; type: RTCSdpType; callerName?: string }, firestoreDocId: string) => {
    try {
      addLog("=== RECEIVER FLOW STARTED ===", "info");
      if (offerData.callerName) setRemoteName(offerData.callerName);

      const stream = await getLocalMedia();
      setOfferStatus("Received ✓");

      const pc = createPC(stream, (candidate) => writeIceCandidate(candidate, "receiver"));

      addLog("Setting remote description (offer)…", "info");
      await pc.setRemoteDescription(new RTCSessionDescription(offerData));
      addLog(`setRemoteDescription (offer) done. Signaling state: ${pc.signalingState}`, "ok");

      addLog("Creating SDP answer…", "info");
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      addLog(`setLocalDescription (answer) done. Signaling state: ${pc.signalingState}`, "ok");

      const answerData = { sdp: answer.sdp, type: answer.type, createdBy: userId, receiverName: userName };
      addLog(`Writing answer to Firestore doc: ${firestoreDocId}`, "info");
      await updateDoc(doc(db, "meetings", firestoreDocId), {
        answer: answerData,
        receiverMicEnabled: micEnabled,
        receiverCamEnabled: camEnabled,
      });
      setAnswerStatus("Created ✓");
      addLog("Answer written to Firestore ✓", "ok");

      setConnState("connecting");
      setRole("receiver");

      listenForIceCandidates("caller");
    } catch (err: any) {
      addLog(`Receiver setup error: ${err?.message}`, "error");
      setError({
        title: err?.friendlyTitle || "Join Failed",
        detail: err?.friendlyDetail || err?.message || "Could not join the call.",
        recoverable: err?.recoverable ?? true,
      });
      setConnState("error");
    }
  }, [addLog, createPC, getLocalMedia, listenForIceCandidates, userId, userName, writeIceCandidate, micEnabled, camEnabled]);

  // ── Entry point ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!meetingId || !userId || hasStartedRef.current) return;
    hasStartedRef.current = true;

    const init = async () => {
      try {
        addLog(`roomId from URL: ${meetingId}`, "info");
        addLog(`projectId from URL: ${projectId}`, "info");
        addLog(`userId: ${userId} | userName: ${userName}`, "info");
        addLog(`Querying Firestore: meetings WHERE meetingId == "${meetingId}"`, "info");

        const q = query(
          collection(db, "meetings"),
          where("meetingId", "==", meetingId)
        );
        const snap = await getDocs(q);
        addLog(`Firestore query result: ${snap.size} doc(s) found`, snap.empty ? "error" : "ok");

        if (snap.empty) {
          throw new Error(`Meeting "${meetingId}" not found. Make sure you have the correct meeting code.`);
        }

        const meetingDocSnap = snap.docs[0];
        const firestoreDocId = meetingDocSnap.id;
        firestoreDocIdRef.current = firestoreDocId;
        const data = meetingDocSnap.data();

        addLog(`Firestore doc ID: ${firestoreDocId}`, "ok");
        addLog(`Meeting status: ${data.status} | hasOffer: ${!!data.offer} | hasAnswer: ${!!data.answer}`, "info");

        // ── TOP-LEVEL MEETING DOCUMENT SNAPSHOT LISTENER ───────────────────────
        // Listens to status, participant details, mic/camera toggles for BOTH peers
        const meetingUnsub = onSnapshot(doc(db, "meetings", firestoreDocId), (snapshot) => {
          if (!snapshot.exists()) return;
          const docData = snapshot.data();
          const isCaller = docData.offer && docData.offer.createdBy === userId;
          
          if (isCaller) {
            if (docData.answer?.receiverName) {
              setRemoteName(docData.answer.receiverName);
            }
            if (docData.receiverMicEnabled !== undefined) {
              setRemoteMicEnabled(docData.receiverMicEnabled);
            }
            if (docData.receiverCamEnabled !== undefined) {
              setRemoteCamEnabled(docData.receiverCamEnabled);
            }
          } else {
            if (docData.offer?.callerName) {
              setRemoteName(docData.offer.callerName);
            }
            if (docData.callerMicEnabled !== undefined) {
              setRemoteMicEnabled(docData.callerMicEnabled);
            }
            if (docData.callerCamEnabled !== undefined) {
              setRemoteCamEnabled(docData.callerCamEnabled);
            }
          }
        });
        unsubscribersRef.current.push(meetingUnsub);

        if (data.offer && data.offer.createdBy !== userId) {
          addLog(`Role: RECEIVER — offer exists from user ${data.offer.createdBy}`, "ok");
          await startAsReceiver(data.offer as { sdp: string; type: RTCSdpType; callerName?: string }, firestoreDocId);
        } else {
          if (data.offer) {
            addLog("Role: CALLER — offer exists but it's ours, re-entering as caller", "warn");
          } else {
            addLog("Role: CALLER — no offer found yet", "ok");
          }
          await startAsCaller(firestoreDocId);
        }
      } catch (err: any) {
        addLog(`Init error: ${err?.message}`, "error");
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
  }, [meetingId, projectId, userId, userName, startAsCaller, startAsReceiver, cleanup, addLog]);

  // ── Leave call ─────────────────────────────────────────────────────────────
  const handleLeave = useCallback(async () => {
    await cleanup(true);
    router.push("/meetings");
  }, [cleanup, router]);

  // Function to sync mic/camera state to Firestore
  const updateLocalMediaStatus = useCallback(async (newMic: boolean, newCam: boolean) => {
    if (!firestoreDocIdRef.current || !role) return;
    try {
      const fieldPrefix = role === "caller" ? "caller" : "receiver";
      await updateDoc(doc(db, "meetings", firestoreDocIdRef.current), {
        [`${fieldPrefix}MicEnabled`]: newMic,
        [`${fieldPrefix}CamEnabled`]: newCam,
      });
      addLog(`Updated Firestore media status: mic=${newMic}, cam=${newCam}`, "info");
    } catch (e: any) {
      addLog(`Failed to update Firestore media status: ${e.message}`, "warn");
    }
  }, [role, addLog]);

  // ── Toggles ────────────────────────────────────────────────────────────────
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

  // ──────────────────────────────────────────────────────────────────────────
  // ── RENDER ────────────────────────────────────────────────────────────────
  // ──────────────────────────────────────────────────────────────────────────
  const isConnected = connState === "connected" || (remoteStreamReady && remoteTrackCount > 0);
  const isWaiting = connState === "waiting" && !(remoteStreamReady && remoteTrackCount > 0);
  const isError = connState === "error" || connState === "failed";
  const isLoading = ["idle", "requesting-media", "creating-offer", "connecting"].includes(connState) && !(remoteStreamReady && remoteTrackCount > 0);

  const logLevelIcon = (level: LogEntry["level"]) => {
    if (level === "ok") return <CheckCircle2 className="h-3 w-3 text-green-400 shrink-0 mt-0.5" />;
    if (level === "error") return <XCircle className="h-3 w-3 text-red-400 shrink-0 mt-0.5" />;
    if (level === "warn") return <AlertCircle className="h-3 w-3 text-yellow-400 shrink-0 mt-0.5" />;
    return <div className="h-3 w-3 rounded-full bg-white/30 shrink-0 mt-0.5" />;
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
              <span className="font-semibold text-white truncate">{meetingName}</span>
              <span className="hidden sm:inline text-xs text-white/40 font-mono shrink-0">#{meetingId}</span>
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

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDebug(!showDebug)}
            className={cn("h-8 gap-1.5 text-xs", showDebug ? "text-green-400 bg-green-400/10" : "text-white/40 hover:text-white hover:bg-white/10")}
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
                {isLoading && <Loader2 className="h-6 w-6 text-primary/60 animate-spin mt-2" />}
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

          {/* ── Remote participant details ─────────────────────────────── */}
          {remoteJoined && (
            <div className="absolute top-4 left-4 z-20">
              <div className="flex items-center gap-2 bg-black/70 backdrop-blur-md rounded-lg px-3 py-1.5 border border-white/10 animate-fade-in">
                <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
                
                {/* Mini avatar */}
                <div className="h-5 w-5 rounded-full bg-gradient-to-tr from-primary to-purple-600 flex items-center justify-center text-[10px] text-white font-bold uppercase select-none">
                  {remoteName ? remoteName.slice(0, 1) : "P"}
                </div>
                
                <span className="text-sm text-white font-medium">{remoteName}</span>
                
                <span className="text-[10px] text-white/40 bg-white/10 rounded px-1.5 py-0.5 uppercase tracking-wider scale-90 shrink-0">
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

          {/* ── Local video PiP — ALWAYS in DOM, CSS visibility only ─────── */}
          {/* CRITICAL FIX: This is NOT inside AnimatePresence or conditionally
              rendered. The <video> element must always exist in the DOM so that
              localVideoRef.current is a valid node when getUserMedia resolves. */}
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

        {/* ── Debug Panel ───────────────────────────────────────────────────── */}
        {showDebug && (
          <aside className="w-80 shrink-0 bg-zinc-950 border-l border-white/10 flex flex-col text-xs font-mono overflow-hidden">
            {/* Status grid */}
            <div className="p-3 border-b border-white/10 space-y-1">
              <div className="text-white/40 text-[10px] uppercase tracking-wider mb-2 flex items-center gap-1">
                <Terminal className="h-3 w-3" /> WebRTC Debug
                <span className="ml-auto text-white/30">Role: {role || "—"}</span>
              </div>
              {[
                ["Local Stream Ready", localStreamReady],
                ["Remote Stream Ready", remoteStreamReady],
                ["Local Video Attached", !!(localVideoRef.current && localVideoRef.current.srcObject)],
                ["Remote Video Attached", !!(remoteVideoRef.current && remoteVideoRef.current.srcObject)],
                ["Local Video Playing", localVideoPlaying],
                ["Remote Video Playing", remoteVideoPlaying],
                ["Local Video Mounted", !!localVideoRef.current],
                ["Remote Video Mounted", !!remoteVideoRef.current],
              ].map(([label, val]) => (
                <div key={label as string} className="flex items-center justify-between">
                  <span className="text-white/50">{label as string}</span>
                  <span className={val ? "text-green-400" : "text-white/30"}>{val ? "✓ Yes" : "No"}</span>
                </div>
              ))}
              
              <div className="mt-2 pt-2 border-t border-white/5 space-y-1">
                <div className="flex flex-col">
                  <span className="text-white/30 text-[9px]">Local Stream ID</span>
                  <span className="text-white truncate font-mono text-[10px]">{localStreamRef.current?.id || "—"}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-white/30 text-[9px]">Remote Stream ID</span>
                  <span className="text-white truncate font-mono text-[10px]">{remoteStreamRef.current?.id || "—"}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-2 pt-2 border-t border-white/5">
                {[
                  ["Offer", offerStatus],
                  ["Answer", answerStatus],
                  ["ICE Gen", iceGenCount],
                  ["ICE Recv", iceRecvCount],
                  ["ICE Added", iceAddCount],
                  ["Tracks Local", localTrackCount],
                  ["Tracks Remote", remoteTrackCount],
                ].map(([label, val]) => (
                  <div key={label as string} className="flex flex-col">
                    <span className="text-white/30 text-[9px]">{label as string}</span>
                    <span className="text-white">{String(val) || "—"}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* State indicators */}
            <div className="p-3 border-b border-white/10 space-y-1">
              <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">States</div>
              {[
                ["PC Conn", pcConnState],
                ["Signaling", pcSignalingState],
                ["ICE Conn", pcIceConnState],
                ["ICE Gather", pcIceGatherState],
              ].map(([label, val]) => {
                const isGood = val === "connected" || val === "completed" || val === "stable";
                const isBad = val === "failed" || val === "closed";
                return (
                  <div key={label as string} className="flex justify-between items-center">
                    <span className="text-white/50">{label as string}</span>
                    <span className={cn(
                      "font-medium",
                      isGood ? "text-green-400" : isBad ? "text-red-400" : "text-yellow-400"
                    )}>
                      {(val as string) || "—"}
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Scrollable log */}
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1 px-1">Event Log</div>
              {debugLogs.length === 0 && (
                <div className="text-white/20 text-center py-4">No events yet…</div>
              )}
              {[...debugLogs].reverse().map((entry, i) => (
                <div key={i} className="flex gap-1.5 items-start">
                  {logLevelIcon(entry.level)}
                  <span className="text-white/30 shrink-0">{entry.time}</span>
                  <span className={cn(
                    "break-all",
                    entry.level === "ok" ? "text-green-300" :
                    entry.level === "error" ? "text-red-300" :
                    entry.level === "warn" ? "text-yellow-300" :
                    "text-white/70"
                  )}>{entry.msg}</span>
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
