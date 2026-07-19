import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { open } from "@tauri-apps/api/dialog";
import ForceGraph2D from "react-force-graph-2d";

interface VaultNode {
  id: string;
  name: string;
  group: number;
}

interface VaultLink {
  source: string;
  target: string;
}

interface VaultGraph {
  nodes: VaultNode[];
  links: VaultLink[];
}

export default function MemoryCore() {
  const [vaultPath, setVaultPath] = useState<string>("");
  const [graphData, setGraphData] = useState<VaultGraph>({ nodes: [], links: [] });
  const [selectedNode, setSelectedNode] = useState<VaultNode | null>(null);
  const [fileContent, setFileContent] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const savedPath = window.localStorage.getItem("genesis_vault_path");
    if (savedPath) {
      setVaultPath(savedPath);
      loadVault(savedPath);
    }

  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setContainerDimensions({
          width: entries[0].contentRect.width,
          height: entries[0].contentRect.height
        });
      }
    });
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, [vaultPath]);

  async function handleSelectVault() {
    const selected = await open({
      directory: true,
      multiple: false,
    });
    if (selected && !Array.isArray(selected)) {
      setVaultPath(selected);
      window.localStorage.setItem("genesis_vault_path", selected);
      loadVault(selected);
    }
  }

  async function loadVault(path: string) {
    try {
      const data = await invoke<VaultGraph>("scan_vault", { path });
      setGraphData(data);
    } catch (e) {
      console.error("Failed to load vault:", e);
    }
  }

  async function handleNodeClick(node: VaultNode) {
    setSelectedNode(node);
    try {
      const content = await invoke<string>("read_vault_file", { path: node.id });
      setFileContent(content);
      setIsEditing(false);
    } catch (e) {
      setFileContent(`Error loading file: ${e}`);
    }
  }

  async function handleSaveFile() {
    if (!selectedNode) return;
    setSaveStatus("Saving…");
    try {
      await invoke("write_vault_file", { path: selectedNode.id, content: fileContent });
      setSaveStatus("Saved");
      setIsEditing(false);
      // Reload vault to catch any new links
      loadVault(vaultPath);
      setTimeout(() => setSaveStatus(""), 2000);
    } catch (e) {
      setSaveStatus(`Error: ${e}`);
    }
  }

  async function handleCreateNewFile() {
    const fileName = prompt("Enter new file name (without .md):");
    if (!fileName) return;
    
    // Simple path join based on OS (assuming Windows backslash or forward slash based on vaultPath)
    const separator = vaultPath.includes("\\") ? "\\" : "/";
    const newPath = `${vaultPath}${separator}${fileName}.md`;
    
    try {
      await invoke("write_vault_file", { path: newPath, content: `# ${fileName}\n\nStart writing here...` });
      loadVault(vaultPath);
    } catch (e) {
      alert(`Error creating file: ${e}`);
    }
  }

  if (!vaultPath) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%" }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>🧠</div>
        <h1 className="page-title">Initialize Memory Core</h1>
        <p className="page-sub" style={{ textAlign: "center", maxWidth: 400, marginBottom: 30 }}>
          Genesis Grid uses a local, markdown-based vault to store memories, skills, and projects. Select an empty folder on your computer to serve as your Brain.
        </p>
        <button className="btn" onClick={handleSelectVault} style={{ fontSize: 16, padding: "12px 24px" }}>
          Select Vault Directory
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>Memory Core</h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            Visualizing Vault: <span style={{ fontFamily: "var(--font-mono)", color: "var(--ink)" }}>{vaultPath}</span>
          </p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn" onClick={handleCreateNewFile} style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--ink)" }}>
            + New Node
          </button>
          <button className="btn" onClick={() => loadVault(vaultPath)} style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--ink)" }}>
            Refresh
          </button>
          <button className="btn" onClick={handleSelectVault} style={{ background: "transparent", border: "1px solid var(--border)", color: "var(--ink)" }}>
            Change Vault
          </button>
        </div>
      </div>

      <div style={{ display: "flex", gap: 16, flex: 1, minHeight: 0 }}>
        {/* Graph View */}
        <div 
          ref={containerRef}
          style={{ 
            flex: selectedNode ? 1 : 2, 
            background: "#0d0f12", 
            borderRadius: "var(--radius-md)", 
            overflow: "hidden",
            position: "relative",
            border: "1px solid var(--border)",
            transition: "flex 0.3s ease"
          }}
        >
          {containerDimensions.width > 0 && (
            <ForceGraph2D
              width={containerDimensions.width}
              height={containerDimensions.height}
              graphData={graphData}
              nodeLabel="name"
              linkColor={() => "rgba(255, 255, 255, 0.15)"}
              backgroundColor="#0d0f12"
              onNodeClick={handleNodeClick}
              linkWidth={1}
              linkDirectionalParticles={2}
              linkDirectionalParticleSpeed={0.005}
              nodeCanvasObject={(node: any, ctx, globalScale) => {
                if (typeof node.x !== 'number' || typeof node.y !== 'number') return;
                const radius = 4;
                
                // Deterministic color based on node name
                const colors = ["#00f2fe", "#ff2ec8", "#ffb300", "#9b3ffb", "#00ff9d", "#ff3366", "#ffffff"];
                let hash = 0;
                for (let i = 0; i < node.id.length; i++) hash = node.id.charCodeAt(i) + ((hash << 5) - hash);
                const glowColor = colors[Math.abs(hash) % colors.length];

                // Create a beautiful glowing orb effect
                const gradient = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, radius * 3);
                gradient.addColorStop(0, "rgba(255, 255, 255, 1)"); // Hot white core
                gradient.addColorStop(0.3, glowColor); // Colored glow
                gradient.addColorStop(1, "rgba(0, 0, 0, 0)"); // Fade to transparent
                
                ctx.beginPath();
                ctx.arc(node.x, node.y, radius * 3, 0, 2 * Math.PI, false);
                ctx.fillStyle = gradient;
                ctx.fill();

                // Draw the crisp text label underneath
                const label = node.name;
                const fontSize = 12 / globalScale;
                ctx.font = `600 ${fontSize}px Sans-Serif`;
                ctx.textAlign = "center";
                ctx.textBaseline = "top";
                ctx.fillStyle = "rgba(255, 255, 255, 0.9)";
                ctx.fillText(label, node.x, node.y + radius * 2);
              }}
            />
          )}
          <div style={{ position: "absolute", top: 10, left: 10, color: "rgba(255,255,255,0.5)", fontSize: 12 }}>
            {graphData.nodes.length} nodes | {graphData.links.length} links
          </div>
        </div>

        {/* Editor Panel */}
        {selectedNode && (
          <div 
            className="card"
            style={{ 
              flex: 1, 
              display: "flex", 
              flexDirection: "column",
              borderRadius: "var(--radius-md)", 
              background: "var(--bg-sunken)",
              border: "1px solid var(--border)",
              overflow: "hidden",
              transition: "flex 0.3s ease"
            }}
          >
            <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg)" }}>
              <div style={{ fontWeight: "bold", fontSize: 14 }}>{selectedNode.name}.md</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {saveStatus && <span style={{ fontSize: 12, color: "var(--accent)" }}>{saveStatus}</span>}
                {isEditing ? (
                  <>
                    <button className="btn" onClick={() => setIsEditing(false)} style={{ padding: "4px 8px", fontSize: 12, background: "transparent", border: "1px solid var(--border)", color: "var(--ink)" }}>Cancel</button>
                    <button className="btn" onClick={handleSaveFile} style={{ padding: "4px 8px", fontSize: 12 }}>Save</button>
                  </>
                ) : (
                  <button className="btn" onClick={() => setIsEditing(true)} style={{ padding: "4px 8px", fontSize: 12 }}>Edit</button>
                )}
                <button 
                  onClick={() => setSelectedNode(null)}
                  style={{ background: "none", border: "none", color: "var(--ink-soft)", cursor: "pointer", marginLeft: 8 }}
                >
                  ✕
                </button>
              </div>
            </div>
            
            <div style={{ flex: 1, padding: 16, overflowY: "auto" }}>
              {isEditing ? (
                <textarea
                  value={fileContent}
                  onChange={(e) => setFileContent(e.target.value)}
                  style={{
                    width: "100%",
                    height: "100%",
                    background: "transparent",
                    border: "none",
                    color: "var(--ink)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 13,
                    resize: "none",
                    outline: "none",
                    lineHeight: 1.6
                  }}
                />
              ) : (
                <div style={{ whiteSpace: "pre-wrap", fontFamily: "var(--font-body)", fontSize: 14, lineHeight: 1.6 }}>
                  {fileContent || <span style={{ color: "var(--ink-soft)" }}>Empty file.</span>}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
