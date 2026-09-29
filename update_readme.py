import sys

with open("README.md", "r", encoding="utf-8") as f:
    content = f.read()

import re

new_features = """- **Dynamic Model Swarming**: Instantly swaps tiny, highly-specialized local models in and out of GPU memory in milliseconds depending on the intent of your query (SQL, Python, Math, Writing).
- **Git-Psychology Engine**: Reads your past git commits to build a psychological profile of your coding style, perfectly mimicking your architecture and variables so AI code is undetectable.
- **Genesis Eye**: A native Rust-powered screen capture vision system that gives the AI real-time context of what you are looking at.
- **Predictive Shadow Execution**: Anticipates your prompts while you are typing and pre-computes responses silently in the background for zero-latency answers."""

if "Dynamic Model Swarming" not in content:
    content = content.replace("- **Loop Agents**:", new_features + "\n- **Loop Agents**:")

with open("README.md", "w", encoding="utf-8") as f:
    f.write(content)
