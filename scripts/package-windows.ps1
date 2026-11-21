# StudyWise AI — Windows Desktop Installer Build Script (PowerShell)
# Run on Windows 10/11 with Node.js 20+, Rust/Cargo, MSVC Build Tools, and WebView2 installed.

$ErrorActionPreference = "Stop"

Write-Host "=== StudyWise AI Windows Packaging Pipeline ===" -ForegroundColor Cyan

# 1. Verify toolchain prerequisites
foreach ($cmd in @("node", "npm", "rustc", "cargo")) {
    if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
        throw "Required build dependency '$cmd' was not found in PATH."
    }
}

# 2. Install frontend dependencies & verify TypeScript + Vite build
Write-Host "[1/3] Installing Node dependencies..." -ForegroundColor Yellow
npm ci

Write-Host "[2/3] Type-checking and building offline frontend bundle..." -ForegroundColor Yellow
npm run lint
npm run build

# 3. Compile Tauri Windows application and generate NSIS (.exe) & MSI (.msi) installers
Write-Host "[3/3] Compiling Tauri Windows installers (NSIS + MSI with Desktop Shortcut)..." -ForegroundColor Yellow
npx @tauri-apps/cli@2 build --bundles nsis,msi

Write-Host ""
Write-Host "Build completed! Generated installers can be found under:" -ForegroundColor Green
Write-Host "  src-tauri/target/release/bundle/nsis/StudyWise AI_1.0.0_x64-setup.exe"
Write-Host "  src-tauri/target/release/bundle/msi/StudyWise AI_1.0.0_x64_en-US.msi"
