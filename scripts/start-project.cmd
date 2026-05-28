@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0stop-project.ps1"
call "%~dp0start-postgres.cmd"
npm.cmd run dev
