@echo off
echo ======================================================================
echo    Starting SpendWise - Daily Expenditure Analyser
echo    FastAPI Backend:  http://127.0.0.1:8000
echo    React UI:         http://127.0.0.1:5173
echo    API Docs:         http://127.0.0.1:8000/docs
echo ======================================================================
echo.

if not exist "venv\Scripts\python.exe" (
    echo [ERROR] Virtual environment not found. Please run setup.bat first!
    pause
    exit /b 1
)

:: Ensure data directory exists
if not exist "data" mkdir data
if not exist "data\receipts" mkdir data\receipts

:: Start Backend server in a separate background window
echo [INFO] Starting FastAPI Uvicorn backend on port 8000...
start "SpendWise Backend" cmd /k "call .\venv\Scripts\activate.bat && python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000 --reload"

:: Give backend 2 seconds to initialize
timeout /t 2 /nobreak >nul

:: Start Frontend Vite server in a separate window
echo [INFO] Starting Vite frontend server on port 5173...
start "SpendWise Frontend" cmd /k "cd frontend && npm run dev"

:: Open user's default browser to SpendWise
timeout /t 3 /nobreak >nul
start http://127.0.0.1:5173

echo.
echo [OK] SpendWise is running!
echo Keep the backend and frontend terminal windows open while using the application.
echo Press any key to close this launcher.
pause
