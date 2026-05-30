"use client";

import { useCallback } from "react";
import {
  collection,
  addDoc,
  serverTimestamp,
  query,
  where,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { type GitHubRepository, type GitHubReport, type GitHubReportType } from "@/lib/aiSystemPrompt";

/**
 * Hook to manage GitHub repository connections and analysis reports.
 * Handles repository configuration and report generation/storage.
 */
export function useGitHub(projectId: string | undefined) {
  // Connect a GitHub repository
  const connectRepository = useCallback(
    async (
      repoUrl: string,
      repoName: string,
      defaultBranch: string,
      userId: string
    ) => {
      if (!projectId) return null;

      try {
        const docRef = await addDoc(collection(db, "githubRepositories"), {
          projectId,
          repoUrl,
          repoName,
          defaultBranch,
          connectedBy: userId,
          connectedAt: serverTimestamp(),
        } as GitHubRepository);

        console.log(`[useGitHub] Repository connected: ${docRef.id} (${repoName})`);
        return docRef.id;
      } catch (error) {
        console.error("[useGitHub] Failed to connect repository:", error);
        return null;
      }
    },
    [projectId]
  );

  // Get connected repository for project
  const getRepository = useCallback(
    (callback: (repo: (GitHubRepository & { id: string }) | null) => void) => {
      if (!projectId) {
        callback(null);
        return () => {};
      }

      const q = query(
        collection(db, "githubRepositories"),
        where("projectId", "==", projectId)
      );

      const unsubscribe = onSnapshot(
        q,
        (snap) => {
          if (snap.empty) {
            callback(null);
          } else {
            const repo = {
              id: snap.docs[0].id,
              ...snap.docs[0].data(),
            } as GitHubRepository & { id: string };
            callback(repo);
          }
        },
        (error) => {
          console.error("[useGitHub] Failed to get repository:", error);
          callback(null);
        }
      );

      return unsubscribe;
    },
    [projectId]
  );

  // Disconnect repository
  const disconnectRepository = useCallback(async (repoId: string) => {
    try {
      await deleteDoc(doc(db, "githubRepositories", repoId));
      console.log(`[useGitHub] Repository disconnected: ${repoId}`);
    } catch (error) {
      console.error("[useGitHub] Failed to disconnect repository:", error);
    }
  }, []);

  // Save analysis report
  const saveReport = useCallback(
    async (
      reportType: GitHubReportType,
      title: string,
      summary: string,
      reportContent: Record<string, any>,
      userId: string
    ) => {
      if (!projectId) return null;

      try {
        const docRef = await addDoc(collection(db, "githubReports"), {
          projectId,
          reportType,
          title,
          summary,
          reportContent,
          generatedBy: userId,
          generatedAt: serverTimestamp(),
        } as GitHubReport);

        console.log(`[useGitHub] Report saved: ${docRef.id} (${reportType})`);
        return docRef.id;
      } catch (error) {
        console.error("[useGitHub] Failed to save report:", error);
        return null;
      }
    },
    [projectId]
  );

  // Get reports for project
  const getReports = useCallback(
    (callback: (reports: (GitHubReport & { id: string })[]) => void) => {
      if (!projectId) return () => {};

      const q = query(
        collection(db, "githubReports"),
        where("projectId", "==", projectId)
      );

      const unsubscribe = onSnapshot(
        q,
        (snap) => {
          const reports = snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          } as GitHubReport & { id: string }));
          callback(reports);
        },
        (error) => {
          console.error("[useGitHub] Failed to get reports:", error);
        }
      );

      return unsubscribe;
    },
    [projectId]
  );

  // Get reports by type
  const getReportsByType = useCallback(
    (reportType: GitHubReportType, callback: (reports: (GitHubReport & { id: string })[]) => void) => {
      if (!projectId) return () => {};

      const q = query(
        collection(db, "githubReports"),
        where("projectId", "==", projectId),
        where("reportType", "==", reportType)
      );

      const unsubscribe = onSnapshot(
        q,
        (snap) => {
          const reports = snap.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          } as GitHubReport & { id: string }));
          callback(reports);
        },
        (error) => {
          console.error("[useGitHub] Failed to get reports by type:", error);
        }
      );

      return unsubscribe;
    },
    [projectId]
  );

  // Delete report
  const deleteReport = useCallback(async (reportId: string) => {
    try {
      await deleteDoc(doc(db, "githubReports", reportId));
      console.log(`[useGitHub] Report deleted: ${reportId}`);
    } catch (error) {
      console.error("[useGitHub] Failed to delete report:", error);
    }
  }, []);

  return {
    connectRepository,
    getRepository,
    disconnectRepository,
    saveReport,
    getReports,
    getReportsByType,
    deleteReport,
  };
}
