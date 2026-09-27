import sys
import re

with open("src/components/FileExplorer.tsx", "r", encoding="utf-8") as f:
    content = f.read()

if "export default React.memo(FileExplorer);" not in content:
    content = content.replace("export default function FileExplorer", "function FileExplorer")
    content += "\nexport default React.memo(FileExplorer);\n"
    
with open("src/components/FileExplorer.tsx", "w", encoding="utf-8") as f:
    f.write(content)
