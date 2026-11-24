import sys
import json
import asyncio
import traceback

import os

PINNED_PACKAGES = [
    "browser-use==0.1.40",
    "langchain-openai==0.3.12",
    "playwright==1.51.0",
]

def install_deps():
    try:
        import browser_use
        import langchain_openai
    except ImportError:
        import subprocess
        print(json.dumps({"type": "progress", "message": "Installing pinned browser-use dependencies... this may take a moment."}))
        req_file = os.path.join(os.path.dirname(os.path.abspath(__file__)), "browser_use_requirements.txt")
        if os.path.isfile(req_file):
            subprocess.check_call([
                sys.executable, "-m", "pip", "install",
                "--no-cache-dir", "--disable-pip-version-check",
                "--require-hashes", "-r", req_file,
            ])
        else:
            subprocess.check_call([
                sys.executable, "-m", "pip", "install",
                "--no-cache-dir", "--disable-pip-version-check",
                *PINNED_PACKAGES,
            ])
        subprocess.check_call([sys.executable, "-m", "playwright", "install", "chromium"])
        print(json.dumps({"type": "progress", "message": "Dependencies installed!"}))

install_deps()

from browser_use import Agent
from langchain_openai import ChatOpenAI

async def run_task(task_data):
    task = task_data.get("task", "")
    provider = task_data.get("provider", "openai")
    api_key = task_data.get("api_key", "")
    model_name = task_data.get("model", "gpt-4o")
    
    if not api_key:
        print(json.dumps({"type": "error", "message": f"Missing API key for {provider}"}))
        return

    print(json.dumps({"type": "progress", "message": f"Starting browser agent with {model_name}..."}))
    
    try:
        if provider == "openai":
            llm = ChatOpenAI(model=model_name, api_key=api_key)
        elif provider == "openrouter":
            llm = ChatOpenAI(
                base_url="https://openrouter.ai/api/v1",
                api_key=api_key,
                model=model_name,
                default_headers={
                    "HTTP-Referer": "https://genesisgridlabs.xyz",
                    "X-Title": "Genesis Grid"
                }
            )
        else:
            # Fallback to OpenAI compatible endpoint if needed
            llm = ChatOpenAI(
                base_url=task_data.get("base_url", "https://api.openai.com/v1"),
                api_key=api_key,
                model=model_name
            )
            
        agent = Agent(
            task=task,
            llm=llm
        )
        
        result = await agent.run()
        final_answer = result.final_result()
        print(json.dumps({"type": "success", "result": str(final_answer)}))
        
    except Exception as e:
        print(json.dumps({"type": "error", "message": f"Browser Use Error: {str(e)}\n{traceback.format_exc()}"}))

async def main():
    print(json.dumps({"type": "ready"}))
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            if req.get("command") == "run_browser_task":
                await run_task(req)
            elif req.get("command") == "ping":
                print(json.dumps({"type": "pong"}))
            elif req.get("command") == "exit":
                break
        except json.JSONDecodeError:
            pass
        except Exception as e:
            print(json.dumps({"type": "error", "message": str(e)}))

if __name__ == "__main__":
    asyncio.run(main())
