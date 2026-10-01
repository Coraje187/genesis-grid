import sys
import json
from collections import OrderedDict

with open("src-tauri/tauri.conf.json", "r", encoding="utf-8") as f:
    config = json.load(f, object_pairs_hook=OrderedDict)

if "license" in config["tauri"]["bundle"]:
    del config["tauri"]["bundle"]["license"]

with open("src-tauri/tauri.conf.json", "w", encoding="utf-8") as f:
    json.dump(config, f, indent=2)
