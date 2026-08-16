from core.vault import PromptVault
from llm.client import LLMClient

class AutoImprover:
    def __init__(self, vault: PromptVault, llm: LLMClient):
        self.vault = vault
        self.llm = llm

    def improve_prompt(self, prompt_name: str, bad_output: str, user_critique: str):
        """
        Takes a prompt that failed to do what the user wanted, asks the LLM to 
        rewrite the prompt to fix the flaw, and saves it back to the vault.
        """
        print(f"[\033[91mIMPROVER\033[0m] Initiating self-healing on '{prompt_name}'...")
        
        try:
            original_prompt = self.vault.get_prompt(prompt_name)
        except FileNotFoundError:
            print(f"[\033[91mIMPROVER\033[0m] Prompt '{prompt_name}' not found.")
            return

        meta_prompt = f"""
You are an expert Prompt Engineer.
Below is an original prompt that was given to an AI.
Below that is the output the AI generated, which was unsatisfactory.
Below that is the user's critique of what went wrong.

Your task is to REWRITE the original prompt to ensure this mistake never happens again.
Return ONLY the rewritten prompt, nothing else. No markdown blocks, no intro.

--- ORIGINAL PROMPT ---
{original_prompt}

--- BAD OUTPUT ---
{bad_output[:500]}... (truncated)

--- USER CRITIQUE ---
{user_critique}
"""
        new_prompt = self.llm.generate(meta_prompt)
        
        # Save as a v2
        new_name = f"{prompt_name}_v2"
        self.vault.save_prompt(new_name, new_prompt.strip())
        print(f"[\033[91mIMPROVER\033[0m] Successfully healed prompt. Saved as '{new_name}'.")
