# WAVE 7118 — LIVE CALIBRATION MODE BLUEPRINT (DECOUPLED)
## Phase Canvas → NodeArbiter L3++ Direct Injection (No-Chronos Approach)

---

## 1. ARQUITECTURA CONCEPTUAL

### 1.1 Visión General

Live Calibration es una **inyección pura** desde el Canvas de Hephaestus hacia el `NodeArbiter` de Aether. El operador edita curvas Bézier o PhaseConfig y ve el resultado instantáneo en las luminarias físicas.

**Hephaestus es un editor independiente.** No interactúa, pausa, ni conoce la existencia de `TimelineEngine` o Chronos. La calibración gana prioridad por **simple dominancia de capas** en el `NodeArbiter`.

```
┌─────────────────────────────────────────────────────────────────┐
│ RENDERER (React) — HephaestusView                                │
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
│  IPC: 'hephaestus:calibration:inject'                           │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│ MAIN PROCESS — NodeArbiter (Aether)                              │
│                                                                 │
│  Capa L3++ 'calibration' (nueva — máxima prioridad pre-Blackout) │
│       │                                                         │
│       ▼                                                         │
│  TickEngine hot-path (44Hz — sin cambios):                      │
│    1. L0/Selene/Chronos/L2/L3/L3+ producen intents normalmente  │
│    2. L3++ calibration intents se aplican DESPUÉS — LTP total   │
│    3. arbiter.arbitrate() → ArbitratedNodeMap                   │
│    4. HAL.renderFromTarget() → DMX físico                       │
│                                                                 │
│  Al desactivar:                                                  │
│    1. arbiter.clearCalibrationIntents() → _calibrationIntents=[]│
│    2. Siguiente frame: L3++ vacío → L0/L1/L2/L3 retoman control │
└─────────────────────────────────────────────────────────────────┘
```

### 1.2 Toggle "LIVE CALIBRATION"

El toggle es un booleano en el store del Phase Canvas que:

- **ON:**
  1. Activa el rAF loop de evaluación local (reutiliza infraestructura de `useHephPreview`)
  2. En cada frame, evalúa las curvas en el `timeMs` correspondiente a la posición del ratón
  3. Serializa los `FixtureEvalResult` y los envía vía `IPC: 'hephaestus:calibration:inject'`

- **OFF:**
  1. Detiene el rAF loop de calibración
  2. Envía `IPC: 'hephaestus:calibration:disable'`
  3. El `NodeArbiter` vacía la capa L3++ → las capas inferiores retoman el control en el siguiente frame (44Hz)

**No se pausa ni detiene ningún motor.** TimelineEngine, Selene, Chronos y HephaestusRuntime siguen ejecutándose normalmente. La capa L3++ simplemente machaca sus salidas en los canales que escribe.

### 1.3 Nueva Capa L3++ 'calibration' en NodeArbiter

Se crea una **capa dedicada de máxima prioridad** en el `NodeArbiter`, justo por debajo del L4 Blackout. Esta capa se aplica **después** de todas las demás capas L0-L3+, garantizando dominancia total por orden de escritura LTP (Last-Takes-Precedence).

**Jerarquía de capas actualizada:**

```
L0    — System (Selene IA, VMM automático)
L1    — Selene (overrides manuales del operador)
L1.C  — Chronos (timeline playback)
L2    — Manual (faders, programmer)
L3    — Effect (Core FX: CumbiaMoon, CorazonLatino, etc.)
L3+   — Hephaestus (Diamond Data: .lfx clips del timeline)
L3++  — Calibration (Live Calibration Mode — NUEVA)    ← máxima prioridad pre-Blackout
L4    — Blackout (egress — fuerza dimmer=0)
```

**Nuevo tipo `ArbiterLayer`:**

```typescript
// ANTES:
type ArbiterLayer = 'system' | 'selene' | 'chronos' | 'effect' | 'hephaestus'

// DESPUÉS:
type ArbiterLayer = 'system' | 'selene' | 'chronos' | 'effect' | 'hephaestus' | 'calibration'
```

**Nuevo campo en `NodeArbiter`:**

```typescript
/** L3++ Calibration intents — máxima prioridad pre-Blackout.
 *  Inyectados por Live Calibration Mode (Hephaestus Canvas → IPC → Arbiter).
 *  Dominancia total sobre L0/L1/L2/L3/L3+ por orden de escritura LTP. */
private _calibrationIntents: readonly INodeIntent[] = []

setCalibrationIntents(intents: readonly INodeIntent[]): void {
  this._calibrationIntents = intents
}

clearCalibrationIntents(): void {
  this._calibrationIntents = []
}
```

**Modificación en `arbitrate()`:** después del bloque de `_hephaestusIntents` (línea ~714) y **antes** del MANUAL HARD LOCK:

```typescript
// L3++: Calibration intents (Live Calibration Mode — Hephaestus Canvas direct injection)
// Dominancia absoluta sobre todas las capas inferiores por LTP.
// No requiere pausar TimelineEngine ni ningún motor — machaca por orden de escritura.
for (let i = 0; i < this._calibrationIntents.length; i++) {
  this._applyIntent(this._calibrationIntents[i], 'calibration')
}
```

**Modificación en `_applyIntent()`:** extender los branches de dominancia L3 para incluir `'calibration'`:

```typescript
// Escudo Anti-Sangrado: L3/L3+/L3++ dominan L0/L1
const l3DominatedChannels = (layer === 'system' || layer === 'selene')
  ? this._l3DominatedChannels.get(intent.nodeId)
  : undefined

// ...

// Registro de dominancia — L3++ también reclama canales
if (layer === 'effect' || layer === 'hephaestus' || layer === 'calibration') {
  this._registerL3Dominance(intent.nodeId, channel)
  // L3++ también marca nodos color para silenciar L0
  if (layer === 'calibration' && (
    channel === 'r' || channel === 'g' || channel === 'b' ||
    channel === 'red' || channel === 'green' || channel === 'blue' ||
    channel === 'colorWheel' || channel === 'color_wheel'
  )) {
    this._l3HephColorNodeIds.add(intent.nodeId)
  }
}

// STRICT_PRIORITY_CHANNELS: L3++ tiene autoridad total
if (layer === 'calibration') {
  record[channel] = incoming
  continue
}
```

**Modificación en `_primeL3DominancePrePass()`:** añadir loop sobre `_calibrationIntents` para registrar dominancia **antes** de que L0/L1 se apliquen:

```typescript
private _primeL3DominancePrePass(): void {
  // ... existing effect + hephaestus loops ...

  // L3++: Calibration — registrar dominancia antes de L0/L1
  for (let i = 0; i < this._calibrationIntents.length; i++) {
    const intent = this._calibrationIntents[i]
    const values = intent.values
    for (const channel in values) {
      this._registerL3Dominance(intent.nodeId, channel)
    }
  }
}
```

### 1.4 Dominancia por Capa — Sin Pausar Motores

El `NodeArbiter` aplica los intents en orden ascendente de prioridad dentro de `arbitrate()`. La última escritura gana (LTP universal — WAVE 4836). Como L3++ se aplica **después** de L0/L1/L2/L3/L3+, sus valores machacan automáticamente cualquier salida anterior en los mismos canales.

**No se necesita:**
- Pausar `TimelineEngine`
- Detener `HephaestusRuntime`
- Pausar Selene o Chronos
- Bandera `outputDMX` o `syncPaused`

**El `TickEngine` hot-path no se modifica.** Sigue ejecutándose a 44Hz, llamando `arbitrate()` y enviando el resultado al HAL. La única diferencia es que `_calibrationIntents` tiene datos cuando el modo está activo, y vacío cuando no lo está.

### 1.5 Bypass de Aduana (DMX Output)

El pipeline existente ya envía DMX cada frame:

```
TickEngine.tick() → arbiter.arbitrate() → ArbitratedNodeMap → HAL.renderFromTarget() → DMX
```

Cuando L3++ tiene intents, el `ArbitratedNodeMap` contiene los valores de calibración en los canales correspondientes, machacando lo que L0/L1/L2/L3 hayan escrito. El HAL lo envía a los fixtures físicos sin saber que viene de calibración — para el HAL es un frame normal.

---

## 2. FLUJO DE DATOS (ZERO-ALLOC)

### 2.1 Opción A: IPC Message (Recomendado para Phase 1)

**Razón:** Los intents de calibración son pocos (típicamente 1-50 fixtures × 1-8 nodos = 50-400 intents). El overhead de IPC estructurado es <1ms para este volumen. SAB es overkill para Phase 1.

**Renderer → Main Process:**

```typescript
// En useLiveCalibration.ts (nuevo hook):
// Después de evaluar evaluateFixtureParams() para cada fixture:

interface CalibrationPayload {
  fixtureId: string
  numeric: Array<{ paramId: string; value: number }>  // 0-1 normalized
  r: number; g: number; b: number; hasColor: boolean
}

// IPC send (fire-and-forget, 44Hz):
window.lux?.hephaestus?.calibrationInject(payloads: CalibrationPayload[])
```

**Main Process → NodeArbiter:**

```typescript
// En IPCHandlers.ts (o AetherIPCHandlers.ts):
ipcMain.handle('hephaestus:calibration:inject', (_event, payloads: CalibrationPayload[]) => {
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

ipcMain.handle('hephaestus:calibration:disable', () => {
  const arbiter = getTitanOrchestrator().aetherArbiter
  arbiter.clearCalibrationIntents()
  return { success: true }
})
```

**Nota:** No existe `hephaestus:calibration:enable`. El modo se activa implícitamente cuando el primer `hephaestus:calibration:inject` llega con payloads no vacíos. Se desactiva explícitamente con `hephaestus:calibration:disable`.

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
Step 2: Renderer envía IPC 'hephaestus:calibration:disable'
Step 3: Main Process ejecuta:
  3a. arbiter.clearCalibrationIntents()     → _calibrationIntents = []
Step 4: TickEngine hot-path (siguiente frame, ~22ms después):
  4a. arbitrate() comienza → _l3DominatedChannels.clear() (limpieza estándar)
  4b. _primeL3DominancePrePass() itera _calibrationIntents (0 elementos) → no registra nada
  4c. L0/L1/L2/L3/L3+ se aplican normalmente → retoman control de los canales DMX
  4d. HAL.renderFromTarget() → DMX con valores del timeline/Selene/Chronos
```

**No hay `syncResume()`, no hay `timelineEngine.resume()`, no hay frame de transición explícito.** La limpieza es automática: al vaciar `_calibrationIntents`, el siguiente `arbitrate()` no registra dominancia L3++, y las capas inferiores fluyen libres.

### 3.2 Prevención de Intents Residuales

**Riesgo:** Un intent de calibración se quede "pegado" en las luces al salir del modo.

**Mitigación:**

1. **`clearCalibrationIntents()`** asigna `[]` (array vacío congelado), no `null`. El loop en `arbitrate()` itera 0 veces → no escribe nada.
2. **`_primeL3DominancePrePass()`** no registra dominancia para calibración cuando el array está vacío → L0/L1 pueden escribir libremente en el frame siguiente.
3. **`_l3DominatedChannels` se limpia al inicio de cada `arbitrate()`** (línea 550 del código existente). No hay estado residual entre frames.
4. **`_l3HephColorNodeIds` se limpia al inicio de cada `arbitrate()`** (línea 561). Los nodos color desbloquean L0 automáticamente.
5. **`purgeForShow()`** (método existente): Añadir `_calibrationIntents = []` al purge existente para doble seguridad al cambiar de show.

### 3.3 Guard Rails

| Guard | Implementación |
|---|---|
| **No colisión con Manual Hard Lock** | El MANUAL HARD LOCK (paso post-L3, línea 716) se reaplica **después** de L3++. Sin embargo, L3++ es calibración del operador desde el Canvas — si el operador también tiene faders manuales activos, el Hard Lock gana. Esto es correcto: el operador humano siempre tiene la última palabra. |
| **No colisión con Blackout (L4)** | Blackout se aplica en egress, después del arbitraje. Si blackout está activo, las luces quedan oscuras incluso en calibración. L3++ no puede sobrepasar L4. |
| **No persistencia accidental** | `_calibrationIntents` NO se serializa en `save()`. Es estado efímero del toggle. |
| **Reentrancia segura** | Si el toggle se activa/desactiva rápidamente, `clearCalibrationIntents()` es idempotente. |
| **Graceful degradation** | Si el IPC falla (renderer crash), el Main Process sigue tickando. `_calibrationIntents` retiene el último frame recibido, pero al no llegar nuevos payloads, los valores se congelan. **Mitigación:** añadir un watchdog timer en el Main Process que limpie `_calibrationIntents` si no recibe un nuevo inject en >500ms. |
| **Desacoplamiento de Chronos** | Hephaestus no importa ni referencia `TimelineEngine`. No hay `syncPause`, `syncResume`, ni banderas de pausa. La calibración es una inyección unidireccional Canvas → Arbiter. |

### 3.4 Watchdog Timer (Anti-Stuck)

```typescript
// En NodeArbiter o IPCHandlers:
private _calibrationWatchdog: NodeJS.Timeout | null = null
private _calibrationLastInjectMs = 0

setCalibrationIntents(intents: readonly INodeIntent[]): void {
  this._calibrationIntents = intents
  this._calibrationLastInjectMs = Date.now()
  // Reset watchdog
  if (this._calibrationWatchdog) clearTimeout(this._calibrationWatchdog)
  this._calibrationWatchdog = setTimeout(() => {
    // Si no llega un nuevo inject en 500ms, limpiar automáticamente
    if (Date.now() - this._calibrationLastInjectMs >= 500) {
      this._calibrationIntents = []
      console.warn('[NodeArbiter 🎛️ CALIB] Watchdog: auto-clear after 500ms timeout')
    }
  }, 600)
}

clearCalibrationIntents(): void {
  this._calibrationIntents = []
  if (this._calibrationWatchdog) {
    clearTimeout(this._calibrationWatchdog)
    this._calibrationWatchdog = null
  }
}
```

### 3.5 Telemetría

```typescript
// En NodeArbiter.arbitrate(), throttled log:
if (this._calibrationIntents.length > 0 && this._photonTracerFrame % 60 === 0) {
  console.log(
    `[NodeArbiter 🎛️ CALIB L3++] frame=${this._photonTracerFrame} | ` +
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
| `src/core/aether/NodeArbiter.ts` | +`'calibration'` a `ArbiterLayer`, +`_calibrationIntents` field, +`setCalibrationIntents()`, +`clearCalibrationIntents()`, +watchdog timer, modificar `arbitrate()` (loop L3++ después de L3+), modificar `_primeL3DominancePrePass()` (loop sobre `_calibrationIntents`), modificar `_applyIntent()` (branches de dominancia incluyen `'calibration'`), añadir a `purgeForShow()` |
| `src/core/aether/intent-bus.ts` | +`setCalibrationIntents()` y +`clearCalibrationIntents()` en interfaz `INodeArbiter` |
| `src/core/orchestrator/IPCHandlers.ts` | +`hephaestus:calibration:inject`, +`hephaestus:calibration:disable` handlers |

### Renderer

| Archivo | Cambio |
|---|---|
| Nuevo: `src/components/views/HephaestusView/useLiveCalibration.ts` | Hook dedicado: toggle state, rAF loop de evaluación, IPC bridge (`hephaestus:calibration:inject` / `disable`), cleanup on unmount |
| `src/components/views/HephaestusView/HephaestusView.tsx` | +Toggle UI button "LIVE CALIBRATION" |

### Archivos NO modificados (desacoplamiento)

| Archivo | Razón |
|---|---|
| `src/core/engine/TimelineEngine.ts` | **No se toca.** Hephaestus no conoce Chronos. El timeline sigue corriendo normalmente. |
| `src/core/orchestrator/tick/TickEngine.ts` | **No se toca.** El hot-path existente ya llama `arbitrate()` a 44Hz. La capa L3++ se procesa dentro de `arbitrate()`. |
| `src/core/hephaestus/runtime/HephaestusRuntime.ts` | **No se toca.** El runtime del timeline es independiente del modo calibración. |
| `src/core/aether/adapters/HephaestusAetherAdapter.ts` | **No se toca.** El adapter L3+ del timeline sigue funcionando. L3++ machaca L3+ si ambos escriben los mismos canales. |

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

  /** WAVE 7118: Live Calibration — inject intents at L3++ (calibration layer) */
  setCalibrationIntents(intents: readonly INodeIntent[]): void

  /** WAVE 7118: Clear calibration bus (toggle OFF) */
  clearCalibrationIntents(): void
}
```

### 5.3 ArbiterLayer Extension

```typescript
// ANTES:
type ArbiterLayer = 'system' | 'selene' | 'chronos' | 'effect' | 'hephaestus'

// DESPUÉS:
type ArbiterLayer = 'system' | 'selene' | 'chronos' | 'effect' | 'hephaestus' | 'calibration'
```

---

## 6. SECUENCIA DE IMPLEMENTACIÓN SUGERIDA

| Phase | Descripción | Archivos | Esfuerza |
|---|---|---|---|
| **P1** | NodeArbiter: +`'calibration'` layer, +`_calibrationIntents` field, +`set/clear` + watchdog, modificar `arbitrate()`, `_primeL3DominancePrePass()`, `_applyIntent()`, `purgeForShow()` | `NodeArbiter.ts`, `intent-bus.ts` | ~45 min |
| **P2** | IPC Handlers: `hephaestus:calibration:inject`, `hephaestus:calibration:disable` | `IPCHandlers.ts` | ~20 min |
| **P3** | Renderer: `useLiveCalibration.ts` hook + toggle UI | `useLiveCalibration.ts`, `HephaestusView.tsx` | ~45 min |
| **P4** | Telemetría + guard rails | `NodeArbiter.ts` | ~10 min |
| **P5** | Test manual con fixtures físicos | — | — |

---

## 7. NOTAS ARQUITECTÓNICAS

- **¿Por qué una capa L3++ dedicada y no reutilizar `'hephaestus'`?** Porque la calibración NO es un clip del timeline. Es una inyección directa del editor. Reutilizar `'hephaestus'` crearía ambigüedad semántica: si un clip Hephaestus del timeline y la calibración escriben el mismo canal, el orden dentro del loop `'hephaestus'` sería no determinista. Con una capa dedicada L3++, la calibración **siempre** gana sobre el timeline Hephaestus, y el orden es explícito en `arbitrate()`.

- **¿Por qué no pausar TimelineEngine?** Porque Hephaestus es un editor independiente que no debe acoplarse con Chronos. Pausar el timeline requiere importar `TimelineEngine`, crear dependencias cruzadas, y manejar estado de reanudación. La dominancia por capa logra el mismo resultado visual (las luces responden a la calibración, no al timeline) sin ninguna de esa complejidad. El timeline sigue corriendo, pero sus salidas son machacadas por L3++ en cada frame.

- **¿Por qué IPC y no SAB para Phase 1?** El volumen de datos es pequeño (50-400 intents × 44Hz = 2K-18K intents/seg). El overhead de IPC estructurado es ~0.5ms, imperceptible. SAB se reserva para Phase 2 si se necesita latencia <0.1ms.

- **¿Por qué no usar `dmx:sendDirect` (WAVE 1007)?** Ese bypass escribe crudo al driver DMX, saltándose el NodeArbiter, el HAL, y la resolución de NodeGraph. No respeta patching, channel mapping, ni capability nodes. La calibración debe pasar por el Arbiter para que los valores se traduzcan correctamente a los canales físicos de cada fixture.

- **¿Qué pasa si el timeline está reproduciendo un clip Hephaestus y la calibración escribe los mismos canales?** L3++ machaca L3+ por orden de escritura en `arbitrate()`. El clip del timeline sigue evaluándose y produciendo intents L3+, pero sus valores son sobrescritos por L3++ en los canales que la calibración toca. Los canales que la calibración NO toca quedan con los valores del timeline. Esto es correcto: el operador calibra solo los parámetros que edita.

- **¿Interacción con MANUAL HARD LOCK?** El Hard Lock (L2 post-L3) se reaplica después de L3++. Si el operador tiene un fader manual con Hard Lock activo, el fader gana sobre la calibración. Esto es intencional: el operador humano siempre tiene la última palabra. En la práctica, si el operador está calibrando curvas, es poco probable que tenga faders manuales con Hard Lock simultáneamente.
