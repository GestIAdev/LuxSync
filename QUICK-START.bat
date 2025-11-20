@echo off
echo ========================================
echo   LuxSync Demo - Quick Start
echo ========================================
echo.

REM Go to demo folder
cd demo

REM Kill any process on port 3000
echo Limpiando puerto 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":3000" ^| find "LISTENING"') do (
    echo Matando proceso %%a
    taskkill /F /PID %%a 2>nul
)

echo.
echo Iniciando servidor Vite...
echo URL: http://localhost:3000
echo.
echo IMPORTANTE:
echo 1. Click "Enable Microphone" y acepta permisos
echo 2. Click "Start Demo"
echo 3. Pon musica!
echo.

REM Start server
start http://localhost:5173
call npm run dev
