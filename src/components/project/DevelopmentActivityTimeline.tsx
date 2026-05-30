import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  GitBranch,
  GitCommit,
  Users,
  Plus,
  Minus,
  FileText,
  Clock,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { GitHubActivity } from "@/lib/useGitHubActivity";
import { Timestamp } from "firebase/firestore";

interface DevelopmentActivityTimelineProps {
  activities: GitHubActivity[];
  loading: boolean;
}

function formatTimestamp(ts: any): string {
  if (!ts) return "Unknown date";
  try {
    let d: Date;
    if (ts instanceof Timestamp) {
      d = ts.toDate();
    } else if (ts instanceof Date) {
      d = ts;
    } else if (typeof ts === "object" && typeof ts.toDate === "function") {
      d = ts.toDate();
    } else if (typeof ts === "object" && typeof ts.seconds === "number") {
      d = new Date(ts.seconds * 1000);
    } else {
      d = new Date(ts);
    }

    if (isNaN(d.getTime())) return "Unknown date";

    const now = Date.now();
    const diff = now - d.getTime();
    if (diff < 60_000) return "just now";
    if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
    if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
    if (diff < 2_592_000_000) return `${Math.floor(diff / 86_400_000)}d ago`;
    return d.toLocaleDateString();
  } catch {
    return "Unknown date";
  }
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getBranchColor(branch: string): string {
  const colors: Record<string, string> = {
    main: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    development:
      "bg-blue-500/15 text-blue-400 border-blue-500/30",
    "feature/auth":
      "bg-purple-500/15 text-purple-400 border-purple-500/30",
    "feature/dashboard":
      "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
    "feature/roadmap":
      "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
    "feature/kanban":
      "bg-violet-500/15 text-violet-400 border-violet-500/30",
    "feature/github":
      "bg-orange-500/15 text-orange-400 border-orange-500/30",
  };

  return (
    colors[branch] ||
    "bg-gray-500/15 text-gray-400 border-gray-500/30"
  );
}

export function DevelopmentActivityTimeline({
  activities,
  loading,
}: DevelopmentActivityTimelineProps) {
  // Calculate contribution summary
  const summary = useMemo(() => {
    if (activities.length === 0) {
      return {
        totalCommits: 0,
        totalContributors: 0,
        totalLinesAdded: 0,
        totalLinesRemoved: 0,
        filesModified: 0,
        branches: [] as string[],
        contributors: [] as {
          name: string;
          count: number;
          linesAdded: number;
        }[],
        topBranch: "",
        mostActiveBranch: "",
        latestAuthor: "",
      };
    }

    const totalCommits = activities.length;
    const contributors = new Map<
      string,
      { name: string; count: number; linesAdded: number }
    >();
    const branches = new Map<string, number>();
    let totalLinesAdded = 0;
    let totalLinesRemoved = 0;
    const filesSet = new Set<string>();

    activities.forEach((act) => {
      // Contributors
      if (!contributors.has(act.authorId)) {
        contributors.set(act.authorId, {
          name: act.authorName,
          count: 0,
          linesAdded: 0,
        });
      }
      const contrib = contributors.get(act.authorId)!;
      contrib.count += 1;
      contrib.linesAdded += act.linesAdded;

      // Branches
      branches.set(act.branch, (branches.get(act.branch) || 0) + 1);

      // Lines
      totalLinesAdded += act.linesAdded;
      totalLinesRemoved += act.linesRemoved;

      // Files (approximate - use filesChanged count)
      filesSet.add(`${act.commitHash}-${act.filesChanged}`);
    });

    const contributorList = Array.from(contributors.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const branchList = Array.from(branches.entries()).sort(
      (a, b) => b[1] - a[1]
    );
    const mostActiveBranch = branchList[0]?.[0] || "";
    const topBranch = activities[0]?.branch || "";

    return {
      totalCommits,
      totalContributors: contributors.size,
      totalLinesAdded,
      totalLinesRemoved,
      filesModified: filesSet.size,
      branches: Array.from(branches.keys()),
      contributors: contributorList,
      topBranch,
      mostActiveBranch,
      latestAuthor: activities[0]?.authorName || "",
    };
  }, [activities]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading development activity…</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="space-y-5"
    >
      {/* Contribution Summary */}
      {activities.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.41 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">
                  Total Commits
                </div>
                <div className="text-2xl font-bold text-blue-400">
                  {summary.totalCommits}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.42 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">
                  Contributors
                </div>
                <div className="text-2xl font-bold text-violet-400">
                  {summary.totalContributors}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.43 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">
                  Lines Added
                </div>
                <div className="text-2xl font-bold text-emerald-400 flex items-center gap-1">
                  <Plus className="h-4 w-4" />
                  {summary.totalLinesAdded}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.44 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">
                  Lines Removed
                </div>
                <div className="text-2xl font-bold text-red-400 flex items-center gap-1">
                  <Minus className="h-4 w-4" />
                  {summary.totalLinesRemoved}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-muted-foreground mb-1">
                  Files Modified
                </div>
                <div className="text-2xl font-bold text-cyan-400 flex items-center gap-1">
                  <FileText className="h-4 w-4" />
                  {summary.filesModified}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Top Contributors & Activity Info */}
      {activities.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Top Contributors */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.46 }}
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Top Contributors
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {summary.contributors.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No contributions yet
                  </p>
                ) : (
                  summary.contributors.map((contrib, idx) => (
                    <div
                      key={contrib.name}
                      className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                    >
                      <Avatar className="h-7 w-7 shrink-0">
                        <AvatarFallback className="text-xs">
                          {getInitials(contrib.name)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {contrib.name}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {contrib.count} commit{contrib.count !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-medium text-emerald-400">
                          +{contrib.linesAdded}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Activity Highlights */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.47 }}
          >
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <GitBranch className="h-4 w-4" />
                  Activity Highlights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <span className="text-sm text-muted-foreground">
                    Most Active Branch
                  </span>
                  <Badge
                    variant="outline"
                    className={`gap-1 text-xs ${getBranchColor(
                      summary.mostActiveBranch
                    )}`}
                  >
                    <GitBranch className="h-3 w-3" />
                    {summary.mostActiveBranch || "—"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <span className="text-sm text-muted-foreground">
                    Latest Branch
                  </span>
                  <Badge
                    variant="outline"
                    className={`gap-1 text-xs ${getBranchColor(
                      summary.topBranch
                    )}`}
                  >
                    <GitBranch className="h-3 w-3" />
                    {summary.topBranch || "—"}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                  <span className="text-sm text-muted-foreground">
                    Latest Contributor
                  </span>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5 shrink-0">
                      <AvatarFallback className="text-[10px]">
                        {getInitials(summary.latestAuthor)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium truncate max-w-[120px]">
                      {summary.latestAuthor || "—"}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      )}

      {/* Timeline */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.48 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <GitCommit className="h-5 w-5 text-primary" />
              Development Activity Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center gap-3">
                <GitCommit className="h-10 w-10 text-muted-foreground/30" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    No development activity recorded yet.
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Connect repository activity or manually add development updates.
                  </p>
                </div>
              </div>
            ) : (
              <div className="relative space-y-0">
                {/* Timeline line */}
                <div className="absolute left-[19px] top-3 bottom-3 w-px bg-border" />

                {activities.map((activity, idx) => (
                  <motion.div
                    key={activity.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.48 + 0.02 * idx }}
                    className="flex gap-4 pb-6 last:pb-0"
                  >
                    {/* Timeline dot */}
                    <div className="flex flex-col items-center gap-0 pt-1 shrink-0">
                      <div className="h-10 w-10 rounded-full flex items-center justify-center bg-primary/10 border border-primary/30 relative z-10">
                        <Avatar className="h-7 w-7">
                          <AvatarFallback className="text-xs">
                            {getInitials(activity.authorName)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                    </div>

                    {/* Card */}
                    <div className="flex-1 pt-1">
                      <div className="bg-muted/20 rounded-lg p-4 border border-border/50 hover:border-primary/30 transition-colors">
                        {/* Header: Name, Branch, and Hash */}
                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                          <div>
                            <h4 className="text-sm font-semibold">
                              {activity.authorName}
                            </h4>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge
                              variant="outline"
                              className={`gap-1 text-xs ${getBranchColor(
                                activity.branch
                              )}`}
                            >
                              <GitBranch className="h-3 w-3" />
                              {activity.branch}
                            </Badge>
                            <Badge
                              variant="outline"
                              className="gap-1 text-xs bg-gray-500/10 text-gray-400 border-gray-500/30 font-mono"
                            >
                              {activity.commitHash.slice(0, 7)}
                            </Badge>
                          </div>
                        </div>

                        {/* Commit message */}
                        <p className="text-sm font-medium mb-3 line-clamp-2">
                          {activity.commitMessage}
                        </p>

                        {/* Stats — only shown when non-zero (GitHub list API may return 0) */}
                        {(activity.linesAdded > 0 || activity.linesRemoved > 0 || activity.filesChanged > 0) && (
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                            <div className="bg-emerald-500/10 rounded p-2">
                              <p className="text-xs text-muted-foreground">
                                Lines Added
                              </p>
                              <p className="text-sm font-bold text-emerald-400 flex items-center gap-1">
                                <Plus className="h-3 w-3" />
                                {activity.linesAdded}
                              </p>
                            </div>
                            <div className="bg-red-500/10 rounded p-2">
                              <p className="text-xs text-muted-foreground">
                                Lines Removed
                              </p>
                              <p className="text-sm font-bold text-red-400 flex items-center gap-1">
                                <Minus className="h-3 w-3" />
                                {activity.linesRemoved}
                              </p>
                            </div>
                            <div className="bg-cyan-500/10 rounded p-2">
                              <p className="text-xs text-muted-foreground">
                                Files Changed
                              </p>
                              <p className="text-sm font-bold text-cyan-400 flex items-center gap-1">
                                <FileText className="h-3 w-3" />
                                {activity.filesChanged}
                              </p>
                            </div>
                          </div>
                        )}

                        {/* Bottom: hash + committed time + link */}
                        <div className="flex flex-wrap items-center gap-3 text-xs">
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatTimestamp(activity.committedAt)}
                          </div>
                          <code className="bg-background/60 px-2 py-0.5 rounded border border-border/50 font-mono text-muted-foreground">
                            {activity.commitHash.slice(0, 7)}
                          </code>
                          {activity.commitUrl && (
                            <a
                              href={activity.commitUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1 text-primary hover:underline"
                            >
                              View on GitHub
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
