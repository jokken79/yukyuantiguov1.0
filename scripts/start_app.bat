@echo off
setlocal

:: Ensure we are running from the project root (one level up from scripts/)
cd /d "%~dp0.."

echo ===================================================
echo      Yukyu Pro - Setup and Launch Script
echo ===================================================

:: 1. Install Dependencies
echo.
echo [1/3] Checking dependencies...
call npm install
if %errorlevel% neq 0 (
    echo Error installing dependencies.
    pause
    exit /b %errorlevel%
)

:: 2. Configure Port
echo.
echo [2/3] Configuration
set /p portInput="Enter the port number (Recommended: 3000 or 5555): "

:: Default if empty
if "%portInput%"=="" set portInput=3000

:: 3. Start Application
echo.
echo [3/3] Starting System...
echo - Frontend: http://localhost:%portInput%
echo - IMPORTANT: Remember to run 'scripts/start_backend.bat' in a separate window!
echo.

:: Launch Vite with the specified port
call npx vite --port %portInput% --host

:: If Vite stops, pause
echo.
echo Application stopped.
pause
endlocal