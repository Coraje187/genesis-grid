import sys

with open("src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Add KeepAlive component definition right after imports
if "function KeepAlive" not in content:
    keep_alive = """
function KeepAlive({ viewName, currentView, children }: { viewName: string, currentView: string, children: React.ReactNode }) {
  const [mounted, setMounted] = React.useState(viewName === currentView);
  React.useEffect(() => {
    if (viewName === currentView) setMounted(true);
  }, [currentView]);
  if (!mounted) return null;
  const isChat = viewName === "chat";
  return (
    <div style={{ display: viewName === currentView ? (isChat ? "flex" : "block") : "none", height: "100%", width: "100%", flexDirection: isChat ? "column" : undefined, minHeight: isChat ? 0 : undefined }}>
      {children}
    </div>
  );
}
"""
    content = content.replace("export default function App() {", keep_alive + "\nexport default function App() {")

# Replace all those display: none blocks with KeepAlive
import re

content = re.sub(r'<div style=\{\{ display: view === "agents" \? "block" : "none", height: "100%", width: "100%" \}\}>\s*<AgentsView installedModels=\{installedModels\} />\s*</div>', 
    r'<KeepAlive viewName="agents" currentView={view}><AgentsView installedModels={installedModels} /></KeepAlive>', content)

content = re.sub(r'<div style=\{\{ display: view === "kanban" \? "block" : "none", height: "100%", width: "100%" \}\}>\s*<KanbanBoard />\s*</div>', 
    r'<KeepAlive viewName="kanban" currentView={view}><KanbanBoard /></KeepAlive>', content)

content = re.sub(r'<div style=\{\{ display: view === "notebook" \? "block" : "none", height: "100%", width: "100%" \}\}>\s*<Notebook />\s*</div>', 
    r'<KeepAlive viewName="notebook" currentView={view}><Notebook /></KeepAlive>', content)

content = re.sub(r'<div style=\{\{ display: view === "browser" \? "block" : "none", height: "100%", width: "100%" \}\}>\s*<BrowserUseMode />\s*</div>', 
    r'<KeepAlive viewName="browser" currentView={view}><BrowserUseMode /></KeepAlive>', content)

content = re.sub(r'<div style=\{\{ display: view === "muse" \? "block" : "none", height: "100%", width: "100%" \}\}>\s*<HermesMuse />\s*</div>', 
    r'<KeepAlive viewName="muse" currentView={view}><HermesMuse /></KeepAlive>', content)

content = re.sub(r'<div style=\{\{ display: view === "chat" \? "flex" : "none", flexDirection: "column", height: "100%", flex: 1, minHeight: 0 \}\}>\s*\{activeSessionId \? \(\s*<Chat \s*sessionId=\{activeSessionId\} \s*installedModels=\{installedModels\} \s*theme=\{theme\}\s*onNewChat=\{async \(\) => \{\s*const session = await invoke<\{ id: string \}>\("new_chat_session", \{ model: "genesis", projectId: null \}\);\s*setActiveSessionId\(session\.id\);\s*\}\}\s*/>\s*\) : \(\s*<p style=\{\{ color: "var\(--ink-soft\)" \}\}>Starting a new chat\.</p>\s*\)\}\s*</div>', 
    r'''<KeepAlive viewName="chat" currentView={view}>
          {activeSessionId ? (
            <Chat 
              sessionId={activeSessionId} 
              installedModels={installedModels} 
              theme={theme}
              onNewChat={async () => {
                const session = await invoke<{ id: string }>("new_chat_session", { model: "genesis", projectId: null });
                setActiveSessionId(session.id);
              }}
            />
          ) : (
            <p style={{ color: "var(--ink-soft)" }}>Starting a new chat.</p>
          )}
        </KeepAlive>''', content)

content = re.sub(r'<div style=\{\{ display: view === "chats" \? "block" : "none", height: "100%", width: "100%" \}\}>\s*<ChatHistory installedModels=\{installedModels\} onOpenSession=\{openSession\} />\s*</div>', 
    r'<KeepAlive viewName="chats" currentView={view}><ChatHistory installedModels={installedModels} onOpenSession={openSession} /></KeepAlive>', content)

content = re.sub(r'<div style=\{\{ display: view === "memory" \? "block" : "none", height: "100%", width: "100%" \}\}>\s*<MemoryCore />\s*</div>', 
    r'<KeepAlive viewName="memory" currentView={view}><MemoryCore /></KeepAlive>', content)

content = re.sub(r'<div style=\{\{ display: view === "skills_tools" \? "block" : "none", height: "100%", width: "100%" \}\}>\s*<SkillsTools />\s*</div>', 
    r'<KeepAlive viewName="skills_tools" currentView={view}><SkillsTools /></KeepAlive>', content)

content = re.sub(r'<div style=\{\{ display: view === "hardware" \? "block" : "none", height: "100%", width: "100%" \}\}>\s*<HardwareCheck theme=\{theme\} />\s*</div>', 
    r'<KeepAlive viewName="hardware" currentView={view}><HardwareCheck theme={theme} /></KeepAlive>', content)

content = re.sub(r'<div style=\{\{ display: view === "library" \? "block" : "none", height: "100%", width: "100%" \}\}>\s*<ModelLibrary profile=\{profile\} />\s*</div>', 
    r'<KeepAlive viewName="library" currentView={view}><ModelLibrary profile={profile} /></KeepAlive>', content)

content = re.sub(r'<div style=\{\{ display: view === "online" \? "block" : "none", height: "100%", width: "100%" \}\}>\s*<OnlineFallback />\s*</div>', 
    r'<KeepAlive viewName="online" currentView={view}><OnlineFallback /></KeepAlive>', content)

with open("src/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)
