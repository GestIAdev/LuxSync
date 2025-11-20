@echo off
echo ========================================
echo   LuxSync Demo Launcher
echo   Selene Audio Reactive Lighting
echo ========================================
echo.

REM Check if Node.js is installed
node --version >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Node.js no esta instalado!
    echo.
    echo Por favor instala Node.js desde: https://nodejs.org
    echo.
    pause
    exit /b 1
)

echo [OK] Node.js detectado
echo.

REM Check if dependencies are installed
if not exist "node_modules" (
    echo [INFO] Instalando dependencias...
    echo.
    call npm install
    if %errorlevel% neq 0 (
        echo [ERROR] Fallo la instalacion de dependencias
        pause
        exit /b 1
    )
    echo.
    echo [OK] Dependencias instaladas
    echo.
)

REM Build the project
echo [INFO] Compilando proyecto...
echo.
call npm run build
if %errorlevel% neq 0 (
    echo [ERROR] Fallo la compilacion
    pause
    exit /b 1
)

echo.
echo [OK] Proyecto compilado exitosamente
echo.
echo ========================================
echo   Abriendo demo en navegador...
echo ========================================
echo.
echo Instrucciones:
echo 1. Click en "Enable Microphone" y acepta permisos
echo 2. Click en "Start Demo"
echo 3. Pon musica cerca del microfono
echo 4. Disfruta las luces reactivas!
echo.
echo Presiona Ctrl+C para detener el servidor
echo.

REM Install demo dependencies
if not exist "demo\node_modules" (
    echo [INFO] Instalando dependencias de demo...
    cd demo
    call npm install
    cd ..
    echo.
)

REM Start dev server
echo Abriendo servidor de desarrollo...
echo URL: http://localhost:3000
echo.
cd demo
start http://localhost:3000
call npm run dev
