import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/tauri";

export interface Agent {
  id: string;
  name: string;
  role: string;
  model: string;
}

interface AgentsViewProps {
  installedModels: string[];
}

const DEFAULT_AGENTS: Agent[] = [
  { id: "architect", name: "Architect", role: "You are the Master Planner. Your job is to orchestrate complex tasks, break them down, and delegate them to other agents.", model: "genesis" },
  { id: "cipher", name: "Cipher", role: "You are an expert Software Engineer. You write clean, optimized code and debug complex issues.", model: "genesis" },
  { id: "oracle", name: "Oracle", role: "You are a Research Specialist. You browse the web, analyze documents, and summarize information efficiently.", model: "genesis" }
];

export default function AgentsView({ installedModels }: AgentsViewProps) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);

  useEffect(() => {
    invoke<string>("load_agents_config").then((json) => {
      let parsed = JSON.parse(json);
      if (parsed.length === 0) {
        parsed = DEFAULT_AGENTS;
        saveAgents(parsed);
      }
      setAgents(parsed);
      if (parsed.length > 0) setSelectedAgentId(parsed[0].id);
    }).catch(console.error);
  }, []);

  function saveAgents(newAgents: Agent[]) {
    invoke("save_agents_config", { content: JSON.stringify(newAgents, null, 2) }).catch(console.error);
  }

  const selectedAgent = agents.find(a => a.id === selectedAgentId);

  function handleUpdate(field: keyof Agent, value: string) {
    if (!selectedAgent) return;
    const updated = agents.map(a => a.id === selectedAgent.id ? { ...a, [field]: value } : a);
    setAgents(updated);
    saveAgents(updated);
  }

  function handleAdd() {
    const newAgent: Agent = {
      id: "agent_" + Date.now(),
      name: "New Agent",
      role: "Describe their role here...",
      model: "genesis"
    };
    const updated = [...agents, newAgent];
    setAgents(updated);
    setSelectedAgentId(newAgent.id);
    saveAgents(updated);
  }

  function handleDelete(id: string) {
    const updated = agents.filter(a => a.id !== id);
    setAgents(updated);
    if (selectedAgentId === id) setSelectedAgentId(updated.length > 0 ? updated[0].id : null);
    saveAgents(updated);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: 32 }}>
      <header style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: "var(--text)", marginBottom: 8 }}>Agents Crew</h1>
        <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>
          Build your autonomous AI crew. Assign specialized roles and models to different agents.
        </p>
      </header>

      <div style={{ display: "flex", gap: 24, flex: 1, minHeight: 0 }}>
        {/* Sidebar List */}
        <div style={{ width: 250, display: "flex", flexDirection: "column", gap: 12 }}>
          <button className="btn" onClick={handleAdd}>+ Hire New Agent</button>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", paddingRight: 4 }}>
            {agents.map((agent) => (
              <div 
                key={agent.id}
                className="card"
                style={{ 
                  padding: "12px 16px", 
                  cursor: "pointer",
                  border: selectedAgentId === agent.id ? "1px solid var(--accent)" : "1px solid var(--border)",
                  background: selectedAgentId === agent.id ? "rgba(0, 242, 254, 0.05)" : "var(--bg-sunken)"
                }}
                onClick={() => setSelectedAgentId(agent.id)}
              >
                <div style={{ fontWeight: 600, color: "var(--text)" }}>{agent.name}</div>
                <div style={{ fontSize: 11, color: "var(--ink-soft)", marginTop: 4 }}>{agent.model}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Editor */}
        {selectedAgent && (
          <div className="card" style={{ flex: 1, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 4 }}>Agent Name</label>
              <input 
                type="text" 
                value={selectedAgent.name}
                onChange={(e) => handleUpdate("name", e.target.value)}
                style={{ 
                  width: "100%", padding: "8px 12px", background: "var(--bg-sunken)", 
                  border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text)" 
                }}
              />
            </div>
            
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 4 }}>AI Model</label>
              <select 
                value={selectedAgent.model}
                onChange={(e) => handleUpdate("model", e.target.value)}
                style={{ 
                  width: "100%", padding: "8px 12px", background: "var(--bg-sunken)", 
                  border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text)" 
                }}
              >
                <option value="genesis">Genesis Default</option>
                <option value="freellmapi">FreeLLM API (OpenRouter)</option>
                {installedModels.map(m => (
                  <option key={m} value={m}>{m} (Local)</option>
                ))}
              </select>
            </div>

            <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--ink-soft)", marginBottom: 4 }}>System Prompt / Role</label>
              <textarea 
                value={selectedAgent.role}
                onChange={(e) => handleUpdate("role", e.target.value)}
                style={{ 
                  flex: 1, width: "100%", padding: "12px", background: "var(--bg-sunken)", 
                  border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text)",
                  resize: "none", fontFamily: "monospace", fontSize: 13, lineHeight: 1.5
                }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button 
                className="btn btn-danger" 
                style={{ background: "rgba(255, 51, 102, 0.1)", color: "#ff3366", border: "1px solid rgba(255, 51, 102, 0.2)" }}
                onClick={() => handleDelete(selectedAgent.id)}
              >
                Fire Agent
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
