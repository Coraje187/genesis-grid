import sys

with open("src/App.tsx", "r", encoding="utf-8") as f:
    content = f.read()

import re

# Update Theme type
content = content.replace('type Theme = "light" | "dark";', 'type Theme = "light" | "dark" | "legacy-light" | "legacy-dark";')

# Replace the theme-toggle buttons with a single cycle button
cycle_button = r'''<div className="theme-toggle" style={{ marginTop: 0 }}>
          <button onClick={() => {
            const themes: Theme[] = ["dark", "light", "legacy-dark", "legacy-light"];
            const nextIndex = (themes.indexOf(theme) + 1) % themes.length;
            setTheme(themes[nextIndex]);
          }}>
            Theme: {theme === "dark" ? "Gold Dark" : theme === "light" ? "Gold Light" : theme === "legacy-dark" ? "Classic Dark" : "Classic Light"}
          </button>
        </div>'''

old_toggle = r'''<div className="theme-toggle" style={{ marginTop: 0 }}>
          <button data-active=\{theme === "light"\} onClick=\{\(\) => setTheme\("light"\)\}>
            Light
          </button>
          <button data-active=\{theme === "dark"\} onClick=\{\(\) => setTheme\("dark"\)\}>
            Dark
          </button>
        </div>'''

content = re.sub(old_toggle, cycle_button, content)

with open("src/App.tsx", "w", encoding="utf-8") as f:
    f.write(content)
