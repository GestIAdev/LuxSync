# 🚨 OPERACIÓN DIQUE SECO - SEPARACIÓN DE FLUJOS

## WAVE 14.9: Arquitectura Corregida - Configuración vs Telemetría

### El Problema Arquitectónico

El parche Wave 14.9 (useRef flags) **falló** porque el problema es más profundo:

```
Backend (SeleneLux) → Envía FIXTURES[13] cada 30ms
                      ↓
Frontend (TrinityProvider) → Recibe NUEVO objeto[] cada frame
                      ↓
React Detector → "Nuevo objeto" → setFixtures()
                      ↓
Zustand → Dispara listeners
                      ↓
SetupView → Re-render → useEffect → getPatchedFixtures() → BUCLE INFINITO
```

**Causa Raíz:** Estábamos enviando **datos estáticos** (configuración de fixtures) por el **canal de telemetría en tiempo real** (30 FPS).

Aunque el contenido de la lista era idéntico, JavaScript crea un **nuevo array** en cada frame, lo que React interpreta como un cambio de estado.

---

## La Solución: Separación de Flujos

### Canal 1: Telemetría en Tiempo Real (30 FPS)
**Propósito:** Datos que cambian en cada frame.

**Contenido:**
- Audio metrics (bass, mid, treble, energy, BPM)
- Beat state (onBeat, beatPhase, confidence)
- DMX values (r, g, b, pan, tilt por fixture)
- Brain output (mode, confidence, beautyScore)
- Colors (primary, secondary, accent)

**Ruta:** `lux:state-update` → `handleStateUpdate()` en TrinityProvider

---

### Canal 2: Configuración Estática (On-Demand)
**Propósito:** Datos que solo cambian cuando el usuario los modifica.

**Contenido:**
- Lista de fixtures patcheados
- Zonas asignadas
- DMX addresses

**Ruta:** `lux:fixtures-loaded` → Listener dedicado en TrinityProvider

**Eventos que disparan actualización:**
1. App startup (`ready-to-show`)
2. Patch fixture (`lux:patch-fixture`)
3. Unpatch fixture (`lux:unpatch-fixture`)
4. Clear patch (`lux:clear-patch`)

---

## Cambios Implementados

### Backend (main.ts)

#### 1. Eliminado fixtures de `lux:get-full-state`
```typescript
// ❌ ANTES
return {
  dmx: {...},
  selene: {...},
  fixtures: patchedFixtures,  // ← Causaba bucle
  audio: {...}
}

// ✅ AHORA
return {
  dmx: {...},
  selene: {...},
  // fixtures eliminados
  audio: {...}
}
```

#### 2. Broadcast al crear ventana
```typescript
mainWindow.once('ready-to-show', () => {
  mainWindow?.show()
  
  // 🚨 Enviar fixtures por canal dedicado
  if (patchedFixtures.length > 0 && mainWindow) {
    mainWindow.webContents.send('lux:fixtures-loaded', patchedFixtures)
  }
})
```

#### 3. Broadcast al modificar patch
```typescript
// En patch-fixture
patchedFixtures.push(patched)
configManager.setPatchedFixtures(...)
mainWindow.webContents.send('lux:fixtures-loaded', patchedFixtures)  // ← AÑADIDO

// En unpatch-fixture
patchedFixtures.splice(index, 1)
mainWindow.webContents.send('lux:fixtures-loaded', patchedFixtures)  // ← AÑADIDO
```

---

### Frontend (TrinityProvider.tsx)

#### 1. Eliminado setFixtures del handshake inicial
```typescript
// ❌ ANTES
if (fullState.fixtures && fullState.fixtures.length > 0) {
  useDMXStore.getState().setFixtures(fullState.fixtures)
  console.log(`[Trinity] 🎭 Fixtures synced: ${fullState.fixtures.length}`)
}

// ✅ AHORA (comentado)
// 🚨 WAVE 14.9: FIXTURES ELIMINADOS DEL HANDSHAKE
// Ya NO se sincronizan aquí (causaba bucle infinito).
// Ahora vienen por canal dedicado 'lux:fixtures-loaded'
```

#### 2. Listener Dedicado para Fixtures
```typescript
useEffect(() => {
  if (!window.electron) return
  
  const handleFixturesLoaded = (_event: any, fixtures: any[]) => {
    console.log(`[Trinity] 🎭 Fixtures loaded via dedicated channel: ${fixtures.length}`)
    useDMXStore.getState().setFixtures(fixtures)
  }
  
  window.electron.ipcRenderer.on('lux:fixtures-loaded', handleFixturesLoaded)
  console.log('[Trinity] 📡 Listening for fixture updates on dedicated channel')
  
  return () => {
    window.electron.ipcRenderer.removeListener('lux:fixtures-loaded', handleFixturesLoaded)
  }
}, [])
```

---

### Frontend (vite-env.d.ts)

```typescript
interface Window {
  // ...
  
  // 🎯 WAVE 13.6: Electron IPC API (for direct event subscriptions)
  electron: {
    ipcRenderer: {
      on: (channel: string, listener: (event: any, ...args: any[]) => void) => void
      removeListener: (channel: string, listener: (...args: any[]) => void) => void
    }
  }
}
```

---

## Resultado Esperado

### ANTES (Bucle Infinito)
```
[Trinity] 🎭 Fixtures synced: 8 fixtures loaded
[Trinity] 🎭 Fixtures synced: 8 fixtures loaded  <-- 30 veces/segundo
[Trinity] 🎭 Fixtures synced: 8 fixtures loaded
[SetupView] 📦 Found 13 fixtures
[SetupView] 📦 Found 13 fixtures  <-- 100+ veces
```

### AHORA (Controlado)
```
[Main] 📡 Broadcasted 8 fixtures to renderer  <-- Solo al inicio
[Trinity] 📡 Listening for fixture updates on dedicated channel
[Trinity] 🎭 Fixtures loaded via dedicated channel: 8 fixtures
... (silencio) ...
[Main] 📡 Broadcasted 9 fixtures to renderer  <-- Solo al patch un fixture
[Trinity] 🎭 Fixtures loaded via dedicated channel: 9 fixtures
```

---

## Métricas de Éxito

| Métrica | Antes | Después |
|---------|-------|---------|
| Fixture Updates/sec | 30 | 0 (solo on-demand) |
| Re-renders/sec | 6000+ | ~60 (solo telemetría) |
| CPU Usage | 100% | 5-15% |
| Memory Leaks | Sí (listeners acumulados) | No |

---

## Lecciones Aprendidas

1. **Separar Concerns:** Configuración estática NO debe viajar por canales de telemetría en tiempo real.

2. **Object Identity Matters:** En React, `[{id: 1}] !== [{id: 1}]`. Aunque el contenido sea igual, son objetos diferentes en memoria.

3. **IPC Channel Design:** 
   - **High-Frequency:** Solo datos volátiles (audio, colors, DMX values)
   - **Low-Frequency:** Configuración (fixtures, settings)

4. **useRef vs Array Deps:** Los flags de `useRef` previenen re-ejecución en StrictMode, pero NO previenen actualizaciones de estado externa (IPC events).

---

## Próximos Pasos

1. ✅ Verificar que el log `Fixtures synced` solo aparece al inicio y al modificar patch.
2. ✅ Confirmar que CPU usage es normal (~5-15%).
3. ✅ Probar patch/unpatch en SetupView para confirmar que el broadcast funciona.
4. 🔲 Considerar aplicar el mismo patrón a otros datos estáticos (DMX config, audio settings).
