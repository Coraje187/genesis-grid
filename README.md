# Genesis Grid

A one-click local AI desktop. Genesis Grid scans your machine, tells you
in plain language what it can run, and manages Ollama models for you —
no parameter counts or quant jargon unless you go looking for them.

## Stack

- **Tauri** (Rust backend) — hardware detection via `sysinfo`, GPU/VRAM
  probing via `nvidia-smi` where available, and process management for
  a locally installed [Ollama](https://ollama.com).
- **React + TypeScript** frontend, two themes:
  - **Light** — warm cream, in the spirit of Claude's own interface.
  - **Dark** — "Genesis Grid Labs" neon cyberpunk, pulled straight from
    the brand banner (circuit cyan `#2be9ff`, neon magenta `#ff2ec8`,
    ultraviolet `#9b3ffb` on void black `#05060d`).

## Getting set up (development)

```bash
npm install
npm run tauri dev
```

This launches the app with hot reload. The Rust side needs a normal
Tauri toolchain (Rust + platform build tools) — see the
[Tauri prerequisites guide](https://tauri.app/v1/guides/getting-started/prerequisites)
if `cargo` or a linker is missing.

## Getting a one-click .exe (no local Rust/Node needed)

This repo includes `.github/workflows/build.yml`, which builds real
installers — Windows `.exe`/`.msi`, macOS `.dmg`, Linux `.deb`/`.AppImage`
— on GitHub's own servers. You don't need Node or Rust installed on your
own machine for this path; GitHub's runner installs them fresh each time.

1. Push this project to a GitHub repo.
2. Tag a release: `git tag v0.1.0 && git push --tags`
3. Go to the repo's **Actions** tab and watch the "Build Genesis Grid
   installers" workflow run (a few minutes per platform).
4. When it finishes, check the **Releases** page — it publishes a draft
   release with the Windows `.exe`/`.msi`, macOS `.dmg`, and Linux
   installers attached, ready to hand to your friends.

You can also trigger a build anytime without a new tag, from the Actions
tab → "Build Genesis Grid installers" → "Run workflow".

## Building locally instead

If you'd rather build on your own machine (both are free):

- Install [Node.js](https://nodejs.org) (LTS version)
- Install [Rust via rustup](https://rustup.rs) — on Windows this also
  prompts you to install the "C++ build tools" component, which you'll
  need to accept

```bash
npm install
npm run tauri build
```

Produces a native installer per OS in `src-tauri/target/release/bundle/`
— this is the "one-click install" artifact you'd hand to a friend.

## How model recommendation works

1. `scan_system` (Rust) reads total RAM, CPU core count, and — best
   effort — GPU name and VRAM. NVIDIA detection is reliable via
   `nvidia-smi`; AMD/Intel/Apple currently fall back to "CPU only"
   rather than guessing, since a wrong guess is worse than an honest
   unknown.
2. `classify_tier` maps that into one of four tiers: **Light**,
   **Balanced**, **Fast**, **Power User**.
3. The Model Library screen filters the catalog (`model_catalog`) into
   "recommended" vs. "runs, but slower" based on tier fit — never
   showing raw GB/parameter numbers in the main view. Full specs live
   behind the "Show advanced details" toggle.

## Model catalog (starting set)

| Model | Role | Min. tier |
|---|---|---|
| Qwen 2.5 Coder 7B | Coding | Balanced |
| DeepSeek Coder V2 | Coding | Fast |
| Gemma4 E4B Claude Coder | Coding | Balanced |
| Qwythos 9B | Unfiltered chat | Balanced |
| Ornith | General chat | Balanced |
| Hermes 3 | General chat | Fast |

Users can add any other Ollama model by name from the "Add your own"
box — it just runs `ollama pull <name>`.

## Branding & ownership

A few things are already wired in so the app is visibly and provably yours:

- **App icon** — `src-tauri/icons/` has a full set (16 up to 1024px, plus
  `.ico` and `.icns`) built from a circuit-node "G" mark in your palette.
  This is a solid placeholder; for a pixel-perfect set, run
  `npx tauri icon path/to/your-logo.png` once you have a final logo —
  it's the official Tauri generator and handles platform-specific
  quirks (like macOS's rounded-corner mask) better than a hand-rolled
  script.
- **Bundle identifier** — `com.genesisgridlabs.app` in `tauri.conf.json`
  is baked into every compiled installer; it's what OS installers and
  package managers use to identify the app as yours.
- **Copyright metadata** — the installer's file properties now carry
  `© 2026 Genesis Grid Labs™`, and the sidebar footer shows it in the
  running app too.
- **`LICENSE` file** — an "all rights reserved" proprietary license
  naming Genesis Grid Labs as the owner, with commit history as the
  paper trail for authorship.

What actually stops someone from copying it, roughly in order of effort
vs. protection:

1. **A public commit history is your strongest, free proof of authorship.**
   Push early and often — timestamps on a real GitHub repo are hard to
   fake and easy to point to if authorship is ever disputed.
2. **The LICENSE + copyright notices** make your terms explicit, so
   reuse without permission is unambiguously a violation rather than a
   gray area.
3. **Code signing** (a paid certificate, roughly $100–500/year from a
   CA) makes Windows/macOS show your verified publisher name instead of
   an "Unknown publisher" warning. This doesn't stop copying, but it
   does stop someone else's build from impersonating yours convincingly,
   and it removes the scary security prompt for your real users.
4. **A registered trademark** on "Genesis Grid" (a legal process, not a
   code change) is the only thing that gives you enforceable rights over
   the *name* itself, separate from the code.

None of this makes copying impossible — no license or signature does,
since anyone with the installer can decompile it — but it does establish
clear, provable ownership and makes casual reuse legally risky, which is
what "stolen work" protection realistically looks like for a solo project.

## Chat, Projects, and Recent Chats

Chat is a real multi-session system now, not one thread per model:

- **"Chat"** in the sidebar opens (or starts) the active conversation.
- **"Chats & projects"** is the browsable history — every past
  conversation, with a title auto-generated from its first message,
  which model it used, and when it was last touched. Group chats under
  a project (a flat name, "All chats" always shows everything), or
  start a fresh one from there.
- Each chat is its own file on disk under
  `genesis-grid/chats/<id>.json`; projects live in
  `genesis-grid/projects.json`.

**Ollama server status** is now checked separately from whether it's
*installed* — `ollama_server_running` does a real TCP probe to
`:11434` every 5 seconds. If Ollama's installed but quit (tray icon
closed, crashed, etc.), the sidebar shows a "Start Ollama" button
instead of falsely claiming everything's fine.

**Known rough edges:**

- `goToChat()`'s "create a session with my first installed model"
  logic reads `installedModels` from React state at click time, which
  can be one render behind a just-completed model install — usually
  harmless (worst case it picks "freellmapi" once), but worth knowing.
- No project renaming/deletion yet, and no way to move an existing
  chat into a different project after creation — only at creation time
  via which project tab was active.
- ~~FreeLLMAPI key only entered per-screen, no shared store~~ — fixed:
  `load_freellmapi_settings`/`save_freellmapi_settings` now persist the
  unified key **and** which underlying model to route to (previously
  hardcoded to `"auto"`, which is also what made it look like "you
  can't choose the model") to `genesis-grid/freellmapi-settings.json`,
  shared by both the Chat screen and "Use online instead."
- `chat_via_freellmapi`'s error handling used to say only "Unexpected
  response shape from FreeLLMAPI" with no detail — real testing showed
  this hid the actual problem. It now surfaces the real HTTP status,
  the raw response body, and any `error.message` field the proxy
  reports, instead of a generic message.

## Still to build

- **Download progress streaming for models.** `pull_model` (the Model
  Library screen) still fires `ollama pull` and returns immediately —
  the Ollama and FreeLLMAPI *installers* now stream real progress (see
  below), but individual model downloads don't yet.
- **AMD/Intel GPU detection.** Implemented on **Windows** via DXGI
  adapter enumeration (`IDXGIFactory1::EnumAdapters1` +
  `GetDesc1().DedicatedVideoMemory`) — the same OS-level interface Task
  Manager and games use. An earlier attempt read a registry field
  (`HardwareInformation.qwMemorySize`) that turned out not to be
  populated by at least one real AMD driver in testing, so that
  approach was replaced rather than patched further. Still missing on
  **Linux** (would need `rocm-smi` for AMD) and doesn't add anything
  new on **macOS** (Apple Silicon is already handled via unified
  memory).
- **Streaming chat replies** for the FreeLLMAPI test box (currently
  waits for the full response rather than showing tokens as they
  arrive).

### FreeLLMAPI — now implemented, self-hosted per person

The "Use online instead" screen sets up
[Ahmed-M-Abdelkader/freellmapi](https://github.com/Ahmed-M-Abdelkader/freellmapi)
(MIT licensed) as a genuinely working fallback, not just a stub:

- `freellmapi_status` checks for Node.js and git, whether the repo's
  been cloned, and whether the proxy is already listening on `:3001`.
- `setup_freellmapi` clones the repo, runs `npm install`, generates a
  local encryption key, builds it, and starts it in the background —
  with live progress in the sidebar-style card, same pattern as the
  Ollama installer.
- `chat_via_freellmapi` sends a real request through the running proxy
  using the person's own unified `freellmapi-…` key (from the proxy's
  own dashboard, opened via `open_freellmapi_dashboard`).

**The honest caveat:** this feature needs **Node.js 20+ and git**
installed on the person's machine — Genesis Grid itself doesn't
require them, but FreeLLMAPI is a separate Node project, not something
that compiles into Genesis Grid's own binary. The UI checks for both
and tells the person plainly what's missing rather than failing
silently.

It's also **self-hosted per person by design**, matching FreeLLMAPI's
own docs ("run this for yourself, don't share the endpoint") — each
friend runs their own local instance with their own free provider keys
(Google, Groq, etc.). Nobody's paying for the hosted freellmapi.co
tier, but each person does need to add their own keys once, in the
proxy's own dashboard.

### Ollama auto-install — now implemented, with real caveats

The sidebar's "Install Ollama" button now actually installs it:

- **Windows** — downloads the official `OllamaSetup.exe` with a live
  progress bar and launches it. You still click through Ollama's own
  installer window; Genesis Grid can't silently install on your
  friend's behalf without their consent, and shouldn't.
- **macOS** — downloads `Ollama-darwin.zip`, unzips it, and moves
  `Ollama.app` into `/Applications` — no sudo, no terminal.
- **Linux** — runs Ollama's official install script behind `pkexec`,
  which pops a native graphical permission prompt instead of requiring
  a terminal. This means **`pkexec`/polkit must be present** (it ships
  by default on most desktop distros — GNOME, KDE, etc. — but minimal
  or server installs may not have it, in which case this command will
  fail and the person needs to install Ollama manually).

None of these are silent, admin-bypassing installs — each still asks
for whatever permission the OS normally requires. That's intentional:
"one click" should mean "no terminal and no separate download page,"
not "no consent."

### Telegram Bot Bridge & Cloud Credentials

Genesis Grid includes a built-in Telegram Bot Bridge that allows you to message your local or cloud AI models directly from your Telegram app.

#### 1. Setup
- Navigate to the **Skills & Tools** panel in the app sidebar.
- Enter your **Telegram Bot Token** (obtainable from [@BotFather](https://t.me/BotFather)).
- Enter your **Allowed Chat ID** to restrict bot access exclusively to you (obtainable from [@userinfobot](https://t.me/userinfobot)).
- Choose your **Target Model**:
  - **Genesis Brain**: Routes queries to your active local Ollama models.
  - **OpenRouter / OpenAI / Google Gemini / FreeLLMAPI**: Routes queries directly to cloud models using your stored keys.
- Toggle the bridge **ON**. Detailed execution and polling status logs will print to your console.

#### 2. Usage Notes & Caveats
- **First Question Initialization**: The very first message you send to the bot might take a few minutes to respond. This occurs because the backend is initializing connection pools, checking local models, or warming up API endpoints.
- **Typing Status Bubble**: While the bot is processing or generating a reply, it will display a live "typing..." bubble inside Telegram so you know it is actively working on your answer.
- **Simultaneous Cloud Keys**: You can configure and save API credentials for OpenRouter, OpenAI, Google Gemini, and FreeLLMAPI concurrently in settings. Dedicated "Save" buttons next to each credential input field persist changes instantly with a green confirmation checkmark.
- **OpenRouter Free Models**: When using OpenRouter, you can select from a dynamic list of currently available free models directly inside the chat interface dropdown, which fetches model metadata in real-time.
