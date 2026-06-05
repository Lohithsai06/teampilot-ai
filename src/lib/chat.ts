"use client";

import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export const DEFAULT_CHAT_ROOMS = [
  {
    roomName: "General",
    roomType: "general",
    purpose: "General team communication.",
  },
  {
    roomName: "Development",
    roomType: "development",
    purpose: "Technical discussions.",
  },
  {
    roomName: "Announcements",
    roomType: "announcements",
    purpose: "Leader-only announcements.",
  },
  {
    roomName: "AI Discussions",
    roomType: "ai_discussions",
    purpose: "Discussion related to AI generated roadmaps, tasks and architecture.",
  },
] as const;

export type ChatRoomType = (typeof DEFAULT_CHAT_ROOMS)[number]["roomType"];

export async function ensureDefaultChatRooms(projectId: string, createdBy: string) {
  const roomsQuery = query(collection(db, "chatRooms"), where("projectId", "==", projectId));
  const snapshot = await getDocs(roomsQuery);
  const existingRoomTypes = new Set(snapshot.docs.map((room) => room.data().roomType as string));
  const missingRooms = DEFAULT_CHAT_ROOMS.filter(
    (room) => !existingRoomTypes.has(room.roomType)
  );

  if (missingRooms.length === 0) return;

  const batch = writeBatch(db);
  missingRooms.forEach((room, index) => {
    const roomId = `${projectId}_${room.roomType}`;
    batch.set(
      doc(db, "chatRooms", roomId),
      {
        projectId,
        roomId,
        roomName: room.roomName,
        roomType: room.roomType,
        purpose: room.purpose,
        roomOrder:
          DEFAULT_CHAT_ROOMS.findIndex((defaultRoom) => defaultRoom.roomType === room.roomType) ??
          index,
        createdBy,
        createdAt: serverTimestamp(),
      },
      { merge: true }
    );
  });

  await batch.commit();
}
