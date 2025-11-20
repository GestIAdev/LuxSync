# 🚀 INICIO RÁPIDO - LUXSYNC DEMO

## ⚡ Un Solo Comando

```bash
# Windows - Doble click:
QUICK-START.bat
```

Esto hace:
1. ✅ Limpia puerto 3000
2. ✅ Inicia Vite dev server  
3. ✅ Abre navegador automáticamente

---

## 🔧 Si hay problemas con imports

### Paso 1: Compilar TypeScript
```bash
npm run build
```

### Paso 2: Limpiar caché de Vite
```bash
cd demo
rm -rf node_modules/.vite
```

### Paso 3: Reiniciar servidor
```bash
QUICK-START.bat
```

---

## 📝 Estructura de Imports

El código usa los archivos **compilados** en `dist/`:

```javascript
// demo/app.js usa:
import { AudioToMetricsAdapter } from '../dist/engines/selene/luxsync/AudioToMetricsAdapter.js';
import { NoteToColorMapper } from '../dist/engines/selene/luxsync/NoteToColorMapper.js';
import { SeleneLightBridge } from '../dist/engines/selene/luxsync/SeleneLightBridge.js';
import { SimulatorDriver } from '../dist/engines/selene/luxsync/drivers/SimulatorDriver.js';
```

**IMPORTANTE:** Si cambias código TypeScript en `src/`, debes recompilar:
```bash
npm run build
```

---

## 🎮 Una vez abierto el navegador:

1. **🎤 Click "Enable Microphone"** → Acepta permisos
2. **▶️ Click "Start Demo"** → Sistema activo
3. **🎵 Pon música** → ¡Disfruta!

---

## 🐛 Troubleshooting

### Error: "Cannot find module"
```bash
# Recompilar proyecto
npm run build

# Reinstalar dependencias demo
cd demo
npm install
cd ..
```

### Error: "Port 3000 already in use"
```bash
# Windows - Matar proceso:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# O usa QUICK-START.bat (lo hace automáticamente)
```

### Error: "Failed to resolve import"
```bash
# Limpiar cache
cd demo
rm -rf node_modules/.vite
cd ..

# Recompilar
npm run build

# Reiniciar
QUICK-START.bat
```

---

## ✅ Checklist Pre-Demo

- [ ] Node.js instalado (node --version)
- [ ] Dependencias instaladas (npm install)
- [ ] Proyecto compilado (npm run build)
- [ ] Demo deps instaladas (cd demo && npm install)
- [ ] Puerto 3000 libre
- [ ] Micrófono funcional
- [ ] Música lista para reproducir

---

**¡Listo para impresionar!** 🎉💡🎵
