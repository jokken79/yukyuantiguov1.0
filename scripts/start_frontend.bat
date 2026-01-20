@echo off
setlocal

:: Navigate to project root (frontend code is in root, not /frontend)
cd /d "%~dp0.."

echo ===================================================
echo      Yukyu Pro Frontend - Start Script
echo ===================================================

:: 1. Check/Install Dependencies
echo.
echo [1/2] Checking dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Error installing dependencies.
    pause
    exit /b %errorlevel%
)

:: 2. Start Application
echo.
echo [2/2] Starting Frontend...
echo - URL: http://localhost:3000
echo - IMPORTANT: Run start_backend.bat in a separate window!
echo.

:: Launch Vite dev server
call npm run dev

:: If Vite stops, pause
echo.
echo Frontend stopped.
pause
endlocal
