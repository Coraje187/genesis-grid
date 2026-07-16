import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { CatalogEntry, SystemProfile, fitsComfortably } from "../lib/modelTiers";

const ROLE_LABEL: Record<string, string> = {
  chat: "General chat",
  code: "Coding",
  uncensored: "Unfiltered",
};

export default function ModelLibrary({ profile }: { profile: SystemProfile | null }) {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [installed, setInstalled] = useState<string[]>([]);
  const [customId, setCustomId] = useState("");
  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    invoke<CatalogEntry[]>("model_catalog").then(setCatalog);
    invoke<string[]>("list_installed_models").then(setInstalled).catch(() => setInstalled([]));
  }, []);

  async function download(id: string) {
    setStatus(`Downloading ${id}…`);
    try {
      const msg = await invoke<string>("pull_model", { modelId: id });
      setStatus(msg);
    } catch (e) {
      setStatus(String(e));
    }
  }

  async function addCustom() {
    if (!customId.trim()) return;
    setStatus(`Adding ${customId}…`);
    try {
      const msg = await invoke<string>("add_custom_model", { modelId: customId.trim() });
      setStatus(msg);
      setCustomId("");
    } catch (e) {
      setStatus(String(e));
    }
  }

  const recommended = profile ? catalog.filter((m) => fitsComfortably(profile, m)) : catalog;
  const heavier = profile ? catalog.filter((m) => !fitsComfortably(profile, m)) : [];

  return (
    <div>
      <h1 className="page-title">Model Library</h1>
      <p className="page-sub">
        Models that fit your machine are front and center. Anything heavier is
        still here — just marked as slower.
      </p>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Recommended for you</h3>
        <div className="model-list">
          {recommended.map((m) => (
            <ModelRow
              key={m.id}
              model={m}
              installed={installed.includes(m.id)}
              onDownload={() => download(m.id)}
            />
          ))}
        </div>

        {heavier.length > 0 && (
          <>
            <h3>Runs, but slower on your machine</h3>
            <div className="model-list">
              {heavier.map((m) => (
                <ModelRow
                  key={m.id}
                  model={m}
                  installed={installed.includes(m.id)}
                  onDownload={() => download(m.id)}
                />
              ))}
            </div>
          </>
        )}

        <h3>Add your own</h3>
        <p style={{ color: "var(--ink-soft)", fontSize: 14 }}>
          Know an Ollama model you want to run? Paste its name (e.g.{" "}
          <code>llama3.2:3b</code>) and Genesis Grid will pull it for you.
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          <input
            value={customId}
            onChange={(e) => setCustomId(e.target.value)}
            placeholder="model:tag"
            style={{
              flex: 1,
              padding: "10px 12px",
              borderRadius: "var(--radius-sm)",
              border: "1px solid var(--border)",
              background: "var(--bg-sunken)",
              color: "var(--ink)",
              fontFamily: "var(--font-mono)",
            }}
          />
          <button className="btn" onClick={addCustom}>Add model</button>
        </div>

        {status && <p style={{ marginTop: 14, color: "var(--ink-soft)", fontSize: 13 }}>{status}</p>}
      </div>
    </div>
  );
}

function ModelRow({
  model,
  installed,
  onDownload,
}: {
  model: CatalogEntry;
  installed: boolean;
  onDownload: () => void;
}) {
  return (
    <div className="model-row">
      <div>
        <div className="name">{model.display_name}</div>
        <div className="role-tag">{ROLE_LABEL[model.role] ?? model.role}</div>
      </div>
      {installed ? (
        <span className="tier-badge" style={{ background: "var(--success)" }}>Installed</span>
      ) : (
        <button className="btn secondary" onClick={onDownload}>Install</button>
      )}
    </div>
  );
}
