@echo off
REM Double-clickable launcher for dump-ym-dom.ps1.
REM Runs the PowerShell script with execution policy bypass so users do not
REM have to change system settings.

cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0dump-ym-dom.ps1"

echo.
pause
