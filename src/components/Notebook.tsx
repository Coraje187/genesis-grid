import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { open } from "@tauri-apps/api/dialog";

type CellType = "code" | "markdown" | "chat";
type Language = "python" | "node" | string;

interface Cell {
  id: string;
  type: CellType;
  language: Language;
  content: string;
  output: string | null;
  isRunning: boolean;
}

interface NotebookData {
  id: string;
  title: string;
  cells: Cell[];
}

export default function Notebook() {
  const [notebooks, setNotebooks] = useState<NotebookData[]>([]);
  const [activeNotebookId, setActiveNotebookId] = useState<string | null>(null);
  const [installedModels, setInstalledModels] = useState<string[]>([]);

  useEffect(() => {
    // Load models
    invoke<string[]>("list_installed_models")
      .then(setInstalledModels)
      .catch(console.error);

    // Load notebooks
    invoke<any[]>("list_notebooks")
      .then((loaded) => {
        if (loaded.length === 0) {
          const defaultNb: NotebookData = {
            id: "nb-" + Date.now(),
            title: "Scratchpad",
            cells: [
              { id: "c1", type: "markdown", language: "python", content: "# Genesis Open Notebook\nWelcome to your AI-powered workspace. You can run code, take notes, and chat with AI using the context of this notebook.", output: null, isRunning: false },
              { id: "c2", type: "chat", language: "genesis", content: "Summarize this notebook for me.", output: null, isRunning: false }
            ]
          };
          invoke("save_notebook", { id: defaultNb.id, content: JSON.stringify(defaultNb) }).catch(console.error);
          setNotebooks([defaultNb]);
          setActiveNotebookId(defaultNb.id);
        } else {
          setNotebooks(loaded);
          setActiveNotebookId(loaded[0].id);
        }
      })
      .catch((err) => {
        console.error("Failed to load notebooks", err);
      });
  }, []);

  const activeNotebook = notebooks.find(n => n.id === activeNotebookId);

  const saveState = (newState: NotebookData[]) => {
    setNotebooks(newState);
    const active = newState.find(n => n.id === activeNotebookId);
    if (active) {
      invoke("save_notebook", { id: active.id, content: JSON.stringify(active) }).catch(console.error);
    }
  };

  const updateCell = (cellId: string, updates: Partial<Cell>) => {
    if (!activeNotebook) return;
    const newNotebooks = [...notebooks];
    const nbIndex = newNotebooks.findIndex(n => n.id === activeNotebookId);
    const nb = { ...newNotebooks[nbIndex] };
    const cellIndex = nb.cells.findIndex(c => c.id === cellId);
    
    nb.cells[cellIndex] = { ...nb.cells[cellIndex], ...updates };
    newNotebooks[nbIndex] = nb;
    saveState(newNotebooks);
  };

  const addCell = (type: CellType) => {
    if (!activeNotebook) return;
    const newNotebooks = [...notebooks];
    const nbIndex = newNotebooks.findIndex(n => n.id === activeNotebookId);
    const nb = { ...newNotebooks[nbIndex] };
    
    nb.cells.push({
      id: "c-" + Date.now(),
      type,
      language: type === "chat" ? (installedModels[0] || "genesis") : "python",
      content: "",
      output: null,
      isRunning: false
    });
    
    newNotebooks[nbIndex] = nb;
    saveState(newNotebooks);
  };

  const deleteCell = (cellId: string) => {
    if (!activeNotebook) return;
    const newNotebooks = [...notebooks];
    const nbIndex = newNotebooks.findIndex(n => n.id === activeNotebookId);
    const nb = { ...newNotebooks[nbIndex] };
    
    nb.cells = nb.cells.filter(c => c.id !== cellId);
    newNotebooks[nbIndex] = nb;
    saveState(newNotebooks);
  };

  const importFile = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{ name: 'Documents', extensions: ['txt', 'md', 'csv', 'json', 'py', 'js', 'ts', 'rs'] }]
      });
      if (typeof selected === 'string') {
        const content = await invoke<string>("read_file_text", { path: selected });
        const fileName = selected.split(/[/\\]/).pop();
        
        if (!activeNotebook) return;
        const newNotebooks = [...notebooks];
        const nbIndex = newNotebooks.findIndex(n => n.id === activeNotebookId);
        const nb = { ...newNotebooks[nbIndex] };
        
        nb.cells.push({
          id: "c-" + Date.now(),
          type: "markdown",
          language: "markdown",
          content: `### Source Document: ${fileName}\n\n\`\`\`\n${content}\n\`\`\``,
          output: null,
          isRunning: false
        });
        
        newNotebooks[nbIndex] = nb;
        saveState(newNotebooks);
      }
    } catch (err) {
      console.error("Failed to import file", err);
    }
  };

  const runCell = async (cellId: string) => {
    if (!activeNotebook) return;
    const cellIndex = activeNotebook.cells.findIndex(c => c.id === cellId);
    if (cellIndex === -1) return;
    const cell = activeNotebook.cells[cellIndex];
    
    if (cell.type === "markdown") return;

    updateCell(cellId, { isRunning: true, output: null });

    if (cell.type === "code") {
      try {
        const output = await invoke<string>("run_code_sandbox", { 
          language: cell.language, 
          code: cell.content 
        });
        updateCell(cellId, { isRunning: false, output });
      } catch (err: any) {
        updateCell(cellId, { isRunning: false, output: err.toString() });
      }
    } else if (cell.type === "chat") {
      try {
        let contextStr = "Here is the context from the notebook:\n\n";
        for (let i = 0; i < cellIndex; i++) {
          const c = activeNotebook.cells[i];
          contextStr += `[Cell ${i + 1} - ${c.type}]:\n${c.content}\n\n`;
          if (c.output) {
            contextStr += `[Cell ${i + 1} Output]:\n${c.output}\n\n`;
          }
        }
        contextStr += "Based on the above context, please answer the following:\n\n" + cell.content;

        const output = await invoke<string>("chat_send_sync", { 
          model: cell.language, 
          message: contextStr 
        });
        updateCell(cellId, { isRunning: false, output });
      } catch (err: any) {
        updateCell(cellId, { isRunning: false, output: err.toString() });
      }
    }
  };

  return (
    <div className="view-container">
      <div style={{ padding: "20px 30px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>{activeNotebook?.title || "Notebook"}</h2>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <button onClick={importFile} style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink-main)", padding: "8px 16px", borderRadius: "6px", cursor: "pointer", fontSize: "12px" }}>
            + Import Source Doc
          </button>
          <div style={{ color: "var(--ink-soft)" }}>AI-Powered Workspace</div>
        </div>
      </div>

      <div style={{ padding: "20px 30px", overflowY: "auto", height: "calc(100vh - 80px)", display: "flex", flexDirection: "column", gap: "20px" }}>
        {activeNotebook?.cells.map((cell, index) => (
          <div key={cell.id} className="cyber-cell" style={{ display: "flex", flexDirection: "column", gap: "0", overflow: "hidden", border: cell.type === "chat" ? "1px solid var(--accent)" : undefined }}>
            
            {/* Cell Toolbar */}
            <div style={{ background: "rgba(0,0,0,0.3)", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <span style={{ color: cell.type === "chat" ? "var(--accent)" : "var(--accent-2)", fontSize: "14px", fontFamily: "var(--font-mono)", textShadow: cell.type === "chat" ? "var(--glow-cyan)" : "var(--glow-magenta)" }}>[{index + 1}]</span>
                
                {cell.type === "code" && (
                  <select 
                    value={cell.language} 
                    onChange={e => updateCell(cell.id, { language: e.target.value as Language })}
                    style={{ background: "var(--bg-sunken)", color: "var(--ink)", border: "1px solid var(--border)", borderRadius: "4px", padding: "4px 8px", fontSize: "12px", outline: "none" }}
                  >
                    <option value="python">Python</option>
                    <option value="node">Node.js</option>
                  </select>
                )}
                
                {cell.type === "chat" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "12px", color: "var(--accent)", letterSpacing: "1px" }}>AI CHAT</span>
                    <select 
                      value={cell.language} 
                      onChange={e => updateCell(cell.id, { language: e.target.value as Language })}
                      style={{ background: "var(--bg-sunken)", color: "var(--ink)", border: "1px solid var(--border)", borderRadius: "4px", padding: "4px 8px", fontSize: "12px", outline: "none" }}
                    >
                      <option value="genesis">Genesis Default</option>
                      {installedModels.map(m => (
                        <option key={m} value={m}>{m}</option>
                      ))}
                    </select>
                  </div>
                )}

                {cell.type === "markdown" && (
                  <span style={{ fontSize: "12px", color: "var(--accent)", letterSpacing: "1px", textShadow: "var(--glow-cyan)" }}>MARKDOWN</span>
                )}
              </div>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                {(cell.type === "code" || cell.type === "chat") && (
                  <button 
                    className="cyber-run-btn"
                    onClick={() => runCell(cell.id)}
                    disabled={cell.isRunning}
                    style={{ background: cell.type === "chat" ? "var(--accent)" : undefined, color: cell.type === "chat" ? "#000" : undefined }}
                  >
                    {cell.isRunning ? "Running..." : "Run"}
                  </button>
                )}
                <button 
                  onClick={() => deleteCell(cell.id)}
                  style={{ background: "transparent", color: "var(--danger, #ff4444)", border: "1px solid var(--danger, #ff4444)", borderRadius: "4px", padding: "4px 12px", cursor: "pointer", fontSize: "12px" }}
                >
                  DELETE
                </button>
              </div>
            </div>

            {/* Cell Editor */}
            <div style={{ padding: "12px" }}>
              <textarea 
                value={cell.content}
                onChange={e => updateCell(cell.id, { content: e.target.value })}
                style={{ 
                  width: "100%", 
                  minHeight: cell.type === "code" ? "100px" : cell.type === "chat" ? "60px" : "40px", 
                  background: "transparent", 
                  border: "none", 
                  color: cell.type === "code" ? "#a6accd" : cell.type === "chat" ? "var(--accent)" : "var(--ink-main)", 
                  fontFamily: cell.type === "code" ? "monospace" : "inherit",
                  fontSize: "14px",
                  resize: "vertical",
                  outline: "none"
                }}
                placeholder={cell.type === "code" ? "Write code here..." : cell.type === "chat" ? "Ask the AI a question about this notebook..." : "Write markdown or paste text here..."}
              />
            </div>

            {/* Cell Output */}
            {cell.output !== null && (
              <div style={{ 
                padding: "12px 16px", 
                background: cell.type === "chat" ? "rgba(0, 255, 255, 0.05)" : "#0d0f17", 
                borderTop: cell.type === "chat" ? "1px dashed var(--accent)" : "1px solid var(--border)",
                color: cell.type === "chat" ? "var(--ink)" : "#c3e88d",
                fontFamily: cell.type === "chat" ? "inherit" : "monospace",
                fontSize: "13px",
                whiteSpace: "pre-wrap",
                lineHeight: "1.5"
              }}>
                {cell.output}
              </div>
            )}
          </div>
        ))}

        <div style={{ display: "flex", gap: "12px", padding: "20px 0", justifyContent: "center" }}>
          <button 
            onClick={() => addCell("code")}
            style={{ background: "var(--surface)", border: "1px dashed var(--border)", color: "var(--ink-main)", padding: "12px 24px", borderRadius: "8px", cursor: "pointer" }}
          >
            + Code Cell
          </button>
          <button 
            onClick={() => addCell("markdown")}
            style={{ background: "var(--surface)", border: "1px dashed var(--border)", color: "var(--ink-main)", padding: "12px 24px", borderRadius: "8px", cursor: "pointer" }}
          >
            + Markdown Cell
          </button>
          <button 
            onClick={() => addCell("chat")}
            style={{ background: "var(--surface)", border: "1px dashed var(--accent)", color: "var(--accent)", padding: "12px 24px", borderRadius: "8px", cursor: "pointer", textShadow: "var(--glow-cyan)" }}
          >
            + AI Chat Cell
          </button>
        </div>
      </div>
    </div>
  );
}
