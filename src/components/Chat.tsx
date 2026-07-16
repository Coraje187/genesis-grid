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
  const options = ["genesis", ...installedModels, "freellmapi"];
  const [model, setModel] = useState(options[0] ?? "");
  const [agentBrain, setAgentBrain] = useState<string>(() => {
    const saved = window.localStorage.getItem("genesis_agent_brain");
    if (saved && (installedModels.includes(saved) || saved === "freellmapi")) {
      return saved;
    }
    return installedModels[0] ?? "freellmapi";
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [freeLlmApiKey, setFreeLlmApiKey] = useState("");
  const [freeLlmApiModel, setFreeLlmApiModel] = useState("");
  const [freeLlmApiSaveError, setFreeLlmApiSaveError] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const [attachedFiles, setAttachedFiles] = useState<{ name: string; content: string; type: string; dataUrl?: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [wikiContent, setWikiContent] = useState("");
  const [showWiki, setShowWiki] = useState(false);
  const [compilingWiki, setCompilingWiki] = useState(false);
  const [pendingToolCall, setPendingToolCall] = useState<{ name: string; args: any; messageHistory: ChatMessage[] } | null>(null);
  const [downloadsPath, setDownloadsPath] = useState("");

  const [enabledTools, setEnabledTools] = useState<Record<string, boolean>>({});
  const [skillsList, setSkillsList] = useState<{ name: string; content: string }[]>([]);
  const [enabledSkills, setEnabledSkills] = useState<Record<string, boolean>>({});

  function refreshSkillsAndTools() {
    const tools = ["list_directory", "read_file_text", "write_file_text", "run_command", "fetch_url"];
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
    const localKey = window.localStorage.getItem("freellmapi_unified_key") || "";
    const localModel = window.localStorage.getItem("freellmapi_default_model") || "";
    setFreeLlmApiKey(localKey);
    setFreeLlmApiModel(localModel);

    invoke<any>("load_freellmapi_settings")
      .then((s) => {
        const keyVal = s?.unified_key ?? s?.unifiedKey;
        const modelVal = s?.default_model ?? s?.defaultModel;
        if (keyVal) {
          setFreeLlmApiKey(keyVal);
          window.localStorage.setItem("freellmapi_unified_key", keyVal);
        }
        if (modelVal) {
          setFreeLlmApiModel(modelVal);
          window.localStorage.setItem("freellmapi_default_model", modelVal);
        }
      })
      .catch(() => {
        // Silently rely on localStorage if loading from Tauri fails
      });
  }, []);

  function persistFreeLlmApiSettings(key: string, model: string) {
    window.localStorage.setItem("freellmapi_unified_key", key);
    window.localStorage.setItem("freellmapi_default_model", model);

    invoke("save_freellmapi_settings", { 
      unifiedKey: key, 
      unified_key: key, 
      defaultModel: model, 
      default_model: model 
    })
      .then(() => setFreeLlmApiSaveError(""))
      .catch((e) => {
        const errStr = String(e);
        if (errStr.includes("not found")) {
          // If the Tauri command is missing, suppress the error since we saved in localStorage.
          setFreeLlmApiSaveError("");
        } else {
          setFreeLlmApiSaveError(`Couldn't save: ${e}`);
        }
      });
  }

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
      const updatedWiki = await invoke<string>("chat_via_freellmapi", {
        unifiedKey: freeLlmApiKey,
        unified_key: freeLlmApiKey,
        model: freeLlmApiModel || "auto",
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
      setSending(false);
      setMessages((prev) => {
        invoke("save_chat_session", { id: sessionId, model, messages: prev }).catch(() => {});
        const lastAssistant = prev[prev.length - 1];
        const lastUser = prev[prev.length - 2];
        if (lastAssistant && lastUser && model === "genesis") {
          const match = lastAssistant.content.match(/\[EXECUTE:\s*([a-zA-Z0-9_]+)\s*(\{.*\})\]/);
          if (match) {
            try {
              const name = match[1];
              const args = JSON.parse(match[2]);
              setPendingToolCall({ name, args, messageHistory: prev });
              return prev;
            } catch (e) {}
          }
          compileMemoryLoop(lastUser.content, lastAssistant.content);
        }
        return prev;
      });
    });
    return () => {
      unToken.then((f) => f());
      unDone.then((f) => f());
    };
  }, [sessionId, model]);

  async function runInference(history: ChatMessage[], userMsg: ChatMessage) {
    let routeModel = model;
    let systemPrompt: ChatMessage | null = null;

    if (model === "genesis") {
      routeModel = agentBrain;

      const toolDescriptions: Record<string, string> = {
        list_directory: 'list_directory { "path": "absolute_path" } -> Returns a list of file/folder names inside that folder.',
        read_file_text: 'read_file_text { "path": "absolute_path" } -> Returns the text content of a file.',
        write_file_text: 'write_file_text { "path": "absolute_path", "content": "text_content" } -> Writes/overwrites a local file with the specified content.',
        run_command: 'run_command { "command": "shell_command" } -> Executes a terminal command (PowerShell on Windows) and returns output.',
        fetch_url: 'fetch_url { "url": "https://..." } -> Fetches URL content using HTTP GET.'
      };

      const toolExamples: Record<string, string> = {
        list_directory: '- To list a directory: [EXECUTE: list_directory { "path": "C:\\\\Users\\\\Example\\\\Downloads" }]',
        read_file_text: '- To read a file: [EXECUTE: read_file_text { "path": "C:\\\\Users\\\\Example\\\\Downloads\\\\notes.txt" }]',
        write_file_text: '- To write a file: [EXECUTE: write_file_text { "path": "C:\\\\Users\\\\Example\\\\Downloads\\\\new.txt", "content": "Hello World" }]',
        run_command: '- To run a command: [EXECUTE: run_command { "command": "echo \"Hello from terminal\"" }]',
        fetch_url: '- To fetch a URL: [EXECUTE: fetch_url { "url": "https://raw.githubusercontent.com/example/README.md" }]'
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
            return ` - ${s.name}: ${cleanLine}.\n   Read details using: [EXECUTE: read_file_text { "path": "C:\\\\Users\\\\Coraj\\\\AppData\\\\Roaming\\\\genesis-grid\\\\skills\\\\${s.name}.md" }]`;
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

    if (routeModel === "freellmapi") {
      try {
        const reply = await invoke<string>("chat_via_freellmapi", {
          unifiedKey: freeLlmApiKey,
          unified_key: freeLlmApiKey,
          model: freeLlmApiModel,
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
    const withUser = [...messages, userMsg, { role: "assistant" as const, content: "" }];
    setMessages(withUser);
    setDraft("");
    setAttachedFiles([]);
    setSending(true);

    runInference(withUser, userMsg);
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
                <option value="freellmapi">FreeLLMAPI (online)</option>
              </select>
            </div>
          )}
        </div>
      </div>

      {model === "freellmapi" && (
        <>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            value={freeLlmApiKey}
            onChange={(e) => {
              setFreeLlmApiKey(e.target.value);
              persistFreeLlmApiSettings(e.target.value, freeLlmApiModel);
            }}
            placeholder="freellmapi-… unified key (from its dashboard, see Use online instead)"
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
            onChange={(e) => {
              setFreeLlmApiModel(e.target.value);
              persistFreeLlmApiSettings(freeLlmApiKey, e.target.value);
            }}
            placeholder="model (e.g. auto, or a name from its dashboard)"
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
        </div>
        {freeLlmApiSaveError && (
          <p style={{ color: "var(--warn)", fontSize: 12, marginTop: -4, marginBottom: 8 }}>
            {freeLlmApiSaveError}
          </p>
        )}
        </>
      )}

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
