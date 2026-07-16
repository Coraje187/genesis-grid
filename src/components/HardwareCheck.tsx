import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { SystemProfile, TIER_COPY } from "../lib/modelTiers";

export default function HardwareCheck({ theme }: { theme: "light" | "dark" }) {
  const [profile, setProfile] = useState<SystemProfile | null>(null);
  const [scanning, setScanning] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  async function scan() {
    setScanning(true);
    try {
      const result = await invoke<SystemProfile>("scan_system");
      // brief pause so the scan animation reads as intentional, not a glitch
      setTimeout(() => {
        setProfile(result);
        setScanning(false);
      }, 900);
    } catch (e) {
      setScanning(false);
    }
  }

  useEffect(() => {
    scan();
  }, []);

  return (
    <div>
      <h1 className="page-title">Let's find your fit</h1>
      <p className="page-sub">
        Genesis Grid checks what your machine can run so you never have to guess.
      </p>

      <div className="card" style={{ position: "relative", overflow: "hidden" }}>
        {theme === "dark" && scanning && <div className="scan-sweep" />}

        {scanning || !profile ? (
          <p style={{ color: "var(--ink-soft)" }}>Scanning your machine…</p>
        ) : (
          <>
            <span className="tier-badge">{profile.tier_label}</span>
            <p style={{ marginTop: 16, fontSize: 16 }}>
              {TIER_COPY[profile.tier].headline}
            </p>
            <p style={{ color: "var(--ink-soft)" }}>{TIER_COPY[profile.tier].body}</p>

            <div className="spec-grid">
              <div className="spec-cell">
                <div className="label">Memory</div>
                <div className="value">{profile.total_ram_gb} GB</div>
              </div>
              <div className="spec-cell">
                <div className="label">Processor</div>
                <div className="value">{profile.cpu_cores} cores</div>
              </div>
              <div className="spec-cell">
                <div className="label">Graphics</div>
                <div className="value">
                  {profile.gpu_name
                    ? `${profile.gpu_name}${profile.gpu_vram_gb ? ` · ${profile.gpu_vram_gb}GB` : ""}`
                    : "CPU only"}
                </div>
              </div>
            </div>

            <button className="btn secondary" style={{ marginTop: 20 }} onClick={scan}>
              Re-scan my PC
            </button>

            <button
              className="advanced-toggle"
              onClick={() => setShowAdvanced((v) => !v)}
            >
              {showAdvanced ? "Hide" : "Show"} advanced details
            </button>
            {showAdvanced && (
              <div className="advanced-panel">
                {JSON.stringify(profile, null, 2)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
