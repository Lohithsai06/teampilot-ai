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
  Timestamp
} from "firebase/firestore";
import { db } from "@/lib/firebase";

interface Project {
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
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

interface ProjectContextType {
  projects: Project[];
  activeProject: Project | null;
  userRole: "leader" | "member" | null;
  loading: boolean;
  selectProject: (projectId: string) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProject, setActiveProject] = useState<Project | null>(null);
  const [userRole, setUserRole] = useState<"leader" | "member" | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProjects([]);
      setActiveProject(null);
      setUserRole(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    // 1. Listen to projects where the user is a member
    const membersQuery = query(
      collection(db, "projectMembers"),
      where("userId", "==", user.uid)
    );

    const unsubscribeMembers = onSnapshot(membersQuery, async (snapshot) => {
      const projectIds = snapshot.docs.map(doc => doc.data().projectId);
      
      if (projectIds.length === 0) {
        setProjects([]);
        setLoading(false);
        return;
      }

      // 2. Listen to the actual project details
      const projectsQuery = query(
        collection(db, "projects"),
        where("projectId", "in", projectIds)
      );

      const unsubscribeProjects = onSnapshot(projectsQuery, (projectSnapshot) => {
        const projectsData = projectSnapshot.docs.map(doc => doc.data() as Project);
        setProjects(projectsData);
        
        // Restore active project if it still exists in the list
        if (activeProject) {
          const updatedActive = projectsData.find(p => p.projectId === activeProject.projectId);
          if (updatedActive) setActiveProject(updatedActive);
        }
        
        setLoading(false);
      });

      return () => unsubscribeProjects();
    });

    return () => unsubscribeMembers();
  }, [user, activeProject]);

  // Update userRole when activeProject changes
  useEffect(() => {
    if (!user || !activeProject) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUserRole(null);
      return;
    }

    const checkRole = async () => {
      const memberRef = doc(db, "projectMembers", `${activeProject.projectId}_${user.uid}`);
      const memberDoc = await getDoc(memberRef);
      if (memberDoc.exists()) {
        setUserRole(memberDoc.data().role);
      }
    };

    checkRole();
  }, [user, activeProject]);

  const selectProject = async (projectId: string) => {
    const project = projects.find(p => p.projectId === projectId);
    if (project) {
      setActiveProject(project);
      // Persist selection
      localStorage.setItem("selectedProjectId", projectId);
    }
  };

  // Initial selection from localStorage
  useEffect(() => {
    if (projects.length > 0 && !activeProject) {
      const savedId = localStorage.getItem("selectedProjectId");
      if (savedId) {
        const savedProject = projects.find(p => p.projectId === savedId);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        if (savedProject) setActiveProject(savedProject);
      }
    }
  }, [projects, activeProject]);

  return (
    <ProjectContext.Provider value={{ projects, activeProject, userRole, loading, selectProject }}>
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}
