export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url?: string;
  role: string;
  created_at: string;
  updated_at: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: "planning" | "in_progress" | "review" | "completed";
  progress: number;
  team_id: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  status: "todo" | "in_progress" | "review" | "done";
  priority: "low" | "medium" | "high";
  assignee_id?: string;
  project_id: string;
  sprint_id?: string;
  due_date?: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  id: string;
  user_id: string;
  team_id: string;
  role: string;
  workload: number;
  joined_at: string;
}

export interface Sprint {
  id: string;
  name: string;
  project_id: string;
  start_date: string;
  end_date: string;
  status: "planning" | "active" | "completed";
  created_at: string;
}

export interface RoadmapPhase {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: "upcoming" | "in_progress" | "completed";
  order: number;
  duration: string;
  created_at: string;
}

export interface Commit {
  id: string;
  sha: string;
  message: string;
  author: string;
  branch: string;
  files_count: number;
  additions: number;
  deletions: number;
  ai_summary?: string;
  committed_at: string;
}

export interface AIChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  session_id: string;
  created_at: string;
}

export interface AISession {
  id: string;
  title: string;
  user_id: string;
  project_id?: string;
  mode: "architect" | "pm" | "coding" | "github";
  created_at: string;
  updated_at: string;
}
