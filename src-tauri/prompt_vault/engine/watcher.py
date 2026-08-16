import time
from pathlib import Path
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler
from engine.workflow import WorkflowEngine

class DropzoneHandler(FileSystemEventHandler):
    def __init__(self, workflow_engine: WorkflowEngine, routing_table: dict):
        self.workflow_engine = workflow_engine
        self.routing_table = routing_table

    def on_created(self, event):
        if event.is_directory:
            return
            
        filepath = Path(event.src_path)
        if filepath.name.endswith("_result.md"):
            return
            
        print(f"[\033[93mWATCHER\033[0m] New file detected: {filepath.name}")
        
        # Smart Routing based on extension
        ext = filepath.suffix.lower()
        target_workflow = self.routing_table.get(ext)
        
        if not target_workflow:
            print(f"[\033[93mWATCHER\033[0m] No route defined for extension '{ext}'. Ignoring.")
            return
            
        print(f"[\033[93mWATCHER\033[0m] Routing {ext} to workflow: {target_workflow}")
        
        final_output = self.workflow_engine.run_chain(
            target_workflow, 
            initial_vars={"dropped_file": filepath.name}
        )
        
        output_path = filepath.parent / f"{filepath.stem}_result.md"
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(final_output)
        print(f"[\033[93mWATCHER\033[0m] Result saved to: {output_path.name}")


class FolderWatcher:
    def __init__(self, watch_dir: str, workflow_engine: WorkflowEngine, routing_table: dict):
        self.watch_dir = watch_dir
        self.handler = DropzoneHandler(workflow_engine, routing_table)
        self.observer = Observer()
        Path(self.watch_dir).mkdir(parents=True, exist_ok=True)

    def start(self):
        self.observer.schedule(self.handler, self.watch_dir, recursive=False)
        self.observer.start()
        print(f"[\033[93mWATCHER\033[0m] Started monitoring {self.watch_dir}...")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            self.observer.stop()
            print("[\033[93mWATCHER\033[0m] Stopped monitoring.")
        self.observer.join()
