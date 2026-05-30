import { useState, useCallback } from "react";
import {
  collection,
  addDoc,
  deleteDoc,
  query,
  where,
  getDocs,
  serverTimestamp,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface GitHubSyncResult {
  success: boolean;
  error?: string;
  commitsAdded?: number;
  branchesFound?: number;
}

/**
 * Extract owner and repo from GitHub URL
 * Examples:
 * - https://github.com/owner/repo
 * - https://github.com/owner/repo.git
 * - git@github.com:owner/repo.git
 */
function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    // Remove .git suffix
    url = url.replace(/\.git$/, "").trim();

    // Handle https URLs
    if (url.includes("github.com/")) {
      const parts = url.split("github.com/")[1].split("/");
      if (parts.length >= 2) {
        return {
          owner: parts[0],
          repo: parts[1],
        };
      }
    }

    // Handle git@ URLs
    if (url.includes("github.com:")) {
      const parts = url.split("github.com:")[1].split("/");
      if (parts.length >= 2) {
        return {
          owner: parts[0],
          repo: parts[1],
        };
      }
    }
  } catch (err) {
    console.error("[GitHub URL Parser] Error:", err);
  }

  return null;
}

export function useGitHubSync() {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const syncRepository = useCallback(
    async (
      projectId: string,
      repoUrl: string,
      token?: string
    ): Promise<GitHubSyncResult> => {
      setSyncing(true);
      setError(null);

      try {
        // Parse URL
        const parsed = parseGitHubUrl(repoUrl);
        if (!parsed) {
          throw new Error("Invalid GitHub repository URL");
        }

        const { owner, repo } = parsed;

        // Call API route
        const response = await fetch("/api/github-sync", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            owner,
            repo,
            token,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch GitHub data");
        }

        const data = await response.json();
        const { commits, branches, repoInfo } = data;

        // Clear old activity for this project
        const q = query(
          collection(db, "githubActivity"),
          where("projectId", "==", projectId)
        );
        const existingDocs = await getDocs(q);
        for (const doc of existingDocs.docs) {
          await deleteDoc(doc.ref);
        }

        // Store commits in Firestore
        let addedCount = 0;

        for (const commit of commits) {
          try {
            // Get branch for this commit (if available)
            let branch = "main"; // default
            if (branches && branches.length > 0) {
              // Try to find the branch that contains this commit
              branch = branches[0]?.name || "main";
            }

            // Convert ISO date string to Firestore Timestamp
            const committedDate = new Date(commit.commit.author.date);
            const committedAt = Timestamp.fromDate(committedDate);

            await addDoc(collection(db, "githubActivity"), {
              projectId,
              authorName: commit.commit.author.name,
              authorId: commit.author?.login || "unknown",
              branch,
              commitMessage: commit.commit.message.split("\n")[0], // First line only
              commitHash: commit.sha,
              commitUrl: commit.html_url,
              repository: `${owner}/${repo}`,
              committedAt,         // Firestore Timestamp ✅
              // GitHub commits list API doesn't return line stats — default to 0
              linesAdded: 0,
              linesRemoved: 0,
              filesChanged: 0,
              repoUrl,
              repoInfo,
              createdAt: serverTimestamp(),
            });

            addedCount++;
          } catch (err) {
            console.error("[GitHub Sync] Error adding commit:", err);
          }
        }

        setSyncing(false);
        return {
          success: true,
          commitsAdded: addedCount,
          branchesFound: branches?.length || 0,
        };
      } catch (err) {
        const errorMsg =
          err instanceof Error ? err.message : "Unknown error occurred";
        setError(errorMsg);
        setSyncing(false);
        return {
          success: false,
          error: errorMsg,
        };
      }
    },
    []
  );

  return {
    syncing,
    error,
    syncRepository,
    parseGitHubUrl,
  };
}
