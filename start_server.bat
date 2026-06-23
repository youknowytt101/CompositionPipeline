@echo off
setlocal

cd /d "%~dp0"

where python >nul 2>nul
if errorlevel 1 (
  echo Python was not found on PATH.
  echo Install Python or start the server manually with the Python used by this project.
  pause
  exit /b 1
)

echo Starting CompositionPipeline local server...
echo.
python server.py

echo.
echo Server stopped.
pause
