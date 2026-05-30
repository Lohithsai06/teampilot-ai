import { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  onSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface GitHubActivity {
  id: string;
  projectId: string;
  authorName: string;
  authorId: string;
  branch: string;
  commitMessage: string;
  commitHash: string;
  commitUrl?: string;
  repository?: string;
  linesAdded: number;
  linesRemoved: number;
  filesChanged: number;
  committedAt: Timestamp | null;
}

/** Safely extract milliseconds from a Firestore Timestamp, Date, or raw object */
function toMillis(value: unknown): number {
  if (!value) return 0;
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "object" && typeof (value as any).toMillis === "function") {
    return (value as any).toMillis();
  }
  if (typeof value === "object" && typeof (value as any).seconds === "number") {
    return (value as any).seconds * 1000;
  }
  return 0;
}

export function useGitHubActivity(projectId: string | undefined) {
  const [activities, setActivities] = useState<GitHubActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setActivities([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const q = query(
        collection(db, "githubActivity"),
        where("projectId", "==", projectId)
      );

      const unsub = onSnapshot(
        q,
        (snap) => {
          const items = snap.docs
            .map((doc) => {
              const data = doc.data();
              return {
                id: doc.id,
                projectId: data.projectId,
                authorName: data.authorName || "Unknown",
                authorId: data.authorId || "unknown",
                branch: data.branch || "main",
                commitMessage: data.commitMessage || "",
                commitHash: data.commitHash || "",
                commitUrl: data.commitUrl,
                repository: data.repository,
                linesAdded: data.linesAdded ?? 0,
                linesRemoved: data.linesRemoved ?? 0,
                filesChanged: data.filesChanged ?? 0,
                committedAt: data.committedAt instanceof Timestamp
                  ? data.committedAt
                  : data.committedAt?.seconds
                    ? new Timestamp(data.committedAt.seconds, data.committedAt.nanoseconds ?? 0)
                    : null,
              } as GitHubActivity;
            })
            .sort((a, b) => toMillis(b.committedAt) - toMillis(a.committedAt)); // Newest first

          setActivities(items);
          setLoading(false);
        },
        (err) => {
          console.error("[GitHub Activity] Error:", err);
          setError("Failed to load activity data");
          setLoading(false);
        }
      );

      return () => unsub();
    } catch (err) {
      console.error("[GitHub Activity] Setup error:", err);
      setError("Failed to set up activity listener");
      setLoading(false);
    }
  }, [projectId]);

  return { activities, loading, error };
}
