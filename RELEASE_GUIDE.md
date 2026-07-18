# Genesis Grid Release and Build Guide

This guide describes how to trigger automatic builds of Windows (`.exe` / `.msi`) and Linux (`.deb` / `.AppImage`) installers via GitHub Actions.

---

## 🔑 GitHub Setup (One-Time Configuration)

### 1. Add the Updater Signing Key
To sign updates securely so the app can update itself:
1. Go to your repository settings page: `https://github.com/Coraje187/genesis-grid/settings`
2. In the left menu, select **Secrets and variables** -> **Actions**.
3. Click **New repository secret**.
4. Name: `TAURI_PRIVATE_KEY`
5. Value: *[Paste your generated private key from your secure backups / chat history]*
6. Click **Add secret**.

### 2. Enable Workflow Write Permissions
By default, GitHub prevents scripts from creating releases. Enable it by doing the following:
1. Go to your repository settings page: `https://github.com/Coraje187/genesis-grid/settings`
2. Under "Code and automation" in the left menu, click **Actions** -> **General**.
3. Scroll down to **Workflow permissions**.
4. Select **Read and write permissions**.
5. Click **Save**.

---

## 🚀 How to Publish a New Release

When you are ready to publish a new build:

1. **Update Version Numbers:**
   Update the version string (e.g. from `"0.1.0"` to `"0.2.0"`) in these two files:
   - [package.json](package.json)
   - [src-tauri/tauri.conf.json](src-tauri/tauri.conf.json)

2. **Commit and Push to GitHub:**
   ```bash
   git add .
   git commit -m "Bump version to v0.2.0"
   git push origin master
   ```

3. **Push a Version Tag:**
   Pushing a tag starting with `v` triggers the automatic build runner:
   ```bash
   git tag v0.2.0
   git push origin v0.2.0
   ```

4. **Monitor and Download:**
   - Go to the **Actions** tab on your GitHub repository page to see the progress.
   - Once completed, the installers will be automatically compiled, signed, and published on your repository's **Releases** page!
