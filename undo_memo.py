import sys

with open("src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

import re

# Undo previous useMemo
content = re.sub(r'\{React\.useMemo\(\(\) => (.*?), \[.*?\]\)\}', r'\1', content)

with open("src/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)
