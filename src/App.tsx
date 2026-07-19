import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";
import HardwareCheck from "./components/HardwareCheck";
import ModelLibrary from "./components/ModelLibrary";
import OnlineFallback from "./components/OnlineFallback";
import Chat from "./components/Chat";
import ChatHistory from "./components/ChatHistory";
import MemoryCore from "./components/MemoryCore";
import SkillsTools from "./components/SkillsTools";
import AgentsView from "./components/AgentsView";
import KanbanBoard from "./components/KanbanBoard";
import Notebook from "./components/Notebook";
import { SystemProfile } from "./lib/modelTiers";

type View = "chat" | "chats" | "hardware" | "library" | "online" | "memory" | "skills_tools" | "agents" | "kanban" | "notebook";
type Theme = "light" | "dark";

interface InstallProgress {
  stage: "downloading" | "installing" | "done" | "error";
  percent: number;
  message: string;
}

export default function App() {
  const { t } = useTranslation();
  const [theme, setTheme] = useState<Theme>("dark");
  const [view, setView] = useState<View>("chat");
  const [profile, setProfile] = useState<SystemProfile | null>(null);
  const [ollamaReady, setOllamaReady] = useState<boolean | null>(null);
  const [ollamaServerRunning, setOllamaServerRunning] = useState<boolean | null>(null);
  const [startingServer, setStartingServer] = useState(false);
  const [installProgress, setInstallProgress] = useState<InstallProgress | null>(null);
  const [installing, setInstalling] = useState(false);
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  function refreshInstalledModels() {
    invoke<string[]>("list_installed_models").then(setInstalledModels).catch(() => setInstalledModels([]));
  }

  function checkOllamaServer() {
    invoke<boolean>("ollama_server_running").then(setOllamaServerRunning).catch(() => setOllamaServerRunning(false));
  }

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    invoke<boolean>("ollama_installed").then(setOllamaReady).catch(() => setOllamaReady(false));
    invoke<SystemProfile>("scan_system").then(setProfile).catch(() => {});
    refreshInstalledModels();
    checkOllamaServer();
    const serverPoll = setInterval(checkOllamaServer, 5000);

    const unlisten = listen<InstallProgress>("ollama-install-progress", (event) => {
      setInstallProgress(event.payload);
      if (event.payload.stage === "done") {
        setOllamaReady(true);
        setInstalling(false);
        checkOllamaServer();
      }
      if (event.payload.stage === "error") {
        setInstalling(false);
      }
    });
    return () => {
      unlisten.then((f) => f());
      clearInterval(serverPoll);
    };
  }, []);

  async function handleInstallOllama() {
    setInstalling(true);
    setInstallProgress({ stage: "downloading", percent: 0, message: "Starting…" });
    try {
      await invoke<string>("install_ollama");
    } catch (e) {
      setInstallProgress({ stage: "error", percent: 0, message: String(e) });
      setInstalling(false);
    }
  }

  async function handleStartOllamaServer() {
    setStartingServer(true);
    try {
      await invoke<string>("start_ollama_server");
      setTimeout(() => {
        checkOllamaServer();
        setStartingServer(false);
      }, 1500);
    } catch (e) {
      setStartingServer(false);
    }
  }

  function openSession(sessionId: string) {
    setActiveSessionId(sessionId);
    setView("chat");
  }

  async function goToChat() {
    refreshInstalledModels();
    if (!activeSessionId) {
      const model = "genesis";
      const session = await invoke<{ id: string }>("new_chat_session", { model, projectId: null });
      setActiveSessionId(session.id);
    }
    setView("chat");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="wordmark">Genesis Grid</div>

        {ollamaReady === false && (
          <div className="card" style={{ padding: 12, fontSize: 12 }}>
            Ollama isn't installed yet. Genesis Grid needs it to run local
            models.
            {installProgress && (
              <div style={{ margin: "8px 0", color: "var(--ink-soft)" }}>
                {installProgress.message}
                {installProgress.stage === "downloading" && (
                  <div
                    style={{
                      marginTop: 6,
                      height: 4,
                      background: "var(--bg-sunken)",
                      borderRadius: 2,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${installProgress.percent}%`,
                        height: "100%",
                        background: "var(--accent)",
                        transition: "width 0.2s ease",
                      }}
                    />
                  </div>
                )}
              </div>
            )}
            <button
              className="btn"
              style={{ marginTop: 8, width: "100%" }}
              onClick={handleInstallOllama}
              disabled={installing}
            >
              {installing ? "Installing…" : "Install Ollama"}
            </button>
          </div>
        )}

        {ollamaReady === true && ollamaServerRunning === false && (
          <div className="card" style={{ padding: 12, fontSize: 12 }}>
            Ollama is installed but not running right now.
            <button
              className="btn"
              style={{ marginTop: 8, width: "100%" }}
              onClick={handleStartOllamaServer}
              disabled={startingServer}
            >
              {startingServer ? "Starting…" : "Start Ollama"}
            </button>
          </div>
        )}

        <nav className="nav-list">
          <button
            className="nav-item"
            aria-current={view === "chat" ? "page" : undefined}
            onClick={goToChat}
          >
            {t("chat")}
          </button>
          <button
            className="nav-item"
            aria-current={view === "chats" ? "page" : undefined}
            onClick={() => setView("chats")}
          >
            {t("chatsAndProjects")}
          </button>
          <button
            className="nav-item"
            aria-current={view === "agents" ? "page" : undefined}
            onClick={() => setView("agents")}
          >
            Agents Crew
          </button>
          <button
            className="nav-item"
            aria-current={view === "kanban" ? "page" : undefined}
            onClick={() => setView("kanban")}
          >
            Kanban Board
          </button>
          <button
            className="nav-item"
            aria-current={view === "notebook" ? "page" : undefined}
            onClick={() => setView("notebook")}
          >
            Open Notebook
          </button>
          <button
            className="nav-item"
            aria-current={view === "memory" ? "page" : undefined}
            onClick={() => setView("memory")}
          >
            {t("memoryCore")}
          </button>
          <button
            className="nav-item"
            aria-current={view === "hardware" ? "page" : undefined}
            onClick={() => setView("hardware")}
          >
            {t("myMachine")}
          </button>
          <button
            className="nav-item"
            aria-current={view === "library" ? "page" : undefined}
            onClick={() => {
              setView("library");
            }}
          >
            {t("modelLibrary")}
          </button>
          <button
            className="nav-item"
            aria-current={view === "online" ? "page" : undefined}
            onClick={() => setView("online")}
          >
            {t("useOnlineInstead")}
          </button>
        </nav>

        <button
          className="nav-item"
          aria-current={view === "skills_tools" ? "page" : undefined}
          onClick={() => setView("skills_tools")}
          style={{ marginTop: "auto" }}
        >
          {t("settings")}
        </button>

        <div className="theme-toggle" style={{ marginTop: 0 }}>
          <button data-active={theme === "light"} onClick={() => setTheme("light")}>
            Light
          </button>
          <button data-active={theme === "dark"} onClick={() => setTheme("dark")}>
            Dark
          </button>
        </div>

        <div 
          className="brand-footer"
          onClick={() => invoke("open_url", { url: "https://genesisgridlabs.xyz/" })}
          style={{ cursor: "pointer", textDecoration: "underline" }}
        >
          © 2026 Genesis Grid Labs™
        </div>
      </aside>

      <main className="main-view">
        {view === "agents" && <AgentsView installedModels={installedModels} />}
        {view === "kanban" && <KanbanBoard />}
        {view === "notebook" && <Notebook />}
        <div style={{ display: view === "chat" ? "flex" : "none", flexDirection: "column", height: "100%", flex: 1, minHeight: 0 }}>
          {activeSessionId ? (
            <Chat 
              sessionId={activeSessionId} 
              installedModels={installedModels} 
              theme={theme}
              onNewChat={async () => {
                const session = await invoke<{ id: string }>("new_chat_session", { model: "genesis", projectId: null });
                setActiveSessionId(session.id);
              }}
            />
          ) : (
            <p style={{ color: "var(--ink-soft)" }}>Starting a new chat…</p>
          )}
        </div>
        {view === "chats" && (
          <ChatHistory installedModels={installedModels} onOpenSession={openSession} />
        )}
        {view === "memory" && (
          <MemoryCore />
        )}
        {view === "skills_tools" && (
          <SkillsTools />
        )}
        {view === "hardware" && <HardwareCheck theme={theme} />}
        {view === "library" && <ModelLibrary profile={profile} />}
        {view === "online" && <OnlineFallback />}
      </main>
    </div>
  );
}
