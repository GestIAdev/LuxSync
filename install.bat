@echo off
REM 🎸⚡ LUXSYNC - INSTALADOR WINDOWS

echo.
echo ╔═══════════════════════════════════════════════════════════════╗
echo ║                 🎸⚡ LUXSYNC INSTALLER                        ║
echo ║          Sistema de Sincronizacion Musica-Luz DMX            ║
echo ╚═══════════════════════════════════════════════════════════════╝
echo.

REM Verificar Node.js
echo [1/5] Verificando Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ ERROR: Node.js no encontrado
    echo.
    echo Por favor instala Node.js 20+ desde: https://nodejs.org/
    pause
    exit /b 1
)
echo ✅ Node.js detectado
echo.

REM Verificar npm
echo [2/5] Verificando npm...
npm --version >nul 2>&1
if errorlevel 1 (
    echo ❌ ERROR: npm no encontrado
    pause
    exit /b 1
)
echo ✅ npm detectado
echo.

REM Instalar dependencias
echo [3/5] Instalando dependencias...
echo Esto puede tardar unos minutos...
call npm install
if errorlevel 1 (
    echo ❌ ERROR: Falló instalación de dependencias
    pause
    exit /b 1
)
echo ✅ Dependencias instaladas
echo.

REM Crear .env
echo [4/5] Configurando entorno...
if not exist .env (
    copy .env.example .env >nul
    echo ✅ Archivo .env creado
) else (
    echo ⚠️  Archivo .env ya existe (no se sobrescribe)
)
echo.

REM Build
echo [5/5] Compilando TypeScript...
call npm run build
if errorlevel 1 (
    echo ⚠️  Advertencia: Falló compilación (ejecuta 'npm run dev' para modo desarrollo)
) else (
    echo ✅ Compilación exitosa
)
echo.

echo ═══════════════════════════════════════════════════════════════
echo ✅ INSTALACIÓN COMPLETA
echo ═══════════════════════════════════════════════════════════════
echo.
echo Próximos pasos:
echo.
echo 1. Edita .env con tu configuración (puerto DMX, Redis, etc.)
echo 2. Inicia Redis: redis-server
echo 3. Inicia LuxSync: npm run dev
echo.
echo Documentación: docs\LUXSYNC-MASTER-PLAN.md
echo.
pause
