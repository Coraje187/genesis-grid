# Genesis Grid Labs - Project Handover Context

This document serves as the active project blueprint and system state for **Genesis Grid Labs** to ensure local development agents (Antigravity) maintain perfect continuity without context drift.

---

## 1. Brand Identity & Visual Assets
* **Brand Name:** Genesis Grid Labs (rebranded from "New Gen Games")
* **Domain Name:** `genesisgridlabs.xyz` (Registered on Porkbun, secured via GitHub SSL)
* **Design Philosophy:** Cyberpunk / Neon Synthwave / Terminal Developer Aesthetic
* **Color Palette:**
  * Background: `#06070a` (Deep Space Dark Blue)
  * Primary Accent: `#00f2fe` (Electric Cyan)
  * Secondary Accent: `#9d00ff` (Synthwave Purple/Magenta)
  * Text/Body: `#d1d5db` (Light Gray)
* **Target Desktop Resolution:** $3440 \times 1440$ (Native 21:9 Ultra-Wide)
* **Banner Graphic:** `genesis_grid_labs_banner.png` (3440x1440px high-tech mountain galaxy landscape)
* **Favicon:** `favicon.png` (Custom branded tab icon)

---

## 2. Infrastructure & Hosting Architecture
* **Hosting Platform:** GitHub Pages (Free tier)
* **Primary Repository:** `https://github.com/Coraje187/Coraje187.github.io`
* **Custom Domain Mapping:** * Handshake established via Porkbun DNS Quick-Connect pointing to GitHub.
  * Verified secure connection with **Enforce HTTPS** enabled.
* **Active Website Code:** Located in `index.html` (single-page responsive hub displaying three core portal panels).

---

## 3. Current Button & Link Configurations
* **// THE WORKSHOP (Mods):** Points to the repository's GitHub Discussions board (`https://github.com/Coraje187/Coraje187.github.io/discussions`) for community-driven mod requests, support, and asset tracking.
* **// CODE & AI LAB (Scripts):** Points to the user's primary GitHub profile (`https://github.com/Coraje187`) as a secure placeholder while local scripts are audited.
* **// RECOVERY FEED (YouTube):** Points to the official YouTube channel (`https://www.youtube.com/@GenesisGridLabs`).

---

## 4. Operational Safety Guidelines (Strict)
* **Credential Safety:** Local API keys, logs, paths, and system login credentials must **NEVER** be committed to public repositories. 
* **Secrets Management:** All local configurations for the Agentic OS project must run off environment variables inside a `.env` file.
* **Git Restrictions:** A `.gitignore` file must be strictly maintained in the workspace root to prevent tracking `.env`, local logs (`*.log`), and Docker secrets (`.docker/`).

---

## 5. Active & Upcoming Tasks for Antigravity
1. **Agentic OS Sanitization:** Audit local system scripts, abstracting all hardcoded paths and private variables into standard env variables before creating a public mod/script repository.
2. **Local Mod Directory Structure:** Organize local mod zips for potential deployment to specialized GitHub Release binaries.
3. **Responsive Maintenance:** Ensure any future HTML/CSS edits preserve the custom un-croppable background watermarks on the landing page cards.

---

## 6. Auto-Release Workflow Reminder
Whenever you want to build and publish a new version of Genesis Grid (with Windows `.exe`/`.msi` and Linux `.deb`/`.AppImage` installers automatically compiled and attached):
1. **Bump Version:** Change the version number in `package.json` and `src-tauri/tauri.conf.json`.
2. **Commit & Push:** Push changes to GitHub:
   ```bash
   git add .
   git commit -m "Bump version to vX.Y.Z"
   git push origin master
   ```
3. **Push Git Tag:** Create and push a tag to trigger the automatic build runner:
   ```bash
   git tag vX.Y.Z
   git push origin vX.Y.Z
   ```
This will automatically launch the build runners on GitHub, compile the binaries, sign them using your `TAURI_PRIVATE_KEY` secret, and publish them to your GitHub Releases page!