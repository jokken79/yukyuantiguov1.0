@echo off
setlocal

echo ===================================================
echo      Yukyu Pro - FULL SYSTEM (Fusion)
echo ===================================================

:: 1. Solicitar Puerto
set /p portInput="Ingresa tus 3 digitos para el puerto (ej. 654 o 3000): "
if "%portInput%"=="" set portInput=3000

echo.
echo [1/2] Iniciando CEREBRO (Backend Python) en ventana separada...
start "Yukyu Backend" cmd /c "scripts\start_backend.bat"

echo [2/2] Iniciando INTERFAZ (Frontend React) en el puerto %portInput%...
echo.
echo - La App estara disponible en: http://localhost:%portInput%
echo - El Backend y el Frontend estan relacionados por el puerto 8000.
echo.

:: Iniciar Frontend en esta ventana
call npx vite --port %portInput% --host

pause
endlocal
