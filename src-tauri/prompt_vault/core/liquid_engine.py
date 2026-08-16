import os
import requests
from bs4 import BeautifulSoup
from jinja2 import Template
from pathlib import Path

class LiquidEngine:
    def __init__(self, base_dir: str = "."):
        self.base_dir = Path(base_dir)

    def _read_file(self, filepath: str) -> str:
        """Helper to read local files for injection."""
        full_path = self.base_dir / filepath
        if not full_path.exists():
            return f"[Error: File {filepath} not found]"
        with open(full_path, "r", encoding="utf-8") as f:
            return f.read()
            
    def _fetch_url(self, url: str) -> str:
        """Helper to fetch and scrape a webpage."""
        try:
            print(f"[\033[96mSCRAPER\033[0m] Fetching {url}...")
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            soup = BeautifulSoup(response.text, 'html.parser')
            # Extract text and remove excess whitespace
            return " ".join(soup.get_text(separator=' ').split())
        except Exception as e:
            return f"[Error fetching URL {url}: {str(e)}]"

    def render(self, template_str: str, **kwargs) -> str:
        """
        Renders the prompt template with special injection functions.
        """
        template = Template(template_str)
        
        context = {
            "read_file": self._read_file,
            "fetch_url": self._fetch_url
        }
        context.update(kwargs)
        
        return template.render(**context)
