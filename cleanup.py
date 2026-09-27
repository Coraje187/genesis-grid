import sys

with open("src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

import re

# Remove the bad injection from KeepAlive
content = re.sub(r'  const memoAgents = React\.useMemo\(.*?\[installedModels, theme\]\);\n\n', '', content, flags=re.DOTALL)
# It might not match because I don't know the exact string. Let's just find and replace the block between "const isChat = viewName === 'chat';" and "return ("

content = re.sub(r'  const memoAgents = React\.useMemo.*?\), \[activeSessionId, installedModels, theme\]\);\n\n', '', content, flags=re.DOTALL)

with open("src/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)
