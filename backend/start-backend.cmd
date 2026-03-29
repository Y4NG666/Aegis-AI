@echo off
setlocal
cd /d "%~dp0\.."
set "UV_CACHE_DIR=%CD%\.uv-cache"
if exist ".venv\Scripts\uvicorn.exe" (
  ".venv\Scripts\uvicorn.exe" backend.app:app --host 127.0.0.1 --port 8000 > backend\uvicorn.log 2> backend\uvicorn.err.log
) else (
  "C:\Users\china\.local\bin\uv.exe" run --offline --with-requirements requirements.txt --python 3.14 -m uvicorn backend.app:app --host 127.0.0.1 --port 8000 > backend\uvicorn.log 2> backend\uvicorn.err.log
)
