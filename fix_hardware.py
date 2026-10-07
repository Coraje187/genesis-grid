import sys

with open("src/components/HardwareCheck.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace('theme === "dark"', 'theme.includes("dark")')

with open("src/components/HardwareCheck.tsx", "w", encoding="utf-8") as f:
    f.write(content)
