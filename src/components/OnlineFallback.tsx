import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { listen } from "@tauri-apps/api/event";

interface FreeLlmApiStatus {
  node_installed: boolean;
  git_installed: boolean;
  cloned: boolean;
  running: boolean;
}

interface SetupProgress {
  stage: "downloading" | "installing" | "done" | "error";
  percent: number;
  message: string;
}

export default function OnlineFallback() {
  const [status, setStatus] = useState<FreeLlmApiStatus | null>(null);
  const [progress, setProgress] = useState<SetupProgress | null>(null);
  const [settingUp, setSettingUp] = useState(false);
  const [unifiedKey, setUnifiedKey] = useState("");
  const [defaultModel, setDefaultModel] = useState("");
  const [settingsError, setSettingsError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [testMessage, setTestMessage] = useState("Say hello in five words.");
  const [testReply, setTestReply] = useState("");
  const [testing, setTesting] = useState(false);
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");

  function refreshStatus() {
    invoke<FreeLlmApiStatus>("freellmapi_status").then(setStatus).catch(() => {});
  }

  useEffect(() => {
    refreshStatus();
    const loadSettings = () => {
      const localKey = window.localStorage.getItem("freellmapi_unified_key") || "";
      const localModel = window.localStorage.getItem("freellmapi_default_model") || "";
      const localOpenrouterKey = window.localStorage.getItem("freellmapi_openrouter_key") || "";
      const localOpenaiKey = window.localStorage.getItem("freellmapi_openai_key") || "";
      const localGeminiKey = window.localStorage.getItem("freellmapi_gemini_key") || "";

      setUnifiedKey(localKey);
      setDefaultModel(localModel);
      setOpenrouterKey(localOpenrouterKey);
      setOpenaiKey(localOpenaiKey);
      setGeminiKey(localGeminiKey);
    };

    loadSettings();

    invoke<any>("load_freellmapi_settings")
      .then((s) => {
        if (s) {
          const keyVal = s.unified_key ?? s.unifiedKey ?? "";
          const modelVal = s.default_model ?? s.defaultModel ?? "";
          const orKey = s.openrouter_key ?? s.openrouterKey ?? "";
          const oaKey = s.openai_key ?? s.openaiKey ?? "";
          const gemKey = s.gemini_key ?? s.geminiKey ?? "";

          setUnifiedKey(keyVal);
          setDefaultModel(modelVal);
          setOpenrouterKey(orKey);
          setOpenaiKey(oaKey);
          setGeminiKey(gemKey);

          window.localStorage.setItem("freellmapi_unified_key", keyVal);
          window.localStorage.setItem("freellmapi_default_model", modelVal);
          window.localStorage.setItem("freellmapi_openrouter_key", orKey);
          window.localStorage.setItem("freellmapi_openai_key", oaKey);
          window.localStorage.setItem("freellmapi_gemini_key", gemKey);
        }
      })
      .catch((e) => {
        // If the Tauri backend load command is missing, we just silently rely on localStorage.
      });

    const unlisten = listen<SetupProgress>("freellmapi-setup-progress", (event) => {
      setProgress(event.payload);
      if (event.payload.stage === "done" || event.payload.stage === "error") {
        setSettingUp(false);
        refreshStatus();
      }
    });

    window.addEventListener("storage", loadSettings);
    return () => {
      window.removeEventListener("storage", loadSettings);
      unlisten.then((f) => f());
    };
  }, []);

  function persistSettings(key: string, model: string) {
    // Write to localStorage immediately
    window.localStorage.setItem("freellmapi_unified_key", key);
    window.localStorage.setItem("freellmapi_default_model", model);

    const orKey = window.localStorage.getItem("freellmapi_openrouter_key") || "";
    const orModel = window.localStorage.getItem("freellmapi_openrouter_model") || "";
    const oaKey = window.localStorage.getItem("freellmapi_openai_key") || "";
    const oaModel = window.localStorage.getItem("freellmapi_openai_model") || "";
    const gemKey = window.localStorage.getItem("freellmapi_gemini_key") || "";
    const gemModel = window.localStorage.getItem("freellmapi_gemini_model") || "";
    const custKey = window.localStorage.getItem("freellmapi_custom_key") || "";
    const custUrl = window.localStorage.getItem("freellmapi_custom_url") || "";

    invoke("save_freellmapi_settings", { 
      unifiedKey: key, 
      unified_key: key, 
      defaultModel: model, 
      default_model: model,
      openrouterKey: orKey,
      openrouter_key: orKey,
      openrouterModel: orModel,
      openrouter_model: orModel,
      openaiKey: oaKey,
      openai_key: oaKey,
      openaiModel: oaModel,
      openai_model: oaModel,
      geminiKey: gemKey,
      gemini_key: gemKey,
      geminiModel: gemModel,
      gemini_model: gemModel,
      customKey: custKey,
      custom_key: custKey,
      customUrl: custUrl,
      custom_url: custUrl,
      mode: "proxy",
      provider: "freellmapi"
    })
      .then(() => {
        setSettingsError("");
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      })
      .catch((e) => {
        const errStr = String(e);
        if (errStr.includes("not found")) {
          // If the Tauri command is not found in the current build, we suppress the error
          // since the key is successfully saved in localStorage and will function fine.
          setSettingsError("");
          setSaveSuccess(true);
          setTimeout(() => setSaveSuccess(false), 3000);
        } else {
          setSettingsError(`Couldn't save: ${e}`);
          setSaveSuccess(false);
        }
      });
  }

  async function handleSetup() {
    setSettingUp(true);
    setProgress({ stage: "installing", percent: 0, message: "Starting…" });
    try {
      await invoke<string>("setup_freellmapi");
    } catch (e) {
      setProgress({ stage: "error", percent: 0, message: String(e) });
      setSettingUp(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setTestReply("");
    try {
      const reply = await invoke<string>("chat_via_freellmapi", {
        unifiedKey,
        model: defaultModel,
        message: testMessage,
      });
      setTestReply(reply);
    } catch (e) {
      setTestReply(`Error: ${e}`);
    }
    setTesting(false);
  }

  const prereqsMissing = status && (!status.node_installed || !status.git_installed);
  const directConfigured = !!(openrouterKey || openaiKey || geminiKey);

  return (
    <div>
      <h1 className="page-title">No local model? No problem.</h1>
      <p className="page-sub">
        Genesis Grid can run <strong>FreeLLMAPI</strong> on your own machine —
        a free proxy that routes chats through your own provider keys
        (Google, Groq, and others). It's self-hosted per person, so it stays
        free and nothing is shared between you and your friends.
      </p>

      {directConfigured && (
        <div className="card" style={{ background: "rgba(var(--accent-rgb), 0.1)", borderColor: "var(--accent)", marginBottom: 16 }}>
          <span style={{ fontSize: 14, fontWeight: "bold", display: "block", marginBottom: 6, color: "var(--accent)" }}>
            ✨ Direct Cloud Fallbacks Configured
          </span>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-soft)" }}>
            Direct connections for {openrouterKey && "OpenRouter "} {openaiKey && "OpenAI "} {geminiKey && "Gemini "} are active. You can select them directly in the Chat dropdown as online fallback options without needing a local proxy!
          </p>
        </div>
      )}

      <div className="card">
        {!status ? (
          <p style={{ color: "var(--ink-soft)" }}>Checking status…</p>
        ) : status.running ? (
          <>
            <span className="tier-badge" style={{ background: "var(--success)" }}>
              Running
            </span>
            <p style={{ marginTop: 12 }}>
              FreeLLMAPI is running at <code>localhost:3001</code>.
            </p>
            <button
              className="btn secondary"
              onClick={() => invoke("open_freellmapi_dashboard")}
            >
              Open dashboard to add provider keys
            </button>
          </>
        ) : prereqsMissing ? (
          <>
            <p>
              This feature needs <strong>Node.js 20+</strong> and{" "}
              <strong>git</strong> installed first — Genesis Grid itself
              doesn't need them, but FreeLLMAPI is a separate project that
              does.
            </p>
            <ul style={{ color: "var(--ink-soft)", fontSize: 13 }}>
              <li>
                Node.js: {status.node_installed ? "found" : (
                  <>
                    not found — get it from{" "}
                    <span 
                      style={{ color: "var(--accent)", cursor: "pointer", textDecoration: "underline" }}
                      onClick={() => invoke("open_url", { url: "https://nodejs.org/" })}
                    >
                      nodejs.org
                    </span>
                  </>
                )}
              </li>
              <li>
                git: {status.git_installed ? "found" : (
                  <>
                    not found — get it from{" "}
                    <span 
                      style={{ color: "var(--accent)", cursor: "pointer", textDecoration: "underline" }}
                      onClick={() => invoke("open_url", { url: "https://git-scm.com/" })}
                    >
                      git-scm.com
                    </span>
                  </>
                )}
              </li>
            </ul>
            <button className="btn secondary" onClick={refreshStatus}>
              I've installed them — check again
            </button>
          </>
        ) : (
          <>
            <p>Ready to set up. This downloads FreeLLMAPI and starts it locally.</p>
            <button className="btn" onClick={handleSetup} disabled={settingUp}>
              {settingUp ? "Setting up…" : "Set up FreeLLMAPI"}
            </button>
            {progress && (
              <div style={{ marginTop: 12, fontSize: 13, color: "var(--ink-soft)" }}>
                {progress.message}
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
                      width: `${progress.percent}%`,
                      height: "100%",
                      background: progress.stage === "error" ? "var(--warn)" : "var(--accent)",
                      transition: "width 0.2s ease",
                    }}
                  />
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {status?.running && (
        <div className="card" style={{ marginTop: 16 }}>
          <h3 style={{ marginTop: 0 }}>Try it</h3>
          <p style={{ color: "var(--ink-soft)", fontSize: 13 }}>
            Paste the unified key from the dashboard's Keys page, then send a
            test message.
          </p>
          <input
            value={unifiedKey}
            onChange={(e) => setUnifiedKey(e.target.value)}
            placeholder="freellmapi-…"
            style={{
              width: "100%",
              padding: "10px 12px",
              marginBottom: 8,
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--bg-sunken)",
              color: "var(--ink)",
              fontFamily: "var(--font-mono)",
            }}
          />
          <input
            value={defaultModel}
            onChange={(e) => setDefaultModel(e.target.value)}
            placeholder="model (e.g. auto, or a name from the dashboard)"
            style={{
              width: "100%",
              padding: "10px 12px",
              marginBottom: 8,
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--bg-sunken)",
              color: "var(--ink)",
              fontFamily: "var(--font-mono)",
            }}
          />
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <button
              className="btn"
              onClick={() => persistSettings(unifiedKey, defaultModel)}
            >
              Save Settings
            </button>
            {saveSuccess && (
              <span style={{ color: "var(--success)", fontSize: 13 }}>
                ✓ Settings saved!
              </span>
            )}
          </div>
          {settingsError && (
            <p style={{ color: "var(--warn)", fontSize: 12, marginTop: -8, marginBottom: 16 }}>
              {settingsError}
            </p>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <input
              value={testMessage}
              onChange={(e) => setTestMessage(e.target.value)}
              style={{
                flex: 1,
                padding: "10px 12px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: "var(--bg-sunken)",
                color: "var(--ink)",
              }}
            />
            <button className="btn" onClick={handleTest} disabled={testing || !unifiedKey}>
              {testing ? "Sending…" : "Send"}
            </button>
          </div>
          {testReply && (
            <div className="advanced-panel" style={{ marginTop: 12 }}>
              {testReply}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
