from core.vault import PromptVault
from core.liquid_engine import LiquidEngine
from llm.client import LLMClient

class WorkflowEngine:
    def __init__(self, vault: PromptVault, liquid: LiquidEngine, llm: LLMClient):
        self.vault = vault
        self.liquid = liquid
        self.llm = llm

    def run_chain(self, prompt_names: list, initial_vars: dict = None) -> str:
        """
        Runs a sequence of prompts. The output of prompt N becomes
        available as `previous_output` in prompt N+1.
        """
        current_vars = initial_vars or {}
        last_output = ""

        for name in prompt_names:
            print(f"[\033[92mWORKFLOW\033[0m] Executing step: {name}")
            
            # Load template from vault
            template_str = self.vault.get_prompt(name)
            
            # Inject variables (including last_output)
            current_vars["previous_output"] = last_output
            rendered_prompt = self.liquid.render(template_str, **current_vars)
            
            # Send to LLM
            last_output = self.llm.generate(rendered_prompt)
            print(f"[\033[92mWORKFLOW\033[0m] Output length: {len(last_output)} chars\n")

        return last_output
