# WAVE 7117 — LIVE CALIBRATION MODE BLUEPRINT
## Phase Canvas → DMX Direct Injection (Bypass Timeline)

---

## 1. ARQUITECTURA CONCEPTUAL

### 1.1 Visión General

Live Calibration es una **burbuja de aislamiento** que permite al operador editar curvas Bézier o PhaseConfig en el Phase Canvas y ver el resultado instantáneo en las luminarias físicas, sin necesidad de reproducir el timeline completo.

```
┌─────────────────────────────────────────────────────────────────┐
│ RENDERER (React)                                                │
│                                                                 │
│  Phase Canvas (mouse X → timeMs)                                │
│       │                                                         │
│       ▼                                                         │
│  HephEvaluationKernel.evaluateFixtureParams()                   │
│       │ (ya existe en useHephPreview.ts)                        │
│       ▼                                                         │
│  FixtureEvalResult[]  →  CalibrationSerializer                  │
│       │                                                         │
│       ▼                                                         │
│  IPC: 'chronos:calibration:inject'  (o SAB rápido)              │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ MAIN PROCESS                                                     │
│                                                                 │
│  CalibrationBus (nuevo campo en NodeArbiter)                    │
│       │                                                         │
│       ▼                                                         │
│  TickEngine hot-path:                                           │
│    1. SYNC_PAUSE → TimelineEngine.tick() no-op                  │
│    2. arbiter.setCalibrationIntents(intents) → L3+ injection    │
│    3. arbiter.arbitrate() → ArbitratedNodeMap                   │
│    4. HAL.renderFromTarget() → DMX físico                       │
│                                                                 │
│  Al desactivar:                                                  │
│    1. arbiter.clearCalibrationIntents()                         │
│    2. arbiter.purgeCalibrationResiduals()                       │
│    3. TimelineEngine.resume()                                   │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Toggle "LIVE CALIBRATION"

El toggle es un booleano en el store del Phase Canvas que:

- **ON:**
  1. Emite `IPC: 'chronos:calibration:enable'` → Main Process pausa el timeline
  2. Activa el rAF loop de evaluación local (reutiliza `useHephPreview` infrastructure)
  3. En cada frame, evalúa las curvas en el `timeMs` correspondiente a la posición del mouse
  4. Serializa los `FixtureEvalResult` y los envía vía IPC o SAB

- **OFF:**
  1. Emite `IPC: 'chronos:calibration:disable'` → Main Process limpia el bus y reanuda
  2. Detiene el rAF loop de calibración
  3. El timeline retoma el control desde su última posición

### 1.3 Inyección L3+ en NodeArbiter

Los intents de calibración se inyectan en la **misma capa L3+ que Hephaestus** (`'hephaestus'` layer), garantizando:

- **Dominancia sobre L0/L1/L2** vía `_l3DominatedChannels` (Escudo Anti-Sangrado WAVE 4829)
- **LTP con otros intents L3+** — el último en escribir gana
- **No interactúa con MANUAL HARD LOCK** — el operador sigue teniendo autoridad final

**Nuevo campo en `NodeArbiter`:**

```typescript
/** Calibration intents (L3+ — same layer as Hephaestus, LTP) */
private _calibrationIntents: readonly INodeIntent[] = []

setCalibrationIntents(intents: readonly INodeIntent[]): void {
  this._calibrationIntents = intents
}

clearCalibrationIntents(): void {
  this._calibrationIntents = []
}
```

**Modificación en `arbitrate()`:** después del bloque de `_hephaestusIntents` (línea ~714):

```typescript
// L3+: Calibration intents (Live Calibration Mode — bypass timeline)
for (let i = 0; i < this._calibrationIntents.length; i++) {
  this._applyIntent(this._calibrationIntents[i], 'hephaestus')
}
```

**Modificación en `_primeL3DominancePrePass()`:** añadir loop sobre `_calibrationIntents` para registrar dominancia antes de L0/L1.

### 1.4 Bypass de Aduana (outputDMX)

El `TickEngine` ya envía el `ArbitratedNodeMap` al HAL en cada frame. Cuando el modo calibración está activo:

- `TimelineEngine.tick()` se vuelve no-op (flag `_syncPaused = true`)
- El `TickEngine` sigue ejecutando su hot-path a 44Hz, pero las únicas intents que llegan al Arbiter son las de calibración (L0/Selene/Chronos producen arrays vacíos o no-op cuando el timeline está pausado)
- El HAL procesa el `ArbitratedNodeMap` y envía DMX a los fixtures — **sin secuencia, sin clips**

**No se necesita un flag `outputDMX` separado** — el pipeline existente ya envía DMX cada frame. Solo necesitamos asegurar que las únicas intents activas sean las de calibración.

### 1.5 Aislamiento Total — SYNC_PAUSE

**Nuevo campo en `TimelineEngine`:**

```typescript
private _syncPaused = false

/** WAVE 7117: Pause timeline tick without unloading project */
syncPause(): void {
  this._syncPaused = true
  // Stop all active HephaestusRuntime instances (clear running clips)
  const hephRuntime = getHephaestusRuntime()
  for (const instanceId of this._activeHephInstances.values()) {
    hephRuntime.stop(instanceId)
  }
  this._activeHephInstances.clear()
  this.previousActiveIds.clear()
}

syncResume(): void {
  this._syncPaused = false
}
```

**Modificación en `tick()`:**

```typescript
tick(timeMs: number): void {
  if (!this.playing || !this.project) return
  if (this._syncPaused) return  // WAVE 7117: calibration bypass
  // ... resto del tick existente
}
```

**Al desactivar el toggle:**

```typescript
// 1. Limpiar bus de calibración
arbiter.clearCalibrationIntents()

// 2. Purgar residuales — forzar un frame con arrays vacíos
arbiter.setCalibrationIntents([])
arbiter.arbitrate()  // un frame de transición con L3+ vacío

// 3. Reanudar timeline
timelineEngine.syncResume()
```

---

## 2. FLUJO DE DATOS (ZERO-ALLOC)

### 2.1 Opción A: IPC Message (Recomendado para Phase 1)

**Razón:** Los intents de calibración son pocos (típicamente 1-50 fixtures × 1-8 nodos = 50-400 intents). El overhead de IPC estructurado es <1ms para este volumen. SAB es overkill para Phase 1.

**Renderer → Main Process:**

```typescript
// En useHephPreview.ts (o nuevo useLiveCalibration.ts):
// Después de evaluar evaluateFixtureParams() para cada fixture:

interface CalibrationPayload {
  fixtureId: string
  numeric: Array<{ paramId: string; value: number }>  // 0-1 normalized
  r: number; g: number; b: number; hasColor: boolean
}

// IPC send (fire-and-forget, 44Hz):
window.lux?.chronos?.calibrationInject(payloads: CalibrationPayload[])
```

**Main Process → NodeArbiter:**

```typescript
// En IPCHandlers.ts:
ipcMain.handle('chronos:calibration:inject', (_event, payloads: CalibrationPayload[]) => {
  const arbiter = getTitanOrchestrator().aetherArbiter
  const graph = getTitanOrchestrator().aetherGraph

  // Convertir payloads → INodeIntent[] (zero-alloc via pool)
  const intents: INodeIntent[] = []
  for (const payload of payloads) {
    const nodeIds = graph.getDeviceNodes(payload.fixtureId)
    for (const nodeId of nodeIds) {
      const intent = acquireIntent(nodeId)  // pool
      // Mapear numeric params → channels
      for (const { paramId, value } of payload.numeric) {
        intent.values[paramId] = value
      }
      // Mapear color → r/g/b channels
      if (payload.hasColor) {
        intent.values.r = payload.r / 255
        intent.values.g = payload.g / 255
        intent.values.b = payload.b / 255
      }
      intents.push(intent)
    }
  }

  arbiter.setCalibrationIntents(intents)
  return { success: true }
})
```

### 2.2 Opción B: SAB (Futuro — Phase 2)

Para latencia sub-milisegundo cuando se necesite >100 fixtures en tiempo real:

```
CalibrationSAB: SharedArrayBuffer
  Header (32 bytes):
    [0-3]:   frameCounter (Uint32)
    [4-7]:   intentCount (Uint32)
    [8-31]:  reserved
  Body (max 512 intents × 64 bytes = 32KB):
    Per intent:
      [0-15]:  nodeId (UTF-16 string, padded)
      [16-19]: channelCount (Uint32)
      [20-23]: channel1 hash (Uint32)
      [24-27]: channel1 value (Float32)
      [28-31]: channel2 hash (Uint32)
      [32-35]: channel2 value (Float32)
      ... (up to 8 channels per intent)
```

**Writer (Renderer):** `CalibrationSABWriter.publish(intents)`
**Reader (Main Process):** En `TickEngine` hot-path, antes de `arbitrate()`:
```typescript
if (this._calibrationSAB) {
  const intents = this._calibrationSABReader.readIfNew()
  if (intents) arbiter.setCalibrationIntents(intents)
}
```

### 2.3 Mapeo HephParamId → NodeArbiter Channels

La conversión de `FixtureEvalResult.numeric` (Map<HephParamId, number>) a `INodeIntent.values` (Record<string, number>) sigue el mismo mapeo que `HephaestusAetherAdapter._paramFamily()`:

| HephParamId | NodeFamily | Arbiter Channels |
|---|---|---|
| `intensity` | IMPACT | `dimmer` |
| `color` | COLOR | `r`, `g`, `b` |
| `pan` | KINETIC | `pan` |
| `tilt` | KINETIC | `tilt` |
| `zoom` | BEAM | `zoom` |
| `focus` | BEAM | `focus` |
| `strobe` | IMPACT | `strobe` |
| `white` | COLOR | `white` |
| `amber` | COLOR | `amber` |

**El serializer en el renderer debe emitir el `paramId` string + valor [0,1]**. El Main Process ya tiene el `NodeGraph` para resolver `fixtureId → nodeId[]` y el mapeo `paramId → family → channels`.

### 2.4 Input: Mouse Position → timeMs

El input es la posición X del ratón sobre la curva Bézier del Canvas:

```
mouseX (px) → normalizedX = mouseX / canvasWidth
→ timeMs = normalizedX * clip.durationMs
```

Esto ya está implementado en `useHephPreview.ts` vía `seek(ms)`. En modo Live Calibration:

1. `onMouseMove` sobre el Canvas → calcula `timeMs`
2. Llama a `evaluateFixtureParams()` para cada fixture (igual que `resolveFixtures()`)
3. Serializa y envía vía IPC

**No usar faders manuales ni MIDI** — el único input es la posición del ratón.

---

## 3. AUDITORÍA DE SEGURIDAD

### 3.1 Limpieza al Desactivar

**Secuencia crítica al apagar el toggle:**

```
Step 1: Renderer detiene rAF loop de calibración
Step 2: Renderer envía IPC 'chronos:calibration:disable'
Step 3: Main Process ejecuta:
  3a. arbiter.clearCalibrationIntents()     → _calibrationIntents = []
  3b. arbiter.setCalibrationIntents([])     → forzar frame vacío
  3c. arbiter.arbitrate()                   → un frame de transición
      (L3+ vacío → L0/L1/Chronos retoman control naturalmente)
  3d. timelineEngine.syncResume()           → timeline retoma desde última posición
Step 4: TickEngine hot-path continúa normalmente
  (en el siguiente frame, _calibrationIntents ya está vacío,
   _primeL3DominancePrePass no registra nada, L0 fluye libre)
```

### 3.2 Prevención de Intents Residuales

**Riesgo:** Un intent de calibración se quede "pegado" en las luces al salir del modo.

**Mitigación:**

1. **`clearCalibrationIntents()`** asigna `[]` (array vacío congelado), no `null`. El loop en `arbitrate()` itera 0 veces → no escribe nada.
2. **`_primeL3DominancePrePass()`** no registra dominancia para calibración → L0/L1 pueden escribir libremente en el frame siguiente.
3. **Frame de transición explícito** (Step 3c): fuerza un `arbitrate()` con `_calibrationIntents = []` antes de reanudar el timeline, garantizando que `_l3DominatedChannels` se limpie (ya se limpia al inicio de cada `arbitrate()`).
4. **`purgeForShow()`** (método existente): Añadir `_calibrationIntents = []` al purge existente para doble seguridad.

### 3.3 Guard Rails

| Guard | Implementación |
|---|---|
| **No colisión con Manual Hard Lock** | Calibración usa layer `'hephaestus'`. El Hard Lock (L2 post-L3) se reaplica después, ganando el operador. |
| **No colisión con Blackout (L4)** | Blackout se aplica en egress, después del arbitraje. Si blackout está activo, las luces quedan oscuras incluso en calibración. |
| **No persistencia accidental** | `_calibrationIntents` NO se serializa en `save()`. Es estado efímero del toggle. |
| **Reentrancia segura** | Si el toggle se activa/desactiva rápidamente, `clearCalibrationIntents()` es idempotente. |
| **Graceful degradation** | Si el IPC falla (renderer crash), el Main Process sigue tickando con `_calibrationIntents` vacío tras el siguiente `arbitrate()` (los arrays se sobreescriben cada frame). |

### 3.4 Telemetría

```typescript
// En NodeArbiter.arbitrate(), throttled log:
if (this._calibrationIntents.length > 0 && this._photonTracerFrame % 60 === 0) {
  console.log(
    `[NodeArbiter 🎛️ CALIB] frame=${this._photonTracerFrame} | ` +
    `intents=${this._calibrationIntents.length} | ` +
    `nodes=${new Set(this._calibrationIntents.map(i => i.nodeId)).size}`
  )
}
```

---

## 4. ARCHIVOS A MODIFICAR

### Main Process

| Archivo | Cambio |
|---|---|
| `src/core/aether/NodeArbiter.ts` | +`_calibrationIntents` field, +`setCalibrationIntents()`, +`clearCalibrationIntents()`, modificar `arbitrate()` y `_primeL3DominancePrePass()`, añadir a `purgeForShow()` |
| `src/core/aether/intent-bus.ts` | +`setCalibrationIntents()` y +`clearCalibrationIntents()` en interfaz `INodeArbiter` |
| `src/core/engine/TimelineEngine.ts` | +`_syncPaused` field, +`syncPause()`, +`syncResume()`, modificar `tick()` |
| `src/core/orchestrator/IPCHandlers.ts` | +`chronos:calibration:enable`, +`chronos:calibration:disable`, +`chronos:calibration:inject` handlers |
| `src/core/orchestrator/tick/TickEngine.ts` | Opcional: telemetría de calibración en hot-path |

### Renderer

| Archivo | Cambio |
|---|---|
| `src/components/views/HephaestusView/useHephPreview.ts` | +`liveCalibration` mode: rAF loop que evalúa en mouse position y envía IPC |
| Nuevo: `src/components/views/HephaestusView/useLiveCalibration.ts` | Hook dedicado al modo calibración (toggle state, IPC bridge, cleanup) |
| `src/components/views/HephaestusView/HephaestusView.tsx` | +Toggle UI button "LIVE CALIBRATION" |

---

## 5. INTERFACES NUEVAS

### 5.1 CalibrationPayload (IPC-safe)

```typescript
interface CalibrationNumericEntry {
  paramId: string    // HephParamId: 'intensity' | 'pan' | 'tilt' | 'zoom' | ...
  value: number      // 0-1 normalized
}

interface CalibrationPayload {
  fixtureId: string
  numeric: CalibrationNumericEntry[]
  r: number          // 0-255
  g: number          // 0-255
  b: number          // 0-255
  hasColor: boolean
}
```

### 5.2 INodeArbiter Extension

```typescript
interface INodeArbiter {
  // ... existing methods ...

  /** WAVE 7117: Live Calibration — inject intents at L3+ (hephaestus layer) */
  setCalibrationIntents(intents: readonly INodeIntent[]): void

  /** WAVE 7117: Clear calibration bus (toggle OFF) */
  clearCalibrationIntents(): void
}
```

### 5.3 TimelineEngine Extension

```typescript
interface TimelineEngine {
  // ... existing methods ...

  /** WAVE 7117: Pause tick processing without unloading project */
  syncPause(): void

  /** WAVE 7117: Resume tick processing after calibration */
  syncResume(): void

  /** WAVE 7117: Query sync-pause state */
  readonly isSyncPaused: boolean
}
```

---

## 6. SECUENCIA DE IMPLEMENTACIÓN SUGERIDA

| Phase | Descripción | Archivos | Esfuerzo |
|---|---|---|---|
| **P1** | NodeArbiter: `_calibrationIntents` + `set/clear` + modificar `arbitrate()` + `_primeL3DominancePrePass()` | `NodeArbiter.ts`, `intent-bus.ts` | ~30 min |
| **P2** | TimelineEngine: `syncPause()` / `syncResume()` + flag `_syncPaused` | `TimelineEngine.ts` | ~15 min |
| **P3** | IPC Handlers: `calibration:enable`, `calibration:disable`, `calibration:inject` | `IPCHandlers.ts` | ~30 min |
| **P4** | Renderer: `useLiveCalibration.ts` hook + toggle UI | `useLiveCalibration.ts`, `HephaestusView.tsx` | ~45 min |
| **P5** | Telemetría + guard rails + `purgeForShow()` update | `NodeArbiter.ts` | ~15 min |
| **P6** | Test manual con fixtures físicos | — | — |

---

## 7. NOTAS ARQUITECTÓNICAS

- **¿Por qué L3+ (hephaestus layer) y no L3 (effect)?** Porque la calibración es conceptualmente idéntica a un clip Hephaestus: curvas evaluadas que producen valores [0,1] por fixture. Reutilizar la layer `'hephaestus'` evita crear una nueva `ArbiterLayer` y aprovecha el Escudo Anti-Sangrado existente.

- **¿Por qué IPC y no SAB para Phase 1?** El volumen de datos es pequeño (50-400 intents × 44Hz = 2K-18K intents/seg). El overhead de IPC estructurado es ~0.5ms, imperceptible. SAB se reserva para Phase 2 si se necesita latencia <0.1ms.

- **¿Por qué `syncPause()` en vez de `stop()`?** `stop()` descarga el proyecto y limpia todos los clips. `syncPause()` solo pausa el tick, manteniendo el proyecto cargado para reanudar instantáneamente al desactivar el toggle.

- **¿Por qué no usar `dmx:sendDirect` (WAVE 1007)?** Ese bypass escribe crudo al driver DMX, saltándose el NodeArbiter, el HAL, y la resolución de NodeGraph. No respeta patching, channel mapping, ni capability nodes. La calibración debe pasar por el Arbiter para que los valores se traduzcan correctamente a los canales físicos de cada fixture.
