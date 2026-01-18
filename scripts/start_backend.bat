@echo off
setlocal

:: Ensure we are in the project root
cd /d "%~dp0.."

echo ===================================================
echo      Yukyu Pro - Backend Launcher
echo ===================================================

:: 1. Check for Python
python --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found. Please install Python 3.10+ and add it to PATH.
    pause
    exit /b 1
)

:: 2. Setup Virtual Environment
if not exist "backend\venv" (
    echo [1/3] Creating virtual environment...
    python -m venv backend\venv
)

:: 3. Install Dependencies
echo.
echo [2/3] Installing/Updating dependencies...
call backend\venv\Scripts\activate
pip install -r backend\requirements.txt
if %errorlevel% neq 0 (
    echo [ERROR] Failed to install dependencies.
    pause
    exit /b 1
)

:: 4. Start Server
echo.
echo [3/3] Starting Backend Server (FastAPI) on port 8000...
echo - API Docs: http://localhost:8000/docs
echo.
cd backend
python main.py

pause
endlocal
