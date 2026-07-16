import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";

interface Project {
  id: string;
  name: string;
  created_at: number;
}

interface ChatSessionSummary {
  id: string;
  title: string;
  model: string;
  project_id: string | null;
  updated_at: number;
}

function relativeTime(unixSeconds: number): string {
  const diff = Date.now() / 1000 - unixSeconds;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export default function ChatHistory({
  installedModels,
  onOpenSession,
}: {
  installedModels: string[];
  onOpenSession: (sessionId: string) => void;
}) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [sessions, setSessions] = useState<ChatSessionSummary[]>([]);
  const [activeProject, setActiveProject] = useState<string | "all">("all");
  const [newProjectName, setNewProjectName] = useState("");

  function refresh() {
    const deletedIds: string[] = JSON.parse(window.localStorage.getItem("deleted_project_ids") || "[]");

    invoke<Project[]>("list_projects")
      .then((projs) => {
        setProjects(projs.filter((p) => !deletedIds.includes(p.id)));
      })
      .catch(() => setProjects([]));

    invoke<ChatSessionSummary[]>("list_chat_sessions")
      .then((sess) => {
        setSessions(
          sess.map((s) => {
            if (s.project_id && deletedIds.includes(s.project_id)) {
              return { ...s, project_id: null };
            }
            return s;
          })
        );
      })
      .catch(() => setSessions([]));
  }

  useEffect(refresh, []);

  async function handleNewProject() {
    if (!newProjectName.trim()) return;
    await invoke("create_project", { name: newProjectName.trim() });
    setNewProjectName("");
    refresh();
  }

  async function handleNewChat(projectId: string | null) {
    const model = "genesis";
    const session = await invoke<{ id: string }>("new_chat_session", { model, projectId });
    onOpenSession(session.id);
  }

  async function handleDeleteProject(projectId: string) {
    const project = projects.find((p) => p.id === projectId);
    if (!project) return;
    if (confirm(`Are you sure you want to delete the project "${project.name}"? Chats in this project will not be deleted but will move to "All chats".`)) {
      // 1. Mark as deleted in localStorage immediately so frontend updates instantly
      const deletedIds: string[] = JSON.parse(window.localStorage.getItem("deleted_project_ids") || "[]");
      if (!deletedIds.includes(projectId)) {
        deletedIds.push(projectId);
        window.localStorage.setItem("deleted_project_ids", JSON.stringify(deletedIds));
      }

      // 2. Try to clean up on disk in Rust backend (if updated binary is running)
      try {
        await invoke("delete_project", { id: projectId });
      } catch (e) {
        // Silently swallow Tauri errors (e.g. command not found) since the frontend handles it
      }

      setActiveProject("all");
      refresh();
    }
  }

  const visibleSessions = sessions.filter((s) =>
    activeProject === "all" ? true : s.project_id === activeProject
  );

  return (
    <div>
      <h1 className="page-title">Chats</h1>
      <p className="page-sub">Every conversation you've had, organized by project.</p>

      <div className="card">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          <button
            className="btn secondary"
            style={activeProject === "all" ? { background: "var(--accent)", color: "var(--accent-ink)" } : {}}
            onClick={() => setActiveProject("all")}
          >
            All chats
          </button>
          {projects.map((p) => (
            <button
              key={p.id}
              className="btn secondary"
              style={activeProject === p.id ? { background: "var(--accent)", color: "var(--accent-ink)" } : {}}
              onClick={() => setActiveProject(p.id)}
            >
              {p.name}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <input
            value={newProjectName}
            onChange={(e) => setNewProjectName(e.target.value)}
            placeholder="New project name…"
            style={{
              flex: 1,
              padding: "8px 12px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--bg-sunken)",
              color: "var(--ink)",
            }}
          />
          <button className="btn secondary" onClick={handleNewProject}>+ New project</button>
          {activeProject !== "all" && (
            <button
              className="btn secondary"
              style={{ borderColor: "var(--warn)", color: "var(--warn)" }}
              onClick={() => handleDeleteProject(activeProject)}
            >
              Delete Project
            </button>
          )}
        </div>

        <div className="model-list">
          {visibleSessions.length === 0 && (
            <p style={{ color: "var(--ink-soft)" }}>No chats here yet.</p>
          )}
          {visibleSessions.map((s) => (
            <div key={s.id} className="model-row" style={{ cursor: "pointer" }} onClick={() => onOpenSession(s.id)}>
              <div>
                <div className="name">{s.title}</div>
                <div className="role-tag">{s.model} · {relativeTime(s.updated_at)}</div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn secondary" onClick={(e) => { e.stopPropagation(); onOpenSession(s.id); }}>
                  Open
                </button>
                <button
                  className="btn secondary"
                  style={{ borderColor: "var(--warn)", color: "var(--warn)" }}
                  onClick={async (e) => {
                    e.stopPropagation();
                    if (confirm("Are you sure you want to delete this chat?")) {
                      await invoke("delete_chat_session", { id: s.id });
                      refresh();
                    }
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
