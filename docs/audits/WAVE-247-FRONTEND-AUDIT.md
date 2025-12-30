# 🔌 WAVE 247: OPERATION NERVE MAPPING - FRONTEND AUDIT

**Fecha:** Enero 2025  
**Operación:** Auditoría de conexiones Frontend (V1 React) ↔ Backend (TITAN 2.0)  
**Objetivo:** Mapear cables rotos ANTES de soldar  

---

## 📋 RESUMEN EJECUTIVO

### 🚨 DESCUBRIMIENTO CRÍTICO: DOS PROTOCOLOS INCOMPATIBLES

El sistema tiene **DOS archivos SeleneProtocol.ts** con interfaces completamente diferentes:

| Archivo | Protocolo | Interfaz Principal | Líneas |
|---------|-----------|-------------------|--------|
| `src/core/protocol/SeleneProtocol.ts` | **TITAN 2.0** | `SeleneTruth` | 263 |
| `src/types/SeleneProtocol.ts` | **V1 Legacy** | `SeleneBroadcast` | 743 |

**El Frontend usa V1 (SeleneBroadcast). El Backend ahora usa TITAN 2.0 (SeleneTruth).**

Estas interfaces son **INCOMPATIBLES** - no hay mapeo posible sin migración.

---

## 🧩 MAPA DE CONEXIONES

### 1. VERDAD (Truth) - **ROTO** 🔴

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CABLE VERDAD (selene:truth)                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  PRELOAD.TS                                                         │
│  ────────────                                                       │
│  onTruthUpdate → ipcRenderer.on('selene:truth', callback)           │
│  Escucha: selene:truth                                              │
│  Tipo esperado: any (pero truthStore espera SeleneBroadcast)        │
│                                                                     │
│  TRUTHSTORE.TS (Frontend Zustand)                                   │
│  ────────────────────────────────                                   │
│  import { SeleneBroadcast } from '../types/SeleneProtocol'  ❌ V1   │
│                                                                     │
│  interface TruthState {                                             │
│    truth: SeleneBroadcast  ← INCOMPATIBLE con SeleneTruth           │
│  }                                                                  │
│                                                                     │
│  Selectores que FALLARÁN:                                           │
│  - selectAudio: truth.sensory.audio ← NO EXISTE en SeleneTruth      │
│  - selectBeat: truth.sensory.beat ← NO EXISTE                       │
│  - selectPalette: truth.visualDecision.palette ← NO EXISTE          │
│  - selectGenre: truth.musicalDNA.genre ← NO EXISTE                  │
│  - selectSection: truth.musicalDNA.section ← NO EXISTE              │
│  - selectRhythm: truth.musicalDNA.rhythm ← NO EXISTE                │
│  - selectMovement: truth.visualDecision.movement ← NO EXISTE        │
│                                                                     │
│  BACKEND (main.ts → TitanOrchestrator)                              │
│  ─────────────────────────────────────                              │
│  Envía: SeleneTruth (estructura completamente diferente)            │
│                                                                     │
│  SeleneTruth = {                                                    │
│    context: MusicalContext     ← NO sensory.audio                   │
│    intent: LightingIntent      ← NO visualDecision                  │
│    hardware: { ... }                                                │
│    audio: { ... }              ← Diferente estructura               │
│    system: { mode, vibe, ... }                                      │
│  }                                                                  │
│                                                                     │
│  VEREDICTO: 🔴 CABLE CORTOCIRCUITADO                                │
│  El frontend recibirá datos pero los selectores fallarán            │
│  silenciosamente (undefined en cadena)                              │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 2. AUDIO - **PARCIALMENTE ROTO** 🟡

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CABLES AUDIO                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  useAudioCapture.ts (Frontend)                                      │
│  ──────────────────────────────                                     │
│  Envía RAW BUFFER:                                                  │
│    window.lux.audioBuffer(Float32Array)                             │
│    → ipcRenderer.invoke('lux:audio-buffer', buffer)                 │
│                                                                     │
│  Envía METRICS:                                                     │
│    window.lux.audioFrame({ bass, mid, treble, energy, bpm, fftBins })│
│    → ipcRenderer.invoke('lux:audio-frame', metrics)                 │
│                                                                     │
│  PRELOAD.TS                                                         │
│  ──────────                                                         │
│  audioBuffer: ipcRenderer.invoke('lux:audio-buffer', ...)   ✅      │
│  audioFrame: ipcRenderer.invoke('lux:audio-frame', ...)     ✅      │
│                                                                     │
│  IPCHandlers.ts V2 (Backend)                                        │
│  ─────────────────────────────                                      │
│  ipcMain.handle('lux:audioFrame', ...) → selene.processAudioFrame() │
│                                                                     │
│  PROBLEMA: Handler es 'lux:audioFrame' pero preload envía           │
│  'lux:audio-frame' (con guión) - POSIBLE MISMATCH                   │
│                                                                     │
│  Handler 'lux:audio-buffer' → ¿EXISTE? Buscar en código...          │
│                                                                     │
│  VEREDICTO: 🟡 REVISAR NAMING (guiones vs camelCase)                │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 3. MODE SWITCHER - **ROTO** 🔴

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CABLE MODE                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ModeSwitcher.tsx (Frontend)                                        │
│  ─────────────────────────────                                      │
│  Llama: window.lux.setMode(mode)                                    │
│                                                                     │
│  PRELOAD.TS                                                         │
│  ──────────                                                         │
│  setMode: ipcRenderer.invoke('selene:setMode', mode)                │
│                                                                     │
│  IPCHandlers.ts V2 (Backend)                                        │
│  ─────────────────────────────                                      │
│  ipcMain.handle('lux:setMode', ...) ← DIFERENTE CANAL               │
│                                                                     │
│  PROBLEMA:                                                          │
│  - Preload envía a 'selene:setMode'                                 │
│  - Handler registrado es 'lux:setMode'                              │
│  - NO HAY HANDLER para 'selene:setMode'                             │
│                                                                     │
│  TAMBIÉN AFECTADO:                                                  │
│  - window.lux.getFullState() → lux:get-full-state                   │
│    Handler: ¿EXISTE? No visto en IPCHandlers V2                     │
│                                                                     │
│  VEREDICTO: 🔴 CABLE DESCONECTADO                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 4. VIBE SELECTOR - **ROTO** 🔴

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CABLE VIBE                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  useSeleneVibe.ts (Frontend)                                        │
│  ─────────────────────────────                                      │
│  Llama: window.lux.setVibe(vibeId)                                  │
│  Llama: window.lux.getVibe()                                        │
│  Escucha: window.lux.onVibeChange()                                 │
│                                                                     │
│  PRELOAD.TS                                                         │
│  ──────────                                                         │
│  setVibe: ipcRenderer.invoke('selene:setVibe', vibeId)              │
│  getVibe: ipcRenderer.invoke('selene:getVibe')                      │
│  onVibeChange: ipcRenderer.on('selene:vibe-changed', ...)           │
│                                                                     │
│  IPCHandlers.ts V2 (Backend)                                        │
│  ─────────────────────────────                                      │
│  ipcMain.handle('lux:setVibe', ...) ← DIFERENTE CANAL               │
│                                                                     │
│  PROBLEMA:                                                          │
│  - Preload envía a 'selene:setVibe'                                 │
│  - Handler registrado es 'lux:setVibe'                              │
│  - NO HAY HANDLER para 'selene:setVibe'                             │
│  - NO HAY HANDLER para 'selene:getVibe'                             │
│  - Backend NO EMITE 'selene:vibe-changed'                           │
│                                                                     │
│  VEREDICTO: 🔴 CABLE DESCONECTADO                                   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 5. STAGE 3D CANVAS - **DEPENDIENTE DE TRUTH** 🔴

```
┌─────────────────────────────────────────────────────────────────────┐
│                      CABLE FIXTURES (3D)                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Stage3DCanvas.tsx (Frontend)                                       │
│  ─────────────────────────────                                      │
│  const hardware = useTruthStore(selectHardware)                     │
│  const fixtures = hardware?.fixtures || []                          │
│                                                                     │
│  TRUTHSTORE.TS                                                      │
│  ─────────────                                                      │
│  selectHardware: (state) => state.truth.hardwareState               │
│                                                                     │
│  PROBLEMA:                                                          │
│  SeleneBroadcast.hardwareState vs SeleneTruth.hardware              │
│  - V1: truth.hardwareState.dmx.fixtures                             │
│  - TITAN: truth.hardware.fixtures                                   │
│                                                                     │
│  VEREDICTO: 🔴 DEPENDIENTE DE FIX #1 (TRUTH)                        │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 📊 TABLA RESUMEN DE CANALES IPC

### Canales que Frontend ENVÍA vs Handlers Backend TIENE

| Preload Envía | Handler Backend | Estado |
|---------------|-----------------|--------|
| `selene:setMode` | `lux:setMode` | 🔴 MISMATCH |
| `selene:setVibe` | `lux:setVibe` | 🔴 MISMATCH |
| `selene:getVibe` | ❌ NO EXISTE | 🔴 AUSENTE |
| `lux:audio-buffer` | ❌ NO EXISTE | 🔴 AUSENTE |
| `lux:audio-frame` | `lux:audioFrame` | 🟡 GUIÓN vs CAMEL |
| `lux:get-full-state` | ❌ NO EXISTE | 🔴 AUSENTE |
| `lux:set-palette` | ❌ NO EXISTE | 🔴 AUSENTE |
| `selene:force-mutate` | `lux:forceMutation` | 🔴 MISMATCH |
| `selene:reset-memory` | `lux:resetMemory` | 🔴 MISMATCH |
| `lux:set-input-gain` | `lux:setInputGain` | 🟡 GUIÓN vs CAMEL |

### Canales que Frontend ESCUCHA

| Preload Escucha | Backend Emite | Estado |
|-----------------|---------------|--------|
| `selene:truth` | ??? | 🟡 A VERIFICAR |
| `selene:mode-changed` | ??? | 🟡 A VERIFICAR |
| `selene:vibe-changed` | ??? | 🟡 A VERIFICAR |
| `lux:fixtures-loaded` | ✅ Si | 🟢 OK |
| `dmx:connected` | ✅ Si | 🟢 OK |
| `dmx:disconnected` | ✅ Si | 🟢 OK |

---

## 🏥 DIAGNÓSTICO

### Causa Raíz

1. **Dualidad de Protocolos**: Dos SeleneProtocol.ts con interfaces incompatibles
2. **Naming Inconsistente**: preload usa `selene:` prefix, IPCHandlers usa `lux:` prefix
3. **Guiones vs CamelCase**: `audio-frame` vs `audioFrame`
4. **Missing Handlers**: Varios handlers no fueron portados de main.ts.bak a IPCHandlers.ts

### Impacto

| Componente | Funcionalidad | Estado |
|------------|---------------|--------|
| Dashboard | Mode switching | ❌ No funciona |
| Dashboard | Vibe selection | ❌ No funciona |
| Stage3D | Fixture rendering | ❌ Datos incorrectos |
| Audio | Reactivity | 🟡 Parcialmente funciona |
| DMX | Connection | ✅ Funciona |
| Fixtures | Patching | ✅ Funciona |

---

## 🛠️ PLAN DE REPARACIÓN (NO IMPLEMENTAR AÚN)

### Opción A: Actualizar Preload (Mínimo Cambio)
Cambiar los canales en preload.ts para que coincidan con IPCHandlers.ts:
- `selene:setMode` → `lux:setMode`
- `selene:setVibe` → `lux:setVibe`
- etc.

**Ventaja**: Cambio pequeño, no rompe backend
**Desventaja**: No resuelve el problema de tipos (SeleneBroadcast vs SeleneTruth)

### Opción B: Migrar Frontend a TITAN Types
Actualizar truthStore.ts y todos los selectores para usar SeleneTruth:
- Cambiar import de `types/SeleneProtocol` a `core/protocol/SeleneProtocol`
- Reescribir todos los selectores para la nueva estructura

**Ventaja**: Coherencia completa V2
**Desventaja**: Cambio masivo en frontend, posibles regresiones

### Opción C: Crear Adapter Layer (Bridge)
Crear un adapter en TitanOrchestrator que transforme SeleneTruth → SeleneBroadcast
antes de emitir a frontend.

**Ventaja**: Backend clean, frontend unchanged
**Desventaja**: Código legacy perpetuo, performance overhead

---

## 📝 SIGUIENTE PASO

**WAVE 248: THE RECONNECTION**

Decisión requerida:
1. ¿Opción A, B, o C?
2. ¿Migración gradual o big bang?
3. ¿Eliminar `src/types/SeleneProtocol.ts` (V1)?

---

## 📁 ARCHIVOS INVOLUCRADOS

### Para Preload Fix (Opción A)
- `electron/preload.ts` - Cambiar nombres de canales

### Para Frontend Migration (Opción B)
- `src/types/SeleneProtocol.ts` - **ELIMINAR**
- `src/stores/truthStore.ts` - Reescribir con SeleneTruth
- `src/hooks/useSeleneTruth.ts` - Actualizar tipo
- `src/components/stage3d/Stage3DCanvas.tsx` - Actualizar selectores
- Todos los componentes que usan `useTruthStore`

### Para Adapter (Opción C)
- `src/core/orchestrator/TitanOrchestrator.ts` - Añadir transformación

---

**FIN DEL REPORTE - WAVE 247: OPERATION NERVE MAPPING**
