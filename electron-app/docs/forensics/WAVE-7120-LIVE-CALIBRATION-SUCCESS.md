# WAVE 7120 — LIVE CALIBRATION MODE: INFORME DE ÉXITO

## Hephaestus Canvas → NodeArbiter L3++ → DMX Físico

---

## 1. RESUMEN EJECUTIVO

Live Calibration Mode permite al operador editar curvas Bézier y PhaseConfig en el Canvas de Hephaestus y ver el resultado **instantáneamente** en las luminarias físicas, sin pausar ningún motor. La calibración gana prioridad por dominancia de capas en el `NodeArbiter` (L3++ — máxima prioridad pre-Blackout).

**Estado: OPERATIVO.** Verificado con fixtures simples (5 pares) y compound (Tungsten fan multi-célula). Strobe, dimmer, color, pan/tilt, zoom, focus, iris, gobo, prism y speed todos mapeados y funcionando.

---

## 2. DEVIACIÓN DEL BLUEPRINT ORIGINAL: SAB → IPC PLANO

### 2.1 El Problema: SharedArrayBuffer No Cruza la Frontera de React

El blueprint original (`WAVE-7118-LIVE-CALIBRATION-BLUEPRINT.md`) diseñaba dos opciones:
- **Opción A (Phase 1):** IPC estructurado con `CalibrationPayload[]`
- **Opción B (Phase 2):** SharedArrayBuffer (SAB) para latencia sub-milisegundo

La implementación inicial intentó usar SAB directamente desde el renderer. **Esto falló** porque `SharedArrayBuffer` no puede cruzar la frontera `contextBridge` de Electron de forma transparente en todos los contextos de render. El SAB vive en el proceso principal (main) o en el preload, pero no es accesible desde el renderer React de manera directa para escritura a 44Hz.

### 2.2 La Solución: IPC Plano con Entries Estructuradas

Se pivotó a un esquema **IPC plano fire-and-forget** que envía entries estructuradas desde el renderer al main process:

```
Renderer (React)                    Preload (Bridge)              Main Process
─────────────────                   ────────────────              ────────────
useLiveCalibration.ts               preload.ts                    IPCHandlers.ts
  │                                   │                             │
  │ window.luxsync.writeCalibration   │                             │
  │   (entries: CalibrationEntry[])   │                             │
  ├──────────────────────────────────►│                             │
  │                                   │ ipcRenderer.send(           │
  │                                   │   'hephaestus:calibration:  │
  │                                   │    write', entries)         │
  │                                   ├────────────────────────────►│
  │                                   │                             │ TickEngine.writeCalibration(entries)
  │                                   │                             │   → _calibEntries: INodeIntent[]
  │                                   │                             │
  │                                   │                             │ TickEngine.tick() @ 44Hz:
  │                                   │                             │   arbiter.setCalibrationIntents(_calibEntries)
  │                                   │                             │   arbiter.arbitrate()
  │                                   │                             │   HAL.renderFromTarget() → DMX
```

### 2.3 Por Qué No Es Un Simple Bypass

No se usó `dmx:sendDirect` (WAVE 1007) porque ese bypass escribe crudo al driver DMX, saltándose el `NodeArbiter`, el HAL, y la resolución de `NodeGraph`. La calibración **pasa por el Arbiter** para que los valores se traduzcan correctamente a los canales físicos de cada fixture mediante:

1. **NodeGraph resolution:** `fixtureId → nodeId[]` (expansión compound)
2. **NodeResolver:** Aplica transfer curves, calibration offsets, safety middleware, y DMX personality remapping
3. **Channel dominance:** L3++ domina L0/L1/L2/L3/L3+ por orden de escritura LTP

### 2.4 Escalabilidad: La Autopista para MIDI/Faders

El pipeline IPC creado no es un workaround temporal — es una **autopista permanente** para control en vivo del show desde Hephaestus. A medio plazo, los mismos handlers IPC (`hephaestus:calibration:write`) pueden recibir datos desde:

- **Pads MIDI / controladores físicos** → mapeo de faders a `CalibrationEntry[]`
- **Faders manuales DMX** → inyección directa sin pasar por el editor de curvas
- **OSC controllers** → mismo bridge, diferente fuente de input

El formato `CalibrationEntry` es genérico:
```typescript
interface CalibrationEntry {
  nodeId: string                                    // 'fixtureId:family'
  channels: Array<{ channel: string; value: number }> // normalized [0,1]
}
```

Cualquier fuente que produzca `CalibrationEntry[]` puede usar esta autopista.

---

## 3. ARQUITECTURA FINAL

### 3.1 Flujo de Datos Completo

```
┌─────────────────────────────────────────────────────────────────────┐
│ RENDERER (React) — HephaestusView                                    │
│                                                                     │
│  useHephPreview.ts                                                   │
│    └─ resolveFixtures() @ 44Hz → previewDataRef.current.playheadMs  │
│                                                                     │
│  useLiveCalibration.ts                                               │
│    ├─ Lee playheadMs del previewDataRef (fuente única de tiempo)    │
│    ├─ evaluateFixtureParams() por fixture con phase offsets          │
│    ├─ Split channels por family: impact/color/kinetic/beam           │
│    ├─ Construye CalibrationEntry[] (nodeId: 'fixtureId:family')     │
│    └─ window.luxsync.writeCalibration(entries) → IPC send            │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ IPC (fire-and-forget, 44Hz)
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│ MAIN PROCESS                                                         │
│                                                                     │
│  IPCHandlers.ts                                                      │
│    └─ ipcMain.on('hephaestus:calibration:write')                     │
│       └─ TickEngine.writeCalibration(entries)                        │
│                                                                     │
│  TickEngine.writeCalibration()                                       │
│    ├─ Accede al NodeGraph via _instances (primera instancia)        │
│    ├─ Por cada entry: parse 'fixtureId:family'                       │
│    ├─ graph.getDeviceNodes(fixtureId) → nodos reales                 │
│    ├─ Filtra por family.toUpperCase() === nd.family                  │
│    ├─ COMPOUND EXPANSION: 1 entry → N intents (una por nodo real)   │
│    ├─ SIMPLE FALLBACK: 1 entry → 1 intent (nodeId tal cual)         │
│    └─ _calibEntries = intents[]                                      │
│                                                                     │
│  TickEngine.tick() @ 44Hz                                            │
│    ├─ arbiter.setCalibrationIntents(_calibEntries)                   │
│    ├─ arbiter.arbitrate() → L0/L1/L2/L3/L3+/L3++ → ArbitratedNodeMap│
│    └─ HAL.renderFromTarget() → DMX físico                            │
│                                                                     │
│  NodeArbiter                                                         │
│    ├─ L3++ 'calibration' layer: máxima prioridad pre-Blackout       │
│    ├─ LTP (Last-Takes-Precedence): machaca L0-L3+ en mismos canales │
│    ├─ Escudo Anti-Sangrado: L0/L1 bloqueados en canales dominados   │
│    ├─ Watchdog: auto-clear si no llega inject en 500ms              │
│    └─ MANUAL HARD LOCK sigue siendo la autoridad final del operador │
└─────────────────────────────────────────────────────────────────────┘
```

### 3.2 Capas del NodeArbiter

```
L0    — System (Selene IA, VMM automático)
L1    — Selene (overrides manuales del operador)
L1.C  — Chronos (timeline playback)
L2    — Manual (faders, programmer)
L3    — Effect (Core FX: CumbiaMoon, CorazonLatino, etc.)
L3+   — Hephaestus (Diamond Data: .lfx clips del timeline)
L3++  — Calibration (Live Calibration Mode)    ← MÁXIMA PRIORIDAD PRE-BLACKOUT
L4    — Blackout (egress — fuerza dimmer=0)
```

---

## 4. FIXES APLICADOS DURANTE LA OPERACIÓN

### 4.1 Sincronización Preview ↔ Physical (Reloj Compartido)

**Problema:** La preview y la calibración física usaban fuentes de tiempo independientes, causando desincronización.

**Fix:** `useLiveCalibration` lee `playheadMs` directamente del `previewDataRef` de `useHephPreview` — **una sola fuente de tiempo** para ambos. Cuando la preview se pausa, la calibración se congela (fixtures mantienen última posición). Cuando reanuda, la calibración reanuda instantáneamente.

### 4.2 Strobe Rate Alias

**Problema:** Clips como `core_meltdown.lfx` usan `paramId: "strobeRate"` pero la preview y calibración solo leían `n.get('strobe')`.

**Fix:** Se añadió fallback `n.get('strobe') ?? n.get('strobeRate')` en:
- `useHephPreview.ts` — preview visual
- `useLiveCalibration.ts` — calibración física

### 4.3 Phase Overrides Sin Spread

**Problema:** Los phase offsets manuales (Phase Canvas) no se aplicaban cuando `spreadDeg === 0`, porque la condición solo verificaba `spreadDeg > 0`.

**Fix:** Se modificó la condición en tres archivos para también considerar overrides manuales:
```typescript
// ANTES:
if (track.phaseConfig && track.phaseConfig.spreadDeg > 0)
// DESPUÉS:
if (track.phaseConfig && (track.phaseConfig.spreadDeg > 0 || hasOverrides))
```

Aplicado en:
- `useLiveCalibration.ts` — calibración física
- `useHephPreview.ts` — preview visual
- `HephaestusRuntime.ts` — runtime del timeline

### 4.4 Compound Fixture Expansion (WAVE 7120.1)

**Problema:** La calibración enviaba `nodeId: 'tungsten-id:impact'` (formato simple), pero el Tungsten es un fixture compound con nodos reales como `tungsten-id:impact-20`, `tungsten-id:impact-14`, `tungsten-id:wash-impact`, etc. El `NodeArbiter` creaba un record para un nodeId fantasma que el `NodeResolver` nunca escribía a DMX.

**Fix:** `TickEngine.writeCalibration()` ahora expande nodeIds simples a los nodos reales del NodeGraph:

1. Parsea `fixtureId:family` del nodeId del entry
2. Busca `graph.getDeviceNodes(fixtureId)` en el NodeGraph
3. Filtra por `nd.family === family.toUpperCase()` (case-insensitive match)
4. Si encuentra nodos compound: emite un `INodeIntent` por cada nodo real
5. Si no (fixture simple o sin graph): usa el nodeId tal cual (backward compat)

**Verificado con Tungsten:**
```
fixture-1782941843636:impact → [impact-20, impact-14, impact-16, impact-18, wash-impact]
fixture-1782941843636:color  → [wash-color, beam-color]
```

### 4.5 Eliminación de Log CPU-Intensivo

**Problema:** `console.log('[IPC] calib write:', summary)` en `IPCHandlers.ts` se ejecutaba a 44Hz, causando overhead significativo de CPU.

**Fix:** Eliminado el log del handler `hephaestus:calibration:write`.

---

## 5. ARCHIVOS MODIFICADOS

| Archivo | Cambio |
|---|---|
| `src/components/views/HephaestusView/useLiveCalibration.ts` | Hook completo: rAF loop 44Hz, evaluación de curvas, split por family, IPC bridge, phase offsets con overrides |
| `src/components/views/HephaestusView/useHephPreview.ts` | Strobe alias (`strobeRate`), phase overrides sin spread |
| `src/core/orchestrator/tick/TickEngine.ts` | `writeCalibration()` con compound fixture expansion via NodeGraph, `clearCalibration()`, inyección en hot-path |
| `src/core/orchestrator/IPCHandlers.ts` | Handlers IPC: `calibration:init`, `calibration:write`, `calibration:clear`, `calibration:disable` |
| `src/core/aether/NodeArbiter.ts` | Capa L3++ `'calibration'`, `setCalibrationIntents()`, `clearCalibrationIntents()`, watchdog 500ms, dominancia L3++ |
| `src/core/aether/intent-bus.ts` | Interfaz `INodeArbiter` extendida con `setCalibrationIntents()` / `clearCalibrationIntents()` |
| `src/core/hephaestus/runtime/HephaestusRuntime.ts` | Phase overrides sin spread |
| `electron/preload.ts` | Bridge IPC: `initCalibration`, `writeCalibration`, `clearCalibration`, `disableCalibration` |
| `src/vite-env.d.ts` | Tipos TypeScript para `window.luxsync` calibration API |

---

## 6. MAPEO DE PARÁMETROS

| HephParamId | NodeFamily | Arbiter Channels | Estado |
|---|---|---|---|
| `intensity` | IMPACT | `dimmer` | ✅ Operativo |
| `strobe` / `strobeRate` | IMPACT | `strobe`, `shutter`, `strobeRate` | ✅ Operativo |
| `color` | COLOR | `r`, `g`, `b` | ✅ Operativo |
| `white` | COLOR | `white` | ✅ Operativo |
| `amber` | COLOR | `amber` | ✅ Operativo |
| `pan` | KINETIC | `pan` | ✅ Operativo |
| `tilt` | KINETIC | `tilt` | ✅ Operativo |
| `speed` | KINETIC | `speed` | ✅ Operativo |
| `zoom` | BEAM | `zoom` | ✅ Operativo |
| `focus` | BEAM | `focus` | ✅ Operativo |
| `iris` | BEAM | `iris` | ✅ Operativo |
| `gobo1` | BEAM | `gobo` | ✅ Operativo |
| `gobo2` | BEAM | `gobo_rotation` | ✅ Operativo |
| `prism` | BEAM | `prism` | ✅ Operativo |

---

## 7. GUARD RAILS

| Guard | Implementación | Estado |
|---|---|---|
| **No colisión con Manual Hard Lock** | Hard Lock se reaplica después de L3++ | ✅ |
| **No colisión con Blackout (L4)** | Blackout en egress, después del arbitraje | ✅ |
| **No persistencia accidental** | `_calibrationIntents` es estado efímero | ✅ |
| **Reentrancia segura** | `clearCalibrationIntents()` es idempotente | ✅ |
| **Watchdog anti-stuck** | Auto-clear tras 500ms sin inject | ✅ |
| **Graceful degradation** | Si IPC falla, Main Process sigue tickando | ✅ |
| **Desacoplamiento de Chronos** | Hephaestus no conoce TimelineEngine | ✅ |
| **Compound fixture expansion** | NodeIds simples → nodos reales del NodeGraph | ✅ |

---

## 8. ROADMAP: MIDI Y FADERS MANUALES

La autopista IPC creada (`hephaestus:calibration:write`) es reutilizable para control en vivo del show desde dispositivos físicos:

1. **MIDI Controller → CalibrationEntry[]:** Un handler MIDI en el renderer (o main) traduce faders/pads a `CalibrationEntry[]` y envía por el mismo IPC
2. **Sin cambios en NodeArbiter:** La capa L3++ ya procesa cualquier `INodeIntent[]` sin importar la fuente
3. **Prioridad sobre Selene/Chronos:** L3++ domina automáticamente — el operador físico siempre tiene control
4. **Watchdog integrado:** Si el controlador MIDI se desconecta, el watchdog limpia en 500ms

**No se necesita un bypass DMX separado.** La autopista L3++ ya respeta patching, channel mapping, capability nodes, y DMX personality remapping.

---

## 9. CONCLUSIÓN

Live Calibration Mode es **operativo y verificado**. La desviación del blueprint (SAB → IPC plano) fue una adaptación necesaria por las restricciones de `contextBridge` en Electron, pero resultó en una arquitectura más simple, más portable, y escalable para futuros controladores físicos. El fix de compound fixture expansion asegura que fixtures multi-célula como el Tungsten fan respondan correctamente a la calibración, expandiendo nodeIds simples a los nodos reales del NodeGraph.
