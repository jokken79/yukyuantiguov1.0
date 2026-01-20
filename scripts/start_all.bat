@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0\.."
title Yukyu Pro - SUPER LAUNCHER

REM ================================================================================
REM   YUKYU PRO - SUPER LAUNCHER v2.0
REM   Configuracion completa: Puertos, Dependencias, Limpieza
REM ================================================================================

REM === DEFAULTS ===
set "BACKEND_PORT=8000"
set "FRONTEND_PORT=3000"
set "AskParams=N"
set "CLEAN=N"

echo.
echo ================================================================================
echo   YUKYU PRO - SUPER LAUNCHER v2.0
echo   Sistema de Gestion de Vacaciones (有給休暇管理)
echo ================================================================================
echo.

REM --------------------------------------------------------------------------------
REM FASE 0: CONFIGURACION
REM --------------------------------------------------------------------------------
echo [FASE 0] CONFIGURACION
echo.

set /p "AskParams=Configurar parametros personalizados? (S/N) [Default: N]: "
if /i "!AskParams!"=="S" goto CONFIGURE_PARAMS
goto SKIP_CONFIG

:CONFIGURE_PARAMS
echo.
echo --- PUERTOS ---
set /p "BACKEND_PORT=Puerto Backend [Default 8000]: "
if "!BACKEND_PORT!"=="" set "BACKEND_PORT=8000"

set /p "FRONTEND_PORT=Puerto Frontend [Default 3000]: "
if "!FRONTEND_PORT!"=="" set "FRONTEND_PORT=3000"

:SKIP_CONFIG
echo.
echo   CONFIGURACION FINAL:
echo   ----------------------
echo   Backend Port:   !BACKEND_PORT!
echo   Frontend Port:  !FRONTEND_PORT!
echo.

REM --------------------------------------------------------------------------------
REM FASE 1: LIMPIEZA (OPCIONAL)
REM --------------------------------------------------------------------------------
echo [FASE 1] LIMPIEZA
echo.

set /p "CLEAN=Limpieza profunda (borrar node_modules y venv)? (S/N) [Default: N]: "
if /i "!CLEAN!"=="S" goto DO_CLEANUP
goto SKIP_CLEANUP

:DO_CLEANUP
echo.
echo   Eliminando node_modules...
if exist "node_modules" (
    rmdir /s /q "node_modules" 2>nul
    echo   [OK] node_modules eliminado.
) else (
    echo   [SKIP] node_modules no existe.
)
echo   Eliminando package-lock.json...
if exist "package-lock.json" (
    del /f /q "package-lock.json" 2>nul
    echo   [OK] package-lock.json eliminado.
)
echo   Eliminando venv del backend...
if exist "backend\venv" (
    rmdir /s /q "backend\venv" 2>nul
    echo   [OK] venv eliminado.
)
echo   Limpiando __pycache__...
for /d /r %%d in (__pycache__) do @if exist "%%d" rmdir /s /q "%%d" 2>nul
echo   [OK] Limpieza completada.
echo.
goto DEPENDENCY_CHECK

:SKIP_CLEANUP
echo   [SKIP] Limpieza omitida.
echo.
goto DEPENDENCY_CHECK

REM --------------------------------------------------------------------------------
REM FASE 2: DEPENDENCIAS
REM --------------------------------------------------------------------------------
:DEPENDENCY_CHECK
echo [FASE 2] VERIFICACION DE DEPENDENCIAS
echo.

REM --- Python venv ---
echo   Verificando entorno virtual Python...
if not exist "backend\venv" (
    echo   Creando venv en backend...
    cd backend
    python -m venv venv
    if errorlevel 1 goto ERROR_PYTHON
    cd ..
    echo   [OK] venv creado.
) else (
    echo   [OK] venv existe.
)

REM --- Backend requirements ---
echo   Instalando dependencias backend...
call backend\venv\Scripts\activate.bat
pip install -q -r backend\requirements.txt
if errorlevel 1 goto ERROR_PIP
call deactivate 2>nul
echo   [OK] Backend listo.
echo.

REM --- Frontend node_modules ---
echo   Verificando dependencias frontend...
if not exist "node_modules" (
    echo   Instalando node_modules...
    call npm install --silent
    if errorlevel 1 goto ERROR_NPM
    echo   [OK] node_modules instalado.
) else (
    echo   [OK] node_modules existe.
)
echo   [OK] Frontend listo.
echo.

REM --------------------------------------------------------------------------------
REM FASE 3: MATAR PROCESOS ZOMBIES
REM --------------------------------------------------------------------------------
echo [FASE 3] LIBERANDO PUERTOS
echo.

REM --- Matar proceso en puerto backend ---
echo   Liberando puerto !BACKEND_PORT!...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":!BACKEND_PORT!" ^| findstr "LISTENING"') do (
    echo   Matando PID %%a...
    taskkill /F /PID %%a >nul 2>&1
)

REM --- Matar proceso en puerto frontend ---
echo   Liberando puerto !FRONTEND_PORT!...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":!FRONTEND_PORT!" ^| findstr "LISTENING"') do (
    echo   Matando PID %%a...
    taskkill /F /PID %%a >nul 2>&1
)

echo   [OK] Puertos liberados.
echo.

REM --------------------------------------------------------------------------------
REM FASE 4: CONFIGURAR ARCHIVOS .ENV
REM --------------------------------------------------------------------------------
echo [FASE 4] CONFIGURANDO ARCHIVOS DE ENTORNO
echo.

REM --- Frontend .env.local (solo si no existe o actualizar API URL) ---
echo   Verificando .env.local...
if not exist ".env.local" (
    echo   Creando .env.local vacio (agrega GEMINI_API_KEY manualmente si lo necesitas)...
    (
    echo # Yukyu Pro Environment Variables
    echo # Agrega tu API key de Gemini aqui:
    echo # GEMINI_API_KEY=your_api_key_here
    ) > .env.local
    echo   [OK] .env.local creado.
) else (
    echo   [OK] .env.local ya existe.
)

REM --- Verificar vite.config.ts tiene el proxy configurado ---
echo   [INFO] El proxy API esta configurado en vite.config.ts
echo.

REM --------------------------------------------------------------------------------
REM FASE 5: LANZAR SERVICIOS
REM --------------------------------------------------------------------------------
echo [FASE 5] INICIANDO SERVICIOS
echo.

echo   Iniciando Backend API (Puerto !BACKEND_PORT!)...
start "Yukyu Pro - BACKEND" cmd /k "cd /d %~dp0\..\backend && call venv\Scripts\activate.bat && python main.py"

echo   Esperando que el backend inicie (5 segundos)...
timeout /t 5 /nobreak >nul

echo   Iniciando Frontend (Puerto !FRONTEND_PORT!)...
start "Yukyu Pro - FRONTEND" cmd /k "cd /d %~dp0\.. && npm run dev -- --port !FRONTEND_PORT!"

echo   Esperando que el frontend inicie (5 segundos)...
timeout /t 5 /nobreak >nul

echo   Abriendo navegador...
start http://localhost:!FRONTEND_PORT!

echo.
echo ================================================================================
echo   SISTEMA INICIADO CORRECTAMENTE
echo ================================================================================
echo.
echo   BACKEND:   http://localhost:!BACKEND_PORT!/api/health
echo   SWAGGER:   http://localhost:!BACKEND_PORT!/docs
echo   FRONTEND:  http://localhost:!FRONTEND_PORT!
echo.
echo   NOTA: Los datos se guardan en localStorage del navegador.
echo         El backend es opcional (para persistencia en SQLite).
echo.
echo   Para detener los servicios, cierra las ventanas de consola.
echo.
echo   Presiona cualquier tecla para cerrar esta ventana...
pause >nul
goto :EOF

REM === MANEJADORES DE ERROR ===

:ERROR_PYTHON
echo.
echo [ERROR FATAL] No se pudo crear el entorno virtual Python.
echo Asegurate de que Python este instalado y en el PATH.
echo.
echo Descarga Python desde: https://www.python.org/downloads/
pause
exit /b 1

:ERROR_PIP
echo.
echo [ERROR FATAL] pip install fallo.
echo Verifica tu conexion a internet o el archivo requirements.txt.
pause
exit /b 1

:ERROR_NPM
echo.
echo [ERROR FATAL] npm install fallo.
echo Verifica que Node.js este instalado.
echo.
echo Descarga Node.js desde: https://nodejs.org/
pause
exit /b 1
