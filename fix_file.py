import sys

with open("src/components/FileExplorer.tsx", "r", encoding="utf-8") as f:
    content = f.read()

if 'import React' not in content:
    content = "import React from 'react';\n" + content

with open("src/components/FileExplorer.tsx", "w", encoding="utf-8") as f:
    f.write(content)
