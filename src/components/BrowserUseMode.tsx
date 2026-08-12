import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { listen } from "@tauri-apps/api/event";

export default function BrowserUseMode() {
  const [task, setTask] = useState("");
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-4o");
  const [logs, setLogs] = useState<{type: string, message?: string, result?: string}[]>([]);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unlistenUpdate = listen("browser-task-update", (event: any) => {
      const data = event.payload;
      setLogs((prev) => [...prev, data]);
      if (data.type === "error") {
        setError(data.message || "An error occurred.");
      }
    });

    const unlistenLog = listen("browser-task-log", (event: any) => {
      setLogs((prev) => [...prev, { type: "stdout", message: event.payload }]);
    });

    const unlistenExit = listen("browser-task-exit", () => {
      setRunning(false);
    });

    return () => {
      unlistenUpdate.then((f) => f());
      unlistenLog.then((f) => f());
      unlistenExit.then((f) => f());
    };
  }, []);

  const handleStartTask = async () => {
    if (!task) return;
    setRunning(true);
    setError("");
    setLogs([]);
    try {
      await invoke("run_browser_task", { task, provider, model });
    } catch (e: any) {
      setError(e.toString());
      setRunning(false);
    }
  };

  return (
    <div className="main-view" style={{ display: 'flex', flexDirection: 'column', gap: '24px', height: '100%' }}>
      <div>
        <h1 className="page-title" style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          Web Agent <span className="tier-badge" style={{ fontSize: "12px", padding: "4px 10px" }}>BETA</span>
        </h1>
        <p className="page-sub">
          Give the AI a goal and it will autonomously surf the web in a browser to complete it.
        </p>
      </div>

      <div className="card">
        <h2 style={{ fontSize: "16px", marginBottom: "16px", color: "var(--ink)", fontWeight: 600 }}>Task Input</h2>
        
        <div style={{ display: "flex", gap: "12px", marginBottom: "12px" }}>
          <select 
            value={provider} 
            onChange={(e) => setProvider(e.target.value)}
            style={{ 
              background: "var(--bg-sunken)", border: "1px solid var(--border)", 
              borderRadius: "var(--radius-sm)", padding: "10px", color: "var(--ink)", outline: "none" 
            }}
          >
            <option value="openai">OpenAI (Recommended)</option>
            <option value="openrouter">OpenRouter</option>
            <option value="gemini">Gemini</option>
            <option value="custom">Custom Endpoint</option>
          </select>
          
          <input 
            type="text" 
            placeholder="Model (e.g. gpt-4o)"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            style={{ 
              flex: 1, background: "var(--bg-sunken)", border: "1px solid var(--border)", 
              borderRadius: "var(--radius-sm)", padding: "10px", color: "var(--ink)", outline: "none" 
            }}
          />
        </div>

        <textarea 
          placeholder="e.g. Find the cheapest 1440p monitor on Amazon and summarize the reviews..."
          style={{ 
            width: "100%", background: "var(--bg-sunken)", border: "1px solid var(--border)", 
            borderRadius: "var(--radius-sm)", padding: "12px", color: "var(--ink)", 
            minHeight: "80px", resize: "vertical", outline: "none", marginBottom: "12px"
          }}
          value={task}
          onChange={(e) => setTask(e.target.value)}
          disabled={running}
        />
        
        <button 
          onClick={handleStartTask}
          disabled={running || !task}
          className="btn"
          style={{ padding: "10px 24px" }}
        >
          {running ? "Agent is browsing..." : "Start Agent"}
        </button>
        {error && <p style={{ color: "var(--warn)", fontSize: "13px", marginTop: "12px" }}>{error}</p>}
      </div>

      <div className="card" style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <h2 style={{ fontSize: "16px", marginBottom: "16px", color: "var(--ink)", fontWeight: 600 }}>Live Feed</h2>
        <div style={{ 
          flex: 1, background: "var(--bg)", border: "1px solid var(--border)", 
          borderRadius: "var(--radius-sm)", padding: "16px", overflowY: "auto",
          fontFamily: "var(--font-mono)", fontSize: "13px", color: "var(--ink-soft)"
        }}>
          {logs.length === 0 && !running && <div style={{ opacity: 0.5 }}>No active task...</div>}
          {logs.map((log, idx) => (
            <div key={idx} style={{ marginBottom: "8px", borderBottom: log.type === 'success' ? 'none' : "1px solid var(--border)", paddingBottom: "8px" }}>
              {log.type === "progress" && <span style={{ color: "var(--accent)" }}>[INFO] {log.message}</span>}
              {log.type === "error" && <span style={{ color: "var(--warn)" }}>[ERROR] {log.message}</span>}
              {log.type === "stdout" && <span style={{ opacity: 0.8 }}>{log.message}</span>}
              {log.type === "success" && (
                <div style={{ 
                  marginTop: "12px", padding: "16px", background: "var(--bg-sunken)", 
                  border: "1px solid var(--accent)", borderRadius: "var(--radius-sm)",
                  color: "var(--ink)"
                }}>
                  <strong style={{ color: "var(--accent)", display: "block", marginBottom: "8px" }}>Task Completed:</strong>
                  <div style={{ whiteSpace: "pre-wrap" }}>{log.result}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
