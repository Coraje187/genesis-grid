import time
import ollama

class LLMClient:
    def __init__(self, use_mock: bool = False, model: str = "llama3"):
        self.use_mock = use_mock
        self.model = model

    def generate(self, prompt: str) -> str:
        if self.use_mock:
            print(f"[\033[94mMOCK LLM\033[0m] Generating response for prompt ({len(prompt)} chars)...")
            time.sleep(1)
            return f"Mock Response based on: {prompt[:50]}...\n\n(This is where the real AI output goes.)"
        else:
            print(f"[\033[94mOLLAMA\033[0m] Asking {self.model} to process ({len(prompt)} chars)...")
            try:
                response = ollama.chat(model=self.model, messages=[
                    {'role': 'user', 'content': prompt}
                ])
                return response['message']['content']
            except Exception as e:
                return f"[LLM Error: {str(e)}]\nMake sure Ollama is running and the model '{self.model}' is installed."
