# 🔍 WAVE 1114: PATHFINDER & VISIBILITY

**Commit:** `dfcb8a3`  
**Status:** ✅ COMPLETE  
**Date:** 2025-02-XX  
**Doctrine:** *"Ver es Diagnosticar. Diagnosticar es Resolver."*

---

## 📋 DIRECTIVA ORIGINAL

> **Problema:** Library solo carga fixtures de usuario. System fixtures invisible. Live Probe invisible.

### 3 CORRECCIONES

1. **Backend: The Library Pathfinder** - Multi-path search + verbose logging
2. **Frontend: Force Probe Visibility** - Siempre visible, con indicador de estado
3. **UI Feedback: Warning Banner** - Alerta cuando system library está vacía

---

## 🏗️ CAMBIOS IMPLEMENTADOS

### 1. Backend: THE PATHFINDER (`main.ts`)

**ANTES (hardcoded path):**
```typescript
const factoryLibraryPath = isDev 
  ? path.join(__dirname, '../../librerias')  // Dev - BROKEN!
  : path.join(app.getPath('userData'), 'librerias')
```

**DESPUÉS (multi-path search):**
```typescript
const candidatePaths = [
  path.join(process.cwd(), 'librerias'),           // Legacy Prod/Dev
  path.join(process.cwd(), 'resources/librerias'), // Electron Packaged
  path.join(__dirname, '../../librerias'),         // Dev fallback
  path.join(__dirname, '../../../librerias'),      // Another fallback
  path.join(app.getPath('userData'), 'librerias'), // Prod userData
]

for (const candidate of candidatePaths) {
  console.log(`[Library] 🔍 Checking: ${candidate}`)
  if (fs.existsSync(candidate)) {
    const files = fs.readdirSync(candidate).filter(f => 
      f.endsWith('.fxt') || f.endsWith('.json')
    )
    if (files.length > 0) {
      console.log(`[Library] ✅ Found ${files.length} fixture files at: ${candidate}`)
      factoryLibraryPath = candidate
      break
    }
  } else {
    console.log(`[Library] ❌ Not found: ${candidate}`)
  }
}
```

**Console Output Example:**
```
[Library] 🔍 WAVE 1114 PATHFINDER: Searching system library...
[Library] 🔍 Checking: C:\LuxSync\librerias
[Library] ❌ Not found: C:\LuxSync\librerias
[Library] 🔍 Checking: C:\LuxSync\resources/librerias
[Library] ❌ Not found: C:\LuxSync\resources/librerias
[Library] 🔍 Checking: C:\LuxSync\electron-app\dist-electron\..\..\librerias
[Library] ✅ Found 14 fixture files at: C:\LuxSync\electron-app\dist-electron\..\..\librerias
```

---

### 2. Frontend: FORCE PROBE VISIBILITY (`WheelSmithEmbedded.tsx`)

**ANTES:**
```tsx
{onTestDmx && (
  <div className="wheel-live-probe">...</div>
)}
```

**DESPUÉS:**
```tsx
{/* WAVE 1114: ALWAYS VISIBLE */}
<div className="wheel-live-probe">
  <div className="probe-header">
    <Zap size={16} />
    <span className="probe-title">LIVE PROBE</span>
    <span className="probe-subtitle">(Channel Output)</span>
    {/* DMX Status Indicator */}
    <span className={`probe-dmx-status ${dmxConnected ? 'connected' : 'offline'}`}>
      {dmxConnected ? '🟢' : '🔴'}
    </span>
  </div>
  {/* Controls... */}
  {!dmxConnected && (
    <div className="probe-offline-warning">
      ⚠️ DMX Offline - slider moves but won't output
    </div>
  )}
</div>
```

**CSS Changes:**
```css
.wheel-live-probe {
  position: relative;
  z-index: 100;
  background: #18181b;  /* Solid background - not transparent */
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.probe-dmx-status.connected {
  animation: pulse-connected 2s ease-in-out infinite;
}

.probe-offline-warning {
  background: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: #ef4444;
}
```

---

### 3. UI Feedback: WARNING BANNER (`LibraryTab.tsx`)

```tsx
{/* WAVE 1114: System Library Warning Banner */}
{!isLoading && systemCount === 0 && (
  <div className="library-warning">
    <AlertCircle size={14} />
    <span>
      ⚠️ System Library not found! Check backend console for path details.
      Expected locations: <code>librerias/</code>, <code>resources/librerias/</code>
    </span>
  </div>
)}
```

**Visual:**
```
┌────────────────────────────────────────────────────────┐
│ ⚠️ System Library not found! Check backend console     │
│    Expected: librerias/, resources/librerias/          │
└────────────────────────────────────────────────────────┘
```

---

## 📁 ARCHIVOS MODIFICADOS

| Archivo | Cambio | Líneas |
|---------|--------|--------|
| `electron/main.ts` | Multi-path search + verbose logging | +30 |
| `WheelSmithEmbedded.tsx` | Remove conditional, add status indicator | +20/-10 |
| `WheelSmithEmbedded.css` | z-index, solid bg, pulse animation | +35 |
| `LibraryTab.tsx` | Warning banner | +10 |
| `LibraryTab.css` | Warning banner styles | +25 |

**Total:** +120/-10 líneas

---

## 🔍 DIAGNÓSTICO VISUAL

### Si Library está vacía:

1. **Mirar consola del backend** (terminal donde corre Electron)
2. Buscar líneas `[Library] 🔍 Checking:` y `❌ Not found`
3. Verificar qué path SÍ existe con los fixtures

### Si Live Probe no hace nada:

1. Ver indicador en header: 🟢 = conectado, 🔴 = offline
2. Si 🔴: DMX driver no está conectado - verificar hardware
3. El slider SIEMPRE se mueve - el problema es la conexión

---

## 🎯 PRÓXIMOS PASOS

1. **Ejecutar la app** y verificar que:
   - Console backend muestra path encontrado
   - Library muestra System fixtures (o warning si no)
   - Live Probe siempre visible con indicador de estado

2. **Si sigue sin encontrar:**
   - Verificar que `/librerias` existe en la raíz del proyecto
   - Verificar que tiene archivos `.fxt` o `.json`

---

**🎸 WAVE 1114 COMPLETADA**

*"El ojo que no ve no puede corregir."*
— PunkOpus
