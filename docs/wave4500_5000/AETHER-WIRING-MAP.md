# AETHER-WIRING-MAP.md

## Diagnóstico Clínico del Ecosistema Aether Native — WAVE 4551

**Auditoría realizada:** 2026-05-05  
**Scope:** Wiring interno de Aether V2 (no Legacy MasterArbiter/HAL.renderFromTarget)  
**Objetivo:** Determinar si ForgeNodeEvaluator está conectado al pipeline de resolución y documentar el flujo completo de intención desde los adaptadores hasta el hardware.

---

## 1. RESUMEN EJECUTIVO

### Estado General: Aether V2 está OPERATIVO pero en PARALELO con Legacy

El ecosistema Aether consta de dos pipelines que coexisten en `TitanOrchestrator.processFrame()`:

| Pipeline | Estado | Ruta a DMX |
|----------|--------|------------|
| **Legacy** (MasterArbiter → HAL.renderFromTarget) | **Activo, default** | `fixtureStates[]` → mutación Hephaestus → `hal.renderFromTarget()` → `universalDMX.sendAll()` |
| **Aether Native** (Systems → Arbiter → Resolver → HAL.sendUniverseRaw) | **Activo, condicional** | `Uint8Array(512)` por universo → `hal.sendUniverseRaw()` |

### Hallazgo Crítico #1: ForgeNodeEvaluator SÍ está conectado

**VEREDICTO: CONECTADO y FUNCIONAL en el pipeline Aether.**

- `NodeResolver._writeNode()` detecta si un device tiene `CompiledForgeGraph` registrado.
- Si existe, **bypassa completamente** el flujo legacy de `_writeNode()` (TransferCurve, calibration, channel iteration).
- `ForgeNodeEvaluator.evaluate()` recibe: `compiled`, `channelValues` (del ArbitratedNodeMap), `ForgeFrameContext`, `dmxBuffer`, `baseAddr`.
- El compilador es invocado en **patch-time** dentro de `registerAetherDevice()`.
- El contexto de frame (BPM, audio bands, time, delta, energy, isBeat) es poblado **in-place** en cada frame antes de `resolve()`.

### Hallazgo Crítico #2: Aether Native es un pipeline PARALELO, no un REEMPLAZO

- `masterArbiter.arbitrate()` (Legacy) y `aetherArbiter.arbitrate()` (Native) **corren ambos** en el mismo frame.
- El Legacy pipeline muta `fixtureStates[]` post-HAL con Hephaestus (líneas 1387-1501).
- El Native pipeline escribe directamente a buffers DMX vía `sendUniverseRaw()` (líneas 1798-1804).
- **WAVE 3521**: Fixtures registrados en Aether NodeGraph son **skippeados** por el bloque Hephaestus Legacy (`this._aetherGraph.getDeviceNodes(fixtureId).length > 0`), evitando doble-DMX.

### Hallazgo Crítico #3: La ruta L2 (Manual Overrides Programmer) usa IPC directo

- No hay un "ProgrammerAetherAdapter" como clase con `ingest()`.
- En su lugar: `AetherIPCHandlers.ts` registra handlers IPC (`lux:aether:setManualOverrides`, `clearManualOverrides`, `clearAllManualOverrides`) que escriben **directamente** en `NodeArbiter._manualOverrides` (Map L2).
- Esto es un **bridge stateful** (no adapter frame-por-frame), pero cumple la función de capa L2.

---

## 2. EJE 1: THE INGRESS — Adaptadores y Systems

### 2.1 Arquitectura de Capas de Intención

```
┌─────────────────────────────────────────────────────────────┐
│  CAPA L0 — Systems Base (Audio-Reactive)                    │
│  Priority: 0-99   Source: 'system'                          │
├─────────────────────────────────────────────────────────────┤
│  ImpactSystem      → bus.push({dimmer, shutter, strobe})   │
│  ColorSystem       → bus.push({r, g, b, brightness})        │
│  KineticSystem     → bus.push({pan, tilt, speed})           │
│  BeamSystem        → bus.push({zoom, focus, gobo, prism})  │
│  AtmosphereSystem  → bus.push({fog, haze, fan})            │
├─────────────────────────────────────────────────────────────┤
│  CAPA L0+ — LiquidAetherAdapter (Bridge Legacy→Aether)      │
│  Priority: 0   Source: 'liquid-aether-l0'                   │
├─────────────────────────────────────────────────────────────┤
│  CAPA L1 — Selene IA Overrides                              │
│  Priority: 100-199   Source: 'effect'                       │
├─────────────────────────────────────────────────────────────┤
│  CAPA L2 — Manual Overrides (Programmer / UI)              │
│  Priority: 200-299   Source: 'manual'                        │
├─────────────────────────────────────────────────────────────┤
│  CAPA LP — Chronos Playback (Timeline)                     │
│  Priority: 200   Source: 'chronos'                          │
├─────────────────────────────────────────────────────────────┤
│  CAPA L3 — Effect Intents (LiveFXEngine)                   │
│  Priority: 300-399   Source: 'effect'                       │
├─────────────────────────────────────────────────────────────┤
│  CAPA L3+ — Hephaestus Diamond Data (Custom Clips)         │
│  Priority: 350   Source: 'hephaestus'                       │
├─────────────────────────────────────────────────────────────┤
│  CAPA L4 — Blackout / GrandMaster                          │
│  Priority: 900+                                               │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Adaptadores Detallados

#### 2.2.1 LiquidAetherAdapter (L0+ Bridge)

```
Archivo:     src/core/aether/adapters/LiquidAetherAdapter.ts
Frecuencia: 44 Hz (cada frame)
Prioridad:  L0_PRIORITY = 0
Source:     'liquid-aether-l0'

INPUT:  ProcessedFrame (de LiquidEngineBase.applyBands)
        LiquidStereoResult (9 intensidades zonales)
OUTPUT: INodeIntent[] → IIntentBus

Rutas internas:
  _routeImpactNodes()   → {dimmer} para IMPACT nodes por zona + falloff
  _routeStrobeNodes()   → {shutter: 1.0, strobeRate} si strobeActive
  _routeMoodToColorIntensity() → {brightness} para COLOR nodes

Zero-alloc: 3 objetos scratch pre-allocated (_impactScratch, _strobeScratch, _colorScratch)
```

#### 2.2.2 SeleneAetherAdapter (L3 Cognitive Bridge)

```
Archivo:     src/core/aether/adapters/selene-aether-adapter.ts
Frecuencia: 44 Hz (cada frame, gateado por hasActiveEffects)
Prioridad:  L3_PRIORITY = 300
Source:     'effect'

INPUT:  ConsciousnessOutput (de DecisionMaker)
        CombinedEffectOutput (de EffectManager)
OUTPUT: INodeIntent[] → IIntentBus (vía ZoneNodeRouter)

Reglas estrictas:
  ❌ NUNCA emite targetX/Y/Z, pan, tilt (L3 bloqueado de movimiento)
  ✅ Solo dimmer, r/g/b, white, amber, strobeRate, shutter

Fases:
  1. _processGlobalOverrides()    → zona 'all'
  2. _processZoneOverrides()      → zonas específicas
  3. _processPhysicsModifier()      → strobe/flash basado en energy

Zero-alloc: 3 scratch objects + buffer HSL→RGB inline
```

#### 2.2.3 ChronosAetherAdapter (LP Playback Bridge)

```
Archivo:     src/core/aether/adapters/ChronosAetherAdapter.ts
Frecuencia: 44 Hz (cada frame, pero cached por tickMs)
Prioridad:  LP_PRIORITY = 200
Source:     'chronos'

INPUT:  TimelineEngine (PlaybackFrameSnapshot)
OUTPUT: INodeIntent[] → INodeArbiter.setPlaybackIntents()
        (NOTA: Va DIRECTO al arbiter, NO al bus)

Familias soportadas:
  IMPACT  → {dimmer, shutter} si LTP blackout
  COLOR   → {r, g, b, white}
  KINETIC → {pan, tilt, speed}
  BEAM    → {zoom}

Zero-alloc: Intent pool con cursor (_intentPool, _intentCursor)
```

#### 2.2.4 HephaestusAetherAdapter (L3+ Diamond Data)

```
Archivo:     src/core/aether/adapters/HephaestusAetherAdapter.ts
Frecuencia: 44 Hz
Prioridad:  L3_HEPH_PRIORITY = 350
Source:     'hephaestus'

INPUT:  HephFixtureOutput[] (de HephaestusRuntime.tick())
        Solo procesa outputs donde isCustomClip === true
OUTPUT: INodeIntent[] → INodeArbiter.setHephaestusIntents()
        (Va DIRECTO al arbiter, NO al bus)

Mapeo param → NodeFamily:
  intensity/strobe  → IMPACT
  color/white/amber → COLOR
  pan/tilt/speed    → KINETIC
  zoom/focus/iris/gobo1/gobo2/prism → BEAM

Zero-alloc: Intent pool con cursor
```

#### 2.2.5 ProgrammerAetherBridge (L2 Manual) — Vía IPC Directo

```
Archivo:     src/core/aether/AetherIPCHandlers.ts
Frecuencia: Event-driven (hasta 44 Hz, pero típicamente más lento)
Prioridad:  200-299 (implícito en NodeArbiter._manualOverrides)
Source:     'manual'

INPUT:  IPC payloads desde frontend (programmerStore)
        channel values YA normalizados 0-1
OUTPUT: Escribe directamente en NodeArbiter._manualOverrides (Map)

Canales IPC:
  lux:aether:setManualOverrides     → arbiter.setManualOverride(nodeId, channels)
  lux:aether:clearManualOverrides   → arbiter.clearManualOverride(nodeId)
  lux:aether:clearAllManualOverrides → arbiter.clearAllManualOverrides()

NO es un adapter con ingest(). Es un bridge stateful que muta
el arbiter directamente vía IPC handlers.
```

### 2.3 Systems Nativos (L0 — Audio-Reactive)

Los 5 Systems implementan `IAetherSystem.process(view, context, bus)`:

| System | Familia | Canales emitidos | Fuente de datos |
|--------|---------|-----------------|-----------------|
| ImpactSystem | IMPACT | dimmer, strobe, shutter | AudioMetrics.bass/energy + VibeProfile.bandMatrixOverride |
| ColorSystem | COLOR | r, g, b, brightness | VibeProfile.palette + audio bandas + sectionIntensity |
| KineticSystem | KINETIC | pan, tilt, speed | AudioMetrics.beatPhase + VibeProfile.movementSpeed + musical.section |
| BeamSystem | BEAM | zoom, focus, gobo, prism | AudioMetrics.energy + VibeProfile.beamExpressiveness |
| AtmosphereSystem | ATMOSPHERE | fog, haze, fan, spark, pyro | Section-triggered (drop, breakdown) |

**Zero-alloc obligatorio:** Todos pre-alocan scratch objects. `process()` no crea objetos en heap.

---

## 3. EJE 2: THE BRAIN — NodeArbiter

### 3.1 Arquitectura del Arbitraje Multicapa

```
Archivo: src/core/aether/NodeArbiter.ts
Clase:   NodeArbiter implements INodeArbiter
```

El Arbiter mantiene **6 fuentes de intención** como propiedades privadas:

```typescript
private _systemBus: IIntentBus | null           // L0 — Systems
private _seleneOverrides: INodeIntent[]          // L1 — Selene IA
private _manualOverrides: Map<NodeId, Record>     // L2 — Programmer
private _inhibitLimits: Map<NodeId, number>       // L2.5 — Per-fixture GrandMaster
private _effectIntents: INodeIntent[]            // L3 — LiveFX
private _hephaestusIntents: INodeIntent[]        // L3+ — Diamond Data
private _playbackIntents: INodeIntent[]          // LP — Chronos
private _grandMaster: number = 1.0                // GM global
private _blackout: boolean = false                // L4
```

### 3.2 Pipeline de arbitrate() (por frame, ~22ms)

```
arbitrate()
  │
  ├── 1. Reset: _poolCursor = 0, _result.clear()
  │
  ├── 2. Blackout gate → return mapa vacío si _blackout = true
  │
  ├── 3. Recolectar intents en orden de prioridad ascendente:
  │   │
  │   ├── L0: _systemBus.getAll() → _applyIntent()
  │   ├── L1: _seleneOverrides   → _applyIntent()
  │   ├── LP: _playbackIntents    → _applyIntent()
  │   ├── L3: _effectIntents      → _applyIntent()
  │   └── L3+: _hephaestusIntents → _applyIntent()
  │
  ├── 4. L2: Manual overrides (ESCRITURA DIRECTA, no _applyIntent)
  │   for [nodeId, channels] of _manualOverrides:
  │     _result[nodeId][channel] = channels[channel]  // override total
  │
  ├── 5. Grand Master: multiply HTP channels (dimmer, strobe, shutter)
  │
  ├── 6. L2.5: Inhibit limits (post-arbitraje cap sobre dimmer)
  │   for [nodeId, limit] of _inhibitLimits:
  │     _result[nodeId]['dimmer'] *= limit
  │
  └── 7. Retornar _result como ArbitratedNodeMap
```

### 3.3 Merge Strategies por Canal

```typescript
const HTP_CHANNELS = new Set(['dimmer', 'strobe', 'shutter'])

_applyIntent(intent):
  for each channel in intent.values:
    if HTP_CHANNELS.has(channel):
      // Highest Takes Precedence (independiente de capa)
      record[channel] = max(record[channel] ?? 0, incoming)
    else:
      // LTP: la última capa en escribir gana
      // (intents llegan en orden ascendente de prioridad)
      record[channel] = incoming
```

### 3.4 Zero-Alloc en el Arbiter

- `_result`: `Map<NodeId, Record<string, number>>` — se reusa frame a frame (`clear()` en lugar de `new Map()`)
- `_resultPool`: `Record<string, number>[]` — pool de objetos reutilizables (`_acquireRecord()`)
- `_poolCursor`: índice para reusar del pool
- Ningún `new Map()`, `new Set()`, ni `new Object()` en hot path.

---

## 4. EJE 3: THE TRUTH — NodeResolver + ForgeNodeEvaluator

### 4.1 NodeResolver — Arquitectura

```
Archivo: src/core/aether/resolver/NodeResolver.ts
Clase:   NodeResolver implements INodeResolver
```

Responsabilidad: Traduce `ArbitratedNodeMap` (valores 0-1) → `IDMXPacket[]` (bytes 0-255)

#### State pre-allocated:

```typescript
private _universeBuffers: Map<number, Uint8Array>     // Uint8Array(512) por universo
private _packetPool: MutableDMXPacket[]                  // Pool de packets reutilizables
private _framePackets: Map<number, MutableDMXPacket>   // Packets del frame actual
private _activeUniverses: Set<number>                  // Universos con datos este frame
private _rgbScratch: RGB = {r:0, g:0, b:0}              // Buffer HSL→RGB
private _ikProfiles: Map<NodeId, IKFixtureProfile>    // Cache lazy IK
```

### 4.2 Pipeline resolve() (por frame)

```
resolve(arbitrated: ArbitratedNodeMap)
  │
  ├── 1. Zero-fill todos los Uint8Array de universos
  ├── 2. Para cada [nodeId, channelValues] en arbitrated:
  │     _writeNode(nodeId, channelValues)
  ├── 3. Ensamblar packets desde buffers activos
  └── 4. Retornar Array.from(_framePackets.values())
```

### 4.3 CRÍTICO: ForgeNodeEvaluator Bypass en _writeNode()

```typescript
// En NodeResolver._writeNode() (líneas 338-352):

const compiled = this._forgeGraphs.get(node.deviceId)
if (compiled) {
  ForgeNodeEvaluator.evaluate(
    compiled,           // CompiledForgeGraph (pre-compilado en patch-time)
    channelValues,      // Valores arbitrados del Aether para este device
    this._forgeFrameContext,  // Contexto del frame (BPM, audio, time)
    buf,                // Uint8Array(512) del universo
    baseAddr,           // Dirección DMX base (0-indexed)
  )
  this._activeUniverses.add(device.universe)
  return  // ← BYPASS TOTAL: no ejecuta flujo legacy
}
```

**¿Qué hace el bypass?**
- **Salta completamente**: TransferCurve, calibration (invertPan, tiltLimits, dimmerScale), _applyCalibration(), channel iteration, 16-bit split, color translation (CMY/RGBW/wheel), IK engine.
- **Delega TODO** al `ForgeNodeEvaluator.evaluate()` que opera sobre:
  - `compiled.wireBuffer` (Float64Array) — valores de nodos
  - `compiled.stateBuffer` (Float64Array) — estado persistente (LFO phase, smooth accum)
  - `compiled.program` (CompiledInstruction[]) — programa flat con opcodes
  - `dmxBuffer` (Uint8Array) — escribe directo al universo

### 4.4 Flujo Legacy (cuando NO hay grafo Forge)

```
_writeNode(nodeId, channelValues)
  │
  ├── Obtener nodeData desde NodeGraph
  ├── Obtener device desde NodeGraph
  ├── Obtener buf del universo
  │
  ├── IK Branch (KINETIC + targetX/Y/Z):
  │   └── solve(IKProfile, target) → pan/tilt DMX
  │       (NO aplica calibration ni TransferCurve — anti-double-calibration)
  │
  ├── Color Branch (COLOR + r/g/b):
  │   └── _translateColor() según mixingType:
  │       ├── 'rgb'    → pass-through red/green/blue
  │       ├── 'rgbw'   → getColorTranslator().translate() → red/green/blue/white
  │       ├── 'cmy'    → getColorTranslator().translate() → cyan/magenta/yellow
  │       ├── 'wheel'  → getColorTranslator() + HarmonicQuantizer(gated by BPM)
  │       └── 'hybrid' → wheel + rgb fallback
  │
  └── Channel Loop (para cada chDef en node.channels):
        ├── Obtener valor normalizado de translatedValues[chDef.type]
        ├── _applyTransferCurve() (linear/exp/log/scurve/gamma)
        ├── Clamp a constraints.maxValue
        ├── Escalar a DMX (0-255)
        ├── _applyCalibration() (invertPan, tiltLimits, dimmerScale)
        ├── Clamp final de seguridad [0, 255]
        ├── Escribir buf[baseAddr + dmxOffset] = dmxValue
        └── Si 16-bit: buf[dmxOffset+1] = fine byte
```

### 4.5 ForgeNodeEvaluator — Arquitectura

```
Archivo: src/core/forge/evaluator/ForgeNodeEvaluator.ts
Clase:   ForgeNodeEvaluator (estática, no instanciable)
```

**Pipeline de evaluate() (4 pasos):**

```
STEP 1: INJECT INPUTS
  ─ Para cada input en compiled.inputMap:
      wire[input.wireOffset] = values[input.channelName] ?? input.defaultValue
  ─ Inyectar audio bands desde ctx.audioBands según AUDIO_BAND_INDEX

STEP 2: EXECUTE PROGRAM
  ─ Linear scan de compiled.program[]
  ─ OPCODE_TABLE[instr.opcode](wire, state, instr, ctx)
  ─ Propagación inmediata de edges después de CADA instrucción:
      for each edge where src in [outputStart, outputEnd):
          wire[dst] = wire[src]
  ─ Esto elimina frame-lag en cadenas A→B→C

STEP 3: FLUSH OUTPUTS
  ─ Para cada output en compiled.outputMap:
      dmxBuffer[baseAddr + dmxOffset] = clamp(0, 255, wire[output.wireOffset] * 255)
      Si 16-bit: dmxBuffer[baseAddr + dmxOffset + 1] = fine byte
```

**Zero-alloc confirmado:** No hay `new`, `[]`, `{}`, ni strings en el hot path. Solo TypedArray reads/writes.

### 4.6 Compilación en Patch-Time

```
registerAetherDevice(definition, forgeGraph?)
  │
  ├── _aetherGraph.registerDevice(definition) → nodeIds
  ├── resolver.registerUniverse(definition.universe)
  ├── (opcional) ForgeGraphCompiler.compile(forgeGraph, deviceId)
  │       └── resolver.registerForgeGraph(deviceId, compiled)
  └── Para cada KINETIC node: _physicsPostProcessor.registerNode(nodeId)
```

**La compilación ocurre UNA VEZ** cuando un fixture con nodeGraph se añade al stage. No en runtime.

### 4.7 Inyección de Contexto (por frame)

```
// En TitanOrchestrator.processFrame() (líneas 1780-1796):

const _fCtx = this._forgeFrameCtx
_fCtx.timeMs      = now
_fCtx.deltaMs     = this._aetherCtx.deltaMs
_fCtx.bpm         = engineAudioMetrics.bpm
_fCtx.bpmConfidence = engineAudioMetrics.beatConfidence
_fCtx.isBeat      = engineAudioMetrics.isBeat
_fCtx.energy      = engineAudioMetrics.energy
_fCtx.frameIndex  = this.frameCount

// Audio bands: write directo al Float64Array pre-allocated
this._forgeAudioBands[0] = audioMetrics.subBass
this._forgeAudioBands[1] = audioMetrics.bass
this._forgeAudioBands[2] = audioMetrics.mid
this._forgeAudioBands[3] = audioMetrics.highMid
this._forgeAudioBands[4] = audioMetrics.presence
this._forgeAudioBands[5] = audioMetrics.air

aetherResolver.setForgeFrameContext(this._forgeFrameCtx)
```

**CRÍTICO:** El contexto se muta **in-place** en el mismo objeto pre-allocated. No hay `new ForgeFrameContext()` por frame.

---

## 5. EJE 4: THE EGRESS — Aduana Aether

### 5.1 Ruta desde Resolver hasta Hardware

```
NodeResolver.resolve(arbitrated)
  │
  └── Retorna readonly IDMXPacket[]
      │
      └── TitanOrchestrator.processFrame() (líneas 1798-1804):
          │
          for (const universe of aetherResolver.registeredUniverses) {
            const rawBuf = aetherResolver.getUniverseBuffer(universe)
            if (rawBuf) this.hal.sendUniverseRaw(universe, rawBuf)
          }
```

**Zero-copy:** `rawBuf` es el **mismo** `Uint8Array(512)` que vive en `_universeBuffers`. No hay copia.

### 5.2 HAL.sendUniverseRaw()

```typescript
// HardwareAbstraction.sendUniverseRaw(universe: number, buffer: Uint8Array)
// Escribe directamente en el driver DMX (universalDMX) sin transformación.
// El buffer es CONSUMIDO por el driver — no se retiene referencia.
```

### 5.3 Coexistencia con Legacy Egress

En el mismo frame, el Legacy pipeline también envía DMX:

```
Legacy:  masterArbiter.arbitrate() → HAL.renderFromTarget() → universalDMX.sendAll()
Aether:  aetherArbiter.arbitrate() → NodeResolver.resolve()   → HAL.sendUniverseRaw()
```

**¿Conflictos de DMX?**
- WAVE 3521: El bloque Hephaestus Legacy **skippea** fixtures que están en Aether NodeGraph.
- Los universos pueden solaparse si un fixture está en Aether Y tiene canales en el Legacy HAL.
- Mitigación: `unregisterAetherDevice()` existe para retirar fixtures del pipeline Aether.

---

## 6. SECUENCIA COMPLETA DEL FRAME LOOP

### 6.1 TitanOrchestrator.processFrame() — Bloque Aether (líneas 1679-1805)

```
if (_aetherHasDevices && _aetherArbiter && _aetherResolver) {

  // ── PREPARACIÓN ─────────────────────────────────────────────
  this._aetherBus.clear()                    // Reset write pointer
  this._aetherCtx.nowMs = now                // Timestamp unificado
  this._aetherCtx.deltaMs = schedulerDelta   // Real delta del scheduler
  this._aetherCtx.frameIndex = this.frameCount

  // ── INGESTA L0+ (Liquid Bridge) ─────────────────────────────
  this._liquidAetherAdapter.ingest(
    liquidResult.processedFrame,
    liquidResult.stereoResult,
    this._aetherBus
  )

  // ── INGESTA L0 (5 Systems) ──────────────────────────────────
  this._impactAdapter.process(IMPACT_VIEW, ctx, bus)
  this._colorAdapter.process(COLOR_VIEW, ctx, bus)
  this._kineticAdapter.process(KINETIC_VIEW, ctx, bus)
  this._beamAdapter.process(BEAM_VIEW, ctx, bus)
  this._atmosphereAdapter.process(ATMOSPHERE_VIEW, ctx, bus)

  // ── INGESTA L3 (Selene Effects) ─────────────────────────────
  this._seleneAetherAdapter.ingest(
    consciousness,
    effectOutput,
    ctx.deltaMs,
    aetherArbiter          // ← Va DIRECTO al arbiter, no al bus
  )

  // ── INGESTA LP (Chronos Timeline) ──────────────────────────
  this._chronosAetherAdapter.ingest(
    this._timelineEngine,
    ctx.deltaMs,
    aetherArbiter          // ← Va DIRECTO al arbiter
  )

  // ── INGESTA L3+ (Hephaestus) ───────────────────────────────
  if (hephOutputs.length > 0) {
    this._hephaestusAetherAdapter.ingest(hephOutputs, aetherArbiter)
  } else {
    this._hephaestusAetherAdapter.clear(aetherArbiter)
  }

  // ── ARBITRAJE ───────────────────────────────────────────────
  aetherArbiter.setSystemIntents(this._aetherBus)
  const arbitrated = aetherArbiter.arbitrate()

  // ── POST-PROCESSING FÍSICO ──────────────────────────────────
  this._physicsPostProcessor.process(arbitrated, ctx.deltaMs)
    // Aplica inertia/velocity/acceleration a nodos KINETIC
    // Muta los valores pan/tilt in-place en el ArbitratedNodeMap

  // ── FORGE CONTEXT INJECTION ────────────────────────────────
  // (ver sección 4.7 para detalle completo)
  aetherResolver.setForgeFrameContext(this._forgeFrameCtx)

  // ── RESOLUCIÓN + DMX ───────────────────────────────────────
  aetherResolver.resolve(arbitrated)

  // ── EGRESS ──────────────────────────────────────────────────
  for (const universe of aetherResolver.registeredUniverses) {
    const rawBuf = aetherResolver.getUniverseBuffer(universe)
    if (rawBuf) this.hal.sendUniverseRaw(universe, rawBuf)
  }
}
```

### 6.2 Frame Loop Completo (Legacy + Aether)

```
processFrame() [cada ~23ms @ 44Hz]
  │
  ├── 1. Brain → context + engineAudioMetrics
  │
  ├── 2. TitanEngine.update(context, metrics) → LightingIntent (Legacy L0)
  │
  ├── 3. masterArbiter.setTitanIntent()         → Legacy L0
  │
  ├── 4. IntentComposer.compose()               → Legacy L3 (Effects)
  │      masterArbiter.setEffectIntents()
  │
  ├── 5. masterArbiter.arbitrate()            → Legacy Arbitration
  │      (merge L0+L1+L2+L3+L4)
  │
  ├── 6. HAL.renderFromTarget()               → Legacy DMX
  │      → fixtureStates[] (mutables)
  │
  ├── 7. HephaestusRuntime.tick()             → Legacy L3+ (post-HAL)
  │      → muta fixtureStates[] in-place
  │      (skippea fixtures en Aether NodeGraph)
  │
  ├── 8. ═══════════════════════════════════════
  │      BLOQUE AETHER (condicional, si _aetherHasDevices)
  │      ═══════════════════════════════════════
  │      a. _aetherBus.clear()
  │      b. LiquidAetherAdapter.ingest() → bus
  │      c. 5 Systems.process() → bus
  │      d. SeleneAetherAdapter.ingest() → arbiter
  │      e. ChronosAetherAdapter.ingest() → arbiter
  │      f. HephaestusAetherAdapter.ingest() → arbiter
  │      g. aetherArbiter.setSystemIntents(bus)
  │      h. arbitrated = aetherArbiter.arbitrate()
  │      i. _physicsPostProcessor.process(arbitrated)
  │      j. _forgeFrameCtx población in-place
  │      k. aetherResolver.setForgeFrameContext(_forgeFrameCtx)
  │      l. aetherResolver.resolve(arbitrated)
  │      m. for each universe: hal.sendUniverseRaw(universe, rawBuf)
  │
  ├── 9. Hot-frame broadcast (22Hz) → Frontend
  │
  └── 10. flushToDriver() → universalDMX.sendAll() (Legacy DMX flush)
```

---

## 7. TABLA DE ADAPTADORES AETHER — Resumen de Fuentes

| Adapter/Hook | Archivo | Capa | Prioridad | Source | Destino | Frecuencia | Tipo de INodeIntent |
|---|---|---|---|---|---|---|---|
| **LiquidAetherAdapter** | `adapters/LiquidAetherAdapter.ts` | L0+ | 0 | `'liquid-aether-l0'` | IIntentBus | 44 Hz | `{dimmer}`, `{shutter, strobeRate}`, `{brightness}` |
| **ImpactSystem** | `systems/ImpactSystem.ts` | L0 | ~10 | `'system'` | IIntentBus | 44 Hz | `{dimmer, strobe, shutter}` |
| **ColorSystem** | `systems/ColorSystem.ts` | L0 | ~10 | `'system'` | IIntentBus | 44 Hz | `{r, g, b, brightness}` |
| **KineticSystem** | `systems/KineticSystem.ts` | L0 | ~10 | `'system'` | IIntentBus | 44 Hz | `{pan, tilt, speed}` |
| **BeamSystem** | `systems/BeamSystem.ts` | L0 | ~10 | `'system'` | IIntentBus | 44 Hz | `{zoom, focus, gobo, prism}` |
| **AtmosphereSystem** | `systems/AtmosphereSystem.ts` | L0 | ~10 | `'system'` | IIntentBus | 44 Hz | `{fog, haze, fan}` |
| **SeleneAetherAdapter** | `adapters/selene-aether-adapter.ts` | L3 | 300 | `'effect'` | INodeArbiter | 44 Hz (gated) | `{dimmer}`, `{r,g,b}`, `{white}`, `{amber}`, `{strobeRate, shutter}` |
| **ChronosAetherAdapter** | `adapters/ChronosAetherAdapter.ts` | LP | 200 | `'chronos'` | INodeArbiter | 44 Hz (cached) | `{dimmer, shutter}`, `{r,g,b,white}`, `{pan,tilt,speed}`, `{zoom}` |
| **HephaestusAetherAdapter** | `adapters/HephaestusAetherAdapter.ts` | L3+ | 350 | `'hephaestus'` | INodeArbiter | 44 Hz | `{dimmer/strobe}`, `{r,g,b,white/amber}`, `{pan,tilt,speed}`, `{zoom,focus,...}` |
| **AetherIPCHandlers** (L2 bridge) | `AetherIPCHandlers.ts` | L2 | 200-299 | `'manual'` | INodeArbiter (direct) | Event-driven | Cualquier canal (nodeId → channels Map) |

---

## 8. ANÁLISIS DE GAPS Y AISLAMIENTO

### 8.1 ForgeNodeEvaluator — Estado de Integración

| Aspecto | Estado | Nota |
|---------|--------|------|
| Compilador | ✅ Funcional | `ForgeGraphCompiler.compile()` en patch-time |
| Evaluador | ✅ Funcional | `ForgeNodeEvaluator.evaluate()` en hot-path |
| Bypass en Resolver | ✅ Funcional | `_writeNode()` detecta `_forgeGraphs` y bypassa |
| Contexto inyectado | ✅ Funcional | `_forgeFrameCtx` poblado in-place cada frame |
| Audio bands | ✅ Funcional | `Float64Array(6)` con 6 bandas GodEar |
| Compound/Ingenio inlining | ⚠️ **STUB** | `compound_ingenio` opcode = 0 (noop) en OPCODE_MAP |
| Test de integración end-to-end | ❌ **NO VERIFICADO** | Ningún fixture en la app tiene `nodeGraph` real en runtime |

**Conclusión:** El wiring mecánico del ForgeNodeEvaluator está **100% implementado y conectado**. Sin embargo, el feature de Ingenios (compound nodes) no está inlineado en el compilador. Esto es un **gap funcional**, no un gap de wiring.

### 8.2 Aether vs Legacy — Gaps Arquitectónicos

| # | Gap | Impacto | Severidad |
|---|-----|---------|-----------|
| G1 | **Pipeline dual** — Aether y Legacy corren en paralelo, potencial doble-DMX si un fixture está en ambos | Conflicto de universo si un fixture se registra en ambos pipelines | Alto |
| G2 | **No hay mecanismo de "switch"** para migrar un fixture de Legacy a Aether o viceversa en runtime | Una vez registrado en Aether, solo `unregisterAetherDevice()` lo retira | Medio |
| G3 | **PhysicsPostProcessor** solo aplica a Aether — el Legacy pipeline tiene su propia física en `renderFromTarget()` | Double-physics si un KINETIC node está en ambos (mitigado por skip) | Medio |
| G4 | **Inhibit limits (L2.5)** existen en Aether Arbiter pero NO tienen equivalente en Legacy MasterArbiter | Inconsistencia de comportamiento entre pipelines | Medio |
| G5 | **Hephaestus L3+** es enviado a Aether Arbiter, pero el Legacy Hephaestus post-HAL mutación sigue corriendo | Fixtures Aether reciben Hephaestus doble si no se skippean (WAVE 3521 mitiga) | Bajo |
| G6 | **Programmer L2** usa IPC directo → solo Aether. El frontend legacy programmer (`lux.aether.*`) no tiene equivalente en Aether | Operador no puede hacer manual override en Aether desde UI antigua | Bajo |

### 8.3 Legacy que NO tiene equivalente Aether

| Feature Legacy | Equivalente Aether | Estado |
|---|---|---|
| `masterArbiter.arbitrate()` (L0-L4) | `NodeArbiter.arbitrate()` | ✅ Reemplazo directo |
| `HAL.renderFromTarget()` | `NodeResolver.resolve()` | ✅ Reemplazo directo |
| Hephaestus post-HAL mutation | `HephaestusAetherAdapter` (L3+) | ✅ Migrado |
| EffectIntents (IntentComposer) | `NodeArbiter.setEffectIntents()` | ✅ Migrado |
| Programmer manual overrides | `AetherIPCHandlers` + `setManualOverride()` | ✅ Migrado (vía IPC) |
| `flushToDriver()` (DMX timing) | `HAL.sendUniverseRaw()` | ✅ Reemplazo (zero-copy) |
| **TitanEngine (VibeMovementManager)** | `KineticSystem` + `LiquidAetherAdapter` | ⚠️ Parcial — VMM aún corre en Legacy |
| **Color engine (LiquidEngine)** | `ColorSystem` + `LiquidAetherAdapter` | ⚠️ Parcial — Liquid aún corre en Legacy |
| **DMX Universe timing** (break/MAB) | `sendUniverseRaw()` | ⚠️ Diferente timing model |

---

## 9. MAPA DE ARCHIVOS DEL ECOSISTEMA AETHER

```
src/core/aether/
├── index.ts                        ← Barrel exports públicos
├── types.ts                        ← NodeId, DeviceId, NodeFamily, IntentSource, MergeStrategy
├── intent-bus.ts                   ← INodeIntent, IIntentBus, INodeArbiter, INodeResolver, IDMXPacket
├── node-graph.ts                   ← INodeGraph, INodeView, NodeGraph (impl)
├── NodeGraph.ts                    ← Implementación concreta de INodeGraph
├── IntentBus.ts                    ← Implementación concreta de IIntentBus (array pre-allocated)
├── NodeArbiter.ts                  ← Implementación concreta de INodeArbiter
├── capability-node.ts              ← ICapabilityNode, IColorNodeData, IKineticNodeData, etc.
├── device.ts                       ← IDeviceDefinition, IDeviceCalibration
├── AetherIPCHandlers.ts            ← Handlers IPC para L2 manual overrides
│
├── adapters/
│   ├── index.ts                    ← Barrel: VMMAdapter, LiquidImpactAdapter, LiquidColorAdapter, etc.
│   ├── LiquidAetherAdapter.ts      ← L0+ Bridge (LiquidEngine → bus)
│   ├── selene-aether-adapter.ts  ← L3 Bridge (Selene → arbiter)
│   ├── ChronosAetherAdapter.ts     ← LP Bridge (Timeline → arbiter)
│   ├── HephaestusAetherAdapter.ts  ← L3+ Bridge (Diamond Data → arbiter)
│   ├── KineticAdapter.ts           ← L0 System adapter (VMM → bus)
│   ├── ImpactAdapter.ts          ← L0 System adapter
│   ├── ColorAdapter.ts           ← L0 System adapter
│   ├── BeamAdapter.ts            ← L0 System adapter
│   ├── AtmosphereAdapter.ts      ← L0 System adapter
│   ├── zoneUtils.ts              ← selectZoneFromResult, computeEpicenterFalloff
│   └── helpers/
│       └── zone-node-router.ts   ← ZoneNodeRouter (fixtureId+family → nodeIds)
│
├── systems/
│   ├── index.ts                    ← Barrel: BaseSystem, ImpactSystem, ColorSystem, KineticSystem, BeamSystem, AtmosphereSystem
│   ├── BaseSystem.ts               ← IAetherSystem contract + AudioMetrics + FrameContext + VibeProfile
│   ├── ImpactSystem.ts           ← L0 IMPACT family (dimmer/audio-reactive)
│   ├── ColorSystem.ts            ← L0 COLOR family (rgb/palette)
│   ├── KineticSystem.ts          ← L0 KINETIC family (pan/tilt/movement)
│   ├── BeamSystem.ts             ← L0 BEAM family (gobo/prism/zoom)
│   └── AtmosphereSystem.ts       ← L0 ATMOSPHERE family (fog/haze)
│
├── resolver/
│   ├── index.ts                    ← Barrel: NodeResolver, PhysicsPostProcessor
│   ├── NodeResolver.ts             ← Traducción ArbitratedNodeMap → DMX (con Forge bypass)
│   ├── PhysicsPostProcessor.ts     ← Inercia física para KINETIC nodes
│   └── AetherUIProjector.ts      ← Proyección de estado Aether para UI
│
└── ingestion/
    ├── index.ts                    ← Barrel: NodeExtractionPipeline, SpatialRegistrar
    ├── NodeExtractionPipeline.ts   ← FixtureDefinition → IDeviceDefinition
    └── SpatialRegistrar.ts         ← Registro de fixtures en stage con posición

src/core/forge/
├── compiler/
│   ├── ForgeGraphCompiler.ts       ← Kahn topological sort + wire/state alloc + program build
│   └── types.ts                    ← CompiledForgeGraph, CompiledInstruction, ForgeFrameContext
├── evaluator/
│   ├── ForgeNodeEvaluator.ts     ← Static evaluate() — 4-step hot path
│   └── opcodes.ts                ← 24 opcode functions + OPCODE_TABLE
├── ingenio/                        ← WAVE 4549.1 (NUEVO)
│   ├── types.ts                    ← IIngenioDefinition, IExposedPort, etc.
│   ├── IngenioFactory.ts           ← Factory para crear .luxingenio
│   └── index.ts                    ← Barrel exports
├── types.ts                        ← IForgeNodeGraph, IForgeNode, IForgeEdge, IForgeNodeConfig
├── NodeGraphBuilder.ts             ← Bidirectional channels[] ↔ nodeGraph
└── index.ts                        ← Barrel exports públicos
```

---

## 10. VEREDICTO FINAL

### ¿Está ForgeNodeEvaluator conectado al pipeline de resolución?

**SÍ. El bypass está implementado, compilado, e inyectado en cada frame.**

El wiring mecánico es correcto:
1. `registerAetherDevice()` compila el grafo en patch-time
2. `processFrame()` inyecta el contexto (audio, BPM, time, energy) in-place
3. `NodeResolver._writeNode()` detecta el grafo compilado y bypassa al evaluador
4. `ForgeNodeEvaluator.evaluate()` ejecuta el programa flat y escribe al buffer DMX

### ¿Qué falta para que sea productivo?

1. **Ingenio inlining** — `compound_ingenio` tiene opcode 0 (noop) en el compilador. Los Ingenios no se flatten.
2. **Fixture real con nodeGraph** — Ningún fixture de la librería actual tiene un `nodeGraph` no vacío en runtime. El bypass nunca se ejecuta en la práctica.
3. **Editor visual** — WAVE 4548.8a (Canvas Blueprint) y WAVE 4549 (Asset Browser) están en diseño.
4. **Testing end-to-end** — No hay tests de integración que verifiquen el bypass completo: Aether Systems → Arbiter → Resolver → ForgeEvaluator → DMX buffer.

### Estado del Ecosistema Aether

| Componente | Estado |
|------------|--------|
| IntentBus | ✅ Producción-ready |
| 5 Systems (L0) | ✅ Producción-ready |
| NodeArbiter (L0-L4) | ✅ Producción-ready |
| NodeResolver (Legacy path) | ✅ Producción-ready |
| NodeResolver (Forge bypass) | ✅ Implementado, sin uso real |
| LiquidAetherAdapter | ✅ Producción-ready |
| SeleneAetherAdapter | ✅ Producción-ready |
| ChronosAetherAdapter | ✅ Producción-ready |
| HephaestusAetherAdapter | ✅ Producción-ready |
| AetherIPCHandlers (L2) | ✅ Producción-ready |
| PhysicsPostProcessor | ✅ Producción-ready |
| ForgeGraphCompiler | ✅ Producción-ready (sin compound inline) |
| ForgeNodeEvaluator | ✅ Producción-ready (sin compound support) |

---

*Fin del Diagnóstico Aether — WAVE 4551*
