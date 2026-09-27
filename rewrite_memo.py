import sys

with open("src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

import re

memo_decls = r'''
  const memoAgents = React.useMemo(() => <AgentsView installedModels={installedModels} />, [installedModels]);
  const memoKanban = React.useMemo(() => <KanbanBoard />, []);
  const memoNotebook = React.useMemo(() => <Notebook />, []);
  const memoBrowser = React.useMemo(() => <BrowserUseMode />, []);
  const memoMuse = React.useMemo(() => <HermesMuse />, []);
  const memoChats = React.useMemo(() => <ChatHistory installedModels={installedModels} onOpenSession={openSession} />, [installedModels]);
  const memoMemory = React.useMemo(() => <MemoryCore />, []);
  const memoSkills = React.useMemo(() => <SkillsTools />, []);
  const memoHardware = React.useMemo(() => <HardwareCheck theme={theme} />, [theme]);
  const memoLibrary = React.useMemo(() => <ModelLibrary profile={profile} />, [profile]);
  const memoOnline = React.useMemo(() => <OnlineFallback />, []);
  const memoChat = React.useMemo(() => (
    activeSessionId ? (
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
    )
  ), [activeSessionId, installedModels, theme]);

  return (
'''

content = content.replace("  return (", memo_decls, 1)

content = re.sub(r'<KeepAlive viewName="agents" currentView=\{view\}><AgentsView installedModels=\{installedModels\} /></KeepAlive>', 
    r'<KeepAlive viewName="agents" currentView={view}>{memoAgents}</KeepAlive>', content)
content = re.sub(r'<KeepAlive viewName="kanban" currentView=\{view\}><KanbanBoard /></KeepAlive>', 
    r'<KeepAlive viewName="kanban" currentView={view}>{memoKanban}</KeepAlive>', content)
content = re.sub(r'<KeepAlive viewName="notebook" currentView=\{view\}><Notebook /></KeepAlive>', 
    r'<KeepAlive viewName="notebook" currentView={view}>{memoNotebook}</KeepAlive>', content)
content = re.sub(r'<KeepAlive viewName="browser" currentView=\{view\}><BrowserUseMode /></KeepAlive>', 
    r'<KeepAlive viewName="browser" currentView={view}>{memoBrowser}</KeepAlive>', content)
content = re.sub(r'<KeepAlive viewName="muse" currentView=\{view\}><HermesMuse /></KeepAlive>', 
    r'<KeepAlive viewName="muse" currentView={view}>{memoMuse}</KeepAlive>', content)

chat_replace = r'''<KeepAlive viewName="chat" currentView=\{view\}>
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

content = re.sub(chat_replace, r'<KeepAlive viewName="chat" currentView={view}>{memoChat}</KeepAlive>', content)

content = re.sub(r'<KeepAlive viewName="chats" currentView=\{view\}><ChatHistory installedModels=\{installedModels\} onOpenSession=\{openSession\} /></KeepAlive>', 
    r'<KeepAlive viewName="chats" currentView={view}>{memoChats}</KeepAlive>', content)
content = re.sub(r'<KeepAlive viewName="memory" currentView=\{view\}><MemoryCore /></KeepAlive>', 
    r'<KeepAlive viewName="memory" currentView={view}>{memoMemory}</KeepAlive>', content)
content = re.sub(r'<KeepAlive viewName="skills_tools" currentView=\{view\}><SkillsTools /></KeepAlive>', 
    r'<KeepAlive viewName="skills_tools" currentView={view}>{memoSkills}</KeepAlive>', content)
content = re.sub(r'<KeepAlive viewName="hardware" currentView=\{view\}><HardwareCheck theme=\{theme\} /></KeepAlive>', 
    r'<KeepAlive viewName="hardware" currentView={view}>{memoHardware}</KeepAlive>', content)
content = re.sub(r'<KeepAlive viewName="library" currentView=\{view\}><ModelLibrary profile=\{profile\} /></KeepAlive>', 
    r'<KeepAlive viewName="library" currentView={view}>{memoLibrary}</KeepAlive>', content)
content = re.sub(r'<KeepAlive viewName="online" currentView=\{view\}><OnlineFallback /></KeepAlive>', 
    r'<KeepAlive viewName="online" currentView={view}>{memoOnline}</KeepAlive>', content)

with open("src/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)
