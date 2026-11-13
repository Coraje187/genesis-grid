import { useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { estimateTokens } from "../lib/chatUtils";

interface CompareResult {
  text: string;
  ms: number;
  tokPerSec: number;
  error?: string;
}

const ONLINE_PROVIDERS = ["openrouter", "openai", "gemini", "freellmapi"];

export default function ModelCompareModal({
  installedModels,
  onClose,
}: {
  installedModels: string[];
  onClose: () => void;
}) {
  const allModels = [...installedModels, ...ONLINE_PROVIDERS];
  const [modelA, setModelA] = useState(allModels[0] ?? "openrouter");
  const [modelB, setModelB] = useState(allModels[1] ?? allModels[0] ?? "gemini");
  const [prompt, setPrompt] = useState("");
  const [running, setRunning] = useState(false);
  const [resultA, setResultA] = useState<CompareResult | null>(null);
  const [resultB, setResultB] = useState<CompareResult | null>(null);

  async function querySingleModel(target: string, userPrompt: string): Promise<CompareResult> {
    const t0 = performance.now();
    try {
      let text = "";
      if (ONLINE_PROVIDERS.includes(target)) {
        text = await invoke<string>("chat_freellmapi", {
          model: target === "freellmapi" ? "openrouter/auto" : "",
          provider: target,
          history: [{ role: "user", content: userPrompt }],
        });
      } else {
        const res = await fetch("http://127.0.0.1:11434/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: target,
            messages: [{ role: "user", content: userPrompt }],
            stream: false,
          }),
        });
        if (!res.ok) throw new Error(`Ollama HTTP ${res.status}`);
        const data = await res.json();
        text = data?.message?.content ?? "";
      }
      const ms = Math.max(1, Math.round(performance.now() - t0));
      const tokens = estimateTokens(text);
      const tokPerSec = Math.round((tokens / (ms / 1000)) * 10) / 10;
      return { text, ms, tokPerSec };
    } catch (e) {
      const ms = Math.max(1, Math.round(performance.now() - t0));
      return { text: "", ms, tokPerSec: 0, error: String(e) };
    }
  }

  async function handleRunCompare() {
    if (!prompt.trim() || running) return;
    setRunning(true);
    setResultA(null);
    setResultB(null);
    const [a, b] = await Promise.all([
      querySingleModel(modelA, prompt.trim()),
      querySingleModel(modelB, prompt.trim()),
    ]);
    setResultA(a);
    setResultB(b);
    setRunning(false);
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        background: "rgba(0, 0, 0, 0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "min(1080px, 96vw)",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          gap: 14,
          padding: 20,
          borderRadius: "var(--radius-md)",
          background: "var(--bg)",
          border: "1px solid var(--border)",
          color: "var(--ink)",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 16 }}>⚖️ Side-by-Side Model Compare</h3>
            <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
              Send one prompt to two models concurrently and compare latency, speed, and output.
            </span>
          </div>
          <button className="btn secondary" onClick={onClose}>
            Close
          </button>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="Enter a prompt to test across both models..."
            rows={2}
            style={{
              flex: 1,
              minWidth: 260,
              padding: "10px 12px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--bg-sunken)",
              color: "var(--ink)",
              resize: "none",
            }}
          />
          <button className="btn" onClick={handleRunCompare} disabled={running || !prompt.trim()}>
            {running ? "Running..." : "Run Compare"}
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, flex: 1, minHeight: 300, overflow: "hidden" }}>
          {[
            { label: "Model A", selected: modelA, setSelected: setModelA, result: resultA },
            { label: "Model B", selected: modelB, setSelected: setModelB, result: resultB },
          ].map((col) => (
            <div
              key={col.label}
              style={{
                display: "flex",
                flexDirection: "column",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--bg-sunken)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "8px 12px",
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <select
                  value={col.selected}
                  onChange={(e) => col.setSelected(e.target.value)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    color: "var(--ink)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    flex: 1,
                  }}
                >
                  {allModels.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                {col.result && !col.result.error && (
                  <span style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--accent)", whiteSpace: "nowrap" }}>
                    {col.result.ms}ms · {col.result.tokPerSec} tok/s
                  </span>
                )}
              </div>
              <div style={{ padding: 12, overflowY: "auto", flex: 1, fontSize: 13, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
                {running && !col.result && <span style={{ color: "var(--ink-soft)" }}>Generating response...</span>}
                {col.result?.error && <span style={{ color: "#ff5c5c" }}>Error: {col.result.error}</span>}
                {col.result && !col.result.error && col.result.text}
                {!running && !col.result && (
                  <span style={{ color: "var(--ink-soft)" }}>Run a prompt above to compare outputs.</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
