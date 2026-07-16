// Genesis Grid — Tauri backend
// Handles: hardware detection, model tier recommendation, and talking to a
// local Ollama install (list / pull / run models, check if Ollama exists).
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows_subsystem")]

use serde::{Deserialize, Serialize};
use std::io::Write;
use std::process::Command;
use sysinfo::System;

// ---------- Hardware detection ----------

#[derive(Serialize, Deserialize, Clone, Debug)]
struct SystemProfile {
    total_ram_gb: f64,
    cpu_cores: usize,
    cpu_brand: String,
    gpu_name: Option<String>,
    gpu_vram_gb: Option<f64>,
    tier: String,       // "starter" | "balanced" | "performance" | "workstation"
    tier_label: String, // plain-language label shown in the UI
}

/// Best-effort GPU/VRAM probe. NVIDIA via nvidia-smi is the reliable path;
/// on Windows, AMD/Intel fall back to a registry read (see below); macOS
/// Apple Silicon is unified memory; anything else falls back to "unknown"
/// rather than a guess, so the app never overpromises what a machine can run.
fn detect_gpu() -> (Option<String>, Option<f64>) {
    // Try nvidia-smi first — works cross-platform if NVIDIA drivers exist.
    if let Ok(output) = Command::new("nvidia-smi")
        .args(["--query-gpu=name,memory.total", "--format=csv,noheader,nounits"])
        .output()
    {
        if output.status.success() {
            let text = String::from_utf8_lossy(&output.stdout);
            if let Some(line) = text.lines().next() {
                let parts: Vec<&str> = line.split(',').map(|s| s.trim()).collect();
                if parts.len() == 2 {
                    let name = parts[0].to_string();
                    if let Ok(mb) = parts[1].parse::<f64>() {
                        return (Some(name), Some(mb / 1024.0));
                    }
                }
            }
        }
    }

    // Windows: AMD/Intel (and NVIDIA without nvidia-smi on PATH). This uses
    // DXGI — the same OS-level interface Task Manager and games use to
    // enumerate GPUs — since neither WMI's AdapterRAM (32-bit, caps at 4GB)
    // nor the driver's own registry fields are consistently populated
    // across vendors and driver versions.
    #[cfg(target_os = "windows")]
    {
        if let Some((name, vram_gb)) = detect_gpu_dxgi() {
            return (Some(name), Some(vram_gb));
        }
    }

    // macOS: Apple Silicon shares unified memory — no discrete VRAM concept.
    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = Command::new("sysctl").arg("-n").arg("machdep.cpu.brand_string").output() {
            let brand = String::from_utf8_lossy(&output.stdout).to_lowercase();
            if brand.contains("apple") {
                return (Some("Apple Silicon (unified memory)".to_string()), None);
            }
        }
    }

    (None, None)
}

/// Enumerates GPUs via DXGI and returns the one with the most dedicated
/// VRAM (skipping Microsoft's software/basic render fallback adapter and
/// near-zero-VRAM entries). This is the OS-level source of truth for
/// adapter memory on Windows, unlike WMI or registry fields which vary by
/// vendor and driver version.
#[cfg(target_os = "windows")]
fn detect_gpu_dxgi() -> Option<(String, f64)> {
    use windows::Win32::Graphics::Dxgi::{CreateDXGIFactory1, IDXGIFactory1};

    unsafe {
        let factory: IDXGIFactory1 = CreateDXGIFactory1().ok()?;
        let mut best: Option<(String, f64)> = None;
        let mut i = 0u32;

        loop {
            let adapter = match factory.EnumAdapters1(i) {
                Ok(a) => a,
                Err(_) => break, // no more adapters
            };
            i += 1;

            let desc = match adapter.GetDesc1() {
                Ok(d) => d,
                Err(_) => continue,
            };

            let name = String::from_utf16_lossy(&desc.Description)
                .trim_end_matches('\0')
                .to_string();
            let vram_gb = desc.DedicatedVideoMemory as f64 / (1024.0 * 1024.0 * 1024.0);

            let is_software = name.to_lowercase().contains("microsoft basic render");
            if !is_software && vram_gb > 0.05 {
                if best.as_ref().map_or(true, |(_, v)| vram_gb > *v) {
                    best = Some((name, vram_gb));
                }
            }
        }

        best
    }
}

fn classify_tier(ram_gb: f64, cores: usize, vram_gb: Option<f64>) -> (String, String) {
    // GPU with meaningful VRAM bumps the tier regardless of RAM, since GPU
    // offload is what actually determines usable model size and speed.
    if let Some(v) = vram_gb {
        if v >= 16.0 {
            return ("workstation".into(), "Power User".into());
        }
        if v >= 8.0 {
            return ("performance".into(), "Fast".into());
        }
    }

    if ram_gb >= 32.0 && cores >= 8 {
        ("performance".into(), "Fast".into())
    } else if ram_gb >= 16.0 && cores >= 4 {
        ("balanced".into(), "Balanced".into())
    } else {
        ("starter".into(), "Light".into())
    }
}

#[tauri::command]
fn scan_system() -> SystemProfile {
    let mut sys = System::new_all();
    sys.refresh_all();

    let total_ram_gb = sys.total_memory() as f64 / (1024.0 * 1024.0 * 1024.0);
    let cpu_cores = sys.cpus().len();
    let cpu_brand = sys
        .cpus()
        .first()
        .map(|c| c.brand().to_string())
        .unwrap_or_else(|| "Unknown CPU".to_string());

    let (gpu_name, gpu_vram_gb) = detect_gpu();
    let (tier, tier_label) = classify_tier(total_ram_gb, cpu_cores, gpu_vram_gb);

    SystemProfile {
        total_ram_gb: (total_ram_gb * 10.0).round() / 10.0,
        cpu_cores,
        cpu_brand,
        gpu_name,
        gpu_vram_gb: gpu_vram_gb.map(|v| (v * 10.0).round() / 10.0),
        tier,
        tier_label,
    }
}

// ---------- Model catalog ----------
// Curated defaults for Genesis Grid. Sizes are approximate download/RAM
// footprints at Q4 quantization — used only to decide what to *recommend*,
// never shown as raw numbers in the main UI (that lives in the Advanced tab).

#[derive(Serialize, Deserialize, Clone, Debug)]
struct CatalogEntry {
    id: String,           // ollama pull name
    display_name: String,
    tier: String,         // minimum comfortable tier
    approx_gb: f64,
    role: String,         // "chat" | "code" | "uncensored" | "vision" etc.
}

#[tauri::command]
fn model_catalog() -> Vec<CatalogEntry> {
    vec![
        CatalogEntry {
            id: "qwen2.5-coder:7b".into(),
            display_name: "Qwen 2.5 Coder".into(),
            tier: "balanced".into(),
            approx_gb: 4.7,
            role: "code".into(),
        },
        CatalogEntry {
            id: "deepseek-coder-v2:latest".into(),
            display_name: "DeepSeek Coder V2".into(),
            tier: "performance".into(),
            approx_gb: 8.9,
            role: "code".into(),
        },
        CatalogEntry {
            id: "rafw007/gemma4-e4b-claude-coder:latest".into(),
            display_name: "Gemma4 E4B Claude Coder".into(),
            tier: "balanced".into(),
            approx_gb: 5.5,
            role: "code".into(),
        },
        CatalogEntry {
            id: "richardyoung/qwythos-9b-abliterated:latest".into(),
            display_name: "Qwythos 9B".into(),
            tier: "balanced".into(),
            approx_gb: 5.8,
            role: "uncensored".into(),
        },
        CatalogEntry {
            id: "ornith-fixed:latest".into(),
            display_name: "Ornith".into(),
            tier: "balanced".into(),
            approx_gb: 5.0,
            role: "chat".into(),
        },
        CatalogEntry {
            id: "hermes3".into(),
            display_name: "Hermes 3".into(),
            tier: "performance".into(),
            approx_gb: 9.1,
            role: "chat".into(),
        },
    ]
}

// ---------- One-click Ollama install ----------
// This is the actual "make it easy for my friends" moment: no terminal, no
// separate download page. The button downloads the official installer for
// their OS and launches it (or, on Linux, runs Ollama's official script
// behind a native graphical permission prompt).

#[derive(Clone, Serialize)]
struct InstallProgress {
    stage: String,   // "downloading" | "installing" | "done" | "error"
    percent: u8,
    message: String,
}

fn emit_progress(window: &tauri::Window, event: &str, stage: &str, percent: u8, message: &str) {
    let _ = window.emit(
        event,
        InstallProgress {
            stage: stage.to_string(),
            percent,
            message: message.to_string(),
        },
    );
}

async fn download_with_progress(
    window: &tauri::Window,
    event: &str,
    url: &str,
    dest: &std::path::Path,
    label: &str,
) -> Result<(), String> {
    use futures_util::StreamExt;

    let response = reqwest::get(url)
        .await
        .map_err(|e| format!("Couldn't reach the download server: {e}"))?;
    let total = response.content_length().unwrap_or(0);
    let mut downloaded: u64 = 0;
    let mut file = std::fs::File::create(dest).map_err(|e| e.to_string())?;
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| e.to_string())?;
        file.write_all(&chunk).map_err(|e| e.to_string())?;
        downloaded += chunk.len() as u64;
        if total > 0 {
            let pct = ((downloaded as f64 / total as f64) * 100.0) as u8;
            emit_progress(window, event, "downloading", pct, label);
        }
    }
    Ok(())
}

#[tauri::command]
async fn install_ollama(window: tauri::Window) -> Result<String, String> {
    if ollama_installed() {
        emit_progress(&window, "ollama-install-progress", "done", 100, "Ollama is already installed.");
        return Ok("Ollama is already installed.".into());
    }

    #[cfg(target_os = "windows")]
    {
        let dest = std::env::temp_dir().join("OllamaSetup.exe");
        emit_progress(&window, "ollama-install-progress", "downloading", 0, "Downloading Ollama for Windows…");
        download_with_progress(&window, "ollama-install-progress", "https://ollama.com/download/OllamaSetup.exe", &dest, "Downloading Ollama…").await?;
        emit_progress(&window, "ollama-install-progress", "installing", 100, "Launching the Ollama installer…");
        Command::new(&dest)
            .spawn()
            .map_err(|e| format!("Couldn't launch installer: {e}"))?;
        return Ok("Installer launched — finish the steps in its window.".into());
    }

    #[cfg(target_os = "macos")]
    {
        let dest = std::env::temp_dir().join("Ollama-darwin.zip");
        emit_progress(&window, "ollama-install-progress", "downloading", 0, "Downloading Ollama for macOS…");
        download_with_progress(&window, "ollama-install-progress", "https://ollama.com/download/Ollama-darwin.zip", &dest, "Downloading Ollama…").await?;
        emit_progress(&window, "ollama-install-progress", "installing", 60, "Unpacking Ollama.app…");
        let unzip_dir = std::env::temp_dir().join("genesis-grid-ollama");
        std::fs::create_dir_all(&unzip_dir).map_err(|e| e.to_string())?;
        Command::new("unzip")
            .args(["-o", dest.to_str().unwrap(), "-d", unzip_dir.to_str().unwrap()])
            .output()
            .map_err(|e| format!("Couldn't unzip: {e}"))?;
        emit_progress(&window, "ollama-install-progress", "installing", 85, "Moving Ollama.app to Applications…");
        Command::new("cp")
            .args(["-R", unzip_dir.join("Ollama.app").to_str().unwrap(), "/Applications/"])
            .output()
            .map_err(|e| format!("Couldn't move app: {e}"))?;
        Command::new("open").arg("/Applications/Ollama.app").spawn().ok();
        emit_progress(&window, "ollama-install-progress", "done", 100, "Ollama installed.");
        return Ok("Ollama installed to /Applications and launched.".into());
    }

    #[cfg(target_os = "linux")]
    {
        // Ollama's official installer needs root. pkexec shows a native
        // graphical permission prompt instead of requiring a terminal.
        emit_progress(&window, "ollama-install-progress", "installing", 20, "Requesting permission to install…");
        let script = "curl -fsSL https://ollama.com/install.sh | sh";
        let status = Command::new("pkexec")
            .arg("sh")
            .arg("-c")
            .arg(script)
            .status()
            .map_err(|e| format!("Couldn't run installer: {e}"))?;
        if status.success() {
            emit_progress(&window, "ollama-install-progress", "done", 100, "Ollama installed.");
            return Ok("Ollama installed.".into());
        } else {
            emit_progress(&window, "ollama-install-progress", "error", 0, "Install was cancelled or failed.");
            return Err("Install was cancelled or failed.".into());
        }
    }

    #[allow(unreachable_code)]
    {
        Err("Unsupported platform — install Ollama manually from ollama.com.".into())
    }
}

/// `ollama_installed` only checks the executable exists — it doesn't check
/// whether the background server is actually up and listening. Someone can
/// quit Ollama from their tray icon and Genesis Grid would otherwise still
/// claim everything's fine while Chat silently fails underneath.
#[tauri::command]
fn ollama_server_running() -> bool {
    std::net::TcpStream::connect_timeout(
        &"127.0.0.1:11434".parse().unwrap(),
        std::time::Duration::from_millis(300),
    )
    .is_ok()
}

#[tauri::command]
fn start_ollama_server() -> Result<String, String> {
    Command::new("ollama")
        .arg("serve")
        .spawn()
        .map(|_| "Starting Ollama…".to_string())
        .map_err(|e| format!("Couldn't start Ollama: {e}"))
}

// ---------- FreeLLMAPI (self-hosted online fallback) ----------
// Ahmed-M-Abdelkader/freellmapi — an OpenAI-compatible proxy that stacks
// free tiers from ~14 providers. It's a separate Node.js app, run locally
// per-person (its own docs: "run this for yourself, don't share the
// endpoint"). Genesis Grid clones it, builds it, and launches it as a
// background process rather than bundling it, since it's MIT-licensed and
// updates independently upstream.

const FREELLMAPI_REPO: &str = "https://github.com/Ahmed-M-Abdelkader/freellmapi.git";

/// On Windows, `npm` is `npm.cmd` (a shell wrapper), not an .exe — spawning
/// it via Command::new("npm") directly fails with "program not found" even
/// though typing `npm` in a terminal works fine, since the shell resolves
/// PATHEXT extensions that a direct process spawn doesn't.
fn npm_program() -> &'static str {
    if cfg!(target_os = "windows") { "npm.cmd" } else { "npm" }
}

fn freellmapi_dir() -> std::path::PathBuf {
    dirs::data_dir()
        .unwrap_or_else(std::env::temp_dir)
        .join("genesis-grid")
        .join("freellmapi")
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct FreeLlmApiStatus {
    node_installed: bool,
    git_installed: bool,
    cloned: bool,
    running: bool,
}

#[tauri::command]
fn freellmapi_status() -> FreeLlmApiStatus {
    let node_installed = Command::new("node").arg("--version").output().is_ok();
    let git_installed = Command::new("git").arg("--version").output().is_ok();
    let cloned = freellmapi_dir().join("package.json").exists();
    // A cheap local check — the proxy listens on :3001 when running.
    let running = std::net::TcpStream::connect_timeout(
        &"127.0.0.1:3001".parse().unwrap(),
        std::time::Duration::from_millis(300),
    )
    .is_ok();

    FreeLlmApiStatus {
        node_installed,
        git_installed,
        cloned,
        running,
    }
}

#[tauri::command]
async fn setup_freellmapi(window: tauri::Window) -> Result<String, String> {
    let dir = freellmapi_dir();
    let status = freellmapi_status();

    if !status.node_installed || !status.git_installed {
        return Err(
            "This feature needs Node.js 20+ and git installed on your system first — \
             Genesis Grid itself doesn't require them, but FreeLLMAPI (the online fallback) \
             is a separate Node project. Install Node from nodejs.org and git from git-scm.com, \
             then try again."
                .into(),
        );
    }

    if !status.cloned {
        emit_progress(&window, "freellmapi-setup-progress", "installing", 10, "Downloading FreeLLMAPI…");
        std::fs::create_dir_all(dir.parent().unwrap()).map_err(|e| e.to_string())?;
        let out = Command::new("git")
            .args(["clone", FREELLMAPI_REPO, dir.to_str().unwrap()])
            .output()
            .map_err(|e| format!("git clone failed: {e}"))?;
        if !out.status.success() {
            return Err(format!(
                "git clone failed:\n{}\n{}",
                String::from_utf8_lossy(&out.stdout),
                String::from_utf8_lossy(&out.stderr)
            ));
        }
    }

    emit_progress(&window, "freellmapi-setup-progress", "installing", 40, "Installing dependencies (npm install)…");
    let install = Command::new(npm_program())
        .arg("install")
        .current_dir(&dir)
        .output()
        .map_err(|e| format!("npm install failed: {e}"))?;
    if !install.status.success() {
        return Err(format!(
            "npm install failed:\n{}\n{}",
            String::from_utf8_lossy(&install.stdout),
            String::from_utf8_lossy(&install.stderr)
        ));
    }

    // Generate a local encryption key for at-rest provider-key storage if
    // this is a first-time setup.
    let env_path = dir.join(".env");
    if !env_path.exists() {
        emit_progress(&window, "freellmapi-setup-progress", "installing", 60, "Generating local encryption key…");
        let example = dir.join(".env.example");
        if example.exists() {
            std::fs::copy(&example, &env_path).map_err(|e| e.to_string())?;
        }
        let keygen = Command::new("node")
            .args(["-e", "console.log(require('crypto').randomBytes(32).toString('hex'))"])
            .output()
            .map_err(|e| e.to_string())?;
        let key = String::from_utf8_lossy(&keygen.stdout).trim().to_string();
        let mut file = std::fs::OpenOptions::new()
            .append(true)
            .open(&env_path)
            .map_err(|e| e.to_string())?;
        writeln!(file, "ENCRYPTION_KEY={key}").map_err(|e| e.to_string())?;
    }

    emit_progress(&window, "freellmapi-setup-progress", "installing", 80, "Building FreeLLMAPI…");
    let build = Command::new(npm_program())
        .arg("run")
        .arg("build")
        .current_dir(&dir)
        .output()
        .map_err(|e| format!("build failed: {e}"))?;
    if !build.status.success() {
        return Err(format!(
            "build failed:\n{}\n{}",
            String::from_utf8_lossy(&build.stdout),
            String::from_utf8_lossy(&build.stderr)
        ));
    }

    emit_progress(&window, "freellmapi-setup-progress", "installing", 95, "Starting FreeLLMAPI on port 3001…");
    Command::new("node")
        .arg("server/dist/index.js")
        .current_dir(&dir)
        .spawn()
        .map_err(|e| format!("Couldn't start server: {e}"))?;

    emit_progress(&window, "freellmapi-setup-progress", "done", 100, "FreeLLMAPI is running.");
    Ok("FreeLLMAPI installed and running at http://localhost:3001".into())
}

#[tauri::command]
fn open_freellmapi_dashboard() -> Result<(), String> {
    open::that("http://localhost:3001").map_err(|e| e.to_string())
}

/// Sends one chat message through a running FreeLLMAPI instance using the
/// person's own unified key (never an Anthropic key — this is strictly the
/// "no local model fits, use an online fallback" path). `model` lets the
/// person pick which underlying provider/model FreeLLMAPI should route to
/// (its own dashboard lists the available names); empty defaults to "auto".
#[tauri::command]
async fn chat_via_freellmapi(unified_key: String, model: String, message: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let model = if model.trim().is_empty() { "auto".to_string() } else { model };
    let body = serde_json::json!({
        "model": model,
        "messages": [{"role": "user", "content": message}]
    });

    let resp = client
        .post("http://localhost:3001/v1/chat/completions")
        .bearer_auth(unified_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Couldn't reach FreeLLMAPI: {e}"))?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        return Err(format!("FreeLLMAPI returned {status}: {text}"));
    }

    let json: serde_json::Value =
        serde_json::from_str(&text).map_err(|e| format!("Couldn't parse FreeLLMAPI's response ({e}): {text}"))?;

    if let Some(content) = json["choices"][0]["message"]["content"].as_str() {
        return Ok(content.to_string());
    }
    // Some proxies report errors with a 200 status and an "error" field
    // instead of an HTTP error code — surface that message if present.
    if let Some(err_msg) = json["error"]["message"].as_str() {
        return Err(format!("FreeLLMAPI error: {err_msg}"));
    }
    Err(format!("Unexpected response shape from FreeLLMAPI: {text}"))
}

// ---- FreeLLMAPI settings (shared between the Chat screen and the "Use online instead" screen) ----

#[derive(Serialize, Deserialize, Clone, Debug, Default)]
struct FreeLlmApiSettings {
    unified_key: String,
    default_model: String,
}

fn freellmapi_settings_file() -> std::path::PathBuf {
    genesis_data_dir().join("freellmapi-settings.json")
}

#[tauri::command]
fn load_freellmapi_settings() -> FreeLlmApiSettings {
    std::fs::read_to_string(freellmapi_settings_file())
        .ok()
        .and_then(|text| serde_json::from_str(&text).ok())
        .unwrap_or_default()
}

#[tauri::command]
fn save_freellmapi_settings(unified_key: String, default_model: String) -> Result<(), String> {
    std::fs::create_dir_all(genesis_data_dir()).map_err(|e| e.to_string())?;
    let settings = FreeLlmApiSettings { unified_key, default_model };
    let json = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    std::fs::write(freellmapi_settings_file(), json).map_err(|e| e.to_string())
}

// ---------- Chat, Projects, and Recent Chats ----------
// Real multi-session history: each chat is its own file with an id, a
// title (auto-set from the first message), which model it uses, and an
// optional project it belongs to. Projects are just a flat name list —
// sessions reference a project_id to group under one.

#[derive(Serialize, Deserialize, Clone, Debug)]
struct ChatMessage {
    role: String, // "user" | "assistant"
    content: String,
}

#[derive(Clone, Serialize)]
struct ChatToken {
    content: String,
}

#[derive(Clone, Serialize)]
struct ChatDone {
    full_content: String,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct Project {
    id: String,
    name: String,
    created_at: i64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct ChatSession {
    id: String,
    title: String,
    model: String,
    project_id: Option<String>,
    created_at: i64,
    updated_at: i64,
    messages: Vec<ChatMessage>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct ChatSessionSummary {
    id: String,
    title: String,
    model: String,
    project_id: Option<String>,
    updated_at: i64,
}

fn genesis_data_dir() -> std::path::PathBuf {
    dirs::data_dir()
        .unwrap_or_else(std::env::temp_dir)
        .join("genesis-grid")
}

fn chats_dir() -> std::path::PathBuf {
    genesis_data_dir().join("chats")
}

fn projects_file() -> std::path::PathBuf {
    genesis_data_dir().join("projects.json")
}

fn now_ts() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Timestamp + process id is unique enough for locally generated ids on a
/// single machine — no need to pull in a uuid crate for this.
fn new_id() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default();
    format!("{}{}", now.as_secs(), now.subsec_nanos())
}

fn session_path(id: &str) -> std::path::PathBuf {
    chats_dir().join(format!("{id}.json"))
}

// ---- Projects ----

#[tauri::command]
fn list_projects() -> Result<Vec<Project>, String> {
    let path = projects_file();
    if !path.exists() {
        return Ok(vec![]);
    }
    let text = std::fs::read_to_string(&path).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_project(name: String) -> Result<Project, String> {
    let mut projects = list_projects()?;
    let project = Project {
        id: new_id(),
        name,
        created_at: now_ts(),
    };
    projects.push(project.clone());
    std::fs::create_dir_all(genesis_data_dir()).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(&projects).map_err(|e| e.to_string())?;
    std::fs::write(projects_file(), json).map_err(|e| e.to_string())?;
    Ok(project)
}

#[tauri::command]
fn delete_project(id: String) -> Result<(), String> {
    let mut projects = list_projects()?;
    projects.retain(|p| p.id != id);
    let json = serde_json::to_string_pretty(&projects).map_err(|e| e.to_string())?;
    std::fs::write(projects_file(), json).map_err(|e| e.to_string())?;

    // Orphan the chats belonging to this project
    let dir = chats_dir();
    if dir.exists() {
        for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
            let entry = match entry {
                Ok(e) => e,
                Err(_) => continue,
            };
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) == Some("json") {
                if let Ok(text) = std::fs::read_to_string(&path) {
                    if let Ok(mut session) = serde_json::from_str::<ChatSession>(&text) {
                        if session.project_id == Some(id.clone()) {
                            session.project_id = None;
                            if let Ok(chat_json) = serde_json::to_string_pretty(&session) {
                                let _ = std::fs::write(&path, chat_json);
                            }
                        }
                    }
                }
            }
        }
    }
    Ok(())
}

// ---- Chat sessions ----

#[tauri::command]
fn list_chat_sessions() -> Result<Vec<ChatSessionSummary>, String> {
    let dir = chats_dir();
    if !dir.exists() {
        return Ok(vec![]);
    }
    let mut out = vec![];
    for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("json") {
            continue;
        }
        if let Ok(text) = std::fs::read_to_string(&path) {
            if let Ok(session) = serde_json::from_str::<ChatSession>(&text) {
                out.push(ChatSessionSummary {
                    id: session.id,
                    title: session.title,
                    model: session.model,
                    project_id: session.project_id,
                    updated_at: session.updated_at,
                });
            }
        }
    }
    out.sort_by(|a, b| b.updated_at.cmp(&a.updated_at));
    Ok(out)
}

#[tauri::command]
fn new_chat_session(model: String, project_id: Option<String>) -> Result<ChatSession, String> {
    let ts = now_ts();
    let session = ChatSession {
        id: new_id(),
        title: "New chat".to_string(),
        model,
        project_id,
        created_at: ts,
        updated_at: ts,
        messages: vec![],
    };
    std::fs::create_dir_all(chats_dir()).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(&session).map_err(|e| e.to_string())?;
    std::fs::write(session_path(&session.id), json).map_err(|e| e.to_string())?;
    Ok(session)
}

#[tauri::command]
fn load_chat_session(id: String) -> Result<ChatSession, String> {
    let text = std::fs::read_to_string(session_path(&id)).map_err(|e| e.to_string())?;
    serde_json::from_str(&text).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_chat_session(id: String, model: String, messages: Vec<ChatMessage>) -> Result<(), String> {
    let mut session = load_chat_session(id.clone())?;
    session.model = model;
    session.messages = messages.clone();
    session.updated_at = now_ts();
    if session.title == "New chat" {
        if let Some(first_user) = messages.iter().find(|m| m.role == "user") {
            let mut title = first_user.content.clone();
            if title.chars().count() > 48 {
                title = title.chars().take(48).collect::<String>() + "…";
            }
            session.title = title;
        }
    }
    let json = serde_json::to_string_pretty(&session).map_err(|e| e.to_string())?;
    std::fs::write(session_path(&id), json).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_chat_session(id: String) -> Result<(), String> {
    std::fs::remove_file(session_path(&id)).map_err(|e| e.to_string())
}


struct ChatController {
    abort: std::sync::atomic::AtomicBool,
}

struct TelegramState {
    abort_handle: std::sync::Mutex<Option<tokio::sync::oneshot::Sender<()>>>,
}

async fn chat_ollama(model: &str, text: &str) -> String {
    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": model,
        "prompt": text,
        "stream": false
    });

    let res = client.post("http://localhost:11434/api/generate")
        .json(&body)
        .send()
        .await;

    match res {
        Ok(resp) => {
            if resp.status().is_success() {
                if let Ok(json) = resp.json::<serde_json::Value>().await {
                    if let Some(response) = json["response"].as_str() {
                        return response.to_string();
                    }
                }
                "Error: Received invalid response format from Ollama.".to_string()
            } else {
                let err_text = resp.text().await.unwrap_or_default();
                format!("Ollama returned an error: {}", err_text)
            }
        }
        Err(e) => format!("Could not reach Ollama. Make sure Ollama server is running (port 11434). Error: {}", e),
    }
}

async fn telegram_loop(
    token: String,
    allowed_chat_id: String,
    model: String,
    mut abort_rx: tokio::sync::oneshot::Receiver<()>,
) {
    let client = reqwest::Client::new();
    let mut offset = 0i64;

    loop {
        let url = format!(
            "https://api.telegram.org/bot{}/getUpdates?offset={}&timeout=20",
            token, offset
        );

        let request_fut = client.get(&url).send();

        tokio::select! {
            _ = &mut abort_rx => {
                break;
            }
            res = request_fut => {
                match res {
                    Ok(resp) => {
                        if let Ok(json) = resp.json::<serde_json::Value>().await {
                            if let Some(ok) = json["ok"].as_bool() {
                                if ok {
                                    if let Some(result) = json["result"].as_array() {
                                        for update in result {
                                            if let Some(update_id) = update["update_id"].as_i64() {
                                                offset = update_id + 1;
                                            }

                                            if let Some(message) = update["message"].as_object() {
                                                if let Some(chat) = message["chat"].as_object() {
                                                    if let Some(chat_id) = chat["id"].as_i64() {
                                                        let is_allowed = chat_id.to_string() == allowed_chat_id.trim();
                                                        if !is_allowed {
                                                            let send_url = format!(
                                                                "https://api.telegram.org/bot{}/sendMessage",
                                                                token
                                                            );
                                                            let body = serde_json::json!({
                                                                "chat_id": chat_id,
                                                                "text": "Unauthorized access. Your Chat ID is not allowed."
                                                            });
                                                            let _ = client.post(&send_url).json(&body).send().await;
                                                            continue;
                                                        }

                                                        if let Some(text) = message["text"].as_str() {
                                                            let reply_text = chat_ollama(&model, text).await;
                                                            let send_url = format!(
                                                                "https://api.telegram.org/bot{}/sendMessage",
                                                                token
                                                            );
                                                            let body = serde_json::json!({
                                                                "chat_id": chat_id,
                                                                "text": reply_text
                                                            });
                                                            let _ = client.post(&send_url).json(&body).send().await;
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    Err(_) => {
                        tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                    }
                }
            }
        }
    }
}

#[tauri::command]
fn start_telegram_bot(
    token: String,
    allowed_chat_id: String,
    model: String,
    state: tauri::State<'_, TelegramState>,
) -> Result<String, String> {
    let _ = stop_telegram_bot(state.clone());

    let (tx, rx) = tokio::sync::oneshot::channel::<()>();
    
    {
        let mut handle = state.abort_handle.lock().map_err(|e| e.to_string())?;
        *handle = Some(tx);
    }

    tokio::spawn(async move {
        telegram_loop(token, allowed_chat_id, model, rx).await;
    });

    Ok("Telegram bot bridge started successfully.".to_string())
}

#[tauri::command]
fn stop_telegram_bot(state: tauri::State<'_, TelegramState>) -> Result<String, String> {
    let mut handle = state.abort_handle.lock().map_err(|e| e.to_string())?;
    if let Some(tx) = handle.take() {
        let _ = tx.send(());
        Ok("Telegram bot bridge stopped.".to_string())
    } else {
        Ok("Bot is not running.".to_string())
    }
}

#[tauri::command]
fn telegram_bot_status(state: tauri::State<'_, TelegramState>) -> bool {
    if let Ok(handle) = state.abort_handle.lock() {
        handle.is_some()
    } else {
        false
    }
}

/// Streams a chat completion from a local Ollama model. Emits "chat-token"
/// as each piece of the reply arrives and "chat-done" with the full text
/// once Ollama reports it's finished.
#[tauri::command]
async fn chat_send(
    window: tauri::Window,
    model: String,
    history: Vec<ChatMessage>,
    controller: tauri::State<'_, ChatController>,
) -> Result<(), String> {
    controller.abort.store(false, std::sync::atomic::Ordering::Relaxed);
    use futures_util::StreamExt;

    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "model": model,
        "messages": history,
        "stream": true
    });

    let response = client
        .post("http://localhost:11434/api/chat")
        .json(&body)
        .send()
        .await
        .map_err(|e| format!("Couldn't reach Ollama: {e}"))?;

    if !response.status().is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err(format!("Ollama returned an error: {text}"));
    }

    let mut stream = response.bytes_stream();
    let mut buffer = String::new();
    let mut full_reply = String::new();

    while let Some(chunk) = stream.next().await {
        if controller.abort.load(std::sync::atomic::Ordering::Relaxed) {
            break;
        }
        let chunk = chunk.map_err(|e| e.to_string())?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));

        // Ollama streams newline-delimited JSON objects — process complete lines.
        while let Some(pos) = buffer.find('\n') {
            let line = buffer[..pos].trim().to_string();
            buffer.drain(..=pos);
            if line.is_empty() {
                continue;
            }
            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                if let Some(content) = json["message"]["content"].as_str() {
                    if !content.is_empty() {
                        full_reply.push_str(content);
                        let _ = window.emit("chat-token", ChatToken { content: content.to_string() });
                    }
                }
                if json["done"].as_bool().unwrap_or(false) {
                    let _ = window.emit("chat-done", ChatDone { full_content: full_reply.clone() });
                    return Ok(());
                }
            }
        }
    }

    let _ = window.emit("chat-done", ChatDone { full_content: full_reply });
    Ok(())
}

#[tauri::command]
fn abort_chat(controller: tauri::State<'_, ChatController>) {
    controller.abort.store(true, std::sync::atomic::Ordering::Relaxed);
}

#[tauri::command]
fn open_url(url: String) -> Result<(), String> {
    open::that(url).map_err(|e| e.to_string())
}

#[tauri::command]
fn load_genesis_wiki() -> Result<String, String> {
    let path = genesis_data_dir().join("genesis_wiki.md");
    if !path.exists() {
        return Ok("# Genesis Memory Wiki\n\n- User preferences: Developer mode active.\n- Key focus: Speed and premium design aesthetics.\n".to_string());
    }
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_genesis_wiki(content: String) -> Result<(), String> {
    std::fs::create_dir_all(genesis_data_dir()).map_err(|e| e.to_string())?;
    let path = genesis_data_dir().join("genesis_wiki.md");
    std::fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_downloads_folder() -> Result<String, String> {
    dirs::download_dir()
        .map(|p| p.to_string_lossy().to_string())
        .ok_or_else(|| "Could not find Downloads folder".to_string())
}

#[tauri::command]
fn list_directory(path: String) -> Result<Vec<String>, String> {
    let dir = std::path::Path::new(&path);
    if !dir.exists() {
        return Err("Directory does not exist".to_string());
    }
    let mut files = vec![];
    for entry in std::fs::read_dir(dir).map_err(|e| e.to_string())? {
        if let Ok(entry) = entry {
            files.push(entry.file_name().to_string_lossy().to_string());
        }
    }
    Ok(files)
}

#[tauri::command]
fn read_file_text(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file_text(path: String, content: String) -> Result<(), String> {
    std::fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn run_command(command: String) -> Result<String, String> {
    let output = if cfg!(target_os = "windows") {
        Command::new("powershell")
            .args(["-Command", &command])
            .output()
    } else {
        Command::new("sh")
            .args(["-c", &command])
            .output()
    };

    match output {
        Ok(out) => {
            let stdout = String::from_utf8_lossy(&out.stdout).to_string();
            let stderr = String::from_utf8_lossy(&out.stderr).to_string();
            if out.status.success() {
                Ok(stdout)
            } else {
                Err(format!(
                    "Command exited with code {}:\nSTDOUT:\n{}\nSTDERR:\n{}",
                    out.status.code().unwrap_or(-1),
                    stdout,
                    stderr
                ))
            }
        }
        Err(e) => Err(format!("Failed to execute command: {e}")),
    }
}

#[tauri::command]
async fn fetch_url(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent("GenesisGrid/0.1.0")
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client.get(&url)
        .send()
        .await
        .map_err(|e| format!("HTTP request failed: {e}"))?;

    let status = resp.status();
    let text = resp.text().await.map_err(|e| e.to_string())?;

    if !status.is_success() {
        return Err(format!("HTTP returned status {status}: {text}"));
    }

    Ok(text)
}

#[derive(Serialize, Deserialize, Clone, Debug)]
struct SkillFile {
    name: String,
    content: String,
}

fn skills_dir() -> std::path::PathBuf {
    genesis_data_dir().join("skills")
}

const DEFAULT_SKILL_GRAPHIFY: &str = r#"# graphify
Use for any question about a codebase, its architecture, file relationships, or project content.
It builds a queryable knowledge graph in `graphify-out/`.

## Usage
- Run graphify on current directory:
  [EXECUTE: run_command { "command": "uv tool run graphifyy ." }]
- Query the graph:
  [EXECUTE: run_command { "command": "uv tool run graphifyy query \"<question>\"" }]
- Find shortest path between files:
  [EXECUTE: run_command { "command": "uv tool run graphifyy path \"<file1>\" \"<file2>\"" }]
"#;

const DEFAULT_SKILL_DEBUGGING: &str = r#"# systematic-debugging
A systematic framework for diagnosing errors and fixing code:

1. **Identify the Symptom:** Gather compiler messages, runtime logs, or crash tracebacks.
2. **Formulate Hypotheses:** Pinpoint potential causes (e.g. check environment variables, syntax, permissions).
3. **Isolate and Test:** Run small scripts, write test assertions, or execute commands.
4. **Fix and Verify:** Implement edits and compile/run tests to ensure the bug is resolved without regression.
"#;

const DEFAULT_SKILL_MODDING: &str = r#"# mod-design-and-builder
Guide for building, testing, and compiling Genesis Grid mods.

1. **Structure:** Place assets, scripts, and configs in a structured folder (e.g. `src/components`, `src-tauri/src`).
2. **Configuration:** Maintain a `mod.json` or manifest file with metadata.
3. **Verification:** Test mod loading by running the development server and verifying visual components.
4. **Compilation:** Zip or bundle target assets for deployment.
"#;

#[tauri::command]
fn list_skills_files() -> Result<Vec<SkillFile>, String> {
    let dir = skills_dir();
    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }

    let is_empty = match std::fs::read_dir(&dir) {
        Ok(mut entries) => entries.next().is_none(),
        Err(_) => true,
    };

    if is_empty {
        let defaults = vec![
            ("graphify.md", DEFAULT_SKILL_GRAPHIFY),
            ("systematic-debugging.md", DEFAULT_SKILL_DEBUGGING),
            ("mod-design-and-builder.md", DEFAULT_SKILL_MODDING),
        ];
        for (name, content) in defaults {
            let path = dir.join(name);
            let _ = std::fs::write(path, content);
        }
    }

    let mut list = vec![];
    for entry in std::fs::read_dir(&dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) == Some("md") {
            let name = path.file_stem().unwrap().to_string_lossy().to_string();
            let content = std::fs::read_to_string(&path).unwrap_or_default();
            list.push(SkillFile { name, content });
        }
    }
    Ok(list)
}

#[tauri::command]
fn save_skill_file(name: String, content: String) -> Result<(), String> {
    let dir = skills_dir();
    if !dir.exists() {
        std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    }
    let safe_name = name.replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "");
    if safe_name.is_empty() {
        return Err("Invalid skill name".to_string());
    }
    let path = dir.join(format!("{safe_name}.md"));
    std::fs::write(path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_skill_file(name: String) -> Result<(), String> {
    let dir = skills_dir();
    let safe_name = name.replace(|c: char| !c.is_alphanumeric() && c != '-' && c != '_', "");
    let path = dir.join(format!("{safe_name}.md"));
    if path.exists() {
        std::fs::remove_file(path).map_err(|e| e.to_string())
    } else {
        Err("Skill file does not exist".to_string())
    }
}

fn mcp_config_file() -> std::path::PathBuf {
    genesis_data_dir().join("mcp-config.json")
}

#[tauri::command]
fn load_mcp_config() -> Result<String, String> {
    let path = mcp_config_file();
    if !path.exists() {
        return Ok(r#"{"mcpServers":{}}"#.to_string());
    }
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_mcp_config(content: String) -> Result<(), String> {
    let _v: serde_json::Value = serde_json::from_str(&content)
        .map_err(|e| format!("Invalid JSON format: {e}"))?;
    std::fs::create_dir_all(genesis_data_dir()).map_err(|e| e.to_string())?;
    std::fs::write(mcp_config_file(), content).map_err(|e| e.to_string())
}

// ---------- Ollama process management ----------

#[tauri::command]
fn ollama_installed() -> bool {
    Command::new("ollama").arg("--version").output().is_ok()
}

#[tauri::command]
fn list_installed_models() -> Result<Vec<String>, String> {
    let output = Command::new("ollama")
        .arg("list")
        .output()
        .map_err(|e| format!("Couldn't reach Ollama: {e}"))?;

    let text = String::from_utf8_lossy(&output.stdout);
    let models: Vec<String> = text
        .lines()
        .skip(1) // header row
        .filter_map(|line| line.split_whitespace().next().map(|s| s.to_string()))
        .collect();
    Ok(models)
}

/// Kicks off `ollama pull <model>` as a background process. Streaming
/// progress back to the UI is left to a follow-up (sidecar + event emit);
/// this starts the pull and reports whether the process launched.
#[tauri::command]
fn pull_model(model_id: String) -> Result<String, String> {
    Command::new("ollama")
        .arg("pull")
        .arg(&model_id)
        .spawn()
        .map(|_| format!("Started downloading {model_id}"))
        .map_err(|e| format!("Couldn't start download: {e}"))
}

#[tauri::command]
fn add_custom_model(model_id: String) -> Result<String, String> {
    // Same code path as pull_model — kept separate so the UI can label the
    // action differently ("Add my own model" vs. a catalog "Download").
    pull_model(model_id)
}

fn main() {
    tauri::Builder::default()
        .manage(ChatController {
            abort: std::sync::atomic::AtomicBool::new(false),
        })
        .manage(TelegramState {
            abort_handle: std::sync::Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            scan_system,
            model_catalog,
            ollama_installed,
            install_ollama,
            ollama_server_running,
            start_ollama_server,
            list_installed_models,
            pull_model,
            add_custom_model,
            freellmapi_status,
            setup_freellmapi,
            open_freellmapi_dashboard,
            chat_via_freellmapi,
            load_freellmapi_settings,
            save_freellmapi_settings,
            list_projects,
            create_project,
            delete_project,
            list_chat_sessions,
            new_chat_session,
            load_chat_session,
            save_chat_session,
            delete_chat_session,
            chat_send,
            abort_chat,
            open_url,
            load_genesis_wiki,
            save_genesis_wiki,
                        get_downloads_folder,
            list_directory,
            read_file_text,
            write_file_text,
            run_command,
            fetch_url,
            list_skills_files,
            save_skill_file,
            delete_skill_file,
            load_mcp_config,
            save_mcp_config,
            start_telegram_bot,
            stop_telegram_bot,
            telegram_bot_status
        ])
        .run(tauri::generate_context!())
        .expect("error while running Genesis Grid");
}
