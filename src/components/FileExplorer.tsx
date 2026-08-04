import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { open } from "@tauri-apps/api/shell";

interface FileEntry {
  name: string;
  is_dir: boolean;
}

function FolderNode({ path, name, initialOpen = false }: { path: string, name: string, initialOpen?: boolean }) {
  const [isOpen, setIsOpen] = useState(initialOpen);
  const [children, setChildren] = useState<FileEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (initialOpen && !loaded) {
      loadDir();
    }
  }, [initialOpen]);

  const loadDir = async () => {
    try {
      const files: FileEntry[] = await invoke("get_file_tree", { path });
      setChildren(files);
      setLoaded(true);
    } catch (e) {
      console.error("Failed to load directory", e);
    }
  };

  const toggleOpen = () => {
    if (!isOpen && !loaded) {
      loadDir();
    }
    setIsOpen(!isOpen);
  };

  return (
    <div className="file-node">
      <div className="file-node-header" onClick={toggleOpen}>
        <span className="file-icon folder-caret">
          {isOpen ? (
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M14 6L8 12L2 6H14Z" />
            </svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6 2L12 8L6 14V2Z" />
            </svg>
          )}
        </span>
        <span className="file-icon">📁</span>
        <span className="file-name">{name}</span>
      </div>
      {isOpen && (
        <div className="file-node-children">
          {children.map((child) => (
            child.is_dir ? (
              <FolderNode key={child.name} path={`${path}\\${child.name}`} name={child.name} />
            ) : (
              <FileNode key={child.name} path={`${path}\\${child.name}`} name={child.name} />
            )
          ))}
        </div>
      )}
    </div>
  );
}

function FileNode({ path, name }: { path: string, name: string }) {
  const handleClick = () => {
    open(path).catch(console.error);
  };

  return (
    <div className="file-node">
      <div className="file-node-header file-only" onClick={handleClick}>
        <span className="file-icon file-icon-plain">📄</span>
        <span className="file-name">{name}</span>
      </div>
    </div>
  );
}

export default function FileExplorer({ onClose }: { onClose: () => void }) {
  const [homeDir, setHomeDir] = useState<string>("");
  const [homeName, setHomeName] = useState<string>("HOME");

  useEffect(() => {
    async function loadHome() {
      try {
        const hDir: string = await invoke("get_home_dir");
        setHomeDir(hDir);
        const parts = hDir.split("\\");
        const name = parts[parts.length - 1] || "HOME";
        setHomeName(name.toUpperCase());
      } catch (e) {
        console.error("Failed to get home dir", e);
      }
    }
    loadHome();
  }, []);

  if (!homeDir) return <div className="file-explorer-container"><div className="loading">Loading...</div></div>;

  return (
    <div className="file-explorer-container">
      <div className="file-explorer-header">
        <span className="file-explorer-title">
          <svg style={{marginRight: 6}} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <rect x="7" y="7" width="3" height="9"></rect>
            <rect x="14" y="7" width="3" height="5"></rect>
          </svg>
          {homeName}
        </span>
        <button className="sidebar-close-btn" onClick={onClose} title="Hide Explorer">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      </div>
      <div className="file-explorer-content">
        <FolderNode path={homeDir} name={homeName} initialOpen={true} />
      </div>
    </div>
  );
}
