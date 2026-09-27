import sys
import re

with open("src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Strip the wrongly injected block
content = re.sub(r'  const handleCloseExplorer = React\.useCallback.*?return \(\n', '  return (\n', content, flags=re.DOTALL)

# Insert it in the correct place inside App
# Find the end of goToChat and start of return
insert_point_regex = r'(  async function goToChat\(\) \{.*?\}\n\n)  return \('
match = re.search(insert_point_regex, content, re.DOTALL)
if match:
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

  return ('''
    content = content.replace(match.group(0), match.group(1) + memo_decls)

with open("src/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)
