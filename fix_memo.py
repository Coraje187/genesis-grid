import sys

with open("src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

import re

# We will memoize the components directly in App.tsx
# Add useMemo around heavy components instead of React.memo so we don't have to change their exports

content = re.sub(r'<KeepAlive viewName="kanban" currentView=\{view\}><KanbanBoard /></KeepAlive>', 
    r'{React.useMemo(() => <KeepAlive viewName="kanban" currentView={view}><KanbanBoard /></KeepAlive>, [view === "kanban"])}', content)

content = re.sub(r'<KeepAlive viewName="agents" currentView=\{view\}><AgentsView installedModels=\{installedModels\} /></KeepAlive>', 
    r'{React.useMemo(() => <KeepAlive viewName="agents" currentView={view}><AgentsView installedModels={installedModels} /></KeepAlive>, [view === "agents", installedModels])}', content)

content = re.sub(r'<KeepAlive viewName="notebook" currentView=\{view\}><Notebook /></KeepAlive>', 
    r'{React.useMemo(() => <KeepAlive viewName="notebook" currentView={view}><Notebook /></KeepAlive>, [view === "notebook"])}', content)

content = re.sub(r'<KeepAlive viewName="chats" currentView=\{view\}><ChatHistory installedModels=\{installedModels\} onOpenSession=\{openSession\} /></KeepAlive>', 
    r'{React.useMemo(() => <KeepAlive viewName="chats" currentView={view}><ChatHistory installedModels={installedModels} onOpenSession={openSession} /></KeepAlive>, [view === "chats", installedModels])}', content)

content = re.sub(r'<KeepAlive viewName="memory" currentView=\{view\}><MemoryCore /></KeepAlive>', 
    r'{React.useMemo(() => <KeepAlive viewName="memory" currentView={view}><MemoryCore /></KeepAlive>, [view === "memory"])}', content)

# For Chat, we can also useMemo:
chat_match = r'''<KeepAlive viewName="chat" currentView=\{view\}>
          \{activeSessionId \? \(
            <Chat 
              sessionId=\{activeSessionId\} 
              installedModels=\{installedModels\} 
              theme=\{theme\}
              onNewChat=\{async \(\) => \{
                const session = await invoke<\{ id: string \}>\("new_chat_session", \{ model: "genesis", projectId: null \}\);
                setActiveSessionId\(session\.id\);
              \}\}
            />
          \) : \(
            <p style=\{\{ color: "var\(--ink-soft\)" \}\}>Starting a new chat\.</p>
          \)\}
        </KeepAlive>'''

replacement = r'''{React.useMemo(() => <KeepAlive viewName="chat" currentView={view}>
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
        </KeepAlive>, [view === "chat", activeSessionId, installedModels, theme])}'''

content = re.sub(chat_match, replacement, content)

with open("src/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)
