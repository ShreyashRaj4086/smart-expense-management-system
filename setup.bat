@echo off
echo ======================================================================
echo    SpendWise - Daily Expenditure Analyser: Windows Setup Script
echo ======================================================================
echo.

:: 1. Verify Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python is not installed or not in PATH. Please install Python 3.10+
    pause
    exit /b 1
)
echo [OK] Python detected.

:: 2. Verify Node.js
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not in PATH. Please install Node.js 18+
    pause
    exit /b 1
)
echo [OK] Node.js detected.

:: 3. Create Python Virtual Environment
if not exist "venv" (
    echo [INFO] Creating Python virtual environment in .\venv ...
    python -m venv venv
) else (
    echo [OK] Existing virtual environment found.
)

:: 4. Install Backend Dependencies
echo [INFO] Installing Python backend dependencies...
call .\venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r backend\requirements.txt

:: 5. Install Frontend Dependencies
echo [INFO] Installing Frontend npm dependencies...
cd frontend
call npm install --legacy-peer-deps
call npm install react-is --legacy-peer-deps
cd ..

:: 6. Initialize Database
echo [INFO] Initializing SQLite database safely...
python -c "from backend.app.main import app; from backend.app.database import engine, Base, SessionLocal; from backend.app import crud; Base.metadata.create_all(bind=engine); db = SessionLocal(); crud.seed_defaults(db); db.close(); print('[OK] Database schema initialized and default tables seeded.')"

echo.
echo ======================================================================
echo    Setup completed successfully!
echo    You can now launch SpendWise anytime using: run.bat
echo ======================================================================
echo.
pause
