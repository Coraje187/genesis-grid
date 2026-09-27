import sys

with open("src/components/FileExplorer.tsx", "r", encoding="utf-8") as f:
    content = f.read()

import re

children_map_match = r'''\{children\.map\(\(child\) => \(
            child\.is_dir \? \(
              <FolderNode key=\{child\.name\} path=\{`\$\{path\}\\\\\$\{child\.name\}`\} name=\{child\.name\} />
            \) : \(
              <FileNode key=\{child\.name\} path=\{`\$\{path\}\\\\\$\{child\.name\}`\} name=\{child\.name\} />
            \)
          \)\)\}'''

replacement = r'''{children.slice(0, 150).map((child) => (
            child.is_dir ? (
              <FolderNode key={child.name} path={`${path}\\${child.name}`} name={child.name} />
            ) : (
              <FileNode key={child.name} path={`${path}\\${child.name}`} name={child.name} />
            )
          ))}
          {children.length > 150 && (
            <div style={{ padding: "4px 20px", fontSize: 11, color: "var(--ink-soft)", fontStyle: "italic" }}>
              + {children.length - 150} more items hidden...
            </div>
          )}'''

content = re.sub(children_map_match, replacement, content)

with open("src/components/FileExplorer.tsx", "w", encoding="utf-8") as f:
    f.write(content)
