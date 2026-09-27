import sys

with open("src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

import re

# 1. Add auto-load for chat session if not present
auto_load_code = """
  useEffect(() => {
    if (!activeSessionId) {
      invoke<any[]>("list_chat_sessions").then((list) => {
        if (list && list.length > 0) {
          setActiveSessionId(list[0].id);
        } else {
          invoke<{ id: string }>("new_chat_session", { model: "genesis", projectId: null })
            .then((s) => setActiveSessionId(s.id));
        }
      }).catch(console.error);
    }
  }, []);
"""
if "list_chat_sessions" not in content:
    content = content.replace("  useEffect(() => {\n    getVersion()", auto_load_code + "\n  useEffect(() => {\n    getVersion()")

# 2. Fix FileExplorer re-render
if "const handleCloseExplorer = React.useCallback" not in content:
    content = content.replace("  return (\n", "  const handleCloseExplorer = React.useCallback(() => setShowFileExplorer(false), []);\n  return (\n")
    content = content.replace("<FileExplorer onClose={() => setShowFileExplorer(false)} />", "<FileExplorer onClose={handleCloseExplorer} />")

# Let's also wrap FileExplorer in React.memo in its own file just to be absolutely sure
with open("src/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)

