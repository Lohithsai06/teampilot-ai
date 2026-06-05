"use client";

import React, { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  addDoc,
  collection,
  serverTimestamp,
} from "firebase/firestore";
import { ArrowLeft, Loader2, Video, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";

// ZegoCloud SDK — loaded dynamically to avoid SSR issues
let ZegoUIKitPrebuilt: any = null;

export default function MeetingRoomPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const roomId = params?.roomId as string;
  const projectId = searchParams?.get("projectId") || "";
  const meetingName = searchParams?.get("name") || "Team Meeting";

  const callContainerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [joinedAt] = useState(() => Date.now());
  const hasInitialized = useRef(false);

  const userId = user?.uid || `guest-${Math.random().toString(36).slice(2, 8)}`;
  const userName = user?.displayName || user?.email?.split("@")[0] || "Guest";

  useEffect(() => {
    if (!roomId || hasInitialized.current) return;
    hasInitialized.current = true;

    const initCall = async () => {
      try {
        // Dynamic import — ZegoCloud requires browser env
        const { ZegoUIKitPrebuilt: ZPC } = await import("@zegocloud/zego-uikit-prebuilt");
        ZegoUIKitPrebuilt = ZPC;

        const appID = parseInt(process.env.NEXT_PUBLIC_ZEGO_APP_ID || "0", 10);
        const serverSecret = process.env.NEXT_PUBLIC_ZEGO_SERVER_SECRET || "";

        if (!appID || !serverSecret) {
          setErrorMsg("ZegoCloud credentials not configured. Please add NEXT_PUBLIC_ZEGO_APP_ID and NEXT_PUBLIC_ZEGO_SERVER_SECRET to your .env.local file.");
          setStatus("error");
          return;
        }

        const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(
          appID,
          serverSecret,
          `${projectId}_${roomId}`,  // Room ID scoped to project
          userId,
          userName
        );

        if (!callContainerRef.current) {
          setStatus("error");
          setErrorMsg("Video container not found.");
          return;
        }

        const zp = ZegoUIKitPrebuilt.create(kitToken);

        zp.joinRoom({
          container: callContainerRef.current,
          scenario: {
            mode: ZegoUIKitPrebuilt.VideoConference,
          },
          showScreenSharingButton: true,
          showPreJoinView: true,
          showRoomDetailsButton: true,
          showMyCameraToggleButton: true,
          showMyMicrophoneToggleButton: true,
          showAudioVideoSettingsButton: true,
          showTextChat: true,
          showUserList: true,
          maxUsers: 50,
          layout: "Auto",
          showLayoutButton: true,
          turnOnMicrophoneWhenJoining: true,
          turnOnCameraWhenJoining: true,
          showNonVideoUser: true,
          showOnlyAudioUser: true,
          useFrontFacingCamera: true,
          onJoinRoom: async () => {
            setStatus("ready");
            console.log("[ZegoCloud] Joined room:", roomId);
          },
          onLeaveRoom: async () => {
            // Save meeting history
            try {
              const duration = Math.floor((Date.now() - joinedAt) / 1000);
              await addDoc(collection(db, "meetingHistory"), {
                projectId,
                meetingId: roomId,
                participantId: userId,
                participantName: userName,
                duration,
                endedAt: serverTimestamp(),
              });
            } catch (err) {
              console.error("[ZegoCloud] Failed to save meeting history:", err);
            }
            router.push("/meetings");
          },
          onUserJoin: (users: any[]) => {
            console.log("[ZegoCloud] Users joined:", users.map((u) => u.userName));
          },
          onUserLeave: (users: any[]) => {
            console.log("[ZegoCloud] Users left:", users.map((u) => u.userName));
          },
        });

        setStatus("ready");
      } catch (err: any) {
        console.error("[ZegoCloud] Init error:", err);
        setErrorMsg(err?.message || "Failed to initialize video call.");
        setStatus("error");
      }
    };

    initCall();
  }, [roomId, projectId, userId, userName, joinedAt, router]);

  return (
    <div className="h-screen w-screen bg-zinc-950 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-white/10 bg-zinc-900/80 backdrop-blur-sm">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/meetings")}
          className="gap-2 text-white/70 hover:text-white hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <div className="h-4 w-px bg-white/20" />
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-sm font-medium text-white">{meetingName}</span>
          <span className="text-xs text-white/50">ID: {roomId}</span>
        </div>
      </div>

      {/* Video area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Loading overlay */}
        {status === "loading" && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950 gap-4"
          >
            <div className="h-16 w-16 rounded-2xl bg-primary/20 flex items-center justify-center">
              <Video className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center space-y-1">
              <p className="text-white font-semibold">Joining {meetingName}</p>
              <p className="text-white/50 text-sm">Setting up your video call…</p>
            </div>
            <Loader2 className="h-6 w-6 animate-spin text-primary/70" />
          </motion.div>
        )}

        {/* Error state */}
        {status === "error" && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-zinc-950 gap-4 p-8 text-center">
            <div className="h-16 w-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-red-400" />
            </div>
            <div className="space-y-2 max-w-md">
              <p className="text-white font-semibold text-lg">Unable to Join Call</p>
              <p className="text-white/60 text-sm leading-relaxed">{errorMsg}</p>
              {errorMsg.includes("ZEGO") && (
                <div className="mt-4 bg-white/5 rounded-xl p-4 text-left text-xs text-white/50 space-y-1">
                  <p className="text-white/70 font-medium mb-2">To set up ZegoCloud:</p>
                  <p>1. Create a free account at <span className="text-primary">console.zegocloud.com</span></p>
                  <p>2. Create a project and get your App ID & Server Secret</p>
                  <p>3. Add to <span className="font-mono bg-white/10 px-1 rounded">.env.local</span>:</p>
                  <p className="font-mono bg-white/10 px-2 py-1 rounded mt-1">NEXT_PUBLIC_ZEGO_APP_ID=your_app_id</p>
                  <p className="font-mono bg-white/10 px-2 py-1 rounded">NEXT_PUBLIC_ZEGO_SERVER_SECRET=your_secret</p>
                </div>
              )}
            </div>
            <Button
              onClick={() => router.push("/meetings")}
              variant="outline"
              className="mt-4 gap-2 border-white/20 text-white hover:bg-white/10"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Meetings
            </Button>
          </div>
        )}

        {/* ZegoCloud container */}
        <div
          ref={callContainerRef}
          className="h-full w-full"
          style={{ display: status === "error" ? "none" : "block" }}
        />
      </div>
    </div>
  );
}
