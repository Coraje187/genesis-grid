import os
import json
import zipfile
from pathlib import Path

class PromptVault:
    def __init__(self, vault_dir: str = "prompts"):
        self.vault_dir = Path(vault_dir)
        self.vault_dir.mkdir(parents=True, exist_ok=True)
        
    def get_prompt(self, prompt_name: str) -> str:
        prompt_path = self.vault_dir / f"{prompt_name}.txt"
        if not prompt_path.exists():
            raise FileNotFoundError(f"Prompt '{prompt_name}' not found in vault.")
        with open(prompt_path, "r", encoding="utf-8") as f:
            return f.read()
            
    def save_prompt(self, prompt_name: str, content: str):
        prompt_path = self.vault_dir / f"{prompt_name}.txt"
        with open(prompt_path, "w", encoding="utf-8") as f:
            f.write(content)
            
    def list_prompts(self) -> list:
        return [p.stem for p in self.vault_dir.glob("*.txt")]

    def export_skill_pack(self, prompt_names: list, output_zip_path: str):
        """Export specific prompts into a single zip file."""
        print(f"[\033[95mVAULT\033[0m] Exporting skill pack to {output_zip_path}...")
        with zipfile.ZipFile(output_zip_path, 'w') as zf:
            for name in prompt_names:
                prompt_path = self.vault_dir / f"{name}.txt"
                if prompt_path.exists():
                    zf.write(prompt_path, arcname=f"{name}.txt")
                    
    def import_skill_pack(self, zip_path: str):
        """Import prompts from a zip file."""
        print(f"[\033[95mVAULT\033[0m] Importing skill pack from {zip_path}...")
        with zipfile.ZipFile(zip_path, 'r') as zf:
            zf.extractall(self.vault_dir)
