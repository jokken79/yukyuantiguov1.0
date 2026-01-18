@echo off
setlocal

echo ===================================================
echo      Yukyu Pro - Full Stack Launcher
echo ===================================================
echo.
echo This will start both frontend and backend servers.
echo.

:: Start backend in new window
echo Starting Backend server...
start "Yukyu Backend" cmd /k "%~dp0start_backend.bat"

:: Wait a moment for backend to initialize
timeout /t 3 /nobreak > nul

:: Start frontend in new window
echo Starting Frontend server...
start "Yukyu Frontend" cmd /k "%~dp0start_frontend.bat"

echo.
echo ===================================================
echo Both servers are starting in separate windows.
echo.
echo - Frontend: http://localhost:3000
echo - Backend:  http://localhost:8000
echo - API Docs: http://localhost:8000/docs
echo ===================================================
echo.
pause
endlocal
