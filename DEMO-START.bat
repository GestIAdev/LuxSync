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

REM Open browser and start demo
start http://localhost:3000/demo/
node -e "const http=require('http'),fs=require('fs'),path=require('path');http.createServer((q,s)=>{let f=q.url==='/'?'/demo/index.html':q.url;let p=path.join(__dirname,f);fs.readFile(p,(e,d)=>{if(e){s.writeHead(404);s.end('404');return}s.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html':f.endsWith('.js')?'application/javascript':'text/plain'});s.end(d)})}).listen(3000,()=>console.log('Server: http://localhost:3000'))"
