import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { listen } from "@tauri-apps/api/event";
import { open as openShell } from "@tauri-apps/api/shell";

interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  model: string;
  project_id: string | null;
  created_at: number;
  updated_at: number;
  messages: ChatMessage[];
}

interface ChatToken {
  content: string;
}

export default function Chat({
  sessionId,
  installedModels,
  onNewChat,
  theme,
}: {
  sessionId: string;
  installedModels: string[];
  onNewChat: () => void;
  theme: "light" | "dark";
}) {
  const options = ["genesis", ...installedModels, "openrouter", "openai", "gemini", "freellmapi"];
  const [model, setModel] = useState(options[0] ?? "");
  const [agentBrain, setAgentBrain] = useState<string>(() => {
    const saved = window.localStorage.getItem("genesis_agent_brain");
    if (saved && (installedModels.includes(saved) || ["freellmapi", "openrouter", "openai", "gemini"].includes(saved))) {
      return saved;
    }
    return installedModels[0] ?? "openrouter";
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [freeLlmApiKey, setFreeLlmApiKey] = useState("");
  const [freeLlmApiModel, setFreeLlmApiModel] = useState("");
  const [freeLlmApiSaveError, setFreeLlmApiSaveError] = useState("");
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [openrouterKey, setOpenrouterKey] = useState("");
  const [openrouterModel, setOpenrouterModel] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [openaiModel, setOpenaiModel] = useState("");
  const [geminiKey, setGeminiKey] = useState("");
  const [geminiModel, setGeminiModel] = useState("");
  const [customKey, setCustomKey] = useState("");
  const [customUrl, setCustomUrl] = useState("");
  const [openrouterFreeModels, setOpenrouterFreeModels] = useState<any[]>([]);
  const [loadingOpenrouterModels, setLoadingOpenrouterModels] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; content: string; type: string; dataUrl?: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [wikiContent, setWikiContent] = useState("");
  const [showWiki, setShowWiki] = useState(false);
  const [compilingWiki, setCompilingWiki] = useState(false);
  const [pendingToolCall, setPendingToolCall] = useState<{ name: string; args: any; messageHistory: ChatMessage[] } | null>(null);
  const [autoExecToolCall, setAutoExecToolCall] = useState<{ name: string; args: any; messageHistory: ChatMessage[] } | null>(null);
  const [downloadsPath, setDownloadsPath] = useState("");

  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>({});
  const [skillsList, setSkillsList] = useState<{ name: string; content: string }[]>([]);
  const [enabledSkills, setEnabledSkills] = useState<Record<string, boolean>>({});

  const [isLoopMode, setIsLoopMode] = useState(false);
  const [loopState, setLoopState] = useState<"idle" | "architect" | "oracle" | "cipher">("idle");
  const loopStateRef = useRef(loopState);
  useEffect(() => { loopStateRef.current = loopState; }, [loopState]);
  const [loopAgents, setLoopAgents] = useState<any[]>([]);

  // Load agents for Loop Mode
  useEffect(() => {
    invoke<string>("load_agents_config")
      .then(json => setLoopAgents(JSON.parse(json)))
      .catch(() => {});
  }, []);

  function refreshSkillsAndTools() {
    const tools = ["list_directory", "read_file_text", "write_file_text", "run_command", "fetch_url", "create_kanban_card", "update_kanban_card", "run_notebook_cell"];
    const toolsConfig: Record<string, boolean> = {};
    tools.forEach((t) => {
      const stored = window.localStorage.getItem(`tool_enabled_${t}`);
      toolsConfig[t] = stored !== "false";
    });
    setEnabledTools(toolsConfig);

    invoke<any[]>("list_skills_files")
      .then((list) => {
        setSkillsList(list);
        const skillsConfig: Record<string, boolean> = {};
        list.forEach((s) => {
          const stored = window.localStorage.getItem(`skill_enabled_${s.name}`);
          skillsConfig[s.name] = stored !== "false";
        });
        setEnabledSkills(skillsConfig);
      })
      .catch(() => {});
  }

  useEffect(() => {
    refreshSkillsAndTools();
    window.addEventListener("storage", refreshSkillsAndTools);
    return () => {
      window.removeEventListener("storage", refreshSkillsAndTools);
    };
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();

      if (file.type.startsWith("image/")) {
        reader.onload = (event) => {
          setAttachedFiles((prev) => [
            ...prev,
            {
              name: file.name,
              type: file.type,
              content: "",
              dataUrl: event.target?.result as string,
            },
          ]);
        };
        reader.readAsDataURL(file);
      } else {
        reader.onload = (event) => {
          setAttachedFiles((prev) => [
            ...prev,
            {
              name: file.name,
              type: file.type,
              content: event.target?.result as string,
            },
          ]);
        };
        reader.readAsText(file);
      }
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function openExternalLink(url: string) {
    openShell(url).catch(() => {
      invoke("open_url", { url }).catch(() => {
        window.open(url, "_blank");
      });
    });
  }

  function parseTextWithLinks(text: string) {
    const urlRegex = /(https?:\/\/[^\s\)]+)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = urlRegex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.substring(lastIndex, match.index));
      }
      const url = match[1];
      parts.push(
        <a
          key={match.index}
          href={url}
          onClick={(e) => {
            e.preventDefault();
            openExternalLink(url);
          }}
          style={{
            color: "var(--accent)",
            textDecoration: "underline",
            cursor: "pointer",
            fontWeight: "bold"
          }}
        >
          The Grid
        </a>
      );
      lastIndex = urlRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }

    return parts.length > 0 ? parts : text;
  }

  function renderMessageContent(content: string) {
    const imageRegex = /!\[([^\]]*)\]\((data:image\/[a-zA-Z+.-]+;base64,[^)]+)\)/g;
    const parts: React.ReactNode[] = [];
    let lastIndex = 0;
    let match;

    while ((match = imageRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(
          <span key={`txt-${lastIndex}`}>
            {parseTextWithLinks(content.substring(lastIndex, match.index))}
          </span>
        );
      }
      const alt = match[1];
      const src = match[2];
      parts.push(
        <div key={`img-${match.index}`} style={{ marginTop: 8, marginBottom: 8 }}>
          <img
            src={src}
            alt={alt}
            style={{
              maxWidth: "100%",
              maxHeight: 250,
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border)",
              display: "block",
            }}
          />
          <span style={{ fontSize: 11, color: "var(--ink-soft)" }}>{alt}</span>
        </div>
      );
      lastIndex = imageRegex.lastIndex;
    }

    if (lastIndex < content.length) {
      parts.push(
        <span key={`txt-${lastIndex}`}>
          {parseTextWithLinks(content.substring(lastIndex))}
        </span>
      );
    }

    return parts.length > 0 ? parts : content;
  }

  useEffect(() => {
    const loadSettings = () => {
      const localKey = window.localStorage.getItem("freellmapi_unified_key") || "";
      const localModel = window.localStorage.getItem("freellmapi_default_model") || "";
      const localOpenrouterKey = window.localStorage.getItem("freellmapi_openrouter_key") || "";
      const localOpenrouterModel = window.localStorage.getItem("freellmapi_openrouter_model") || "";
      const localOpenaiKey = window.localStorage.getItem("freellmapi_openai_key") || "";
      const localOpenaiModel = window.localStorage.getItem("freellmapi_openai_model") || "";
      const localGeminiKey = window.localStorage.getItem("freellmapi_gemini_key") || "";
      const localGeminiModel = window.localStorage.getItem("freellmapi_gemini_model") || "";
      const localCustomKey = window.localStorage.getItem("freellmapi_custom_key") || "";
      const localCustomUrl = window.localStorage.getItem("freellmapi_custom_url") || "";

      setFreeLlmApiKey(localKey);
      setFreeLlmApiModel(localModel);
      setOpenrouterKey(localOpenrouterKey);
      setOpenrouterModel(localOpenrouterModel);
      setOpenaiKey(localOpenaiKey);
      setOpenaiModel(localOpenaiModel);
      setGeminiKey(localGeminiKey);
      setGeminiModel(localGeminiModel);
      setCustomKey(localCustomKey);
      setCustomUrl(localCustomUrl);
    };

    loadSettings();

    invoke<any>("load_freellmapi_settings")
      .then((s) => {
        if (s) {
          const keyVal = (s.unified_key ?? s.unifiedKey) || window.localStorage.getItem("freellmapi_unified_key") || "";
          const modelVal = (s.default_model ?? s.defaultModel) || window.localStorage.getItem("freellmapi_default_model") || "";
          const orKeyVal = (s.openrouter_key ?? s.openrouterKey) || window.localStorage.getItem("freellmapi_openrouter_key") || "";
          const orModelVal = (s.openrouter_model ?? s.openrouterModel) || window.localStorage.getItem("freellmapi_openrouter_model") || "";
          const oaKeyVal = (s.openai_key ?? s.openaiKey) || window.localStorage.getItem("freellmapi_openai_key") || "";
          const oaModelVal = (s.openai_model ?? s.openaiModel) || window.localStorage.getItem("freellmapi_openai_model") || "";
          const gemKeyVal = (s.gemini_key ?? s.geminiKey) || window.localStorage.getItem("freellmapi_gemini_key") || "";
          const gemModelVal = (s.gemini_model ?? s.geminiModel) || window.localStorage.getItem("freellmapi_gemini_model") || "";
          const custKeyVal = (s.custom_key ?? s.customKey) || window.localStorage.getItem("freellmapi_custom_key") || "";
          const custUrlVal = (s.custom_url ?? s.customUrl) || window.localStorage.getItem("freellmapi_custom_url") || "";

          setFreeLlmApiKey(keyVal);
          setFreeLlmApiModel(modelVal);
          setOpenrouterKey(orKeyVal);
          setOpenrouterModel(orModelVal);
          setOpenaiKey(oaKeyVal);
          setOpenaiModel(oaModelVal);
          setGeminiKey(gemKeyVal);
          setGeminiModel(gemModelVal);
          setCustomKey(custKeyVal);
          setCustomUrl(custUrlVal);

          window.localStorage.setItem("freellmapi_unified_key", keyVal);
          window.localStorage.setItem("freellmapi_default_model", modelVal);
          window.localStorage.setItem("freellmapi_openrouter_key", orKeyVal);
          window.localStorage.setItem("freellmapi_openrouter_model", orModelVal);
          window.localStorage.setItem("freellmapi_openai_key", oaKeyVal);
          window.localStorage.setItem("freellmapi_openai_model", oaModelVal);
          window.localStorage.setItem("freellmapi_gemini_key", gemKeyVal);
          window.localStorage.setItem("freellmapi_gemini_model", gemModelVal);
          window.localStorage.setItem("freellmapi_custom_key", custKeyVal);
          window.localStorage.setItem("freellmapi_custom_url", custUrlVal);
        }
      })
      .catch(() => {
        // Silently rely on localStorage if loading from Tauri fails
      });

    window.addEventListener("storage", loadSettings);
    return () => {
      window.removeEventListener("storage", loadSettings);
    };
  }, []);

  function persistFreeLlmApiSettings(provider: string, key: string, model: string) {
    // Read directly from DOM to catch auto-filled values or immediate updates securely
    const dUnified = document.getElementById("chat-freellmapi-key") as HTMLInputElement;
    const dOpenrouter = document.getElementById("chat-openrouter-key") as HTMLInputElement;
    const dOpenai = document.getElementById("chat-openai-key") as HTMLInputElement;
    const dGemini = document.getElementById("chat-gemini-key") as HTMLInputElement;

    const valUnified = dUnified ? dUnified.value : (freeLlmApiKey || window.localStorage.getItem("freellmapi_unified_key") || "");
    const valOpenrouter = dOpenrouter ? dOpenrouter.value : (openrouterKey || window.localStorage.getItem("freellmapi_openrouter_key") || "");
    const valOpenai = dOpenai ? dOpenai.value : (openaiKey || window.localStorage.getItem("freellmapi_openai_key") || "");
    const valGemini = dGemini ? dGemini.value : (geminiKey || window.localStorage.getItem("freellmapi_gemini_key") || "");

    const updated = {
      unified_key: valUnified,
      default_model: freeLlmApiModel,
      openrouter_key: valOpenrouter,
      openrouter_model: openrouterModel,
      openai_key: valOpenai,
      openai_model: openaiModel,
      gemini_key: valGemini,
      gemini_model: geminiModel,
      custom_key: customKey,
      custom_url: customUrl,
    };

    let targetKey = key;
    if (provider === "freellmapi") {
      targetKey = valUnified;
      setFreeLlmApiKey(targetKey);
      setFreeLlmApiModel(model);
      updated.unified_key = targetKey;
      updated.default_model = model;
      window.localStorage.setItem("freellmapi_unified_key", targetKey);
      window.localStorage.setItem("freellmapi_default_model", model);
    } else if (provider === "openrouter") {
      targetKey = valOpenrouter;
      setOpenrouterKey(targetKey);
      setOpenrouterModel(model);
      updated.openrouter_key = targetKey;
      updated.openrouter_model = model;
      window.localStorage.setItem("freellmapi_openrouter_key", targetKey);
      window.localStorage.setItem("freellmapi_openrouter_model", model);
    } else if (provider === "openai") {
      targetKey = valOpenai;
      setOpenaiKey(targetKey);
      setOpenaiModel(model);
      updated.openai_key = targetKey;
      updated.openai_model = model;
      window.localStorage.setItem("freellmapi_openai_key", targetKey);
      window.localStorage.setItem("freellmapi_openai_model", model);
    } else if (provider === "gemini") {
      targetKey = valGemini;
      setGeminiKey(targetKey);
      setGeminiModel(model);
      updated.gemini_key = targetKey;
      updated.gemini_model = model;
      window.localStorage.setItem("freellmapi_gemini_key", targetKey);
      window.localStorage.setItem("freellmapi_gemini_model", model);
    }

    invoke("save_freellmapi_settings", { 
      unifiedKey: updated.unified_key, 
      unified_key: updated.unified_key, 
      defaultModel: updated.default_model, 
      default_model: updated.default_model,
      openrouterKey: updated.openrouter_key,
      openrouter_key: updated.openrouter_key,
      openrouterModel: updated.openrouter_model,
      openrouter_model: updated.openrouter_model,
      openaiKey: updated.openai_key,
      openai_key: updated.openai_key,
      openaiModel: updated.openai_model,
      openai_model: updated.openai_model,
      geminiKey: updated.gemini_key,
      gemini_key: updated.gemini_key,
      geminiModel: updated.gemini_model,
      gemini_model: updated.gemini_model,
      customKey: updated.custom_key,
      custom_key: updated.custom_key,
      customUrl: updated.custom_url,
      custom_url: updated.custom_url,
      // fallbacks
      mode: "proxy",
      provider: "openrouter",
      directApiKey: updated.openrouter_key,
      direct_api_key: updated.openrouter_key,
    })
      .then(() => {
        setFreeLlmApiSaveError("");
        setSettingsSaved(true);
        setTimeout(() => setSettingsSaved(false), 2000);
      })
      .catch((e) => {
        const errStr = String(e);
        if (errStr.includes("not found")) {
          setFreeLlmApiSaveError("");
          setSettingsSaved(true);
          setTimeout(() => setSettingsSaved(false), 2000);
        } else {
          setFreeLlmApiSaveError(`Couldn't save: ${e}`);
        }
      });
  }

  useEffect(() => {
    const isOrSelected = model === "openrouter" || (model === "genesis" && agentBrain === "openrouter");
    if (isOrSelected && openrouterFreeModels.length === 0 && !loadingOpenrouterModels) {
      setLoadingOpenrouterModels(true);
      invoke<any[]>("fetch_openrouter_free_models")
        .then((list) => {
          setOpenrouterFreeModels(list);
          if (list.length > 0 && !openrouterModel) {
            const firstModelId = list[0].id;
            setOpenrouterModel(firstModelId);
            window.localStorage.setItem("freellmapi_openrouter_model", firstModelId);
            // invoke save settings
            persistFreeLlmApiSettings("openrouter", openrouterKey, firstModelId);
          }
        })
        .catch((err) => {
          console.error("Failed to fetch free OpenRouter models", err);
        })
        .finally(() => {
          setLoadingOpenrouterModels(false);
        });
    }
  }, [model, agentBrain, openrouterFreeModels.length]);

  useEffect(() => {
    invoke<string>("load_genesis_wiki")
      .then(setWikiContent)
      .catch(() => {
        const localWiki = window.localStorage.getItem("genesis_wiki") || "# Genesis Memory Wiki\n\n- User preferences: Developer mode active.\n- Key focus: Speed and premium design aesthetics.\n";
        setWikiContent(localWiki);
      });

    invoke<string>("get_downloads_folder")
      .then(setDownloadsPath)
      .catch(() => {});
  }, []);

  function handleSaveWiki(content: string) {
    setWikiContent(content);
    window.localStorage.setItem("genesis_wiki", content);
    invoke("save_genesis_wiki", { content }).catch(() => {});
  }

  async function compileMemoryLoop(userMsgText: string, assistantReplyText: string) {
    if (!freeLlmApiKey) return; // Background compiler uses FreeLLMAPI
    setCompilingWiki(true);
    
    const prompt = `You are the Memory Compiler Core of Genesis. 
Your job is to read the latest user-assistant exchange and update the Memory Wiki.

Existing Memory Wiki:
"""
${wikiContent}
"""

Latest conversation exchange:
User: "${userMsgText}"
Assistant: "${assistantReplyText}"

Please output a revised version of the Memory Wiki.
Keep the existing wiki content but ADD any new persistent facts, user preferences, projects discussed, or long-term details that arose in the conversation.
If no new facts are learned, return the existing wiki exactly.
Respond ONLY with the raw updated markdown content. Do not include chat intro/outro, backticks, or code blocks.`;

    try {
      const provider = ["openrouter", "openai", "gemini", "freellmapi"].includes(agentBrain) ? agentBrain : "freellmapi";
      const targetModel = provider === "freellmapi" ? freeLlmApiModel 
                          : provider === "openrouter" ? openrouterModel 
                          : provider === "openai" ? openaiModel 
                          : provider === "gemini" ? geminiModel 
                          : "auto";
      const updatedWiki = await invoke<string>("chat_via_cloud", {
        provider,
        model: targetModel,
        message: prompt
      });
      if (updatedWiki && updatedWiki.trim() && !updatedWiki.startsWith("Error:")) {
        handleSaveWiki(updatedWiki.trim());
      }
    } catch (e) {
      // Ignore background compiler failures
    } finally {
      setCompilingWiki(false);
    }
  }

  useEffect(() => {
    invoke<ChatSession>("load_chat_session", { id: sessionId })
      .then((session) => {
        setMessages(session.messages);
        setModel(options.includes(session.model) ? session.model : options[0] ?? "");
      })
      .catch(() => setMessages([]));
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  useEffect(() => {
    const unToken = listen<ChatToken>("chat-token", (event) => {
      setMessages((prev) => {
        const next = [...prev];
        const last = next[next.length - 1];
        if (last && last.role === "assistant") {
          next[next.length - 1] = { ...last, content: last.content + event.payload.content };
        }
        return next;
      });
    });
    const unDone = listen("chat-done", () => {
      setMessages((prev) => {
        invoke("save_chat_session", { id: sessionId, model, messages: prev }).catch(() => {});
        const lastAssistant = prev[prev.length - 1];
        const lastUser = prev[prev.length - 2];
        if (lastAssistant && lastUser && (model === "genesis" || isLoopMode)) {
          const match = lastAssistant.content.match(/\[EXECUTE:\s*([a-zA-Z0-9_]+)\s*(\{.*\})\]/);
          if (match) {
            try {
              const name = match[1];
              const args = JSON.parse(match[2]);
              
              const autoTools = ["run_notebook_cell", "create_kanban_card", "update_kanban_card"];
              if (autoTools.includes(name)) {
                setTimeout(() => setAutoExecToolCall({ name, args, messageHistory: prev }), 0);
                return prev;
              }

              if (!isLoopMode) {
                setPendingToolCall({ name, args, messageHistory: prev });
              }
              return prev;
            } catch (e) {}
          }
          if (!isLoopMode) {
            compileMemoryLoop(lastUser.content, lastAssistant.content);
          }
        }
        
        if (isLoopMode) {
          const currentStep = loopStateRef.current;
          if (currentStep === "architect") {
            setTimeout(() => runLoopStep("oracle", "", [], prev), 500);
          } else if (currentStep === "oracle") {
            setTimeout(() => runLoopStep("cipher", "", [], prev), 500);
          } else if (currentStep === "cipher") {
            setLoopState("idle");
            setSending(false);
          }
        } else {
          setSending(false);
        }
        
        return prev;
      });
    });
    return () => {
      unToken.then((f) => f());
      unDone.then((f) => f());
    };
  }, [sessionId, model]);

  useEffect(() => {
    if (!autoExecToolCall) return;
    const { name, args, messageHistory } = autoExecToolCall;
    
    const executeAuto = async () => {
      let output = "";
      try {
        if (name === "run_notebook_cell") {
          output = await invoke("run_code_sandbox", { language: args.language || "python", code: args.code || "" });
        } else if (name === "create_kanban_card") {
          const json = await invoke<string>("load_kanban_config");
          const boards = JSON.parse(json);
          if (boards.length > 0) {
            const board = boards[0];
            const col = board.columns.find((c: any) => c.id === args.column);
            if (col) {
               col.cards.push({ id: "card-" + Date.now(), title: args.title || "Task", description: args.description || "" });
               await invoke("save_kanban_config", { content: JSON.stringify(boards) });
               output = `Successfully created card in column ${args.column}`;
            } else {
               output = `Column ${args.column} not found`;
            }
          } else {
            output = "No boards found.";
          }
        } else if (name === "update_kanban_card") {
          const json = await invoke<string>("load_kanban_config");
          const boards = JSON.parse(json);
          if (boards.length > 0) {
            const board = boards[0];
            let foundCard = null;
            // Remove card from old column
            board.columns.forEach((col: any) => {
              const idx = col.cards.findIndex((c: any) => c.id === args.card_id);
              if (idx !== -1) {
                foundCard = col.cards.splice(idx, 1)[0];
              }
            });
            // Add to new column
            if (foundCard) {
              const newCol = board.columns.find((c: any) => c.id === args.new_column);
              if (newCol) {
                newCol.cards.push(foundCard);
                await invoke("save_kanban_config", { content: JSON.stringify(boards) });
                output = `Successfully moved card to ${args.new_column}`;
              } else {
                output = `Column ${args.new_column} not found`;
              }
            } else {
              output = `Card ${args.card_id} not found`;
            }
          }
        }
      } catch (e) {
         output = `Error executing tool: ${e}`;
      }

      const newMessages = [...messageHistory, { role: "system" as const, content: `Tool Execution Result:\n${output}` }];
      setMessages(newMessages);
      
      if (isLoopMode) {
         runLoopStep(loopStateRef.current, "", [], newMessages);
      }
      setAutoExecToolCall(null);
    };
    executeAuto();
  }, [autoExecToolCall, isLoopMode]);

  async function runInference(history: ChatMessage[], userMsg: ChatMessage, overrideModel?: string, overrideSystem?: ChatMessage) {
    let routeModel = overrideModel || model;
    let systemPrompt: ChatMessage | null = overrideSystem || null;

    if (routeModel === "genesis" && !overrideSystem) {
      routeModel = agentBrain;

      const toolDescriptions: Record<string, string> = {
        list_directory: 'list_directory { "path": "absolute_path" } -> Returns a list of file/folder names inside that folder.',
        read_file_text: 'read_file_text { "path": "absolute_path" } -> Returns the text content of a file.',
        write_file_text: 'write_file_text { "path": "absolute_path", "content": "text_content" } -> Writes/overwrites a local file with the specified content.',
        run_command: 'run_command { "command": "shell_command" } -> Executes a terminal command (PowerShell on Windows) and returns output.',
        fetch_url: 'fetch_url { "url": "https://..." } -> Fetches URL content using HTTP GET.',
        create_kanban_card: 'create_kanban_card { "column": "col-todo", "title": "...", "description": "..." } -> Creates a card on the Kanban Board. Valid columns: col-todo, col-inprog, col-done.',
        update_kanban_card: 'update_kanban_card { "card_id": "card-...", "new_column": "col-done" } -> Moves an existing Kanban card to a new column.',
        run_notebook_cell: 'run_notebook_cell { "language": "python", "code": "print(123)" } -> Safely executes Python or Node.js code in the local Notebook Sandbox and returns stdout/stderr.'
      };

      const toolExamples: Record<string, string> = {
        list_directory: '- To list a directory: [EXECUTE: list_directory { "path": "C:\\\\Users\\\\Example\\\\Downloads" }]',
        read_file_text: '- To read a file: [EXECUTE: read_file_text { "path": "C:\\\\Users\\\\Example\\\\Downloads\\\\notes.txt" }]',
        write_file_text: '- To write a file: [EXECUTE: write_file_text { "path": "C:\\\\Users\\\\Example\\\\Downloads\\\\new.txt", "content": "Hello World" }]',
        run_command: '- To run a command: [EXECUTE: run_command { "command": "echo \"Hello from terminal\"" }]',
        fetch_url: '- To fetch a URL: [EXECUTE: fetch_url { "url": "https://raw.githubusercontent.com/example/README.md" }]',
        create_kanban_card: '- To create a Kanban task: [EXECUTE: create_kanban_card { "column": "col-todo", "title": "Build UI", "description": "Write React code" }]',
        update_kanban_card: '- To move a Kanban task to Done: [EXECUTE: update_kanban_card { "card_id": "card-12345", "new_column": "col-done" }]',
        run_notebook_cell: '- To run Python code in the sandbox: [EXECUTE: run_notebook_cell { "language": "python", "code": "def hello():\\n  print(\'hi\')\\nhello()" }]'
      };

      const activeTools = Object.keys(enabledTools).filter(k => enabledTools[k]);
      let toolsText = "";
      let examplesText = "";
      if (activeTools.length > 0) {
        toolsText = "Available tools:\n" + activeTools.map((t, idx) => `${idx + 1}. ${toolDescriptions[t]}`).join("\n");
        examplesText = "Examples:\n" + activeTools.map(t => toolExamples[t]).join("\n");
      } else {
        toolsText = "No system execution tools are currently enabled. You must solve the user's request strictly through conversational assistance.";
      }

      const activeSkills = skillsList.filter(s => enabledSkills[s.name]);
      let skillsText = "";
      if (activeSkills.length > 0) {
        skillsText = "\n\nAvailable Skills Library (Progressive Disclosure):\n" +
          "You have access to specialized documentation/skill manuals. If you need to perform any of these workflows, read the corresponding skill file using read_file_text:\n" +
          activeSkills.map(s => {
            const firstLine = s.content.split("\n")[0] || "";
            const cleanLine = firstLine.replace(/^#\s*/, "").trim();
            return ` - ${s.name}: ${cleanLine}.\n   Read details using: [EXECUTE: read_file_text { "path": "%APPDATA%\\\\genesis-grid\\\\skills\\\\${s.name}.md" }]`;
          }).join("\n");
      }

      systemPrompt = {
        role: "system",
        content: `You are Genesis, the primary cybernetic intelligence of Genesis Grid Labs. You speak with a clean, high-tech, futuristic developer-centric persona, combining absolute capability with synthwave styling. You are here to help the user build mods, test code, run local AI, and optimize their local machine. Keep responses concise, helpful, and technically precise.

Your local system environment:
- OS: Windows
- Downloads Folder Path: "${downloadsPath || "Unknown (ask user if needed)"}"

You have access to local system tools to inspect the PC! If you need to perform a task, output a tool call using the exact tag syntax:
[EXECUTE: <tool_name> { <args> }]

${toolsText}

${examplesText}

When you output a tool call, stop outputting immediately. The system will execute the command (after user permission), and send the results back as a system/user message. Then you can finish your response to the user.${skillsText}

Your Memory Core (Persistent Wiki):
"""
${wikiContent}
"""`
      };
    }

    const isCloud = ["freellmapi", "openrouter", "openai", "gemini"].includes(routeModel);
    if (isCloud) {
      try {
        const targetModel = routeModel === "freellmapi" ? freeLlmApiModel 
                            : routeModel === "openrouter" ? openrouterModel 
                            : routeModel === "openai" ? openaiModel 
                            : routeModel === "gemini" ? geminiModel 
                            : "auto";
        const reply = await invoke<string>("chat_via_cloud", {
          provider: routeModel,
          model: targetModel,
          message: systemPrompt
            ? `[System Directive: ${systemPrompt.content}]\n\nUser: ${userMsg.content}`
            : userMsg.content,
        });
        
        let hasToolCall = false;
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: reply };
          invoke("save_chat_session", { id: sessionId, model, messages: next }).catch(() => {});
          
          const match = reply.match(/\[EXECUTE:\s*([a-zA-Z0-9_]+)\s*(\{.*\})\]/);
          if (match) {
            try {
              const name = match[1];
              const args = JSON.parse(match[2]);
              setPendingToolCall({ name, args, messageHistory: next });
              hasToolCall = true;
              return next;
            } catch (e) {}
          }
          
          if (model === "genesis") {
            compileMemoryLoop(userMsg.content, reply);
          }
          return next;
        });
        
        if (!hasToolCall) {
          setSending(false);
        }
      } catch (e) {
        setMessages((prev) => {
          const next = [...prev];
          next[next.length - 1] = { role: "assistant", content: `Error: ${e}` };
          return next;
        });
        setSending(false);
      }
      return;
    }

    try {
      const historyToSend = systemPrompt ? [systemPrompt, ...history.slice(0, -1)] : history.slice(0, -1);
      await invoke("chat_send", { model: routeModel, history: historyToSend });
    } catch (e) {
      setMessages((prev) => {
        const next = [...prev];
        next[next.length - 1] = { role: "assistant", content: `Error: ${e}` };
        return next;
      });
      setSending(false);
    }
  }

  async function handleApproveTool() {
    if (!pendingToolCall) return;
    const { name, args, messageHistory } = pendingToolCall;
    setPendingToolCall(null);
    setSending(true);

    let resultStr = "";
    try {
      const res = await invoke<any>(name, args);
      resultStr = typeof res === "string" ? res : JSON.stringify(res);
    } catch (e) {
      resultStr = `Error executing tool: ${e}`;
    }

    const systemMsg: ChatMessage = { 
      role: "user", 
      content: `[System Tool Output: ${resultStr}]` 
    };
    
    const nextHistory = [...messageHistory, systemMsg, { role: "assistant" as const, content: "" }];
    setMessages(nextHistory);

    runInference(nextHistory, systemMsg);
  }

  async function handleDenyTool() {
    if (!pendingToolCall) return;
    const { messageHistory } = pendingToolCall;
    setPendingToolCall(null);
    setSending(true);

    const systemMsg: ChatMessage = { 
      role: "user", 
      content: `[System Tool Output: Access denied by user.]` 
    };
    
    const nextHistory = [...messageHistory, systemMsg, { role: "assistant" as const, content: "" }];
    setMessages(nextHistory);

    runInference(nextHistory, systemMsg);
  }

  async function handleSend() {
    if ((!draft.trim() && attachedFiles.length === 0) || !model || sending) return;

    let promptModifier = "";
    for (const file of attachedFiles) {
      if (file.dataUrl) {
        promptModifier += `\n\n![${file.name}](${file.dataUrl})`;
      } else if (file.content) {
        promptModifier += `\n\n[Attached File: ${file.name}]\n\`\`\`\n${file.content}\n\`\`\`\n`;
      }
    }

    const fullContent = draft.trim() + promptModifier;
    const userMsg: ChatMessage = { role: "user", content: fullContent };
    
    setDraft("");
    setAttachedFiles([]);
    setSending(true);

    if (isLoopMode) {
      runLoopStep("architect", fullContent, attachedFiles, []);
    } else {
      const withUser = [...messages, userMsg, { role: "assistant" as const, content: "" }];
      setMessages(withUser);
      runInference(withUser, userMsg);
    }
  }

  function runLoopStep(step: "architect" | "oracle" | "cipher", userText: string, files: any[], currentHistory: ChatMessage[]) {
    const architect = loopAgents.find(a => a.id === "architect") || { name: "Architect", role: "Planner", model: "genesis" };
    const oracle = loopAgents.find(a => a.id === "oracle") || { name: "Oracle", role: "Researcher", model: "genesis" };
    const cipher = loopAgents.find(a => a.id === "cipher") || { name: "Cipher", role: "Coder", model: "genesis" };

    const getModelStr = (agentModel: string) => agentModel === "genesis" ? agentBrain : agentModel;

    let targetAgent;
    let overrideSystemText = "";
    
    if (step === "architect") {
      targetAgent = architect;
      overrideSystemText = `[System: ${architect.role}]\n\nUser Request: ${userText}\n\nPlease break this down into a concrete plan for the next agent.`;
    } else if (step === "oracle") {
      targetAgent = oracle;
      const lastOutput = currentHistory[currentHistory.length - 1].content;
      overrideSystemText = `[System: ${oracle.role}]\n\nArchitect's Plan:\n${lastOutput}\n\nPlease perform necessary analysis/research for this plan.`;
    } else {
      targetAgent = cipher;
      const architectOutput = currentHistory[currentHistory.length - 3].content;
      const oracleOutput = currentHistory[currentHistory.length - 1].content;
      overrideSystemText = `[System: ${cipher.role}]\n\nArchitect's Plan:\n${architectOutput}\n\nOracle's Research:\n${oracleOutput}\n\nPlease execute the final task and provide the output to the user.`;
    }

    const sysMsg: ChatMessage = { role: "system", content: overrideSystemText };
    const userMsg: ChatMessage = { role: "user", content: step === "architect" ? userText : "(Internal Loop Handoff)" };

    const newHistory = [
      ...(step === "architect" ? messages : currentHistory),
      userMsg,
      { role: "assistant" as const, content: `**${targetAgent.name}:**\n\n` }
    ];

    setMessages(newHistory);
    setLoopState(step);
    setSending(true);
    runInference(newHistory, userMsg, getModelStr(targetAgent.model), sysMsg);
  }

  async function handleAbort() {
    setSending(false);
    try {
      await invoke("abort_chat");
    } catch (e) {
      // Silently swallow errors (e.g. command not found on old builds)
    }
    // Save the current chat history as-is
    setMessages((prev) => {
      invoke("save_chat_session", { id: sessionId, model, messages: prev }).catch(() => {});
      return prev;
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div>
          <h1 className="page-title" style={{ marginBottom: 0 }}>
            {model === "genesis" ? "Genesis Agent" : "Chat"}
          </h1>
          <p className="page-sub" style={{ marginBottom: 0 }}>
            {model === "genesis"
              ? "Talking to the primary cybernetic intelligence of Genesis Grid Labs."
              : "Talk to any model you've installed."}
          </p>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button 
            className="btn secondary" 
            onClick={onNewChat}
            style={{ fontSize: 13, padding: "8px 16px", whiteSpace: "nowrap" }}
          >
            + New Chat
          </button>
          <button 
            className="btn" 
            onClick={() => setIsLoopMode(!isLoopMode)}
            style={{ 
              fontSize: 13, 
              padding: "8px 16px", 
              whiteSpace: "nowrap",
              background: isLoopMode ? "var(--accent)" : "transparent",
              color: isLoopMode ? "#000" : "var(--accent)",
              border: "1px solid var(--accent)",
              fontWeight: "bold",
              boxShadow: isLoopMode ? "0 0 10px rgba(0, 242, 254, 0.4)" : "none",
              transition: "all 0.2s ease"
            }}
          >
            {isLoopMode ? "♺ LOOP MODE: ON" : "♺ LOOP MODE: OFF"}
          </button>
          {model === "genesis" ? (
            <div 
              style={{
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: "var(--bg-sunken)",
                color: "var(--ink)",
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                fontWeight: "bold",
                display: "flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap"
              }}
            >
              🔒 Genesis Agent
            </div>
          ) : (
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                background: "var(--bg-sunken)",
                color: "var(--ink)",
                fontFamily: "var(--font-mono)",
                fontSize: 13,
                minWidth: 200,
                maxWidth: 280,
              }}
            >
              <option value="genesis">Genesis Agent</option>
              {installedModels.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
              <option value="openrouter">OpenRouter (online)</option>
              <option value="openai">OpenAI (online)</option>
              <option value="gemini">Google Gemini (online)</option>
              <option value="freellmapi">FreeLLMAPI (online)</option>
            </select>
          )}
          {model === "genesis" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 12, color: "var(--ink-soft)", whiteSpace: "nowrap" }}>Brain:</span>
              <select
                value={agentBrain}
                onChange={(e) => {
                  setAgentBrain(e.target.value);
                  window.localStorage.setItem("genesis_agent_brain", e.target.value);
                }}
                style={{
                  padding: "8px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border)",
                  background: "var(--bg-sunken)",
                  color: "var(--ink)",
                  fontFamily: "var(--font-mono)",
                  fontSize: 13,
                  minWidth: 160,
                  maxWidth: 220,
                }}
              >
                {installedModels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
                <option value="openrouter">OpenRouter (online)</option>
                <option value="openai">OpenAI (online)</option>
                <option value="gemini">Google Gemini (online)</option>
                <option value="freellmapi">FreeLLMAPI (online)</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {(["freellmapi", "openrouter", "openai", "gemini"].includes(model) || (model === "genesis" && ["freellmapi", "openrouter", "openai", "gemini"].includes(agentBrain))) && (() => {
        const activeProvider = model === "genesis" ? agentBrain : model;
        return (
          <>
          <div style={{ display: "flex", gap: 8, marginBottom: 8, alignItems: "center" }}>
            {activeProvider === "freellmapi" && (
              <>
                <input
                  id="chat-freellmapi-key"
                  value={freeLlmApiKey}
                  onChange={(e) => setFreeLlmApiKey(e.target.value)}
                  onBlur={() => persistFreeLlmApiSettings("freellmapi", freeLlmApiKey, freeLlmApiModel)}
                  placeholder="freellmapi-… unified key (from dashboard, see Use online instead)"
                  style={{
                    flex: 2,
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: "var(--bg-sunken)",
                    color: "var(--ink)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                  }}
                />
                <input
                  value={freeLlmApiModel}
                  onChange={(e) => setFreeLlmApiModel(e.target.value)}
                  placeholder="model (e.g. auto)"
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: "var(--bg-sunken)",
                    color: "var(--ink)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                  }}
                />
                <button
                  type="button"
                  className="btn"
                  onClick={() => persistFreeLlmApiSettings("freellmapi", freeLlmApiKey, freeLlmApiModel)}
                  style={{
                    padding: "8px 12px",
                    fontSize: 12,
                    background: settingsSaved ? "var(--success)" : "var(--accent)",
                    borderColor: settingsSaved ? "var(--success)" : "var(--accent)",
                    transition: "all 0.2s ease",
                    minWidth: 70
                  }}
                >
                  {settingsSaved ? "Saved! ✓" : "Save"}
                </button>
              </>
            )}

            {activeProvider === "openrouter" && (
              <>
                <input
                  id="chat-openrouter-key"
                  type="password"
                  value={openrouterKey}
                  onChange={(e) => setOpenrouterKey(e.target.value)}
                  onBlur={() => persistFreeLlmApiSettings("openrouter", openrouterKey, openrouterModel)}
                  placeholder="OpenRouter API Key (sk-or-...)"
                  style={{
                    flex: 2,
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: "var(--bg-sunken)",
                    color: "var(--ink)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                  }}
                />
                <select
                  value={openrouterModel}
                  onChange={(e) => {
                    setOpenrouterModel(e.target.value);
                    persistFreeLlmApiSettings("openrouter", openrouterKey, e.target.value);
                  }}
                  style={{
                    flex: 1.5,
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: "var(--bg-sunken)",
                    color: "var(--ink)",
                    fontSize: 12,
                    cursor: "pointer",
                  }}
                >
                  {loadingOpenrouterModels ? (
                    <option value="">Loading free models...</option>
                  ) : (
                    <>
                      <option value="auto">Auto-select</option>
                      {openrouterFreeModels.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name || m.id}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                <button
                  type="button"
                  className="btn"
                  onClick={() => persistFreeLlmApiSettings("openrouter", openrouterKey, openrouterModel)}
                  style={{
                    padding: "8px 12px",
                    fontSize: 12,
                    background: settingsSaved ? "var(--success)" : "var(--accent)",
                    borderColor: settingsSaved ? "var(--success)" : "var(--accent)",
                    transition: "all 0.2s ease",
                    minWidth: 70
                  }}
                >
                  {settingsSaved ? "Saved! ✓" : "Save"}
                </button>
              </>
            )}

            {activeProvider === "openai" && (
              <>
                <input
                  id="chat-openai-key"
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  onBlur={() => persistFreeLlmApiSettings("openai", openaiKey, openaiModel)}
                  placeholder="OpenAI API Key (sk-proj-...)"
                  style={{
                    flex: 2,
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: "var(--bg-sunken)",
                    color: "var(--ink)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                  }}
                />
                <input
                  value={openaiModel}
                  onChange={(e) => setOpenaiModel(e.target.value)}
                  placeholder="model (e.g. gpt-4o-mini)"
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: "var(--bg-sunken)",
                    color: "var(--ink)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                  }}
                />
                <button
                  type="button"
                  className="btn"
                  onClick={() => persistFreeLlmApiSettings("openai", openaiKey, openaiModel)}
                  style={{
                    padding: "8px 12px",
                    fontSize: 12,
                    background: settingsSaved ? "var(--success)" : "var(--accent)",
                    borderColor: settingsSaved ? "var(--success)" : "var(--accent)",
                    transition: "all 0.2s ease",
                    minWidth: 70
                  }}
                >
                  {settingsSaved ? "Saved! ✓" : "Save"}
                </button>
              </>
            )}

            {activeProvider === "gemini" && (
              <>
                <input
                  id="chat-gemini-key"
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  onBlur={() => persistFreeLlmApiSettings("gemini", geminiKey, geminiModel)}
                  placeholder="Google Gemini API Key (AIzaSy...)"
                  style={{
                    flex: 2,
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: "var(--bg-sunken)",
                    color: "var(--ink)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                  }}
                />
                <input
                  value={geminiModel}
                  onChange={(e) => setGeminiModel(e.target.value)}
                  placeholder="model (e.g. gemini-1.5-flash)"
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border)",
                    background: "var(--bg-sunken)",
                    color: "var(--ink)",
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                  }}
                />
                <button
                  type="button"
                  className="btn"
                  onClick={() => persistFreeLlmApiSettings("gemini", geminiKey, geminiModel)}
                  style={{
                    padding: "8px 12px",
                    fontSize: 12,
                    background: settingsSaved ? "var(--success)" : "var(--accent)",
                    borderColor: settingsSaved ? "var(--success)" : "var(--accent)",
                    transition: "all 0.2s ease",
                    minWidth: 70
                  }}
                >
                  {settingsSaved ? "Saved! ✓" : "Save"}
                </button>
              </>
            )}
          </div>
          {freeLlmApiSaveError && (
            <p style={{ color: "var(--warn)", fontSize: 12, marginTop: -4, marginBottom: 8 }}>
              {freeLlmApiSaveError}
            </p>
          )}
          </>
        );
      })()}

      <div
        ref={scrollRef}
        className="card"
        style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12 }}
      >
        {messages.length === 0 && (
          <p style={{ color: "var(--ink-soft)" }}>No messages yet — say something below.</p>
        )}
        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === "user" ? "flex-end" : "flex-start",
              maxWidth: "75%",
              background: m.role === "user"
                ? "var(--accent)"
                : (model === "genesis"
                    ? (theme === "dark" 
                        ? "linear-gradient(135deg, rgba(6, 7, 10, 0.95) 0%, rgba(25, 10, 45, 0.95) 100%)"
                        : "linear-gradient(135deg, #f2eee3 0%, #e6e0cc 100%)")
                    : "var(--bg-sunken)"),
              border: m.role === "assistant" && model === "genesis"
                ? (theme === "dark" ? "1px solid #9d00ff" : "1px solid #d6ceb8")
                : "1px solid transparent",
              boxShadow: m.role === "assistant" && model === "genesis"
                ? (theme === "dark" ? "0 0 10px rgba(157, 0, 255, 0.25)" : "0 2px 6px rgba(0, 0, 0, 0.05)")
                : "none",
              color: m.role === "user" 
                ? "var(--accent-ink)" 
                : (m.role === "assistant" && model === "genesis" && theme === "dark" 
                    ? "#ffffff" 
                    : "var(--ink)"),
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              whiteSpace: "pre-wrap",
              fontSize: 14,
            }}
          >
            {m.content ? renderMessageContent(m.content) : (sending && i === messages.length - 1 ? "…" : "")}
          </div>
        ))}
      </div>

      {pendingToolCall && (
        <div 
          className="card" 
          style={{ 
            border: enabledTools[pendingToolCall.name] === false ? "1px solid var(--warn)" : "1px solid var(--accent)", 
            background: "var(--bg-sunken)", 
            padding: 16, 
            margin: "0 0 16px 0",
            borderRadius: "var(--radius-md)"
          }}
        >
          <p style={{ margin: "0 0 12px 0", fontWeight: "bold", fontSize: 14, color: enabledTools[pendingToolCall.name] === false ? "var(--warn)" : "inherit" }}>
            {enabledTools[pendingToolCall.name] === false 
              ? "⚠️ Genesis requested a tool that is currently disabled:" 
              : "🛡️ Genesis requests permission to execute a system tool:"}
          </p>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, background: "var(--bg)", padding: "10px 12px", borderRadius: 4, marginBottom: 12 }}>
            <strong>Tool:</strong> {pendingToolCall.name}<br/>
            <strong>Args:</strong> {JSON.stringify(pendingToolCall.args, null, 2)}
          </div>
          {enabledTools[pendingToolCall.name] === false && (
            <p style={{ fontSize: 12, color: "var(--warn)", margin: "0 0 12px 0" }}>
              This tool has been turned off in the <strong>Skills & Tools</strong> settings tab. You cannot approve its execution.
            </p>
          )}
          <div style={{ display: "flex", gap: 12 }}>
            <button 
              className="btn" 
              onClick={handleApproveTool} 
              disabled={enabledTools[pendingToolCall.name] === false}
            >
              Approve
            </button>
            <button 
              className="btn secondary" 
              style={{ borderColor: "var(--warn)", color: "var(--warn)" }} 
              onClick={handleDenyTool}
            >
              {enabledTools[pendingToolCall.name] === false ? "Dismiss" : "Deny"}
            </button>
          </div>
        </div>
      )}

      {attachedFiles.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
          {attachedFiles.map((file, idx) => (
            <div 
              key={idx} 
              style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 8, 
                background: "var(--bg-sunken)", 
                padding: "6px 10px", 
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border)",
                fontSize: 12,
              }}
            >
              {file.dataUrl ? (
                <img src={file.dataUrl} style={{ width: 20, height: 20, objectFit: "cover", borderRadius: 4 }} />
              ) : (
                <span>📄</span>
              )}
              <span style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file.name}
              </span>
              <button 
                onClick={() => setAttachedFiles(prev => prev.filter((_, i) => i !== idx))}
                style={{ 
                  background: "none", 
                  border: "none", 
                  color: "var(--warn)", 
                  cursor: "pointer", 
                  padding: 0,
                  fontSize: 12,
                  marginLeft: 4,
                  fontWeight: "bold"
                }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
        <input 
          type="file" 
          ref={fileInputRef} 
          style={{ display: "none" }} 
          onChange={handleFileChange} 
          multiple 
        />
        <button 
          className="btn secondary" 
          onClick={() => fileInputRef.current?.click()}
          title="Attach file or image"
          style={{ padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          📎
        </button>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Message the model…"
          rows={2}
          style={{
            flex: 1,
            padding: "10px 12px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
            background: "var(--bg-sunken)",
            color: "var(--ink)",
            fontFamily: "var(--font-body)",
            resize: "none",
          }}
        />
        {sending ? (
          <button className="btn secondary" onClick={handleAbort} style={{ borderColor: "var(--warn)", color: "var(--warn)", minWidth: 80 }}>
            Stop
          </button>
        ) : (
          <button className="btn" onClick={handleSend} disabled={!model}>
            Send
          </button>
        )}
      </div>
    </div>
  );
}
