@echo off
setlocal enabledelayedexpansion

title SpendWise Launcher

echo ===============================================================================
echo            SpendWise - Daily Expenditure Analyser Launcher
echo ===============================================================================
echo.
echo  Starting local services:
echo    [1] Ollama Local AI Server  - http://127.0.0.1:11434
echo    [2] FastAPI Backend Engine   - http://127.0.0.1:8000 (Docs: /docs)
echo    [3] React + Vite Frontend    - http://127.0.0.1:5173
echo.
echo ===============================================================================
echo.

:: 1. Verify virtual environment
if not exist "venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment 'venv' not found.
    echo Please run 'setup.bat' first to install required Python packages.
    echo.
    pause
    exit /b 1
)

:: 2. Ensure data directories exist
if not exist "data" mkdir "data"
if not exist "data\receipts" mkdir "data\receipts"

:: 3. Launch Ollama (if installed on system)
echo [1/3] Checking Ollama local AI server...
where ollama >nul 2>nul
if %ERRORLEVEL% equ 0 (
    echo       Ollama detected. Launching 'ollama serve' in dedicated terminal...
    start "SpendWise - Ollama Local AI" cmd /k "title SpendWise - Ollama AI && echo Starting Ollama Local Server... && ollama serve"
) else (
    echo       [NOTE] Ollama CLI not found in PATH.
    echo       SpendWise will run smoothly using Deterministic SQL Intelligence mode.
)

:: Short pause before launching backend
timeout /t 2 /nobreak >nul

:: 4. Launch FastAPI backend in its own terminal
echo [2/3] Launching FastAPI backend server (Port 8000)...
start "SpendWise - FastAPI Backend" cmd /k "title SpendWise - FastAPI Backend && call .\venv\Scripts\activate.bat && echo Initializing SQLite database and starting Uvicorn server... && python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload"

:: Give backend 2 seconds to initialize database tables
timeout /t 2 /nobreak >nul

:: 5. Launch Frontend (Vite) in its own terminal
echo [3/3] Launching React Vite frontend dev server (Port 5173)...
start "SpendWise - React Frontend" cmd /k "title SpendWise - React Frontend && cd frontend && echo Starting Vite development server... && npm run dev"

:: Wait for frontend to spin up, then open browser
timeout /t 3 /nobreak >nul

echo.
echo Opening SpendWise dashboard in your default browser...
start http://127.0.0.1:5173

echo.
echo ===============================================================================
echo   [SUCCESS] SpendWise is up and running!
echo.
echo   Terminals opened:
echo     - Ollama Local AI Engine
echo     - FastAPI Backend (:8000)
echo     - Vite React Frontend (:5173)
echo.
echo   Keep those terminal windows open while using SpendWise.
echo   To shut down, simply close the respective terminal windows.
echo ===============================================================================
echo.
pause
