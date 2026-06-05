import { useEffect, useState, useCallback } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

export interface GitHubActivity {
  id: string; // sha
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
  committedAt: string | Date | null;
}

function parseGitHubUrl(url: string): { owner: string; repo: string } | null {
  try {
    url = url.replace(/\.git$/, "").trim();
    if (url.includes("github.com/")) {
      const parts = url.split("github.com/")[1].split("/");
      if (parts.length >= 2) return { owner: parts[0], repo: parts[1] };
    }
    if (url.includes("github.com:")) {
      const parts = url.split("github.com:")[1].split("/");
      if (parts.length >= 2) return { owner: parts[0], repo: parts[1] };
    }
  } catch (err) {
    console.error("[parseGitHubUrl] Error", err);
  }
  return null;
}

export function useGitHubActivity(projectId: string | undefined) {
  const [activities, setActivities] = useState<GitHubActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [repoUrl, setRepoUrl] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);

  const refresh = useCallback(() => setRefreshCounter((c) => c + 1), []);

  // Listen for repository connection (only githubRepositories is used)
  useEffect(() => {
    if (!projectId) return;
    const q = query(
      collection(db, "githubRepositories"),
      where("projectId", "==", projectId)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        if (snap.empty) {
          setRepoUrl(null);
        } else {
          const d = snap.docs[0].data() as any;
          setRepoUrl(d.repoUrl || null);
        }
      },
      (err) => {
        console.error('[useGitHubActivity] repo listener error', err);
        setRepoUrl(null);
      }
    );
    return () => unsub();
  }, [projectId]);

  // Fetch live GitHub data when repoUrl changes or refresh requested
  useEffect(() => {
    let mounted = true;
    if (!repoUrl) {
      setActivities([]);
      setLoading(false);
      return;
    }

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const parsed = parseGitHubUrl(repoUrl);
        if (!parsed) throw new Error("Invalid GitHub repository URL");
        const { owner, repo } = parsed;

        const headers: Record<string, string> = {
          Accept: "application/vnd.github.v3+json",
        };

        // Support optional GitHub token from localStorage to increase rate limits
        try {
          const storedToken = typeof window !== 'undefined' ? localStorage.getItem('github_token') : null;
          if (storedToken) headers.Authorization = `token ${storedToken}`;
        } catch (e) {
          // ignore localStorage errors
        }

        // Fetch commits (latest 20)
        const commitsRes = await fetch(
          `https://api.github.com/repos/${owner}/${repo}/commits?per_page=20`,
          { headers }
        );

        if (!commitsRes.ok) {
          if (commitsRes.status === 404) throw new Error("Repository not found");
          if (commitsRes.status === 403) {
            // Try to surface reset time if available
            const reset = commitsRes.headers?.get?.("x-ratelimit-reset");
            if (reset) {
              const resetTs = Number(reset) * 1000;
              const resetDate = new Date(resetTs).toLocaleString();
              throw new Error(`Rate limit exceeded. Resets at: ${resetDate}. Provide a GitHub token via localStorage key 'github_token' to increase limits.`);
            }
            throw new Error("Rate limit exceeded or access denied. Provide a GitHub token via localStorage key 'github_token' to increase limits.");
          }
          throw new Error("Failed to fetch commits");
        }

        const commits = await commitsRes.json();

        // Fetch branches to get default branch info (best-effort)
        let branches: any[] = [];
        try {
          const branchesRes = await fetch(
            `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100`,
            { headers }
          );
          if (branchesRes.ok) branches = await branchesRes.json();
        } catch (err) {
          console.warn('[useGitHubActivity] branches fetch failed', err);
        }

        // For each commit, fetch commit details to get stats
        const detailed = await Promise.all(
          commits.map(async (c: any) => {
            try {
              const detailRes = await fetch(
                `https://api.github.com/repos/${owner}/${repo}/commits/${c.sha}`,
                { headers }
              );
              if (!detailRes.ok) return { commit: c, detail: null };
              const detail = await detailRes.json();
              return { commit: c, detail };
            } catch (err) {
              return { commit: c, detail: null };
            }
          })
        );

        const defaultBranch = branches[0]?.name || "main";

        const items: GitHubActivity[] = detailed.map(({ commit, detail }: any) => {
          const stats = detail?.stats || { additions: 0, deletions: 0, total: 0 };
          const filesChanged = Array.isArray(detail?.files) ? detail.files.length : 0;

          return {
            id: commit.sha,
            authorName: commit.commit?.author?.name || commit.author?.login || "Unknown",
            authorId: commit.author?.login || commit.commit?.author?.email || "unknown",
            branch: defaultBranch,
            commitMessage: commit.commit?.message?.split("\n")[0] || "",
            commitHash: commit.sha,
            commitUrl: commit.html_url,
            repository: `${owner}/${repo}`,
            linesAdded: stats.additions || 0,
            linesRemoved: stats.deletions || 0,
            filesChanged: filesChanged,
            committedAt: commit.commit?.author?.date || null,
          } as GitHubActivity;
        });

        // Sort newest first by date
        items.sort((a, b) => {
          const ta = a.committedAt ? new Date(a.committedAt).getTime() : 0;
          const tb = b.committedAt ? new Date(b.committedAt).getTime() : 0;
          return tb - ta;
        });

        if (!mounted) return;
        setActivities(items);
        setLoading(false);
      } catch (err: any) {
        console.error('[useGitHubActivity] Error fetching live data', err);
        if (!mounted) return;
        setError(err?.message || 'Failed to fetch GitHub data');
        setActivities([]);
        setLoading(false);
      }
    };

    run();

    return () => {
      mounted = false;
    };
  }, [repoUrl, refreshCounter]);

  return { activities, loading, error, refresh };
}
