"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext";
import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

// ─── Types (exported so Team page can use them) ──────────────────────────────

export interface Project {
  projectId: string;
  projectName: string;
  projectDescription: string;
  projectCode: string;
  leaderId: string;
  leaderName: string;
  githubRepo?: string;
  status: "active" | "archived";
  currentPhase: number;
  totalMembers: number;
  totalTasks: number;
  completedTasks: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ProjectMember {
  projectId: string;
  userId: string;
  name: string;
  email: string;
  role: "leader" | "member";
  joinedAt: Timestamp | null;
}

// ─── Context type ─────────────────────────────────────────────────────────────

interface ProjectContextType {
  projects: Project[];
  activeProject: Project | null;
  activeProjectMembers: ProjectMember[];
  userRole: "leader" | "member" | null;
  loading: boolean;
  membersLoading: boolean;
  projectProgress: number; // 0-100, derived from real task counts
  selectProject: (projectId: string) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [activeProjectMembers, setActiveProjectMembers] = useState<ProjectMember[]>([]);
  const [userRole, setUserRole] = useState<"leader" | "member" | null>(null);
  const [loading, setLoading] = useState(true);
  const [membersLoading, setMembersLoading] = useState(false);

  // ── 1. Listen to all projects the current user belongs to ──────────────────
  useEffect(() => {
    if (!user) {
      setProjects([]);
      setActiveProject(null);
      setUserRole(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    const membersQuery = query(
      collection(db, "projectMembers"),
      where("userId", "==", user.uid)
    );

    const unsubscribeMembers = onSnapshot(membersQuery, (snapshot) => {
      const projectIds = snapshot.docs.map((d) => d.data().projectId as string);

      if (projectIds.length === 0) {
        setProjects([]);
        setLoading(false);
        return;
      }

      const projectsQuery = query(
        collection(db, "projects"),
        where("projectId", "in", projectIds)
      );

      const unsubscribeProjects = onSnapshot(projectsQuery, (projectSnapshot) => {
        const projectsData = projectSnapshot.docs.map((d) => d.data() as Project);
        setProjects(projectsData);

        // Keep active project in sync when Firestore updates it
        setActiveProject((prev) => {
          if (!prev) return null;
          const updated = projectsData.find((p) => p.projectId === prev.projectId);
          return updated ?? prev;
        });

        setLoading(false);
      });

      return () => unsubscribeProjects();
    });

    return () => unsubscribeMembers();
  }, [user]);

  // ── 2. Listen to members of the active project ────────────────────────────
  useEffect(() => {
    if (!activeProject) {
      setActiveProjectMembers([]);
      return;
    }

    setMembersLoading(true);

    const q = query(
      collection(db, "projectMembers"),
      where("projectId", "==", activeProject.projectId)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const members = snapshot.docs.map((d) => d.data() as ProjectMember);
      setActiveProjectMembers(members);
      setMembersLoading(false);
    });

    return () => unsubscribe();
  }, [activeProject?.projectId]);

  // ── 3. Resolve role of current user in active project ─────────────────────
  useEffect(() => {
    if (!user || !activeProject) {
      setUserRole(null);
      return;
    }

    const memberRef = doc(
      db,
      "projectMembers",
      `${activeProject.projectId}_${user.uid}`
    );
    getDoc(memberRef).then((snap) => {
      if (snap.exists()) {
        setUserRole(snap.data().role as "leader" | "member");
      } else {
        setUserRole(null);
      }
    });
  }, [user, activeProject?.projectId]);

  // ── 4. Restore last selected project from localStorage ────────────────────
  useEffect(() => {
    if (projects.length > 0 && !activeProject) {
      const savedId = localStorage.getItem("selectedProjectId");
      if (savedId) {
        const saved = projects.find((p) => p.projectId === savedId);
        if (saved) setActiveProject(saved);
      }
    }
  }, [projects, activeProject]);

  // ── 5. Select a project ───────────────────────────────────────────────────
  const selectProject = async (projectId: string) => {
    const project = projects.find((p) => p.projectId === projectId);
    if (project) {
      setActiveProject(project);
      localStorage.setItem("selectedProjectId", projectId);
    }
  };

  // ── 6. Compute real progress from Firebase task fields ───────────────────
  const projectProgress = (() => {
    if (!activeProject) return 0;
    const total = activeProject.totalTasks ?? 0;
    const completed = activeProject.completedTasks ?? 0;
    if (total === 0) return 0;
    return Math.round((completed / total) * 100);
  })();

  return (
    <ProjectContext.Provider
      value={{
        projects,
        activeProject,
        activeProjectMembers,
        userRole,
        loading,
        membersLoading,
        projectProgress,
        selectProject,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}
