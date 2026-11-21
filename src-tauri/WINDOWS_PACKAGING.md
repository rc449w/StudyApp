# StudyWise AI — Windows Desktop Packaging Guide (Tauri v2)

## Architecture Summary

- **Frontend Bundle**: Built into `dist/` via `npm run build` (`vite build`) and embedded directly into the Windows desktop executable (`frontendDist: "../dist"` in `src-tauri/tauri.conf.json`). Core study features require **zero cloud backend**.
- **Startup Screen**: Native `splashscreen` window (`public/splashscreen.html`) appears immediately on launch while the React `StartupScreen` initializes the local SQLite database and document vault, then calls `close_splashscreen`.
- **Student Records Database**: Stored locally in SQLite (`%APPDATA%/StudyWiseAI/studywise_ai.db`) via `tauri-plugin-sql` (`src-tauri/src/lib.rs` + `src/services/storage/sqliteDesktopAdapter.ts`). Any existing browser IndexedDB records are migrated automatically on first desktop launch.
- **Uploaded Document Storage**: Source files are copied locally into `%APPDATA%/StudyWiseAI/documents/` via `save_document_to_local_vault` (or a student-chosen folder via native Windows folder picker).
- **Backup & Restore**: `.studywise.json` bundles (with SHA-256 checksum & optional embedded documents) and portable `.sql` SQLite dumps (`Settings -> Local Database, Backup & Restore`).
- **Windows Installer & Desktop Shortcut**: Configured in `src-tauri/tauri.conf.json` (`nsis` + `msi` targets) with `src-tauri/nsis/installer-hooks.nsh` creating `$DESKTOP\StudyWise AI.lnk` on install and removing it on uninstall.

## Remaining Windows Build Dependencies & Installation Requirements

To compile the Windows `.exe` (NSIS) and `.msi` (WiX) installers on a Windows 10/11 machine:

1. **Node.js 20 LTS or newer** (`node` & `npm`)
2. **Rust Toolchain (`rustup`, `rustc`, `cargo` 1.77+)** from https://rustup.rs/
3. **Microsoft C++ Build Tools (Visual Studio Build Tools 2022)** with the **"Desktop development with C++"** workload and Windows 10/11 SDK
4. **Microsoft Edge WebView2 Runtime** (pre-installed on Windows 11; install Evergreen Bootstrapper on Windows 10 if absent)
5. **Tauri CLI v2** (`npx @tauri-apps/cli@2` or `cargo install tauri-cli@^2.0.0`)
6. **WiX Toolset v3** (optional, required only if building `.msi` alongside the default `.exe` NSIS installer; Tauri downloads NSIS automatically on Windows)

## Build & Offline Verification Commands (Windows PowerShell)

```powershell
# Or run the automated script:
.\scripts\package-windows.ps1

# Manual steps:
npm ci
npm run lint
npm run build
npx @tauri-apps/cli@2 build --bundles nsis,msi
```

### Post-Build Offline Verification Checklist on Windows

1. Run `src-tauri/target/release/bundle/nsis/StudyWise AI_1.0.0_x64-setup.exe`.
2. Confirm the **Desktop Shortcut (`StudyWise AI`)** and Start Menu shortcut are created.
3. Disconnect Wi-Fi / Ethernet on Windows (Airplane Mode).
4. Launch StudyWise AI from the Desktop Shortcut and verify:
   - Native splashscreen opens and transitions into the main workspace.
   - Top bar displays **Offline Mode**.
   - Uploaded documents, confirmed topics, saved study guides, saved research notes, mock exams, scoring, backup export, and backup restore all work with zero internet access.
