import sys
import re

with open("src/components/Chat.tsx", "r", encoding="utf-8") as f:
    content = f.read()

# Replace all theme === "dark" with theme.includes("dark") in the style prop of the message bubble
content = content.replace('theme === "dark"', 'theme.includes("dark")')

with open("src/components/Chat.tsx", "w", encoding="utf-8") as f:
    f.write(content)
