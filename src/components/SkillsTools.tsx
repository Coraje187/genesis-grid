import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";

interface SkillFile {
  name: string;
  content: string;
}

interface McpServerConfig {
  command: string;
  args: string[];
  env?: Record<string, string>;
  disabled?: boolean;
}

interface McpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

export default function SkillsTools() {
  const [skills, setSkills] = useState<SkillFile[]>([]);
  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>({});
  const [enabledSkills, setEnabledSkills] = useState<Record<string, boolean>>({});
  const [installedModels, setInstalledModels] = useState<string[]>([]);
  
  // MCP config state
  const [mcpConfig, setMcpConfig] = useState<McpConfig>({ mcpServers: {} });
  
  // Custom skill form
  const [newSkillName, setNewSkillName] = useState("");
  const [newSkillContent, setNewSkillContent] = useState("");
  const [skillFormError, setSkillFormError] = useState("");
  const [skillFormSuccess, setSkillFormSuccess] = useState("");
  
  // Custom MCP form
  const [newMcpName, setNewMcpName] = useState("");
  const [newMcpCommand, setNewMcpCommand] = useState("");
  const [newMcpArgs, setNewMcpArgs] = useState("");
  const [newMcpEnv, setNewMcpEnv] = useState("");
  const [mcpFormError, setMcpFormError] = useState("");
  const [mcpFormSuccess, setMcpFormSuccess] = useState("");

  // Telegram Bot Bridge state
  const [tgToken, setTgToken] = useState("");
  const [tgChatId, setTgChatId] = useState("");
  const [tgModel, setTgModel] = useState("genesis");
  const [tgRunning, setTgRunning] = useState(false);
  const [tgStatusMsg, setTgStatusMsg] = useState("");
  
  // Selected skill to view
  const [viewingSkill, setViewingSkill] = useState<SkillFile | null>(null);

  const defaultTools = [
    { id: "list_directory", name: "List Directory", desc: "Allows listing files and directories inside a specified path." },
    { id: "read_file_text", name: "Read File Content", desc: "Allows reading the text contents of local files." },
    { id: "write_file_text", name: "Write File Content", desc: "Allows creating or overwriting local text files." },
    { id: "run_command", name: "Run Shell Command", desc: "Executes shell commands (PowerShell on Windows) and returns output." },
    { id: "fetch_url", name: "Fetch Web Content", desc: "HTTP tool to retrieve the text content of web URLs." },
  ];

  useEffect(() => {
    // Load skills from backend
    loadSkillsList();

    // Load tool configurations from localStorage
    const toolsConfig: Record<string, boolean> = {};
    defaultTools.forEach((t) => {
      const stored = window.localStorage.getItem(`tool_enabled_${t.id}`);
      toolsConfig[t.id] = stored !== "false";
    });
    setEnabledTools(toolsConfig);

    // Load MCP configuration
    loadMcpConfigData();

    // Load installed models
    invoke<string[]>("list_installed_models")
      .then(setInstalledModels)
      .catch(() => {});

    // Load Telegram configurations
    const storedToken = window.localStorage.getItem("tg_bot_token") || "";
    const storedChatId = window.localStorage.getItem("tg_allowed_chat_id") || "";
    const storedModel = window.localStorage.getItem("tg_target_model") || "genesis";
    setTgToken(storedToken);
    setTgChatId(storedChatId);
    setTgModel(storedModel);

    // Query active bot status
    invoke<boolean>("telegram_bot_status")
      .then(setTgRunning)
      .catch(() => {});
  }, []);

  function loadSkillsList() {
    invoke<SkillFile[]>("list_skills_files")
      .then((list) => {
        setSkills(list);
        
        // Load enabled skills state
        const skillsConfig: Record<string, boolean> = {};
        list.forEach((s) => {
          const stored = window.localStorage.getItem(`skill_enabled_${s.name}`);
          skillsConfig[s.name] = stored !== "false";
        });
        setEnabledSkills(skillsConfig);
      })
      .catch((err) => console.error("Failed to load skills", err));
  }

  function loadMcpConfigData() {
    invoke<string>("load_mcp_config")
      .then((jsonStr) => {
        try {
          const parsed = JSON.parse(jsonStr);
          if (!parsed.mcpServers) parsed.mcpServers = {};
          setMcpConfig(parsed);
        } catch (e) {
          console.error("Failed to parse MCP config JSON", e);
        }
      })
      .catch((err) => console.error("Failed to load MCP config", err));
  }

  function handleToggleTool(toolId: string) {
    const nextVal = !enabledTools[toolId];
    setEnabledTools((prev) => ({ ...prev, [toolId]: nextVal }));
    window.localStorage.setItem(`tool_enabled_${toolId}`, String(nextVal));
  }

  function triggerStorageEvent() {
    window.dispatchEvent(new Event("storage"));
  }

  function handleToggleSkill(skillName: string) {
    const nextVal = !enabledSkills[skillName];
    setEnabledSkills((prev) => ({ ...prev, [skillName]: nextVal }));
    window.localStorage.setItem(`skill_enabled_${skillName}`, String(nextVal));
    triggerStorageEvent();
  }

  function saveMcpConfigData(updatedConfig: McpConfig) {
    const jsonStr = JSON.stringify(updatedConfig, null, 2);
    invoke("save_mcp_config", { content: jsonStr })
      .then(() => {
        setMcpConfig(updatedConfig);
        triggerStorageEvent();
      })
      .catch((err) => alert(`Failed to save MCP config: ${err}`));
  }

  function handleToggleMcp(serverName: string) {
    const nextConfig = { ...mcpConfig };
    const server = nextConfig.mcpServers[serverName];
    if (server) {
      server.disabled = !server.disabled;
      saveMcpConfigData(nextConfig);
    }
  }

  function handleDeleteMcp(serverName: string) {
    if (!confirm(`Are you sure you want to delete the MCP server '${serverName}'?`)) return;
    const nextConfig = { ...mcpConfig };
    delete nextConfig.mcpServers[serverName];
    saveMcpConfigData(nextConfig);
  }

  function handleCreateSkill(e: React.FormEvent) {
    e.preventDefault();
    setSkillFormError("");
    setSkillFormSuccess("");

    if (!newSkillName.trim()) {
      setSkillFormError("Skill name is required.");
      return;
    }
    if (!newSkillContent.trim()) {
      setSkillFormError("Skill content/instructions are required.");
      return;
    }

    const cleanName = newSkillName.trim().replace(/[^a-zA-Z0-9-_]/g, "");
    if (!cleanName) {
      setSkillFormError("Name must contain alphanumeric characters, dashes, or underscores.");
      return;
    }

    invoke("save_skill_file", { name: cleanName, content: newSkillContent })
      .then(() => {
        setNewSkillName("");
        setNewSkillContent("");
        setSkillFormSuccess(`Skill '${cleanName}' created successfully!`);
        window.localStorage.setItem(`skill_enabled_${cleanName}`, "true");
        loadSkillsList();
        triggerStorageEvent();
      })
      .catch((err) => {
        setSkillFormError(`Failed to save: ${err}`);
      });
  }

  function handleCreateMcp(e: React.FormEvent) {
    e.preventDefault();
    setMcpFormError("");
    setMcpFormSuccess("");

    if (!newMcpName.trim()) {
      setMcpFormError("Server name is required.");
      return;
    }
    if (!newMcpCommand.trim()) {
      setMcpFormError("Command is required.");
      return;
    }

    const nameClean = newMcpName.trim().replace(/[^a-zA-Z0-9-_]/g, "");
    if (!nameClean) {
      setMcpFormError("Name must contain alphanumeric characters, dashes, or underscores.");
      return;
    }

    let argsArray: string[] = [];
    if (newMcpArgs.trim()) {
      const match = newMcpArgs.match(/"[^"]+"|[^\s]+/g);
      if (match) {
        argsArray = match.map((arg) => arg.replace(/^"|"$/g, ""));
      }
    }

    let envObj: Record<string, string> = {};
    if (newMcpEnv.trim()) {
      try {
        envObj = JSON.parse(newMcpEnv);
      } catch (err) {
        const lines = newMcpEnv.split("\n");
        lines.forEach((line) => {
          const parts = line.split("=");
          if (parts.length >= 2) {
            const key = parts[0].trim();
            const val = parts.slice(1).join("=").trim();
            if (key) envObj[key] = val;
          }
        });
      }
    }

    const nextConfig = { ...mcpConfig };
    nextConfig.mcpServers[nameClean] = {
      command: newMcpCommand.trim(),
      args: argsArray,
      env: Object.keys(envObj).length > 0 ? envObj : undefined,
      disabled: false,
    };

    const jsonStr = JSON.stringify(nextConfig, null, 2);
    invoke("save_mcp_config", { content: jsonStr })
      .then(() => {
        setMcpConfig(nextConfig);
        setNewMcpName("");
        setNewMcpCommand("");
        setNewMcpArgs("");
        setNewMcpEnv("");
        setMcpFormSuccess(`MCP Server '${nameClean}' added successfully!`);
        triggerStorageEvent();
      })
      .catch((err) => {
        setMcpFormError(`Failed to save: ${err}`);
      });
  }

  function handleToggleTelegramBot() {
    setTgStatusMsg("");
    if (tgRunning) {
      invoke<string>("stop_telegram_bot")
        .then((msg) => {
          setTgRunning(false);
          setTgStatusMsg(msg);
        })
        .catch((err) => setTgStatusMsg(`Error: ${err}`));
    } else {
      if (!tgToken.trim() || !tgChatId.trim()) {
        setTgStatusMsg("Error: Bot Token and Allowed Chat ID are required.");
        return;
      }

      window.localStorage.setItem("tg_bot_token", tgToken.trim());
      window.localStorage.setItem("tg_allowed_chat_id", tgChatId.trim());
      window.localStorage.setItem("tg_target_model", tgModel);

      invoke<string>("start_telegram_bot", {
        token: tgToken.trim(),
        allowedChatId: tgChatId.trim(),
        allowed_chat_id: tgChatId.trim(),
        model: tgModel,
      })
        .then((msg) => {
          setTgRunning(true);
          setTgStatusMsg(msg);
        })
        .catch((err) => setTgStatusMsg(`Error starting bot: ${err}`));
    }
  }

  function handleDeleteSkill(skillName: string) {
    if (!confirm(`Are you sure you want to delete the skill '${skillName}'?`)) return;

    invoke("delete_skill_file", { name: skillName })
      .then(() => {
        if (viewingSkill?.name === skillName) {
          setViewingSkill(null);
        }
        window.localStorage.removeItem(`skill_enabled_${skillName}`);
        loadSkillsList();
        triggerStorageEvent();
      })
      .catch((err) => alert(`Failed to delete: ${err}`));
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflowY: "auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 className="page-title">Settings</h1>
        <p className="page-sub">
          Control the capabilities of the Genesis local agent. Enabled tools, skills, and MCP servers are injected into the agent's prompt context.
        </p>
      </div>

      <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
        
        {/* Left column: Tools, Skills, and Telegram listing */}
        <div style={{ flex: "1 1 500px", display: "flex", flexDirection: "column", gap: 20 }}>
          
          {/* System Tools Card */}
          <div className="card" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 16, color: "var(--settings-tools)", marginBottom: 12, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
              🛡️ System Execution Tools
            </h2>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 16 }}>
              Expose local terminal and file capabilities to the Genesis agent. Disabling these hides them completely from the agent.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {defaultTools.map((tool) => (
                <div 
                  key={tool.id} 
                  style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center",
                    padding: 10,
                    background: "var(--bg-sunken)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)"
                  }}
                >
                  <div style={{ paddingRight: 16 }}>
                    <div style={{ fontWeight: "bold", fontSize: 14 }}>{tool.name}</div>
                    <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>{tool.desc}</div>
                  </div>
                  <div>
                    <label className="switch" style={{ display: "flex", alignItems: "center", cursor: "pointer" }}>
                      <input 
                        type="checkbox" 
                        checked={!!enabledTools[tool.id]} 
                        onChange={() => {
                          handleToggleTool(tool.id);
                          triggerStorageEvent();
                        }}
                        style={{ width: 18, height: 18, cursor: "pointer" }}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Telegram Bot Bridge Card */}
          <div className="card" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 16, color: "var(--settings-telegram)", marginBottom: 12, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
              📱 Telegram Bot Bridge
            </h2>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 16 }}>
              Access your local AI models remotely from your phone. Only requests matching your Chat ID will be processed.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, marginBottom: 4, fontWeight: "bold" }}>Bot Token</label>
                <input 
                  type="password" 
                  value={tgToken}
                  onChange={(e) => setTgToken(e.target.value)}
                  placeholder="Paste Token from @BotFather"
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: "var(--bg-sunken)",
                    color: "var(--ink)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 13
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, marginBottom: 4, fontWeight: "bold" }}>Allowed Chat ID</label>
                <input 
                  type="text" 
                  value={tgChatId}
                  onChange={(e) => setTgChatId(e.target.value)}
                  placeholder="Paste your Telegram Chat ID (e.g. 123456789)"
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: "var(--bg-sunken)",
                    color: "var(--ink)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 13
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, marginBottom: 4, fontWeight: "bold" }}>Target Model</label>
                <select 
                  value={tgModel}
                  onChange={(e) => setTgModel(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: "var(--bg-sunken)",
                    color: "var(--ink)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 13
                  }}
                >
                  <option value="genesis">Default: Genesis Brain</option>
                  {installedModels.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                  <option value="freellmapi">FreeLLMAPI (online)</option>
                </select>
              </div>

              {tgStatusMsg && (
                <div style={{ fontSize: 12, color: tgStatusMsg.startsWith("Error") ? "var(--warn)" : "var(--success)" }}>
                  {tgStatusMsg}
                </div>
              )}

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                <span style={{ fontSize: 13 }}>
                  Status: <strong style={{ color: tgRunning ? "var(--success)" : "var(--warn)" }}>{tgRunning ? "Active" : "Stopped"}</strong>
                </span>
                <button 
                  type="button" 
                  className={`btn ${tgRunning ? "secondary" : ""}`}
                  style={tgRunning ? { borderColor: "var(--warn)", color: "var(--warn)" } : {}}
                  onClick={handleToggleTelegramBot}
                >
                  {tgRunning ? "Stop Bridge" : "Start Bridge"}
                </button>
              </div>
            </div>
          </div>

          {/* MCP Servers Card */}
          <div className="card" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 16, color: "var(--settings-mcp)", marginBottom: 12, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
              🔌 MCP Servers (Model Context Protocol)
            </h2>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 16 }}>
              Expose third-party Model Context Protocol services. These extend the agent's tools dynamically.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {Object.keys(mcpConfig.mcpServers).length === 0 ? (
                <p style={{ fontSize: 13, color: "var(--ink-soft)" }}>No MCP servers configured yet.</p>
              ) : (
                Object.keys(mcpConfig.mcpServers).map((serverName) => {
                  const s = mcpConfig.mcpServers[serverName];
                  return (
                    <div 
                      key={serverName} 
                      style={{ 
                        display: "flex", 
                        justifyContent: "space-between", 
                        alignItems: "center",
                        padding: 10,
                        background: "var(--bg-sunken)",
                        borderRadius: "var(--radius-sm)",
                        border: "1px solid var(--border)"
                      }}
                    >
                      <div style={{ paddingRight: 16 }}>
                        <div style={{ fontWeight: "bold", fontSize: 14, color: s.disabled ? "var(--ink-soft)" : "inherit" }}>
                          {serverName} {s.disabled && <span style={{ fontSize: 10, color: "var(--warn)" }}>(Disabled)</span>}
                        </div>
                        <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--ink-soft)", marginTop: 2 }}>
                          {s.command} {s.args?.join(" ")}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <input 
                          type="checkbox" 
                          checked={!s.disabled} 
                          onChange={() => handleToggleMcp(serverName)}
                          style={{ width: 18, height: 18, cursor: "pointer" }}
                        />
                        <button 
                          onClick={() => handleDeleteMcp(serverName)}
                          style={{ 
                            background: "none", 
                            border: "none", 
                            color: "var(--warn)", 
                            cursor: "pointer", 
                            fontSize: 12,
                            padding: 4
                          }}
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

        </div>

        {/* Right column: Forms */}
        <div style={{ flex: "1 1 450px", display: "flex", flexDirection: "column", gap: 20 }}>
          
          {/* Add MCP Server Form */}
          <div className="card" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 16, color: "var(--settings-mcp)", marginBottom: 12 }}>Add MCP Server</h2>
            <form onSubmit={handleCreateMcp} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, marginBottom: 4, fontWeight: "bold" }}>Server Identifier</label>
                <input 
                  type="text" 
                  value={newMcpName}
                  onChange={(e) => setNewMcpName(e.target.value)}
                  placeholder="e.g. sqlite-mcp-server"
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: "var(--bg-sunken)",
                    color: "var(--ink)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 13
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, marginBottom: 4, fontWeight: "bold" }}>Command / Executable</label>
                <input 
                  type="text" 
                  value={newMcpCommand}
                  onChange={(e) => setNewMcpCommand(e.target.value)}
                  placeholder="e.g. npx, uvx, python"
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: "var(--bg-sunken)",
                    color: "var(--ink)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 13
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, marginBottom: 4, fontWeight: "bold" }}>Arguments (space separated)</label>
                <input 
                  type="text" 
                  value={newMcpArgs}
                  onChange={(e) => setNewMcpArgs(e.target.value)}
                  placeholder='e.g. -y @modelcontextprotocol/server-sqlite --db "C:\temp\db.sqlite"'
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: "var(--bg-sunken)",
                    color: "var(--ink)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 13
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, marginBottom: 4, fontWeight: "bold" }}>Environment Variables (KEY=VALUE per line or JSON)</label>
                <textarea 
                  value={newMcpEnv}
                  onChange={(e) => setNewMcpEnv(e.target.value)}
                  placeholder="e.g.&#10;API_KEY=my-secret-key&#10;PORT=8080"
                  rows={3}
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: "var(--bg-sunken)",
                    color: "var(--ink)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 13,
                    resize: "none"
                  }}
                />
              </div>

              {mcpFormError && <div style={{ color: "var(--warn)", fontSize: 12 }}>{mcpFormError}</div>}
              {mcpFormSuccess && <div style={{ color: "var(--success)", fontSize: 12 }}>{mcpFormSuccess}</div>}

              <button type="submit" className="btn" style={{ alignSelf: "flex-end" }}>
                Add MCP Server
              </button>
            </form>
          </div>

          {/* Agent Skills Card */}
          <div className="card" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 16, color: "var(--settings-skills)", marginBottom: 12, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
              🧠 Agent Capability Skills
            </h2>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 16 }}>
              Instruct the agent on specialized procedures using Progressive Disclosure. The agent loads detail documents from the skills library only when needed.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {skills.map((skill) => (
                <div 
                  key={skill.name} 
                  style={{ 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center",
                    padding: 10,
                    background: "var(--bg-sunken)",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)"
                  }}
                >
                  <div style={{ cursor: "pointer" }} onClick={() => setViewingSkill(skill)}>
                    <div style={{ fontWeight: "bold", fontSize: 14, textDecoration: "underline", color: "var(--accent)" }}>
                      {skill.name}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--ink-soft)", marginTop: 2 }}>
                      Click to view Markdown instructions
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <input 
                      type="checkbox" 
                      checked={!!enabledSkills[skill.name]} 
                      onChange={() => handleToggleSkill(skill.name)}
                      style={{ width: 18, height: 18, cursor: "pointer" }}
                    />
                    <button 
                      onClick={() => handleDeleteSkill(skill.name)}
                      style={{ 
                        background: "none", 
                        border: "none", 
                        color: "var(--warn)", 
                        cursor: "pointer", 
                        fontSize: 12,
                        padding: 4
                      }}
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Create Custom Skill Card */}
          <div className="card" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 16, color: "var(--settings-skills)", marginBottom: 12 }}>Create Custom Skill</h2>
            <form onSubmit={handleCreateSkill} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, marginBottom: 4, fontWeight: "bold" }}>Skill Name</label>
                <input 
                  type="text" 
                  value={newSkillName}
                  onChange={(e) => setNewSkillName(e.target.value)}
                  placeholder="e.g. game-asset-importer"
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: "var(--bg-sunken)",
                    color: "var(--ink)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 13
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, marginBottom: 4, fontWeight: "bold" }}>Skill Content (Markdown)</label>
                <textarea 
                  value={newSkillContent}
                  onChange={(e) => setNewSkillContent(e.target.value)}
                  placeholder="# Description & Guidelines..."
                  rows={5}
                  style={{
                    width: "100%",
                    padding: 8,
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: "var(--bg-sunken)",
                    color: "var(--ink)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 13,
                    resize: "none"
                  }}
                />
              </div>

              {skillFormError && <div style={{ color: "var(--warn)", fontSize: 12 }}>{skillFormError}</div>}
              {skillFormSuccess && <div style={{ color: "var(--success)", fontSize: 12 }}>{skillFormSuccess}</div>}

              <button type="submit" className="btn" style={{ alignSelf: "flex-end" }}>
                Add Skill File
              </button>
            </form>
          </div>

          {/* Skill detail preview pane */}
          {viewingSkill && (
            <div className="card" style={{ padding: 20, maxHeight: 400, overflowY: "auto" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
                <h3 style={{ margin: 0, fontSize: 15 }}>📄 Preview: {viewingSkill.name}</h3>
                <button 
                  onClick={() => setViewingSkill(null)}
                  style={{ background: "none", border: "none", color: "var(--ink-soft)", cursor: "pointer", fontSize: 16 }}
                >
                  ✕
                </button>
              </div>
              <pre 
                style={{ 
                  whiteSpace: "pre-wrap", 
                  fontFamily: "var(--font-mono)", 
                  fontSize: 12, 
                  background: "var(--bg-sunken)", 
                  padding: 10,
                  borderRadius: "var(--radius-sm)",
                  color: "var(--ink)"
                }}
              >
                {viewingSkill.content}
              </pre>
            </div>
          )}

          {/* Help & Documentation Card */}
          <div className="card" style={{ padding: 20, marginTop: 20 }}>
            <h2 style={{ fontSize: 16, color: "var(--settings-skills)", marginBottom: 12, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
              📖 Help & Documentation
            </h2>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 16 }}>
              Access user manuals, setup guides, and protocols for custom skills and MCP servers on the official Genesis Grid website.
            </p>
            <button 
              type="button" 
              className="btn secondary"
              onClick={() => invoke("open_url", { url: "https://genesisgridlabs.xyz/docs" })}
            >
              Open Online Manuals
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
