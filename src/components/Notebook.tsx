import React, { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/tauri";

type CellType = "code" | "markdown";
type Language = "python" | "node";

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

  useEffect(() => {
    invoke<any[]>("list_notebooks")
      .then((loaded) => {
        if (loaded.length === 0) {
          const defaultNb: NotebookData = {
            id: "nb-" + Date.now(),
            title: "Scratchpad",
            cells: [
              { id: "c1", type: "markdown", language: "python", content: "# Genesis Sandbox\nWrite code below and hit **Run** to execute it locally.", output: null, isRunning: false },
              { id: "c2", type: "code", language: "python", content: "print('Hello from Genesis Grid Sandbox!')", output: null, isRunning: false }
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
      language: "python",
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

  const runCell = async (cellId: string) => {
    if (!activeNotebook) return;
    const cell = activeNotebook.cells.find(c => c.id === cellId);
    if (!cell || cell.type !== "code") return;

    updateCell(cellId, { isRunning: true, output: null });

    try {
      const output = await invoke<string>("run_code_sandbox", { 
        language: cell.language, 
        code: cell.content 
      });
      updateCell(cellId, { isRunning: false, output });
    } catch (err: any) {
      updateCell(cellId, { isRunning: false, output: err.toString() });
    }
  };

  return (
    <div className="view-container">
      <div style={{ padding: "20px 30px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2>{activeNotebook?.title || "Notebook"}</h2>
        <div style={{ color: "var(--ink-soft)" }}>Local Execution Sandbox</div>
      </div>

      <div style={{ padding: "20px 30px", overflowY: "auto", height: "calc(100vh - 80px)", display: "flex", flexDirection: "column", gap: "20px" }}>
        {activeNotebook?.cells.map((cell, index) => (
          <div key={cell.id} className="cyber-cell" style={{ display: "flex", flexDirection: "column", gap: "0", overflow: "hidden" }}>
            
            {/* Cell Toolbar */}
            <div style={{ background: "rgba(0,0,0,0.3)", padding: "10px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                <span style={{ color: "var(--accent-2)", fontSize: "14px", fontFamily: "var(--font-mono)", textShadow: "var(--glow-magenta)" }}>[{index + 1}]</span>
                {cell.type === "code" ? (
                  <select 
                    value={cell.language} 
                    onChange={e => updateCell(cell.id, { language: e.target.value as Language })}
                    style={{ background: "var(--bg-sunken)", color: "var(--ink)", border: "1px solid var(--border)", borderRadius: "4px", padding: "4px 8px", fontSize: "12px", outline: "none" }}
                  >
                    <option value="python">Python</option>
                    <option value="node">Node.js</option>
                  </select>
                ) : (
                  <span style={{ fontSize: "12px", color: "var(--accent)", letterSpacing: "1px", textShadow: "var(--glow-cyan)" }}>MARKDOWN</span>
                )}
              </div>
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                {cell.type === "code" && (
                  <button 
                    className="cyber-run-btn"
                    onClick={() => runCell(cell.id)}
                    disabled={cell.isRunning}
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
                  minHeight: cell.type === "code" ? "100px" : "40px", 
                  background: "transparent", 
                  border: "none", 
                  color: cell.type === "code" ? "#a6accd" : "var(--ink-main)", 
                  fontFamily: cell.type === "code" ? "monospace" : "inherit",
                  fontSize: "14px",
                  resize: "vertical",
                  outline: "none"
                }}
                placeholder={cell.type === "code" ? "Write code here..." : "Write markdown here..."}
              />
            </div>

            {/* Cell Output */}
            {cell.output !== null && (
              <div style={{ 
                padding: "12px 16px", 
                background: "#0d0f17", 
                borderTop: "1px solid var(--border)",
                color: "#c3e88d",
                fontFamily: "monospace",
                fontSize: "13px",
                whiteSpace: "pre-wrap"
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
        </div>
      </div>
    </div>
  );
}
