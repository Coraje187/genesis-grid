import sys

with open("src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

import re

# Undo chat memo
chat_match = r'''\{React\.useMemo\(\(\) => <KeepAlive viewName="chat" currentView=\{view\}>
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
        </KeepAlive>, \[view === "chat", activeSessionId, installedModels, theme\]\)\}'''

replacement = r'''<KeepAlive viewName="chat" currentView={view}>
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
        </KeepAlive>'''

content = re.sub(chat_match, replacement, content)

with open("src/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)
