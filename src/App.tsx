import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { getVersion } from "@tauri-apps/api/app";
import { checkUpdate, installUpdate } from "@tauri-apps/api/updater";
import { relaunch } from "@tauri-apps/api/process";
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
import FileExplorer from "./components/FileExplorer";
import HermesMuse from "./components/HermesMuse";
import BrowserUseMode from "./components/BrowserUseMode";
import { SystemProfile } from "./lib/modelTiers";

type View = "chat" | "chats" | "hardware" | "library" | "online" | "memory" | "skills_tools" | "agents" | "kanban" | "notebook" | "muse" | "browser";
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
  const [appVersion, setAppVersion] = useState<string>("");
  const [updateAvailable, setUpdateAvailable] = useState<any>(null);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const [showFileExplorer, setShowFileExplorer] = useState(true);

  function refreshInstalledModels() {
    invoke<string[]>("list_installed_models").then(setInstalledModels).catch(() => setInstalledModels([]));
  }

  function checkOllamaServer() {
    invoke<boolean>("ollama_server_running").then(setOllamaServerRunning).catch(() => setOllamaServerRunning(false));
  }

  useEffect(() => {
    getVersion().then(setAppVersion).catch(console.error);
    async function runUpdateCheck() {
      try {
        const { shouldUpdate, manifest } = await checkUpdate();
        if (shouldUpdate) {
          setUpdateAvailable(manifest);
        }
      } catch (error) {
        console.error("Update check failed", error);
      }
    }
    runUpdateCheck();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  useEffect(() => {
    const applyCustomTheme = () => {
      try {
        const stored = localStorage.getItem("custom_theme");
        const doc = document.documentElement;
        if (stored) {
          const colors = JSON.parse(stored);
          if (colors.bg) doc.style.setProperty("--bg", colors.bg);
          if (colors.bgRaised) doc.style.setProperty("--bg-raised", colors.bgRaised);
          if (colors.ink) doc.style.setProperty("--ink", colors.ink);
          if (colors.accent) doc.style.setProperty("--accent", colors.accent);
        } else {
          doc.style.removeProperty("--bg");
          doc.style.removeProperty("--bg-raised");
          doc.style.removeProperty("--ink");
          doc.style.removeProperty("--accent");
        }
      } catch (e) {}
    };
    
    applyCustomTheme();
    window.addEventListener("theme-changed", applyCustomTheme);
    return () => window.removeEventListener("theme-changed", applyCustomTheme);
  }, []);

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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="wordmark" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="status-dot" title="Core Online"></div>
            Genesis Grid
          </div>
        </div>

        <button 
          className="nav-item" 
          style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            background: 'var(--bg-sunken)',
            border: '1px solid var(--border)',
            padding: '8px 12px',
            marginTop: '-10px'
          }}
        >
          <span style={{ color: 'var(--ink-soft)' }}>Search...</span>
          <kbd style={{ 
            fontFamily: 'var(--font-mono)', 
            fontSize: '10px', 
            background: 'var(--bg-raised)', 
            padding: '2px 6px', 
            borderRadius: '4px',
            border: '1px solid var(--border)'
          }}>⌘K</kbd>
        </button>

        {updateAvailable && (
          <div className="card" style={{ padding: 12, fontSize: 12, background: "var(--accent)", color: "#fff", border: "none" }}>
            Update v{updateAvailable.version} is available!
            <button
              className="btn"
              style={{ marginTop: 8, width: "100%", background: "#fff", color: "var(--accent)" }}
              onClick={async () => {
                setInstallingUpdate(true);
                try {
                  await installUpdate();
                  await relaunch();
                } catch (e) {
                  console.error(e);
                  setInstallingUpdate(false);
                }
              }}
              disabled={installingUpdate}
            >
              {installingUpdate ? "Installing…" : "Install & Restart"}
            </button>
          </div>
        )}

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
            aria-current={view === "browser" ? "page" : undefined}
            onClick={() => setView("browser")}
          >
            Web Agent
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
            aria-current={view === "muse" ? "page" : undefined}
            onClick={() => setView("muse")}
          >
            Creator Forge
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
          <button
            className="nav-item"
            onClick={() => setShowFileExplorer(!showFileExplorer)}
          >
            {showFileExplorer ? "Hide Explorer" : "Show Explorer"}
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
          © 2026 Genesis Grid Labs,
          <div style={{ fontSize: 10, opacity: 0.6, marginTop: 4, textDecoration: "none" }}>
            v{appVersion}
          </div>
        </div>
      </aside>

      <main className="main-view" style={{ position: "relative" }}>
        {!showFileExplorer && (
          <button 
            onClick={() => setShowFileExplorer(true)}
            className="sidebar-close-btn"
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              background: "var(--bg-sunken)",
              border: "1px solid var(--border)",
              padding: "6px",
              zIndex: 100
            }}
            title="Open Explorer"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              <line x1="15" y1="3" x2="15" y2="21"></line>
            </svg>
          </button>
        )}
        {view === "agents" && <AgentsView installedModels={installedModels} />}
        {view === "kanban" && <KanbanBoard />}
        {view === "notebook" && <Notebook />}
        {view === "browser" && <BrowserUseMode />}
        {view === "muse" && <HermesMuse />}
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
      
      {showFileExplorer && (
        <aside className="right-sidebar">
          <FileExplorer onClose={() => setShowFileExplorer(false)} />
        </aside>
      )}
    </div>
  );
}
