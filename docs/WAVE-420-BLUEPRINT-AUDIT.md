# WAVE 420: ARCHITECTURE BLUEPRINT AUDIT & RECOVERY ROADMAP

**Date:** 2026-01-14  
**Status:** 🔍 AUDITORÍA COMPLETA  
**Requested by:** Radwulf (El Arquitecto necesita memoria)  
**Audited by:** PunkOpus (El Ejecutor)

---

## 📋 EXECUTIVE SUMMARY

Radwulf, aquí tienes el informe forense de WAVE 371.

### Estado de las Fases Originales

| Fase | Wave | Descripción | Estado | Completitud |
|------|------|-------------|--------|-------------|
| **Phase 1** | 372-376 | MasterArbiter Foundation | ✅ **COMPLETA** | 100% |
| **Phase 2** | 373/377 | Calibration System | 🟡 **PARCIAL** | ~40% |
| **Phase 3** | 374 | Logging Cleanup | ❌ **NO IMPLEMENTADO** | 0% |
| **Phase 4** | 375 | Mode Simplification | ❌ **NO IMPLEMENTADO** | 0% |

---

## 🔬 PHASE 1: MASTER ARBITER FOUNDATION

### ✅ STATUS: COMPLETA (100%)

**Locación:** `electron-app/src/core/arbiter/`

```
arbiter/
├── MasterArbiter.ts        ← 1301 líneas, BEAST MODE
├── CrossfadeEngine.ts      ← Smooth transitions
├── ArbiterIPCHandlers.ts   ← IPC bridge
├── types.ts                ← Type definitions
├── index.ts                ← Exports
├── layers/                 ← Layer implementations
├── merge/                  ← Merge strategies (HTP/LTP)
└── __tests__/              ← Tests
```

### Lo que SÍ existe y FUNCIONA:

**1. Arquitectura de Layers (WAVE 373)**
```typescript
// MasterArbiter.ts línea 17-24
LAYER PRIORITY (highest wins):
- Layer 4: BLACKOUT (emergency, always wins)
- Layer 3: EFFECTS (strobe, flash, etc.)
- Layer 2: MANUAL (user overrides)
- Layer 1: CONSCIOUSNESS (CORE 3 - SeleneLuxConscious)
- Layer 0: TITAN_AI (base from TitanEngine)
```

**2. Crossfade Engine (WAVE 373)**
- Smooth transitions on override release ✅
- Configurable duration per channel type ✅

**3. Manual Override System (WAVE 374)**
- Per-fixture override ✅
- Per-channel granularity ✅
- Auto-release timer ✅
- Release transition ✅

**4. Pattern Engine (WAVE 376)**
```typescript
// MasterArbiter.ts línea 821-851
calculatePatternOffset(pattern, now): { panOffset, tiltOffset }
- 'circle': Circular movement ✅
- 'eight': Figure-8 pattern ✅
- 'sweep': Horizontal sweep ✅
```

**5. Group Formations (WAVE 376)**
- Center of gravity calculation ✅
- Fan multiplier for spacing ✅
- Offset calculation ✅

**6. Grand Master (WAVE 376)**
- Global dimmer multiplier ✅
- 0-1 range, affects all fixtures ✅

**7. Blackout Layer (WAVE 374)**
- Emergency all-off ✅
- Toggle and force methods ✅

### Registro en Main:
```typescript
// main.ts línea 26
import { registerArbiterHandlers, masterArbiter } from '../src/core/arbiter'

// main.ts línea 368
registerArbiterHandlers(masterArbiter)
```

### VEREDICTO PHASE 1: 🎉 **MISIÓN CUMPLIDA**

El Arbiter es el corazón de la reactividad musical actual. La arquitectura limpia elimina parpadeos porque hay UNA SOLA fuente de verdad para cada fixture.

---

## 🔬 PHASE 2: CALIBRATION SYSTEM

### 🟡 STATUS: PARCIAL (~40%)

**Lo que SÍ existe:**

**1. IPC Handlers para Calibration Mode (WAVE 377)**
```typescript
// ArbiterIPCHandlers.ts líneas 264-320
ipcMain.handle('lux:arbiter:enterCalibrationMode', ...)
ipcMain.handle('lux:arbiter:exitCalibrationMode', ...)
ipcMain.handle('lux:arbiter:isCalibrating', ...)
```

**2. UI Component: PositionSection.tsx (WAVE 377)**
```typescript
// PositionSection.tsx líneas 42, 173-206
const [isCalibrating, setIsCalibrating] = useState(false)
const handleCalibrationToggle = useCallback(async () => { ... })
// Botón 🎯 para enter/exit calibration mode
```

**3. Preload Bridge**
```typescript
// preload.ts líneas 574-582
enterCalibrationMode: (fixtureId: string) => ...
exitCalibrationMode: (fixtureId: string) => ...
```

**4. Offset Calculation en MasterArbiter**
```typescript
// MasterArbiter.ts líneas 562-575
offsets: Map<string, { panOffset: number; tiltOffset: number }>
const panOffset = currentPan - center.pan
const tiltOffset = currentTilt - center.tilt
offsets.set(fixtureId, { panOffset, tiltOffset })
```

### Lo que FALTA:

| Item | Status | Descripción |
|------|--------|-------------|
| `calibration` field en ShowFileV2 | ❌ | No persiste offsets al archivo de show |
| Calibration Mode global | ❌ | Solo afecta fixture individual, no modo global |
| UI de ajuste de offsets | ❌ | No hay sliders Pan/Tilt Offset dedicados |
| Offset application en HAL | 🟡 | Calculado pero no aplicado consistentemente |
| Test Pattern durante calibración | ❌ | No hay "pan sweep" o "home position" visual |

### Problema Actual:
```
User enters calibration → Manual override set → User adjusts position → 
User exits calibration → Override released → Offset LOST! (no persistence)
```

### VEREDICTO PHASE 2: 🟡 **SCAFFOLD EXISTE, FALTA PERSISTENCIA**

---

## 🔬 PHASE 3: LOGGING CLEANUP

### ❌ STATUS: NO IMPLEMENTADO (0%)

**Evidencia:**
```bash
grep -r "LogLevel|logger\." → Solo matches en blueprint WAVE-371
file_search "**/Logger.ts" → No files found
```

**Estado Actual del Logging:**

Conteo de `console.log` en archivos críticos:
- `MasterArbiter.ts`: 14+ calls
- `TitanOrchestrator.ts`: ~20 calls
- `HAL`: Spam de física cada frame
- `ALPHA/BETA/GAMMA workers`: Ruido continuo

**Lo que se propuso pero NO existe:**

```typescript
// PROPUESTO en WAVE-371 (NO IMPLEMENTADO):
// src/core/logging/Logger.ts

export enum LogLevel {
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,  // Frame-by-frame spam
}

class Logger {
  private config: LogConfig
  info(module: string, message: string, data?: object): void
  // etc.
}

export const logger = new Logger()
```

### Consecuencias Actuales:
- Consola saturada en desarrollo
- No hay forma de silenciar módulos específicos
- Heartbeat spam dificulta debugging
- No hay niveles configurables por módulo

### VEREDICTO PHASE 3: ❌ **TODO PENDIENTE**

---

## 🔬 PHASE 4: MODE SIMPLIFICATION

### ❌ STATUS: NO IMPLEMENTADO (0%)

**Estado Actual de los Modos:**

```typescript
// FRONTEND (3 sistemas diferentes):

// controlStore.ts línea 30
export type GlobalMode = 'manual' | 'flow' | 'selene' | null

// seleneStore.ts línea 13
export type SeleneMode = 'flow' | 'selene' | 'locked'

// ModeSwitcher.tsx línea 13
type SeleneMode = 'flow' | 'selene' | 'locked'
```

**Confusión de Terminología:**

| UI Component | Usa | Tipo |
|--------------|-----|------|
| ModeSwitcher.tsx | `flow/selene/locked` | SeleneMode |
| StageViewDual.tsx | `manual/flow/selene/null` | GlobalMode |
| controlStore | `manual/flow/selene/null` | GlobalMode |
| seleneStore | `flow/selene/locked` | SeleneMode |

### Lo que se propuso pero NO existe:

```typescript
// PROPUESTO en WAVE-371 (NO IMPLEMENTADO):
type SystemMode = 
  | 'selene'     // AI fully controls
  | 'calibrate'  // Movement frozen, user adjusts
  | 'manual'     // User controls everything
  | 'blackout'   // Emergency - all off

// UI simplificado a 3 modos:
🧠 SELENE | 🎛️ CALIBRATE | 🔒 MANUAL
```

### Consecuencias Actuales:
- `flow` y `selene` ejecutan **código idéntico** (ambos `useBrain = true`)
- Usuario confundido: "¿Cuál elijo?"
- Duplicación de tipos entre stores
- No hay modo `calibrate` como modo global

### VEREDICTO PHASE 4: ❌ **TODO PENDIENTE**

---

## 🗺️ RECOVERY ROADMAP

### Prioridades Recomendadas

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ORDEN DE IMPLEMENTACIÓN RECOMENDADO                                         │
└─────────────────────────────────────────────────────────────────────────────┘

  BLOQUEANTE (Crashes)
       │
       ▼
  ┌─────────────────┐
  │ WAVE 420.1      │  ← Ya hecho: Hook Violation Fix (TheProgrammer)
  │ Hook Fixes      │     + Anti-Nuke Normalization (StageSimulator2)
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ WAVE 420.2      │  ← PRÓXIMO: Logging Cleanup
  │ Logger System   │     Elimina spam, permite debugging limpio
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ WAVE 420.3      │  ← Mode Unification
  │ Mode Simplify   │     Kill 'flow', unify types
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │ WAVE 420.4      │  ← Calibration Complete
  │ Full Calibration│     Persistence + UI + HAL integration
  └─────────────────┘
```

---

## 🛠️ WAVE 420.2: LOGGER SYSTEM (PROPUESTA)

### Especificación

**Archivo:** `src/core/logging/Logger.ts`

```typescript
export enum LogLevel {
  SILENT = -1,  // Production mode
  ERROR = 0,
  WARN = 1,
  INFO = 2,
  DEBUG = 3,
  TRACE = 4,    // Frame-by-frame (off by default)
}

export interface LogConfig {
  globalLevel: LogLevel
  modules: Record<string, LogLevel>
  timestamps: boolean
  colors: boolean
}

class Logger {
  private config: LogConfig = {
    globalLevel: LogLevel.INFO,
    modules: {
      'MasterArbiter': LogLevel.INFO,
      'HAL': LogLevel.WARN,          // Silence physics spam
      'Titan': LogLevel.INFO,        // No heartbeat in prod
      'ALPHA': LogLevel.WARN,
      'BETA': LogLevel.WARN,
      'GAMMA': LogLevel.WARN,
    },
    timestamps: true,
    colors: true,
  }

  log(level: LogLevel, module: string, message: string, data?: any): void {
    const moduleLevel = this.config.modules[module] ?? this.config.globalLevel
    if (level > moduleLevel) return  // Skip if below threshold
    
    const prefix = this.formatPrefix(level, module)
    if (data) {
      console.log(prefix, message, data)
    } else {
      console.log(prefix, message)
    }
  }

  error(module: string, message: string, data?: any): void {
    this.log(LogLevel.ERROR, module, `❌ ${message}`, data)
  }
  
  warn(module: string, message: string, data?: any): void {
    this.log(LogLevel.WARN, module, `⚠️ ${message}`, data)
  }
  
  info(module: string, message: string, data?: any): void {
    this.log(LogLevel.INFO, module, message, data)
  }
  
  debug(module: string, message: string, data?: any): void {
    this.log(LogLevel.DEBUG, module, `🔍 ${message}`, data)
  }
  
  trace(module: string, message: string, data?: any): void {
    this.log(LogLevel.TRACE, module, `📍 ${message}`, data)
  }

  // Configuration
  setLevel(level: LogLevel): void { ... }
  setModuleLevel(module: string, level: LogLevel): void { ... }
}

export const logger = new Logger()
```

### Migración Ejemplo

```typescript
// ANTES:
console.log(`[MasterArbiter] Manual override: ${override.fixtureId}`, override.overrideChannels)

// DESPUÉS:
logger.info('MasterArbiter', `Manual override: ${override.fixtureId}`, override.overrideChannels)

// ANTES (spam):
console.log(`[HAL] Phase offset applied: ${pan}, ${tilt}`)

// DESPUÉS:
logger.trace('HAL', 'Phase offset applied', { pan, tilt })  // Solo visible si TRACE enabled
```

### Archivos a Migrar

| Archivo | console.log count | Prioridad |
|---------|-------------------|-----------|
| MasterArbiter.ts | 14 | ALTA |
| TitanOrchestrator.ts | ~20 | ALTA |
| HardwareAbstraction.ts | ~15 | MEDIA |
| TrinityBrain workers | ~30 | BAJA |

---

## 🛠️ WAVE 420.3: MODE SIMPLIFICATION (PROPUESTA)

### El Problema

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CAOS ACTUAL DE MODOS                                                        │
└─────────────────────────────────────────────────────────────────────────────┘

  controlStore.ts          seleneStore.ts           ModeSwitcher.tsx
  ─────────────────        ─────────────────        ─────────────────
  GlobalMode:              SeleneMode:              type SeleneMode:
  • manual                 • flow                   • flow
  • flow     ─────────────►• selene ◄───────────────• selene
  • selene                 • locked                 • locked
  • null (idle)

  3 TIPOS DIFERENTES, NOMBRES INCONSISTENTES, CÓDIGO DUPLICADO
```

### La Solución

**1. Unificar en UN solo tipo:**

```typescript
// src/types/system.ts (NUEVO ARCHIVO CENTRAL)

/**
 * System Control Mode - THE ONLY SOURCE OF TRUTH
 * 
 * Elimina: GlobalMode, SeleneMode duplicados
 */
export type SystemMode = 
  | 'selene'     // AI fully controls (combines old 'flow' + 'selene')
  | 'manual'     // User controls everything (was 'locked')
  | 'calibrate'  // Movement frozen, offsets adjustable
  | 'blackout'   // Emergency - all off (new)

// No más 'flow' - era idéntico a 'selene' en código
// No más 'locked' - renombrado a 'manual' (más claro)
// No más 'null' - ahora es 'blackout' explícito
```

**2. UI Simplificado:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  NUEVO MODE SWITCHER (3 botones + 1 emergency)                               │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
  │                 │    │                 │    │                 │
  │    🧠 SELENE    │    │  🎛️ CALIBRATE   │    │  🔒 MANUAL      │
  │                 │    │                 │    │                 │
  │  AI Reactive    │    │  Adjust Offsets │    │  Full Control   │
  │  Music → Light  │    │  Test Patterns  │    │  No AI          │
  │                 │    │                 │    │                 │
  └─────────────────┘    └─────────────────┘    └─────────────────┘

  [🚨 BLACKOUT] ← Emergency button, always visible
```

**3. Migration Path:**

```typescript
// Mapeo de migración:
'flow'   → 'selene'   // Flow era placebo, mismo código
'selene' → 'selene'   // Mantiene
'locked' → 'manual'   // Renombre semántico
null     → 'blackout' // Explícito en vez de ambiguo
```

---

## 🛠️ WAVE 420.4: CALIBRATION COMPLETE (PROPUESTA)

### Lo que falta

**1. Persistencia en ShowFile:**

```typescript
// src/stage/ShowFileV2.ts (MODIFICAR)

interface FixtureDefinition {
  id: string
  name: string
  type: string
  // ... existing fields ...
  
  // 🆕 WAVE 420.4: Calibration offsets
  calibration?: {
    panOffset: number    // -180 to +180 degrees
    tiltOffset: number   // -90 to +90 degrees
    homePosition?: {     // "Home" reference point
      pan: number
      tilt: number
    }
    invertPan?: boolean
    invertTilt?: boolean
    lastCalibrated?: number  // Timestamp
  }
}
```

**2. Calibration Mode Global:**

```typescript
// MasterArbiter.ts (AÑADIR)

private calibrationMode: boolean = false
private calibratingFixtures: Set<string> = new Set()

enterGlobalCalibrationMode(): void {
  this.calibrationMode = true
  // Freeze all movement, but allow manual adjustment
  for (const fixture of this.fixtures.values()) {
    if (fixture.hasMovementChannels) {
      this.calibratingFixtures.add(fixture.id)
    }
  }
  this.emit('calibration-mode', true)
}

exitGlobalCalibrationMode(): void {
  this.calibrationMode = false
  this.calibratingFixtures.clear()
  this.emit('calibration-mode', false)
}
```

**3. UI Components Faltantes:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  CALIBRATION PANEL (nuevo componente)                                        │
└─────────────────────────────────────────────────────────────────────────────┘

  ┌─────────────────────────────────────────────────────────────────┐
  │ 🎯 CALIBRATION MODE - Moving Head #1 (Beam 2R)                  │
  ├─────────────────────────────────────────────────────────────────┤
  │                                                                 │
  │  Pan Offset:  [-30°]═══════●═══════════[+30°]  = +12°          │
  │  Tilt Offset: [-30°]════●══════════════[+30°]  = -8°           │
  │                                                                 │
  │  Home Position: Pan 127° | Tilt 90°                            │
  │                                                                 │
  │  ☑ Invert Pan    ☑ Invert Tilt                                 │
  │                                                                 │
  │  [GO HOME]  [SWEEP TEST]  [SAVE]  [CANCEL]                     │
  │                                                                 │
  └─────────────────────────────────────────────────────────────────┘
```

**4. HAL Offset Application:**

```typescript
// HardwareAbstraction.ts (MODIFICAR)

applyCalibrationOffsets(fixtureId: string, pan: number, tilt: number): { pan: number, tilt: number } {
  const calibration = this.getCalibration(fixtureId)
  if (!calibration) return { pan, tilt }
  
  let adjustedPan = pan + (calibration.panOffset * 65535 / 360)  // Convert degrees to DMX16
  let adjustedTilt = tilt + (calibration.tiltOffset * 65535 / 270)
  
  if (calibration.invertPan) adjustedPan = 65535 - adjustedPan
  if (calibration.invertTilt) adjustedTilt = 65535 - adjustedTilt
  
  return {
    pan: Math.max(0, Math.min(65535, adjustedPan)),
    tilt: Math.max(0, Math.min(65535, adjustedTilt)),
  }
}
```

---

## 📊 RESUMEN EJECUTIVO PARA EL ARQUITECTO

### ✅ Lo que YA FUNCIONA (no tocar):

1. **MasterArbiter** - Corazón del sistema, 1301 líneas de código sólido
2. **Layer Priority System** - Blackout > Effects > Manual > Consciousness > Titan
3. **CrossfadeEngine** - Transitions suaves
4. **Pattern Engine** - Circle, Eight, Sweep
5. **Manual Override per-channel** - Granularidad completa
6. **IPC Bridge** - Frontend ↔ Backend comunicación

### 🟡 Lo que está A MEDIAS:

1. **Calibration** - Tiene enter/exit mode, pero no persiste offsets ni tiene UI completa

### ❌ Lo que FALTA:

1. **Logger System** - Spam incontrolable, sin niveles
2. **Mode Unification** - 3 tipos diferentes (GlobalMode, SeleneMode local, etc.)
3. **Calibration Persistence** - Offsets se pierden al salir
4. **Calibration UI** - Solo botón 🎯, faltan sliders y test patterns

### 🎯 Próximos Pasos Recomendados:

```
WAVE 420.2 → Logger System (2-3 horas)
WAVE 420.3 → Mode Simplification (3-4 horas)
WAVE 420.4 → Calibration Complete (4-6 horas)
```

---

**WAVE 420 AUDIT Status:** ✅ COMPLETA

*"El Arquitecto ya tiene su inyección de memoria. Ahora a ejecutar."* 🔧

---

## ANEXO: Archivos Clave para Referencia

| Archivo | Líneas | Propósito |
|---------|--------|-----------|
| `src/core/arbiter/MasterArbiter.ts` | 1301 | Central control hierarchy |
| `src/core/arbiter/ArbiterIPCHandlers.ts` | 373 | IPC bridge |
| `src/core/arbiter/CrossfadeEngine.ts` | ~200 | Smooth transitions |
| `src/stores/controlStore.ts` | 333 | Frontend GlobalMode |
| `src/stores/seleneStore.ts` | 353 | Frontend SeleneMode |
| `src/components/programmer/PositionSection.tsx` | 276 | Calibration UI (parcial) |
| `src/components/ModeSwitcher/ModeSwitcher.tsx` | 136 | Mode selector UI |
