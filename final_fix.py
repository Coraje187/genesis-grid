import sys

with open("src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

import re

# Add import React if missing
if 'import React' not in content:
    content = "import React from 'react';\n" + content

# Move handleCloseExplorer inside App function
content = content.replace("  const handleCloseExplorer = React.useCallback(() => setShowFileExplorer(false), []);\n  return (\n", "  return (\n")

memo_decls = r'''
  const handleCloseExplorer = React.useCallback(() => setShowFileExplorer(false), []);

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

with open("src/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)
