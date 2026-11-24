#Requires -Version 5.1
$ErrorActionPreference = "Stop"

Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  Antigravity x Google Flow MCP — Windows Automated Setup" -ForegroundColor Cyan
Write-Host "==================================================================" -ForegroundColor Cyan

$RepoRoot = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. Detect Node.js & npm.cmd (avoiding PowerShell ExecutionPolicy blocks on npm.ps1 / npx.ps1)
$NodeExe = (Get-Command node.exe -ErrorAction SilentlyContinue).Source
if (-not $NodeExe -and (Test-Path "C:\Program Files\nodejs\node.exe")) {
    $NodeExe = "C:\Program Files\nodejs\node.exe"
}
if (-not $NodeExe) {
    Write-Host "[ERROR] Node.js (v20+) not found! Please install from https://nodejs.org/" -ForegroundColor Red
    exit 1
}
$NodeDir = Split-Path -Parent $NodeExe
$NpmCmd  = Join-Path $NodeDir "npm.cmd"
$NpxCmd  = Join-Path $NodeDir "npx.cmd"

$NodeVer = & $NodeExe -v
Write-Host "[1/5] Detected Node.js $NodeVer at $NodeExe" -ForegroundColor Green

# 2. Install Plugin & MCP Server into ~/.gemini/config/plugins/sangamflow-flow
$ConfigDir = Join-Path $env:USERPROFILE ".gemini\config"
$PluginDir = Join-Path $ConfigDir "plugins\sangamflow-flow"
New-Item -ItemType Directory -Force -Path $PluginDir | Out-Null

Write-Host "[2/5] Copying MCP server & skills to $PluginDir ..." -ForegroundColor Yellow
foreach ($sub in @("mcp-server", "skills")) {
    $srcSub = Join-Path $RepoRoot $sub
    $dstSub = Join-Path $PluginDir $sub
    if (Test-Path $dstSub) { Remove-Item $dstSub -Recurse -Force }
    Copy-Item $srcSub $dstSub -Recurse -Force
}

$PluginJson = @{
    name        = "sangamflow-flow"
    displayName = "SangamFlow Google Flow Bridge"
    version     = "2.0.0"
    description = "Connects Antigravity AI agents directly to an open Google Flow tab in Chrome via local WebSocket bridge (127.0.0.1:8792)."
    keywords    = @("google flow", "veo", "imagen", "sangamflow", "deepx", "mcp")
} | ConvertTo-Json -Depth 4
Set-Content -Path (Join-Path $PluginDir "plugin.json") -Value $PluginJson -Encoding UTF8

# 3. Install npm dependencies cleanly with npm.cmd
Write-Host "[3/5] Installing MCP server npm dependencies ..." -ForegroundColor Yellow
Push-Location (Join-Path $PluginDir "mcp-server")
if (Test-Path "package-lock.json") {
    & $NpmCmd ci --no-audit --no-fund
} else {
    & $NpmCmd install --no-audit --no-fund
}
Pop-Location

# 4. Copy lazy-loaded MCP tool schemas into ~/.gemini/antigravity/mcp/deepx-flow
$McpSchemaDir = Join-Path $env:USERPROFILE ".gemini\antigravity\mcp\deepx-flow"
New-Item -ItemType Directory -Force -Path $McpSchemaDir | Out-Null
Copy-Item (Join-Path $PluginDir "mcp-server\instructions.md") (Join-Path $McpSchemaDir "instructions.md") -Force
Copy-Item (Join-Path $PluginDir "mcp-server\schemas\*.json") $McpSchemaDir -Force
Write-Host "[4/5] Installed MCP schemas into $McpSchemaDir" -ForegroundColor Green

# 5. Non-destructively merge deepx-flow into ~/.gemini/config/mcp_config.json
$McpConfigPath = Join-Path $ConfigDir "mcp_config.json"
if (Test-Path $McpConfigPath) {
    Copy-Item $McpConfigPath "$McpConfigPath.bak" -Force
}

$EntryMjs = Join-Path $PluginDir "mcp-server\bin\sangamflow-mcp.mjs"
$NodeUpdateScript = @'
const fs = require("fs");
const [cfgPath, nodeExe, entryMjs] = process.argv.slice(1);
let cfg = { mcpServers: {} };
if (fs.existsSync(cfgPath)) {
  try { cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8")); } catch (e) {}
}
if (!cfg.mcpServers) cfg.mcpServers = {};
delete cfg.mcpServers["sangamflow-flow"]; // avoid duplicate port 8792 bind
cfg.mcpServers["deepx-flow"] = {
  command: nodeExe,
  args: [entryMjs]
};
fs.writeFileSync(cfgPath, JSON.stringify(cfg, null, 2) + "\n", "utf8");
'@
& $NodeExe -e $NodeUpdateScript $McpConfigPath $NodeExe $EntryMjs
Write-Host "[5/5] Updated $McpConfigPath (backup saved to mcp_config.json.bak)" -ForegroundColor Green

$ExtPath = Join-Path $RepoRoot "chrome-extension"
Write-Host ""
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  INSTALLATION COMPLETE! Next 2 steps in Chrome:" -ForegroundColor Green
Write-Host "==================================================================" -ForegroundColor Cyan
Write-Host "  1. Open Chrome -> go to: chrome://extensions"
Write-Host "     - Turn ON 'Developer mode' (top-right corner)"
Write-Host "     - Click 'Load unpacked' (top-left) and select folder:"
Write-Host "       $ExtPath" -ForegroundColor Yellow
Write-Host "  2. Open https://labs.google/fx/tools/flow in Chrome, sign in, and open any Project."
Write-Host "     Antigravity will auto-detect 'deepx-flow' on port 127.0.0.1:8792!"
Write-Host "==================================================================" -ForegroundColor Cyan
