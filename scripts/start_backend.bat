@echo off
setlocal

:: Navigate to backend directory
cd /d "%~dp0..\backend"

echo ===================================================
echo      Yukyu Pro Backend - Start Script
echo ===================================================

:: 1. Activate virtual environment
echo.
echo [1/3] Activating virtual environment...
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
) else (
    echo Creating virtual environment...
    python -m venv venv
    call venv\Scripts\activate.bat
    echo Installing dependencies...
    pip install -r requirements.txt
)

:: 2. Install dependencies if needed
echo.
echo [2/3] Checking dependencies...
pip install -r requirements.txt --quiet

:: 3. Start FastAPI server
echo.
echo [3/3] Starting Backend...
echo - API URL: http://localhost:8000
echo - Docs: http://localhost:8000/docs
echo.

:: Launch FastAPI with uvicorn
python main.py

:: If server stops, pause
echo.
echo Backend stopped.
pause
endlocal
