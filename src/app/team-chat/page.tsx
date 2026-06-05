"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import {
  AtSign,
  Bot,
  CheckCheck,
  Edit3,
  FolderKanban,
  Hash,
  Loader2,
  Megaphone,
  MessageSquare,
  MoreVertical,
  PanelLeft,
  PanelRight,
  Search,
  Send,
  Shield,
  Smile,
  Trash2,
  X,
} from "lucide-react";
import { DashboardLayout } from "@/components/common/DashboardLayout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/AuthContext";
import { useProject } from "@/context/ProjectContext";
import { ensureDefaultChatRooms } from "@/lib/chat";
import { db } from "@/lib/firebase";
import { cn } from "@/lib/utils";

type RoomType = "general" | "development" | "announcements" | "ai_discussions";

interface ChatRoom {
  roomId: string;
  projectId: string;
  roomName: string;
  roomType: RoomType;
  purpose: string;
  roomOrder: number;
  createdBy: string;
  createdAt: Timestamp | null;
}

interface ChatMessage {
  id: string;
  projectId: string;
  roomId: string;
  senderId: string;
  senderName: string;
  senderRole: "leader" | "member" | "ai";
  senderAgent?: string;
  message: string;
  createdAt: Timestamp | null;
  edited: boolean;
  editedAt: Timestamp | null;
  mentions: string[];
  status: "sent" | "delivered" | "seen";
}

interface TypingStatus {
  id: string;
  userId: string;
  userName: string;
  updatedAt: Timestamp | null;
}

interface PresenceStatus {
  id: string;
  userId: string;
  isOnline: boolean;
  activeRoomId?: string;
  lastSeenAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

const roomIcons: Record<RoomType, React.ElementType> = {
  general: Hash,
  development: MessageSquare,
  announcements: Megaphone,
  ai_discussions: Bot,
};

const emojiOptions = ["👍", "🔥", "✅", "🎯", "💡", "🚀"];
const agentOptions = [
  { senderAgent: "PM Agent", message: "Sprint 2 Generated Successfully." },
  { senderAgent: "Architect Agent", message: "Recommended Firebase + Next.js Architecture." },
  { senderAgent: "Vibe Coding Agent", message: "Implementation direction is ready for review." },
];

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatMessageTime(timestamp: Timestamp | null) {
  if (!timestamp) return "Sending…";
  return timestamp.toDate().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatLastSeen(timestamp: Timestamp | null) {
  if (!timestamp) return "Offline";
  const diff = Date.now() - timestamp.toMillis();
  if (diff < 60_000) return "Online";
  if (diff < 3_600_000) return `Last seen ${Math.max(1, Math.round(diff / 60_000))}m ago`;
  return timestamp.toDate().toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function extractMentions(message: string, memberNames: string[]) {
  const normalizedMessage = message.toLowerCase();
  return memberNames.filter((name) => normalizedMessage.includes(`@${name.toLowerCase()}`));
}

function renderMessageWithMentions(message: string) {
  const parts = message.split(/(@[\w\s.-]+?)(?=\s|$|[,.!?])/g);
  return parts.map((part, index) =>
    part.startsWith("@") ? (
      <span key={`${part}-${index}`} className="rounded bg-primary/15 px-1 font-medium text-primary">
        {part}
      </span>
    ) : (
      <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>
    )
  );
}

export default function TeamChatPage() {
  const { user } = useAuth();
  const { activeProject, activeProjectMembers, membersLoading, userRole } = useProject();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [messageDraft, setMessageDraft] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingDraft, setEditingDraft] = useState("");
  const [typingUsers, setTypingUsers] = useState<TypingStatus[]>([]);
  const [presenceStatuses, setPresenceStatuses] = useState<Record<string, PresenceStatus>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const projectId = activeProject?.projectId;
  const userId = user?.uid;
  const userName = user?.displayName || "Anonymous";

  const selectedRoom = rooms.find((room) => room.roomId === selectedRoomId) ?? rooms[0];
  const isAnnouncementRoom = selectedRoom?.roomType === "announcements";
  const canSendInRoom = Boolean(user && selectedRoom && (!isAnnouncementRoom || userRole === "leader"));

  const memberNames = useMemo(
    () => activeProjectMembers.map((member) => member.name).filter(Boolean),
    [activeProjectMembers]
  );

  const filteredRooms = useMemo(() => {
    if (!searchTerm.trim()) return rooms;
    const needle = searchTerm.toLowerCase();
    return rooms.filter(
      (room) =>
        room.roomName.toLowerCase().includes(needle) ||
        room.purpose.toLowerCase().includes(needle)
    );
  }, [rooms, searchTerm]);

  const filteredMembers = useMemo(() => {
    if (!searchTerm.trim()) return activeProjectMembers;
    const needle = searchTerm.toLowerCase();
    return activeProjectMembers.filter(
      (member) =>
        member.name.toLowerCase().includes(needle) ||
        member.role.toLowerCase().includes(needle) ||
        member.email.toLowerCase().includes(needle)
    );
  }, [activeProjectMembers, searchTerm]);

  const filteredMessages = useMemo(() => {
    if (!searchTerm.trim()) return messages;
    const needle = searchTerm.toLowerCase();
    return messages.filter(
      (message) =>
        message.message.toLowerCase().includes(needle) ||
        message.senderName.toLowerCase().includes(needle) ||
        message.senderRole.toLowerCase().includes(needle)
    );
  }, [messages, searchTerm]);

  useEffect(() => {
    if (!projectId || !userId) return;
    ensureDefaultChatRooms(projectId, userId).catch((error) => {
      console.error("Failed to ensure chat rooms:", error);
    });
  }, [projectId, userId]);

  useEffect(() => {
    if (!projectId) return;
    const roomsQuery = query(
      collection(db, "chatRooms"),
      where("projectId", "==", projectId),
      orderBy("roomOrder", "asc")
    );
    return onSnapshot(roomsQuery, (snapshot) => {
      const roomData = snapshot.docs.map((roomDoc) => {
        const data = roomDoc.data() as Omit<ChatRoom, "roomId"> & { roomId?: string };
        return { ...data, roomId: data.roomId ?? roomDoc.id } as ChatRoom;
      });
      setRooms(roomData);
      setSelectedRoomId((currentRoomId) => currentRoomId || roomData[0]?.roomId || "");
      setLoadingRooms(false);
    });
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !selectedRoomId) return;
    const messagesQuery = query(
      collection(db, "messages"),
      where("projectId", "==", projectId),
      where("roomId", "==", selectedRoomId),
      orderBy("createdAt", "asc")
    );
    return onSnapshot(messagesQuery, (snapshot) => {
      const messageData = snapshot.docs.map((messageDoc) => {
        const data = messageDoc.data() as Omit<ChatMessage, "id">;
        return { id: messageDoc.id, ...data };
      });
      setMessages(messageData);
      setLoadingMessages(false);
    });
  }, [projectId, selectedRoomId]);

  useEffect(() => {
    if (!projectId || !selectedRoomId || !userId) return;
    const typingQuery = query(
      collection(db, "typingStatus"),
      where("projectId", "==", projectId),
      where("roomId", "==", selectedRoomId)
    );
    return onSnapshot(typingQuery, (snapshot) => {
      const now = Date.now();
      const activeTypingUsers = snapshot.docs
        .map((typingDoc) => {
          const data = typingDoc.data() as Omit<TypingStatus, "id">;
          return { id: typingDoc.id, ...data };
        })
        .filter(
          (typing) =>
            typing.userId !== userId &&
            typing.updatedAt &&
            now - typing.updatedAt.toMillis() < 6000
        );
      setTypingUsers(activeTypingUsers);
    });
  }, [now, projectId, selectedRoomId, userId]);

  useEffect(() => {
    if (!projectId) return;
    const presenceQuery = query(collection(db, "chatPresence"), where("projectId", "==", projectId));
    return onSnapshot(presenceQuery, (snapshot) => {
      const nextStatuses: Record<string, PresenceStatus> = {};
      snapshot.docs.forEach((presenceDoc) => {
        const data = presenceDoc.data() as Omit<PresenceStatus, "id">;
        const status = { id: presenceDoc.id, ...data };
        nextStatuses[status.userId] = status;
      });
      setPresenceStatuses(nextStatuses);
    });
  }, [projectId]);

  useEffect(() => {
    if (!projectId || !selectedRoomId || !userId) return;
    const presenceRef = doc(db, "chatPresence", `${projectId}_${userId}`);
    const writePresence = (isOnline: boolean) =>
      setDoc(
        presenceRef,
        { projectId, userId, userName, isOnline, activeRoomId: selectedRoomId, lastSeenAt: serverTimestamp(), updatedAt: serverTimestamp() },
        { merge: true }
      ).catch((error) => console.error("Failed to update presence:", error));
    writePresence(true);
    const intervalId = window.setInterval(() => writePresence(true), 45_000);
    const handleVisibility = () => writePresence(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
      writePresence(false);
    };
  }, [projectId, selectedRoomId, userId, userName]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, selectedRoomId]);

  const stopTyping = async () => {
    if (!activeProject || !selectedRoomId || !user) return;
    await deleteDoc(doc(db, "typingStatus", `${activeProject.projectId}_${selectedRoomId}_${user.uid}`)).catch(() => {});
  };

  const markTyping = async () => {
    if (!activeProject || !selectedRoomId || !user || !messageDraft.trim()) return;
    await setDoc(doc(db, "typingStatus", `${activeProject.projectId}_${selectedRoomId}_${user.uid}`), {
      projectId: activeProject.projectId,
      roomId: selectedRoomId,
      userId: user.uid,
      userName: user.displayName || "Anonymous",
      updatedAt: serverTimestamp(),
    });
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(stopTyping, 2500);
  };

  const createNotification = async (
    type: "new_message" | "mention" | "announcement" | "ai_update",
    title: string,
    body: string,
    recipientIds: string[]
  ) => {
    if (!activeProject || recipientIds.length === 0) return;
    await addDoc(collection(db, "notifications"), {
      projectId: activeProject.projectId,
      roomId: selectedRoomId,
      type, title, body, recipientIds, readBy: [], createdAt: serverTimestamp(),
    }).catch((error) => console.error("Failed to create notification:", error));
  };

  const sendMessage = async (agentMessage?: { senderAgent: string; message: string }) => {
    if (!activeProject || !selectedRoom || !user || !userRole) return;
    const outgoingMessage = agentMessage?.message ?? messageDraft.trim();
    if (!outgoingMessage || (!agentMessage && !canSendInRoom)) return;

    const senderName = agentMessage?.senderAgent ?? user.displayName ?? "Anonymous";
    const mentions = extractMentions(outgoingMessage, memberNames);
    const mentionedMemberIds = activeProjectMembers
      .filter((member) => mentions.includes(member.name) && member.userId !== user.uid)
      .map((member) => member.userId);
    const recipientIds = activeProjectMembers
      .filter((member) => member.userId !== user.uid)
      .map((member) => member.userId);

    await addDoc(collection(db, "messages"), {
      projectId: activeProject.projectId,
      roomId: selectedRoom.roomId,
      senderId: user.uid,
      senderName,
      senderRole: agentMessage ? "ai" : userRole,
      senderAgent: agentMessage?.senderAgent ?? null,
      message: outgoingMessage,
      createdAt: serverTimestamp(),
      edited: false, editedAt: null, mentions, status: "sent",
    });

    setMessageDraft("");
    await stopTyping();

    if (agentMessage) {
      await createNotification("ai_update", senderName, outgoingMessage, recipientIds);
    } else if (isAnnouncementRoom) {
      await createNotification("announcement", "New announcement", outgoingMessage, recipientIds);
    } else if (mentionedMemberIds.length > 0) {
      await createNotification("mention", `${senderName} mentioned you`, outgoingMessage, mentionedMemberIds);
    } else {
      await createNotification("new_message", `${senderName} in ${selectedRoom.roomName}`, outgoingMessage, recipientIds);
    }
  };

  const saveEdit = async (messageId: string) => {
    if (!editingDraft.trim()) return;
    await updateDoc(doc(db, "messages", messageId), {
      message: editingDraft.trim(),
      edited: true,
      editedAt: serverTimestamp(),
      mentions: extractMentions(editingDraft.trim(), memberNames),
    });
    setEditingMessageId(null);
    setEditingDraft("");
  };

  const deleteMessage = async (messageId: string) => {
    await deleteDoc(doc(db, "messages", messageId));
  };

  const handleDraftChange = (value: string) => {
    setMessageDraft(value);
    markTyping();
  };

  const handleComposerKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const getMessageStatus = (message: ChatMessage) => {
    if (message.senderId !== user?.uid || !message.createdAt) return null;
    const seenBySomeone = Object.values(presenceStatuses).some(
      (presence) =>
        presence.userId !== user.uid &&
        presence.activeRoomId === message.roomId &&
        presence.lastSeenAt &&
        presence.lastSeenAt.toMillis() >= message.createdAt!.toMillis()
    );
    if (seenBySomeone) return "Seen";
    return message.createdAt ? "Delivered" : "Sent";
  };

  const unreadCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    rooms.forEach((room) => {
      counts[room.roomId] = room.roomId === selectedRoomId ? 0 : 0;
    });
    return counts;
  }, [rooms, selectedRoomId]);

  if (!activeProject) {
    return (
      <DashboardLayout>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-8">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold">
              <MessageSquare className="h-8 w-8 text-primary" />
              Team Chat
            </h1>
            <p className="mt-1 text-muted-foreground">Realtime project communication</p>
          </div>
          <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-muted/20 py-24 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
              <FolderKanban className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mt-4 text-xl font-bold">No Project Selected</h3>
            <p className="mt-1 max-w-[300px] text-muted-foreground">Select a project to open its chat workspace.</p>
            <Link href="/projects" className="mt-5">
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

  // ── Rooms Panel ────────────────────────────────────────────────────────────
  const roomsPanel = (
    <aside className="flex h-full flex-col border-r bg-background">
      <div className="border-b p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Project Chat</p>
            <h2 className="line-clamp-1 font-semibold">{activeProject.projectName}</h2>
          </div>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setRoomsOpen(false)}>
            <X className="h-4 w-4" />
          </Button>
        </div>
        <div className="relative mt-4">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search messages, rooms, users"
            className="pl-9"
          />
        </div>
      </div>
      <div className="flex-1 space-y-1 overflow-y-auto p-3">
        {loadingRooms ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          filteredRooms.map((room) => {
            const Icon = roomIcons[room.roomType] ?? Hash;
            const isSelected = room.roomId === selectedRoom?.roomId;
            return (
              <button
                key={room.roomId}
                onClick={() => { setSelectedRoomId(room.roomId); setRoomsOpen(false); }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition",
                  "hover:bg-accent hover:text-accent-foreground",
                  isSelected && "bg-accent text-accent-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{room.roomName}</span>
                    {unreadCounts[room.roomId] > 0 && (
                      <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                        {unreadCounts[room.roomId]}
                      </span>
                    )}
                  </div>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{room.purpose}</p>
                </div>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );

  // ── Members Panel ──────────────────────────────────────────────────────────
  const membersPanel = (
    <aside className="flex h-full flex-col border-l bg-background">
      <div className="flex items-center justify-between border-b p-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Project Members</p>
          <h2 className="font-semibold">{activeProjectMembers.length} teammates</h2>
        </div>
        <Button variant="ghost" size="icon" className="xl:hidden" onClick={() => setMembersOpen(false)}>
          <X className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {membersLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          filteredMembers.map((member) => {
            const presence = presenceStatuses[member.userId];
            const online = Boolean(presence?.isOnline && presence.updatedAt && now - presence.updatedAt.toMillis() < 120_000);
            return (
              <div key={member.userId} className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-muted/60">
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback>{getInitials(member.name)}</AvatarFallback>
                  </Avatar>
                  <span className={cn("absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background", online ? "bg-emerald-500" : "bg-muted-foreground")} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{member.name}</p>
                    {member.role === "leader" && <Shield className="h-3.5 w-3.5 text-primary" />}
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {online ? "Online" : formatLastSeen(presence?.lastSeenAt ?? null)}
                  </p>
                </div>
                <Badge variant={member.role === "leader" ? "default" : "secondary"} className="text-[10px]">
                  {member.role}
                </Badge>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <DashboardLayout>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="h-[calc(100vh-7rem)] overflow-hidden rounded-xl border bg-background shadow-sm"
      >
        <div className="grid h-full grid-cols-1 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[280px_minmax(0,1fr)_300px]">
          <div className="hidden lg:block">{roomsPanel}</div>

          {/* ── Center: Chat Area ──────────────────────────────────────────── */}
          <section className="flex min-w-0 flex-col">
            {/* Header */}
            <header className="flex items-center justify-between gap-3 border-b bg-background/95 p-3 sm:p-4">
              <div className="flex min-w-0 items-center gap-2">
                <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setRoomsOpen(true)}>
                  <PanelLeft className="h-5 w-5" />
                </Button>
                {selectedRoom && React.createElement(roomIcons[selectedRoom.roomType] ?? Hash, { className: "h-5 w-5 text-primary" })}
                <div className="min-w-0">
                  <h1 className="truncate font-semibold">{selectedRoom?.roomName ?? "Team Chat"}</h1>
                  <p className="line-clamp-1 text-xs text-muted-foreground">{selectedRoom?.purpose}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isAnnouncementRoom && (
                  <Badge variant={userRole === "leader" ? "default" : "secondary"}>
                    {userRole === "leader" ? "Leader posting" : "Read only"}
                  </Badge>
                )}
                <Button variant="ghost" size="icon" className="xl:hidden" onClick={() => setMembersOpen(true)}>
                  <PanelRight className="h-5 w-5" />
                </Button>
              </div>
            </header>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto bg-muted/20 px-3 py-4 sm:px-5">
              {loadingMessages ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                    <MessageSquare className="h-7 w-7 text-primary" />
                  </div>
                  <h3 className="mt-4 font-semibold">Start the conversation</h3>
                  <p className="mt-1 max-w-[300px] text-sm text-muted-foreground">
                    Messages, mentions, AI updates, and announcements appear here instantly.
                  </p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  <AnimatePresence initial={false}>
                    {filteredMessages.map((message, idx) => {
                      const ownMessage = message.senderId === user?.uid && message.senderRole !== "ai";
                      const canDelete = ownMessage || userRole === "leader";
                      const status = getMessageStatus(message);

                      // Grouping logic
                      const prevMsg = filteredMessages[idx - 1];
                      const nextMsg = filteredMessages[idx + 1];
                      const isGroupStart = !prevMsg || prevMsg.senderId !== message.senderId || prevMsg.senderRole !== message.senderRole;
                      const isGroupEnd = !nextMsg || nextMsg.senderId !== message.senderId || nextMsg.senderRole !== message.senderRole;

                      return (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.15 }}
                          className={cn(
                            "group flex items-end gap-2 px-1",
                            ownMessage ? "flex-row-reverse" : "flex-row",
                            isGroupStart ? "mt-4" : "mt-0.5"
                          )}
                        >
                          {/* Avatar — left for others only */}
                          {!ownMessage && (
                            <div className="w-8 shrink-0 self-end mb-0.5">
                              {isGroupEnd ? (
                                <Avatar className={cn("h-8 w-8", message.senderRole === "ai" && "bg-violet-500/10")}>
                                  <AvatarFallback className="text-xs font-semibold">
                                    {message.senderRole === "ai"
                                      ? <Bot className="h-4 w-4 text-violet-500" />
                                      : getInitials(message.senderName)}
                                  </AvatarFallback>
                                </Avatar>
                              ) : (
                                <div className="h-8 w-8" />
                              )}
                            </div>
                          )}

                          {/* Content column */}
                          <div className={cn("flex flex-col max-w-[72%] sm:max-w-[60%]", ownMessage ? "items-end" : "items-start")}>
                            {/* Sender label — only for others, only at group start */}
                            {!ownMessage && isGroupStart && (
                              <div className="flex items-center gap-1.5 mb-1 px-1">
                                <span className="text-xs font-semibold">{message.senderName}</span>
                                <Badge
                                  variant={message.senderRole === "leader" ? "default" : "secondary"}
                                  className="text-[9px] px-1.5 py-0 h-4"
                                >
                                  {message.senderRole === "ai" ? "AI Agent" : message.senderRole}
                                </Badge>
                              </div>
                            )}

                            {/* Bubble */}
                            {editingMessageId === message.id ? (
                              <div className="space-y-2 p-3 rounded-2xl border bg-background min-w-[240px] w-full">
                                <Textarea
                                  value={editingDraft}
                                  onChange={(e) => setEditingDraft(e.target.value)}
                                  className="min-h-[72px] resize-none"
                                />
                                <div className="flex justify-end gap-2">
                                  <Button variant="outline" size="sm" onClick={() => setEditingMessageId(null)}>Cancel</Button>
                                  <Button size="sm" onClick={() => saveEdit(message.id)}>Save</Button>
                                </div>
                              </div>
                            ) : (
                              <div
                                className={cn(
                                  "px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words",
                                  // Own messages: right side, blue gradient
                                  ownMessage && "bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-sm",
                                  ownMessage && "rounded-2xl rounded-br-sm",
                                  // AI agent messages
                                  !ownMessage && message.senderRole === "ai" && "bg-violet-500/10 border border-violet-500/20 text-foreground rounded-2xl rounded-bl-sm",
                                  // Other user messages
                                  !ownMessage && message.senderRole !== "ai" && "bg-background border shadow-sm rounded-2xl rounded-bl-sm"
                                )}
                              >
                                {renderMessageWithMentions(message.message)}
                              </div>
                            )}

                            {/* Footer — timestamp, edited, seen, actions */}
                            {isGroupEnd && (
                              <div className={cn(
                                "flex items-center gap-1.5 mt-1 px-1",
                                ownMessage ? "flex-row-reverse" : "flex-row"
                              )}>
                                <span className="text-[10px] text-muted-foreground">{formatMessageTime(message.createdAt)}</span>
                                {message.edited && <span className="text-[10px] text-muted-foreground">· edited</span>}
                                {status && ownMessage && (
                                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                    <CheckCheck className="h-3 w-3" />
                                    {status}
                                  </span>
                                )}
                                {(ownMessage || canDelete) && !editingMessageId && (
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                      >
                                        <MoreVertical className="h-3 w-3" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align={ownMessage ? "end" : "start"}>
                                      {ownMessage && (
                                        <DropdownMenuItem
                                          onClick={() => { setEditingMessageId(message.id); setEditingDraft(message.message); }}
                                        >
                                          <Edit3 className="mr-2 h-4 w-4" />
                                          Edit
                                        </DropdownMenuItem>
                                      )}
                                      {canDelete && (
                                        <DropdownMenuItem className="text-destructive" onClick={() => deleteMessage(message.id)}>
                                          <Trash2 className="mr-2 h-4 w-4" />
                                          Delete
                                        </DropdownMenuItem>
                                      )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                )}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Footer / Composer */}
            <footer className="border-t bg-background p-3 sm:p-4">
              {typingUsers.length > 0 && (
                <p className="mb-2 text-xs text-muted-foreground">
                  {typingUsers.map((typing) => typing.userName).join(", ")}{" "}
                  {typingUsers.length === 1 ? "is" : "are"} typing...
                </p>
              )}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Smile className="h-4 w-4" />
                      Emoji
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="flex gap-1 p-2">
                    {emojiOptions.map((emoji) => (
                      <button
                        key={emoji}
                        className="rounded-md p-2 text-lg hover:bg-accent"
                        onClick={() => setMessageDraft((draft) => `${draft}${emoji}`)}
                      >
                        {emoji}
                      </button>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2" disabled={userRole !== "leader"}>
                      <Bot className="h-4 w-4" />
                      AI Update
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {agentOptions.map((agent) => (
                      <DropdownMenuItem key={agent.senderAgent} onClick={() => sendMessage(agent)}>
                        {agent.senderAgent}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <AtSign className="h-3.5 w-3.5" />
                  Mention teammates with @name
                </div>
              </div>
              <div className="flex items-end gap-2">
                <Textarea
                  value={messageDraft}
                  onChange={(event) => handleDraftChange(event.target.value)}
                  onKeyDown={handleComposerKeyDown}
                  disabled={!canSendInRoom}
                  placeholder={
                    canSendInRoom
                      ? `Message ${selectedRoom?.roomName ?? "room"}`
                      : "Only project leaders can post announcements"
                  }
                  className="max-h-36 min-h-[48px] resize-none"
                />
                <Button
                  size="icon"
                  className="h-12 w-12 shrink-0"
                  disabled={!messageDraft.trim() || !canSendInRoom}
                  onClick={() => sendMessage()}
                >
                  <Send className="h-5 w-5" />
                </Button>
              </div>
            </footer>
          </section>

          <div className="hidden xl:block">{membersPanel}</div>
        </div>

        {/* Mobile overlays */}
        {roomsOpen && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm lg:hidden">
            <div className="h-full w-[min(88vw,320px)] shadow-xl">{roomsPanel}</div>
          </div>
        )}
        {membersOpen && (
          <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm xl:hidden">
            <div className="h-full w-[min(88vw,340px)] shadow-xl">{membersPanel}</div>
          </div>
        )}
      </motion.div>
    </DashboardLayout>
  );
}
