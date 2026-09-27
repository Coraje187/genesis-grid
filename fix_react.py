import sys

with open("src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

content = content.replace("React.useState", "useState").replace("React.useEffect", "useEffect").replace("React.ReactNode", "any")

with open("src/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)
