@echo off
setlocal
cd /d "%~dp0"
call npm.cmd run dev -- --hostname 127.0.0.1 --port 3000 > next-dev.log 2>&1
