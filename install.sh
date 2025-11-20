#!/bin/bash
# 🎸⚡ LUXSYNC - INSTALADOR LINUX/MAC

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║                 🎸⚡ LUXSYNC INSTALLER                        ║"
echo "║          Sistema de Sincronización Música-Luz DMX            ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# Verificar Node.js
echo "[1/5] Verificando Node.js..."
if ! command -v node &> /dev/null; then
    echo "❌ ERROR: Node.js no encontrado"
    echo ""
    echo "Por favor instala Node.js 20+ desde: https://nodejs.org/"
    exit 1
fi
echo "✅ Node.js detectado: $(node --version)"
echo ""

# Verificar npm
echo "[2/5] Verificando npm..."
if ! command -v npm &> /dev/null; then
    echo "❌ ERROR: npm no encontrado"
    exit 1
fi
echo "✅ npm detectado: $(npm --version)"
echo ""

# Instalar dependencias
echo "[3/5] Instalando dependencias..."
echo "Esto puede tardar unos minutos..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ ERROR: Falló instalación de dependencias"
    exit 1
fi
echo "✅ Dependencias instaladas"
echo ""

# Crear .env
echo "[4/5] Configurando entorno..."
if [ ! -f .env ]; then
    cp .env.example .env
    echo "✅ Archivo .env creado"
else
    echo "⚠️  Archivo .env ya existe (no se sobrescribe)"
fi
echo ""

# Build
echo "[5/5] Compilando TypeScript..."
npm run build
if [ $? -ne 0 ]; then
    echo "⚠️  Advertencia: Falló compilación (ejecuta 'npm run dev' para modo desarrollo)"
else
    echo "✅ Compilación exitosa"
fi
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "✅ INSTALACIÓN COMPLETA"
echo "═══════════════════════════════════════════════════════════════"
echo ""
echo "Próximos pasos:"
echo ""
echo "1. Edita .env con tu configuración (puerto DMX, Redis, etc.)"
echo "2. Inicia Redis: redis-server"
echo "3. Inicia LuxSync: npm run dev"
echo ""
echo "Documentación: docs/LUXSYNC-MASTER-PLAN.md"
echo ""
