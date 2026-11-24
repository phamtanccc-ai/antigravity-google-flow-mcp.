@echo off
chcp 65001 >nul
echo ==================================================================
echo   Antigravity x Google Flow MCP - Windows 1-Click Installer
echo ==================================================================
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-windows.ps1"
echo.
pause
