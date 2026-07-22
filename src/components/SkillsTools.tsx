import { useEffect, useState, useRef } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { useTranslation } from "react-i18next";

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
  const { t, i18n } = useTranslation();
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

  // Simultaneous Cloud & Fallback settings
  const [unifiedKey, setUnifiedKey] = useState("");
  const [defaultModel, setDefaultModel] = useState("");
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [openrouterModel, setOpenrouterModel] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiModel, setGeminiModel] = useState("");
  const [customKey, setCustomKey] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [cloudSaveSuccess, setCloudSaveSuccess] = useState(false);
  const [cloudSaveError, setCloudSaveError] = useState("");

  const latestSettingsRef = useRef({
    unifiedKey: "", defaultModel: "", openrouterKey: "", openrouterModel: "", openaiKey: "", openaiModel: "", geminiKey: "", geminiModel: "", customKey: "", customUrl: ""
  });

  useEffect(() => {
    latestSettingsRef.current = {
      unifiedKey, defaultModel, openrouterKey, openrouterModel, openaiKey, openaiModel, geminiKey, geminiModel, customKey, customUrl
    };
  }, [unifiedKey, defaultModel, openrouterKey, openrouterModel, openaiKey, openaiModel, geminiKey, geminiModel, customKey, customUrl]);
  
  // Selected skill to view
  const [viewingSkill, setViewingSkill] = useState<SkillFile | null>(null);

  const hasLoadedRef = useRef(false);

  function getLatestSettings() {
    const orKeyEl = document.getElementById("settings-openrouter-key") as HTMLInputElement;
    const oaKeyEl = document.getElementById("settings-openai-key") as HTMLInputElement;
    const gemKeyEl = document.getElementById("settings-gemini-key") as HTMLInputElement;
    const custKeyEl = document.getElementById("settings-custom-key") as HTMLInputElement;
    const custUrlEl = document.getElementById("settings-custom-url") as HTMLInputElement;
    const uKeyEl = document.getElementById("settings-unified-key") as HTMLInputElement;
    const dModelEl = document.getElementById("settings-default-model") as HTMLInputElement;

    const ref = latestSettingsRef.current;

    return {
      unifiedKey: uKeyEl ? uKeyEl.value : ref.unifiedKey,
      defaultModel: dModelEl ? dModelEl.value : ref.defaultModel,
      openrouterKey: orKeyEl ? orKeyEl.value : ref.openrouterKey,
      openrouterModel: ref.openrouterModel,
      openaiKey: oaKeyEl ? oaKeyEl.value : ref.openaiKey,
      openaiModel: ref.openaiModel,
      geminiKey: gemKeyEl ? gemKeyEl.value : ref.geminiKey,
      geminiModel: ref.geminiModel,
      customKey: custKeyEl ? custKeyEl.value : ref.customKey,
      customUrl: custUrlEl ? custUrlEl.value : ref.customUrl,
    };
  }

  useEffect(() => {
    return () => {
      if (!hasLoadedRef.current) return;
      // Auto-save when leaving settings screen
      const current = getLatestSettings();
      window.localStorage.setItem("freellmapi_unified_key", current.unifiedKey);
      window.localStorage.setItem("freellmapi_default_model", current.defaultModel);
      window.localStorage.setItem("freellmapi_openrouter_key", current.openrouterKey);
      window.localStorage.setItem("freellmapi_openrouter_model", current.openrouterModel);
      window.localStorage.setItem("freellmapi_openai_key", current.openaiKey);
      window.localStorage.setItem("freellmapi_openai_model", current.openaiModel);
      window.localStorage.setItem("freellmapi_gemini_key", current.geminiKey);
      window.localStorage.setItem("freellmapi_gemini_model", current.geminiModel);
      window.localStorage.setItem("freellmapi_custom_key", current.customKey);
      window.localStorage.setItem("freellmapi_custom_url", current.customUrl);

      invoke("save_freellmapi_settings", {
        unifiedKey: current.unifiedKey,
        unified_key: current.unifiedKey,
        defaultModel: current.defaultModel,
        default_model: current.defaultModel,
        openrouterKey: current.openrouterKey,
        openrouter_key: current.openrouterKey,
        openrouterModel: current.openrouterModel,
        openrouter_model: current.openrouterModel,
        openaiKey: current.openaiKey,
        openai_key: current.openaiKey,
        openaiModel: current.openaiModel,
        openai_model: current.openaiModel,
        geminiKey: current.geminiKey,
        gemini_key: current.geminiKey,
        geminiModel: current.geminiModel,
        gemini_model: current.geminiModel,
        customKey: current.customKey,
        custom_key: current.customKey,
        customUrl: current.customUrl,
        custom_url: current.customUrl,
        mode: "proxy",
        provider: "openrouter",
        directApiKey: current.openrouterKey,
        direct_api_key: current.openrouterKey,
      }).catch(() => {});
    };
  }, []);

  function handleBlurSave() {
    if (!hasLoadedRef.current) return;
    const current = getLatestSettings();

    // Sync to state to keep UI in sync
    setUnifiedKey(current.unifiedKey);
    setDefaultModel(current.defaultModel);
    setOpenrouterKey(current.openrouterKey);
    setOpenaiKey(current.openaiKey);
    setGeminiKey(current.geminiKey);
    setCustomKey(current.customKey);
    setCustomUrl(current.customUrl);

    window.localStorage.setItem("freellmapi_unified_key", current.unifiedKey);
    window.localStorage.setItem("freellmapi_default_model", current.defaultModel);
    window.localStorage.setItem("freellmapi_openrouter_key", current.openrouterKey);
    window.localStorage.setItem("freellmapi_openrouter_model", current.openrouterModel);
    window.localStorage.setItem("freellmapi_openai_key", current.openaiKey);
    window.localStorage.setItem("freellmapi_openai_model", current.openaiModel);
    window.localStorage.setItem("freellmapi_gemini_key", current.geminiKey);
    window.localStorage.setItem("freellmapi_gemini_model", current.geminiModel);
    window.localStorage.setItem("freellmapi_custom_key", current.customKey);
    window.localStorage.setItem("freellmapi_custom_url", current.customUrl);

    invoke("save_freellmapi_settings", {
      unifiedKey: current.unifiedKey,
      unified_key: current.unifiedKey,
      defaultModel: current.defaultModel,
      default_model: current.defaultModel,
      openrouterKey: current.openrouterKey,
      openrouter_key: current.openrouterKey,
      openrouterModel: current.openrouterModel,
      openrouter_model: current.openrouterModel,
      openaiKey: current.openaiKey,
      openai_key: current.openaiKey,
      openaiModel: current.openaiModel,
      openai_model: current.openaiModel,
      geminiKey: current.geminiKey,
      gemini_key: current.geminiKey,
      geminiModel: current.geminiModel,
      gemini_model: current.geminiModel,
      customKey: current.customKey,
      custom_key: current.customKey,
      customUrl: current.customUrl,
      custom_url: current.customUrl,
      mode: "proxy",
      provider: "openrouter",
      directApiKey: current.openrouterKey,
      direct_api_key: current.openrouterKey,
    }).catch(() => {});
  }

  const defaultTools = [
    { id: "list_directory", name: "List Directory", desc: "Allows listing files and directories inside a specified path." },
    { id: "read_file_text", name: "Read File Content", desc: "Allows reading the text contents of local files." },
    { id: "write_file_text", name: "Write File Content", desc: "Allows creating or overwriting local text files." },
    { id: "run_command", name: "Run Shell Command", desc: "Executes shell commands (PowerShell on Windows) and returns output." },
    { id: "fetch_url", name: "Fetch Web Content", desc: "HTTP tool to retrieve the text content of web URLs." },
    { id: "create_kanban_card", name: "Create Kanban Card", desc: "Allows creating tasks directly on the project board." },
    { id: "update_kanban_card", name: "Update Kanban Card", desc: "Allows moving project board tasks between columns." },
    { id: "run_notebook_cell", name: "Notebook Sandbox Executor", desc: "Executes scripts securely inside the sandbox environment." },
    { id: "query_local_calendar", name: "Query Local Calendar", desc: "Allows the agent to search and parse local .ics calendar files offline." },
    { id: "query_local_email", name: "Query Local Email", desc: "Allows the agent to parse local .eml email files offline." },
    { id: "query_local_mbox_archive", name: "Query Local Mailbox Archive", desc: "Allows the agent to search local Thunderbird/Google Takeout .mbox email backups." },
    { id: "query_local_csv_log", name: "Query Local CSV Spreadsheet", desc: "Allows the agent to filter and search offline local .csv spreadsheets." },
    { id: "compress_codebase", name: "Codebase AST Compressor", desc: "Generates compressed, token-saving structural summaries of code folders." }
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

    // Load Cloud Provider settings
    invoke<any>("load_freellmapi_settings")
      .then((s) => {
        if (s) {
          setUnifiedKey(s.unified_key || s.unifiedKey || "");
          setDefaultModel(s.default_model || s.defaultModel || "");
          setOpenrouterKey(s.openrouter_key || s.openrouterKey || "");
          setOpenrouterModel(s.openrouter_model || s.openrouterModel || "");
          setOpenaiKey(s.openai_key || s.openaiKey || "");
          setOpenaiModel(s.openai_model || s.openaiModel || "");
          setGeminiKey(s.gemini_key || s.geminiKey || "");
          setGeminiModel(s.gemini_model || s.geminiModel || "");
          setCustomKey(s.custom_key || s.customKey || "");
          setCustomUrl(s.custom_url || s.customUrl || "");
        }
        hasLoadedRef.current = true;
      })
      .catch((err) => {
        console.error("Failed to load cloud settings", err);
        hasLoadedRef.current = true;
      });
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

  function handleSaveCloudSettings(e: React.FormEvent) {
    e.preventDefault();
    setCloudSaveError("");
    setCloudSaveSuccess(false);

    const current = getLatestSettings();

    // Sync to state to keep UI inputs in sync
    setUnifiedKey(current.unifiedKey);
    setDefaultModel(current.defaultModel);
    setOpenrouterKey(current.openrouterKey);
    setOpenaiKey(current.openaiKey);
    setGeminiKey(current.geminiKey);
    setCustomKey(current.customKey);
    setCustomUrl(current.customUrl);

    // Save to localStorage immediately for fast frontend sync
    window.localStorage.setItem("freellmapi_unified_key", current.unifiedKey);
    window.localStorage.setItem("freellmapi_default_model", current.defaultModel);
    window.localStorage.setItem("freellmapi_openrouter_key", current.openrouterKey);
    window.localStorage.setItem("freellmapi_openrouter_model", current.openrouterModel);
    window.localStorage.setItem("freellmapi_openai_key", current.openaiKey);
    window.localStorage.setItem("freellmapi_openai_model", current.openaiModel);
    window.localStorage.setItem("freellmapi_gemini_key", current.geminiKey);
    window.localStorage.setItem("freellmapi_gemini_model", current.geminiModel);
    window.localStorage.setItem("freellmapi_custom_key", current.customKey);
    window.localStorage.setItem("freellmapi_custom_url", current.customUrl);

    invoke("save_freellmapi_settings", {
      unifiedKey: current.unifiedKey,
      unified_key: current.unifiedKey,
      defaultModel: current.defaultModel,
      default_model: current.defaultModel,
      openrouterKey: current.openrouterKey,
      openrouter_key: current.openrouterKey,
      openrouterModel: current.openrouterModel,
      openrouter_model: current.openrouterModel,
      openaiKey: current.openaiKey,
      openai_key: current.openaiKey,
      openaiModel: current.openaiModel,
      openai_model: current.openaiModel,
      geminiKey: current.geminiKey,
      gemini_key: current.geminiKey,
      geminiModel: current.geminiModel,
      gemini_model: current.geminiModel,
      customKey: current.customKey,
      custom_key: current.customKey,
      customUrl: current.customUrl,
      custom_url: current.customUrl,
      // Fallbacks
      mode: "proxy",
      provider: "openrouter",
      directApiKey: current.openrouterKey,
      direct_api_key: current.openrouterKey,
    })
      .then(() => {
        setCloudSaveSuccess(true);
        triggerStorageEvent();
        setTimeout(() => setCloudSaveSuccess(false), 3000);
      })
      .catch((err) => {
        setCloudSaveError(`Failed to save settings: ${err}`);
      });
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
      <div style={{ marginBottom: 20, display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <h1 className="page-title">{t("settings")}</h1>
          <p className="page-sub">
            Control the capabilities of the Genesis local agent. Enabled tools, skills, and MCP servers are injected into the agent's prompt context.
          </p>
        </div>
        
        {/* Language Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, background: "var(--bg-sunken)", padding: "8px 12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
          <span style={{ fontSize: 13, fontWeight: "bold", color: "var(--ink-soft)" }}>{t("language")}:</span>
          <select 
            value={i18n.language} 
            onChange={(e) => {
              const newLang = e.target.value;
              i18n.changeLanguage(newLang);
              window.localStorage.setItem('genesis_language', newLang);
            }}
            style={{
              padding: "4px 8px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--bg)",
              color: "var(--ink)",
              fontFamily: "var(--font-sans)",
              fontSize: 13,
              cursor: "pointer"
            }}
          >
            <option value="en">English (US)</option>
            <option value="es">Español (ES)</option>
            <option value="zh">中文 (ZH)</option>
            <option value="fr">Français (FR)</option>
            <option value="de">Deutsch (DE)</option>
            <option value="ja">日本語 (JA)</option>
            <option value="hi">हिन्दी (HI)</option>
          </select>
        </div>
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

          {/* Cloud & Fallback Models Card */}
          <div className="card" style={{ padding: 20 }}>
            <h2 style={{ fontSize: 16, color: "var(--accent)", marginBottom: 12, borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
              🌐 Cloud & Fallback Models
            </h2>
            <p style={{ fontSize: 13, color: "var(--ink-soft)", marginBottom: 16 }}>
              Configure direct API integrations and local proxies. All keys are saved concurrently, enabling instant switching.
            </p>
            <form onSubmit={handleSaveCloudSettings} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              
              {/* Direct APIs Section */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h3 style={{ fontSize: 14, margin: "0 0 4px 0", color: "var(--accent)", opacity: 0.9 }}>⚡ Direct Cloud Keys</h3>
                
                <div>
                  <label style={{ display: "block", fontSize: 12, marginBottom: 4, fontWeight: "bold" }}>OpenRouter API Key</label>
                  <input 
                    id="settings-openrouter-key"
                    type="password" 
                    value={openrouterKey}
                    onChange={(e) => setOpenrouterKey(e.target.value)}
                    onBlur={handleBlurSave}
                    placeholder="Enter OpenRouter API key (sk-or-...)"
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
                  <label style={{ display: "block", fontSize: 12, marginBottom: 4, fontWeight: "bold" }}>OpenAI API Key</label>
                  <input 
                    id="settings-openai-key"
                    type="password" 
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    onBlur={handleBlurSave}
                    placeholder="Enter OpenAI API key (sk-proj-...)"
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
                  <label style={{ display: "block", fontSize: 12, marginBottom: 4, fontWeight: "bold" }}>Google Gemini API Key</label>
                  <input 
                    id="settings-gemini-key"
                    type="password" 
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    onBlur={handleBlurSave}
                    placeholder="Enter Gemini API key (AIzaSy...)"
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

                <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <label style={{ display: "block", fontSize: 12, marginBottom: 4, fontWeight: "bold" }}>Custom Endpoint Base URL</label>
                    <input 
                      id="settings-custom-url"
                      type="text" 
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      onBlur={handleBlurSave}
                      placeholder="https://api.example.com/v1/chat/completions"
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
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <label style={{ display: "block", fontSize: 12, marginBottom: 4, fontWeight: "bold" }}>Custom API Key</label>
                    <input 
                      id="settings-custom-key"
                      type="password" 
                      value={customKey}
                      onChange={(e) => setCustomKey(e.target.value)}
                      onBlur={handleBlurSave}
                      placeholder="Custom provider API Key"
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
                </div>
              </div>

              <div style={{ borderTop: "1px solid var(--border)", margin: "4px 0" }} />

              {/* Local Proxy Section */}
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                <h3 style={{ fontSize: 14, margin: "0 0 4px 0", color: "var(--accent)", opacity: 0.9 }}>🔌 Local Proxy (FreeLLMAPI)</h3>
                
                <div>
                  <label style={{ display: "block", fontSize: 12, marginBottom: 4, fontWeight: "bold" }}>FreeLLMAPI Unified Key</label>
                  <input 
                    id="settings-unified-key"
                    type="text" 
                    value={unifiedKey}
                    onChange={(e) => setUnifiedKey(e.target.value)}
                    onBlur={handleBlurSave}
                    placeholder="freellmapi-... (from keys dashboard)"
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
                  <label style={{ display: "block", fontSize: 12, marginBottom: 4, fontWeight: "bold" }}>FreeLLMAPI Default Model</label>
                  <input 
                    id="settings-default-model"
                    type="text" 
                    value={defaultModel}
                    onChange={(e) => setDefaultModel(e.target.value)}
                    onBlur={handleBlurSave}
                    placeholder="e.g. auto, or local proxy routing model"
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
              </div>

              {cloudSaveError && (
                <div style={{ fontSize: 12, color: "var(--warn)", marginTop: 4 }}>{cloudSaveError}</div>
              )}
              {cloudSaveSuccess && (
                <div style={{ fontSize: 12, color: "var(--success)", marginTop: 4 }}>✓ Settings saved successfully!</div>
              )}

              <button type="submit" className="btn" style={{ alignSelf: "flex-end", marginTop: 8 }}>
                Save Cloud Settings
              </button>
            </form>
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
                  <option value="openrouter">OpenRouter (online)</option>
                  <option value="openai">OpenAI (online)</option>
                  <option value="gemini">Google Gemini (online)</option>
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
