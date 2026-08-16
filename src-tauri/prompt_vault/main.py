import os
from pathlib import Path
from core.vault import PromptVault
from core.liquid_engine import LiquidEngine
from llm.client import LLMClient
from engine.workflow import WorkflowEngine
from engine.watcher import FolderWatcher
from engine.improver import AutoImprover

def setup_demo_prompts(vault: PromptVault):
    """Seed the vault with demo prompts for different workflows."""
    
    # Text Analysis Workflow
    prompt1 = """
You are an expert analyst. Read the following file from the dropzone:
File Name: {{ dropped_file }}
Content:
{{ read_file('dropzone/' + dropped_file) }}
Please provide a highly detailed summary.
"""
    vault.save_prompt("step1_analyze", prompt1.strip())

    prompt2 = """
You are a creative writer. Take the following analysis and turn it into a blog post.
Analysis:
{{ previous_output }}
Format it nicely using Markdown.
"""
    vault.save_prompt("step2_blog_post", prompt2.strip())

    # Code Review Workflow (for .py files)
    code_prompt = """
You are a Senior Staff Software Engineer. 
Please review the following python code:
File Name: {{ dropped_file }}
Code:
{{ read_file('dropzone/' + dropped_file) }}

Also, here is the current top story on HackerNews to set the context of today's tech world:
{{ fetch_url('https://news.ycombinator.com/') }}

Provide a harsh but fair code review.
"""
    vault.save_prompt("code_review_harsh", code_prompt.strip())

def main():
    print("Initializing Genesis Grid Epic Prompt Vault v2.3.4...\n")
    
    # Initialize Core Components
    vault = PromptVault(vault_dir="prompts")
    liquid = LiquidEngine(base_dir=".")
    
    # Set use_mock=False to use real Ollama! (Make sure Ollama is running)
    llm = LLMClient(use_mock=False, model="llama3") 
    
    # Seed the vault
    setup_demo_prompts(vault)
    print(f"Vault loaded with prompts: {vault.list_prompts()}")
    
    # Export a skill pack just to show it works
    vault.export_skill_pack(["step1_analyze", "step2_blog_post"], "blog_writer_skill_pack.zip")
    
    # Initialize Engines
    workflow = WorkflowEngine(vault, liquid, llm)
    improver = AutoImprover(vault, llm)
    
    # Define Smart Routing
    routing_table = {
        ".txt": ["step1_analyze", "step2_blog_post"],
        ".md":  ["step1_analyze", "step2_blog_post"],
        ".py":  ["code_review_harsh"]
    }
    
    # Start the watcher
    dropzone_path = "dropzone"
    watcher = FolderWatcher(watch_dir=dropzone_path, workflow_engine=workflow, routing_table=routing_table)
    
    print("\n" + "="*60)
    print("🔥 THE EPIC ENGINE IS LIVE 🔥")
    print(f"Drop a .txt file into '{dropzone_path}' for a Blog Post.")
    print(f"Drop a .py file into '{dropzone_path}' for a Code Review (with live Web Scraping).")
    print(f"A Skill Pack has been exported to 'blog_writer_skill_pack.zip'.")
    print("="*60 + "\n")
    
    watcher.start()

if __name__ == "__main__":
    main()
