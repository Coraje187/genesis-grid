import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";

export default function MemoryCore() {
  const [wikiContent, setWikiContent] = useState("");
  const [saveStatus, setSaveStatus] = useState("Saved");
  const [freeLlmApiKey, setFreeLlmApiKey] = useState("");
  const [freeLlmApiModel, setFreeLlmApiModel] = useState("");
  const [compiling, setCompiling] = useState(false);
  const [compileStatus, setCompileStatus] = useState("");

  useEffect(() => {
    // Load wiki content
    invoke<string>("load_genesis_wiki")
      .then(setWikiContent)
      .catch(() => {
        const localWiki = window.localStorage.getItem("genesis_wiki") || "# Genesis Memory Wiki\n\n- User preferences: Developer mode active.\n- Key focus: Speed and premium design aesthetics.\n";
        setWikiContent(localWiki);
      });

    // Load settings for the background compiler
    const localKey = window.localStorage.getItem("freellmapi_unified_key") || "";
    const localModel = window.localStorage.getItem("freellmapi_default_model") || "";
    setFreeLlmApiKey(localKey);
    setFreeLlmApiModel(localModel);

    invoke<any>("load_freellmapi_settings")
      .then((s) => {
        const keyVal = s?.unified_key ?? s?.unifiedKey;
        const modelVal = s?.default_model ?? s?.defaultModel;
        if (keyVal) setFreeLlmApiKey(keyVal);
        if (modelVal) setFreeLlmApiModel(modelVal);
      })
      .catch(() => {});
  }, []);

  function handleSave(content: string) {
    setWikiContent(content);
    setSaveStatus("Saving…");
    window.localStorage.setItem("genesis_wiki", content);
    invoke("save_genesis_wiki", { content })
      .then(() => setSaveStatus("Saved"))
      .catch(() => setSaveStatus("Saved locally"));
  }

  async function handleOptimize() {
    if (!freeLlmApiKey) {
      setCompileStatus("Configure FreeLLMAPI key in 'Use online instead' first.");
      return;
    }
    setCompiling(true);
    setCompileStatus("Optimizing context memory…");

    const prompt = `You are the Memory Compiler Core of Genesis. 
Review the existing Memory Wiki and clean it up. Combine duplicate items, structure notes logically, and optimize formatting.

Existing Memory Wiki:
"""
${wikiContent}
"""

Respond ONLY with the raw updated markdown content. Do not include chat intro/outro, backticks, or code blocks.`;

    try {
      const updated = await invoke<string>("chat_via_freellmapi", {
        unifiedKey: freeLlmApiKey,
        unified_key: freeLlmApiKey,
        model: freeLlmApiModel || "auto",
        message: prompt,
      });
      if (updated && updated.trim() && !updated.startsWith("Error:")) {
        handleSave(updated.trim());
        setCompileStatus("Memory Core optimized successfully!");
      } else {
        setCompileStatus("Failed to compile: Invalid response.");
      }
    } catch (e) {
      setCompileStatus(`Compilation failed: ${e}`);
    } finally {
      setCompiling(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Memory Core</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Configure and compile the persistent long-term memories for your Genesis agent.
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <span style={{ fontSize: 13, color: "var(--ink-soft)" }}>
            Status: <span style={{ color: "#00f2fe", fontWeight: "bold" }}>● {saveStatus}</span>
          </span>
          <button 
            className="btn" 
            onClick={handleOptimize}
            disabled={compiling}
          >
            {compiling ? "Optimizing…" : "Optimize memories"}
          </button>
        </div>
      </div>

      {compileStatus && (
        <div 
          className="card" 
          style={{ 
            padding: 12, 
            marginBottom: 16, 
            fontSize: 13, 
            borderColor: compiling ? "var(--border)" : "var(--accent)",
            background: "var(--bg-sunken)",
            color: "var(--ink)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}
        >
          <span>{compileStatus}</span>
          <button 
            style={{ background: "none", border: "none", color: "var(--ink-soft)", cursor: "pointer" }}
            onClick={() => setCompileStatus("")}
          >
            ✕
          </button>
        </div>
      )}

      <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>
        {/* Editor panel */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          <textarea
            value={wikiContent}
            onChange={(e) => handleSave(e.target.value)}
            placeholder="Write persistent notes, tasks, knowledge bases, or configurations for Genesis Agent here…"
            style={{
              flex: 1,
              padding: 16,
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
              background: "var(--bg-sunken)",
              color: "var(--ink)",
              fontFamily: "var(--font-mono)",
              fontSize: 13,
              resize: "none",
              lineHeight: 1.6
            }}
          />
        </div>

        {/* Live Preview panel */}
        <div 
          className="card"
          style={{ 
            flex: 1, 
            padding: 20, 
            borderRadius: "var(--radius-md)", 
            overflowY: "auto",
            background: "var(--bg)",
            border: "1px solid var(--border)",
            fontSize: 14,
            lineHeight: 1.6
          }}
        >
          <div style={{ borderBottom: "1px solid var(--border)", paddingBottom: 8, marginBottom: 12 }}>
            <span style={{ fontSize: 12, fontWeight: "bold", textTransform: "uppercase", color: "var(--ink-soft)" }}>
              Live System Preview
            </span>
          </div>
          <div style={{ whiteSpace: "pre-wrap", fontFamily: "var(--font-body)" }}>
            {wikiContent || <p style={{ color: "var(--ink-soft)" }}>No memory core documents created yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
