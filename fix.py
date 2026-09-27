import sys

with open("src/components/Chat.tsx", "r", encoding="utf-8") as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "Rapidly routing task to micro-agent" in line:
        lines[i] = '    const newHistory = [...messages, userMsg, { role: "assistant" as const, content: `**[DYNAMIC SWARM]** Rapidly routing task to micro-agent \\`${bestModel}\\`...\\n\\n` }];\n'
    if "Swarm: Handed off to" in line and "Unloading immediately after" in line:
        lines[i] = '    setActiveAgentStatus(`🐝 Swarm: Handed off to [${bestModel}] (Unloading immediately after)`);\n'

with open("src/components/Chat.tsx", "w", encoding="utf-8") as f:
    f.writelines(lines)
