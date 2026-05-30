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
  linesAdded: number;
  linesRemoved: number;
  filesChanged: number;
  committedAt: Timestamp | null;
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
                authorName: data.authorName,
                authorId: data.authorId,
                branch: data.branch,
                commitMessage: data.commitMessage,
                commitHash: data.commitHash,
                linesAdded: data.linesAdded,
                linesRemoved: data.linesRemoved,
                filesChanged: data.filesChanged,
                committedAt: data.committedAt,
              } as GitHubActivity;
            })
            .sort((a, b) => {
              const at = a.committedAt?.toMillis?.() ?? 0;
              const bt = b.committedAt?.toMillis?.() ?? 0;
              return bt - at; // Newest first
            });

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
