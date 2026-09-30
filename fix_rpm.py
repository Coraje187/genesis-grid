import sys
import json
from collections import OrderedDict

with open("src-tauri/tauri.conf.json", "r", encoding="utf-8") as f:
    config = json.load(f, object_pairs_hook=OrderedDict)

config["tauri"]["bundle"]["shortDescription"] = "A one-click local AI desktop"
config["tauri"]["bundle"]["longDescription"] = "Genesis Grid is a one-click local AI desktop that manages Ollama models, features an autonomous micro-agent swarm, and provides a fully private workflow."
config["tauri"]["bundle"]["license"] = "MIT"

with open("src-tauri/tauri.conf.json", "w", encoding="utf-8") as f:
    json.dump(config, f, indent=2)
