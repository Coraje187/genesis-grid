import sys
import json
import asyncio
from playwright.async_api import async_playwright
import base64

async def run_task(task_obj):
    task_desc = task_obj.get("task", "")
    
    def log_msg(msg):
        print(json.dumps({"type": "log", "msg": msg}))
        sys.stdout.flush()

    log_msg(f"Initializing Visual Browser Agent for task: '{task_desc}'")
    
    try:
        async with async_playwright() as p:
            log_msg("Launching Chromium engine...")
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()
            
            if task_desc.startswith("http"):
                url = task_desc
                log_msg(f"Navigating directly to {url}")
                await page.goto(url)
            else:
                url = "https://html.duckduckgo.com/html/"
                log_msg(f"Searching for '{task_desc}'...")
                await page.goto(url)
                await page.fill('#search_form_input_homepage', task_desc)
                await page.click('#search_button_homepage')
                await page.wait_for_load_state('networkidle')
                
            log_msg("Analyzing DOM accessibility tree and extracting content...")
            text_content = await page.evaluate("document.body.innerText")
            
            log_msg("Capturing visual viewport snapshot...")
            screenshot_bytes = await page.screenshot(type="jpeg", quality=60)
            b64_img = base64.b64encode(screenshot_bytes).decode('utf-8')
            
            log_msg("Task complete. Handoff to Genesis Oracle.")
            
            print(json.dumps({
                "type": "result",
                "text": text_content[:2000] + "\n...(truncated)",
                "screenshot": f"data:image/jpeg;base64,{b64_img}"
            }))
            sys.stdout.flush()
            
            await browser.close()
    except Exception as e:
        log_msg(f"Error during browser task: {str(e)}")
        print(json.dumps({"type": "error", "error": str(e)}))
        sys.stdout.flush()

async def main():
    for line in sys.stdin:
        try:
            req = json.loads(line)
            if req.get("command") == "run_browser_task":
                await run_task(req)
        except Exception as e:
            print(json.dumps({"type": "error", "error": str(e)}))
            sys.stdout.flush()

if __name__ == "__main__":
    asyncio.run(main())
