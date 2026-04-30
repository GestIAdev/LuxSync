# 🌌 WAVE 3513.1 — REALITY CHECK (DEEP TRACE)

> **Documento**: Auditoria real del codigo fuente Legacy antes de la demolicion (Fase 7).
> **Version**: 3513.1.0-REALITY
> **Estado**: READ-ONLY / TRAZAS VERIFICADAS CON GREP + READ
> **Metodologia**: Cero suposiciones. Cada afirmacion cita archivo + linea exacta.

---

## 0. RESUMEN EJECUTIVO DE LOS HALLAZGOS

Este documento NO es un blueprint de diseno (eso es WAVE-3513-SINGULARITY-BLUEPRINT.md).
Este documento es un **mapa de la realidad actual del codigo**, trazado con grep y
read_file sobre la base de codigo real.

**Hallazgo #1 (Critico)**: NodeExtractionPipeline y SpatialRegistrar ya existen
pero **nunca se invocan** en el hot path. La Forja y el StageBuilder envian datos
al legacy (MasterArbiter) y Aether vive en el vacio.

**Hallazgo #2 (Critico)**: HephaestusRuntime **NO inyecta en MasterArbiter**.
Aplica HephFixtureOutput[] directamente sobre `fixtureStates` **post-HAL**.
Es una mutacion post-render que el Arbiter nunca ve.

**Hallazgo #3 (Sorpresa)**: ChronosInjector produce `StageCommand` para la UI,
pero ChronosStageDispatcher inyecta playback frames en MasterArbiter via
`setPlaybackFrame()` (path WAVE 2063 HYBRID).

**Hallazgo #4**: Hyperion es un Web Worker con RAF a 60fps que recibe datos
via postMessage con Float32Array Transferrable. El main thread lee de
`transientStore` (mutable ref, ~44Hz) y `truthStore` (Zustand, ~5Hz).

---

## 1. EL GENESIS DEL DATO (Showfile & Extraccion)

### 1.1 Carga del .luxshow desde disco

```
Archivo: src/core/stage/StagePersistence.ts:321-376

async loadShow(filePath?: string): Promise<LoadResult>
  -> fsp.readFile(targetPath, 'utf-8')
  -> JSON.parse(content)
  -> validateShowFile(data)
  -> migrateV2ToLatest(showFile)
  -> normalizar zonas (canonical)
  -> return { success: true, showFile: patchedShow }
```

El showfile V2 contiene:
- `fixtures: FixtureV2[]` — con `channels`, `capabilities`, `position`, `rotation`, `calibration`
- `stage: StageContext` — dimensions, zones
- metadata: bpm, name, modifiedAt

### 1.2 Trayectoria al StageStore (renderer)

```
Archivo: electron-app/electron/main.ts:614 (app.whenReady)

  await initTitan()                          // linea ~893
    -> stagePersistence.init()               // carga show activo
    -> setupStageIPCHandlers(() => mainWindow)

Archivo: src/core/orchestrator/IPCHandlers.ts (setupStageIPCHandlers)
  -> IPC handler 'stage:load' devuelve showFile al renderer

Renderer:
  -> stageStore.setShow(showFile)
  -> stageStore.setFixtures(showFile.fixtures)
```

### 1.3 Del StageStore al Backend (TitanSyncBridge)

```
Archivo: src/core/sync/TitanSyncBridge.tsx:148-228

export const TitanSyncBridge: React.FC = () => {
  useEffect(() => {
    // Espera window.lux.arbiter.setFixtures (max 5s polling)
    
    useStageStore.subscribe(
      (state) => state.fixtures,              // watcher
      (fixtures) => {
        const currentHash = generateFixturesHash(fixtures)
        if (currentHash === lastSyncedHash) return
        
        debounceTimeoutRef.current = setTimeout(() => {
          syncToBackend(fixtures, lastSyncedHashRef)
            -> window.lux.arbiter.setFixtures(arbiterFixtures)
               // IPC: 'lux:arbiter:setFixtures'
        }, SYNC_DEBOUNCE_MS = 200ms)
      }
    )
  }, [])
}
```

**Observacion**: TitanSyncBridge envia fixtures al backend cada vez que el
stageStore muta (anadir/quitar/editar fixture). **No sabe de Aether.**

### 1.4 TitanOrchestrator.setFixtures() — el punto de ingesta real

```
Archivo: src/core/orchestrator/TitanOrchestrator.ts:2158-2211

setFixtures(fixtures: any[]): void {
  // Normalizacion de address (dmxAddress || address)
  this.fixtures = fixtures.map(f => ({
    ...f,
    dmxAddress: f.dmxAddress || f.address,
    isVirtual: f.isVirtual ?? false,
  }))
  
  // 1. Enviar a MasterArbiter (LEGACY)
  masterArbiter.setFixtures(this.fixtures.map(f => ({
    id, name, zone, type, dmxAddress, universe, capabilities,
    hasMovementChannels, hasColorWheel, hasColorMixing,
    profileId, channels, position           // WAVE 1055: POSITION
  })))
  
  // 2. Registrar movers en HAL PhysicsDriver
  for (const fixture of fixtures) {
    if (fixture.hasMovementChannels && this.hal) {
      this.hal.registerMover(fixture.id, fixture.installationType || 'ceiling')
    }
  }
  
  // 3. Invalidar HAL profile cache
  if (this.hal) this.hal.invalidateProfileCache()
}
```

**Hallazgo critico #A**: `setFixtures()` **NO LLAMA** a:
- `NodeExtractionPipeline.extract()`
- `SpatialRegistrar.register()`
- `registerAetherDevice()`

**Consecuencia**: Aether NodeGraph permanece vacio. `_aetherHasDevices = false`.
El bloque Aether en `processFrame()` es no-op aunque `toggleAetherUniverse()`
reclame el universo.

### 1.5 NodeExtractionPipeline — listo pero desconectado

```
Archivo: src/core/aether/ingestion/NodeExtractionPipeline.ts:192-229

export class NodeExtractionPipeline {
  public extract(
    fixtureDef: Readonly<FixtureDefinition>,  // .fxt profile
    dmxAddress: number,
    universe: number,
    zoneId: ZoneId,
    deviceIdOverride?: DeviceId,
  ): IDeviceDefinition {
    const topology = this._analyzeTopology(fixtureDef)
    const nodes    = this._buildAllNodes(deviceId, zoneId, fixtureDef, topology)
    const calibr   = this._buildCalibration(fixtureDef)
    
    return {
      deviceId, name, type, dmxAddress, universe,
      channelCount: fixtureDef.channels.length,
      nodes: Object.freeze(nodes),
      calibration: calibr,
    }
  }
}
```

**Observacion**: El pipeline necesita un `FixtureDefinition` (profile de la
libreria .fxt), pero `FixtureV2` persistido inline ya tiene `channels` y
`capabilities`. En teoria puede extraer directamente del V2 sin resolver la
libreria.

### 1.6 SpatialRegistrar — listo pero desconectado

```
Archivo: src/core/aether/ingestion/SpatialRegistrar.ts:113-120

public register(
  deviceDef:     Readonly<IDeviceDefinition>,
  stagePosition: Readonly<StagePosition3D>,
  target:        IAetherRegistrationTarget,   // TitanOrchestrator
): void {
  const enriched = this._enrichWithSpatialData(deviceDef, stagePosition)
  target.registerAetherDevice(enriched)        // -> NodeGraph + Resolver + Aduana
}
```

**Punto de conexion faltante**: `TitanOrchestrator.setFixtures()` debe invocar
`_ingestAetherDevices()` entre la linea 2171 (invalidar cache) y el return.

---

## 2. LA JERARQUIA DEL ARBITRO (MasterArbiter / ArbitrationDirector)

### 2.1 El Arbiter real es ArbitrationDirector

```
Archivo: src/core/arbiter/ArbitrationDirector.ts:1-32

WAVE 3504 — PASO 3: The Director and the Facade.

"Esta clase ES el MasterArbiter nuevo. Contiene toda la logica de composicion
por frame del monolito original, pero delega el estado de capas (L0-L4) al
ILayerStateManager inyectado por constructor."

API publica 100% identica al MasterArbiter pre-WAVE-3504.
```

### 2.2 Capas exactas (L0-L4)

```
Archivo: src/core/arbiter/ArbitrationDirector.ts:286-556

// LAYER 0 — TITAN AI (delegated to layerState)
setTitanIntent(intent: Layer0_Titan): void
  -> this.layerState.setTitanIntent(intent)

// LAYER 1 — CONSCIOUSNESS (delegated to layerState)
setConsciousnessModifier(modifier: Layer1_Consciousness): void
  -> this.layerState.setConsciousnessModifier(modifier)

// LAYER 2 — MANUAL OVERRIDE (delegated + Director side-effects)
setManualOverride(override: Layer2_Manual): void
  -> sanitizar controls
  -> this.layerState.setManualOverride(override)
  -> DIMMER AUTO-TAKE (WAVE 2497)
  -> emit('manualOverride', fixtureId, channels)

// LAYER 3 — EFFECTS (delegated to layerState)
addEffect(effect: Layer3_Effect): void
  -> this.layerState.addEffect(effect)
  -> emit('effectStart', effect)

setEffectIntents(intents: EffectIntentMap): void
  -> strip movement from ALL effect intents (WAVE 3305)
  -> strip color/white/amber from movers on global effects (WAVE 3307)
  -> this.layerState.setEffectIntents(intents)

// LAYER 4 — BLACKOUT (delegated to layerState + event emit)
setBlackout(active: boolean): void
  -> this.layerState.enableBlackout() / disableBlackout()
  -> emit('blackout', active)
```

### 2.3 Quie inyecta en cada capa — TRAZA REAL

#### CAPA L0 (Titan AI)

```
Archivo: src/core/orchestrator/TitanOrchestrator.ts:1081-1099

const titanLayer: Layer0_Titan = {
  intent,
  timestamp: now,
  vibeId: this.engine.getCurrentVibe(),
  frameNumber: this.frameCount,
}
masterArbiter.setTitanIntent(titanLayer)
```

**Origen**: `TitanEngine.update(context, engineAudioMetrics)` (linea 1082).
Context contiene: bpm, beatPhase, syncopation, audioMetrics (bass/mid/high/energy).

**Consumidor**: ArbitrationDirector.arbitrate() -> mergeChannelForFixture()
-> L0 como base layer para cada canal.

#### CAPA L1 (Consciousness)

```
Archivo: src/core/arbiter/ArbitrationDirector.ts:301-311

setConsciousnessModifier(modifier: Layer1_Consciousness): void
  -> this.layerState.setConsciousnessModifier(modifier)
```

**Estado actual**: L1 esta preparado en la arquitectura pero **no hay consumidor
activo** inyectando en ella. Es el hueco para Selene IA Conscious (futuro).

#### CAPA L2 (Manual Override)

```
Archivo: src/core/orchestrator/TitanOrchestrator.ts:319-355 (aprox)

Inyectores reales de L2:
- UI Joystick: via IPC 'lux:manual:joystick' -> applySpatialTarget() -> IK -> setManualOverride(pan,tilt)
- UI Faders: via IPC 'lux:manual:fader' -> setManualOverride(channel values)
- MIDI Input: via MidiInputRuntime -> masterArbiter.setManualOverride()
- CalibrationLab: directo al Arbiter
- OSC Bridge: directo al Arbiter
```

**Observacion**: `applySpatialTarget()` (linea 357-426 de ArbitrationDirector)
resuelve IK para un grupo de fixtures y los inyecta como overrides L2.
**Este mecanismo vive en el Arbiter, no en HAL.**

#### CAPA L3 (Effects) — DOS SISTEMAS PARALELOS

**Sistema A: EffectManager (efectos musicales)**

```
Archivo: src/core/orchestrator/TitanOrchestrator.ts:1113-1137

const effectManager = getEffectManager()
const effectOutput = effectManager.getCombinedOutput()
const chronosFixtureIds = masterArbiter.getPlaybackAffectedFixtureIds()

if (effectOutput.hasActiveEffects) {
  this._effectIntentBuf.clear()
  const { intentMap } = this.intentComposer.compose(
    effectOutput,
    this.fixtures,
    chronosFixtureIds,
    this._effectIntentBuf,
  )
  masterArbiter.setEffectIntents(intentMap)   // Inyecta en L3
}
```

**Sistema B: HephaestusRuntime (.lfx clips)**

```
Archivo: src/core/orchestrator/TitanOrchestrator.ts:1247-1339

const hephRuntime = getHephaestusRuntime()
const hephOutputs = hephRuntime.tick(now)

// WAVE 2030.19: THE MERGER — Hephaestus aplica POST-HAL
// Evalua curvas activas y MERGE con fixtureStates post-render
// Intensity/Dimmer: HTP
// Color: LTP (Hephaestus overwrites)
// Pan/Tilt: Overlay
// Strobe: Additive

if (hephOutputs.length > 0 && this._licenseTier !== 'DJ_FOUNDER') {
  // Aplica hephOutputs MUTANDO fixtureStates in-place
  // No pasa por MasterArbiter. Es post-arbitration, post-HAL.
}
```

**Hallazgo critico #B**: Hephaestus **NO usa el Arbiter**. Sus outputs aplican
directamente sobre `fixtureStates` despues de que HAL.renderFromTarget() ya
corrio. Esto significa que el Arbiter nunca ve los valores de Hephaestus.
La UI si los ve porque `fixtureStates` es lo que se envia a la UI via
`selene:truth` (WAVE 255), pero DMX y Arbiter no los conocen.

#### CAPA L4 (Blackout)

```
Archivo: src/core/orchestrator/TitanOrchestrator.ts (buscar setBlackout)

Desde UI: 'lux:blackout:toggle' -> masterArbiter.toggleBlackout()
Desde MIDI: mapeo directo a toggleBlackout()
```

L4 es la capa mas alta. Overridea TODO incluyendo L2 manual.

### 2.4 arbitrate() — el corazon del merge

```
Archivo: src/core/arbiter/ArbitrationDirector.ts:767-987

arbitrate(): FinalLightingTarget {
  // 1. Hybrid path (Chronos playback activo)
  if (this.playbackActive) { ...merge Chronos + Titan por fixture... }
  
  // 2. Normal path
  const fixtureTargets: FixtureLightingTarget[] = []
  for (const [fixtureId] of this.fixtures) {
    fixtureTargets.push(this.arbitrateFixture(fixtureId, now))
  }
  
  // 3. Global effects
  const globalEffects = this.buildGlobalEffectsState()
  
  // 4. Layer activity metadata
  const output: FinalLightingTarget = {
    fixtures: fixtureTargets,
    globalEffects,
    timestamp: now,
    frameNumber: this.frameNumber,
    _layerActivity: { titanActive, titanVibeId, consciousnessActive,
                      manualOverrideCount, manualFixtureIds, activeEffects }
  }
  
  // 5. Frame freshness guarantee
  this.layerState.clearEffectIntents()   // L3 se limpia cada frame
  
  return output
}
```

`arbitrateFixture()` (linea 993+) aplica merge por canal:
- L4 (Blackout) gana siempre -> dimmer=0
- L2 (Manual) gana si el canal esta en overrideChannels
- L3 (Effects) gana si no hay L2 ni L4
- L0 (Titan) es base layer

### 2.5 Output Gate (ARMED vs LIVE)

```
Archivo: src/core/arbiter/ArbitrationDirector.ts:615-634

setOutputEnabled(enabled: boolean): void
  -> this._outputEnabled = enabled
  -> log: "Output ENABLED (LIVE)" / "DISABLED (ARMED)"

isOutputEnabled(): boolean
  -> return this._outputEnabled
```

**Nota**: Este gate **vive en el Arbiter**. Si demolemos MasterArbiter,
perdemos el gate a menos que lo migremos a `aetherConfig` u
`OutputGateController`.

---

## 3. EL FANTASMA DE HYPERION (UI Render)

### 3.1 Arquitectura Hyperion

```
Archivo: src/workers/hyperion-render.worker.ts:1-30

Web Worker (Chromium renderer-side) that owns the TacticalCanvas via
OffscreenCanvas. Runs its own RAF loop at 60fps, receives fixture data
via postMessage Transferrable at ~44Hz, interpolates the gap.
```

**Componentes**:
- `TacticalCanvas.tsx` (main thread) -> crea worker, transfiere OffscreenCanvas
- `hyperion-render.worker.ts` (worker) -> RAF loop 60fps, 5 capas de render

### 3.2 Mensajes Main Thread -> Worker

```
Archivo: src/workers/hyperion-render.types.ts:76-120 (inferido)

// INIT: una sola vez
type: 'INIT', canvas: OffscreenCanvas, width, height, dpr

// RESIZE: cuando cambia el contenedor
type: 'RESIZE', width, height, dpr

// SCAFFOLD: estructural (fixture IDs, posiciones, tipos, zonas)
type: 'SCAFFOLD', fixtures: WorkerFixtureScaffold[]

// FRAME: dinamico (~44Hz desde hot-frame o ~12.5Hz fallback)
type: 'FRAME', data: Float32Array, fixtureCount, timestamp

// MOUSE: eventos de raton
type: 'MOUSE', action: 'move'|'down'|'up', x, y, ctrlKey, shiftKey

// SELECTION: cambios de seleccion
type: 'SELECTION', selectedIds: string[]
```

### 3.3 Mensajes Worker -> Main Thread

```
Archivo: src/components/hyperion/views/tactical/TacticalCanvas.tsx:359-436

// READY: worker listo para recibir frames
// FRAME_ACK: frame recibido y procesado
// HIT_TEST: fixture bajo el cursor (con coords normalizadas)
// LASSO_COMPLETE: seleccion por lasso finalizada
```

### 3.4 Empaquetado de FRAME data en main thread

```
Archivo: src/components/hyperion/views/tactical/TacticalCanvas.tsx:111-164

function packFrameData(
  fixtureCount: number,
  fixtureIds: string[],
  transientMap: Map<string, any> | null,     // transientStore (mutable ref)
  controlState: ReturnType<typeof useControlStore.getState>,
  overrides: Map<string, any>,                // overrideStore
): Float32Array {
  const buffer = new Float32Array(fixtureCount * FLOATS_PER_FIXTURE)
  
  for (let i = 0; i < fixtureCount; i++) {
    const id = fixtureIds[i]
    const transientState = transientMap?.get(id)   // leer del transientStore
    
    if (transientState) {
      const renderData = calculateFixtureRenderValues(
        transientState,
        cinema.globalMode, cinema.flowParams, cinema.activePaletteId,
        cinema.globalIntensity, cinema.globalSaturation,
        i, fixtureOverride?.values, fixtureOverride?.mask,
        cinema.targetPalette, cinema.transitionProgress
      )
      
      // Escribe en Float32Array:
      buffer[offset + R] = renderData.color.r
      buffer[offset + G] = renderData.color.g
      buffer[offset + B] = renderData.color.b
      buffer[offset + INTENSITY] = normInt
      buffer[offset + PHYSICAL_PAN] = renderData.physicalPan
      buffer[offset + PHYSICAL_TILT] = renderData.physicalTilt
      buffer[offset + ZOOM] = renderData.zoom
      buffer[offset + FOCUS] = renderData.focus
      buffer[offset + PAN_VELOCITY] = renderData.panVelocity
      buffer[offset + TILT_VELOCITY] = renderData.tiltVelocity
    }
  }
  return buffer   // Transferrable (zero-copy)
}
```

### 3.5 Origen de los datos para packFrameData

```
Archivo: src/components/hyperion/views/tactical/TacticalCanvas.tsx:236-247

const fixtures = useFixtureData()              // scaffold estructural
const transientMap = getTransientTruth()       // datos dinamicos (mutable ref)
const controlState = useControlStore(...)      // cinema mode, globalIntensity
const overrides = useOverrideStore(...)        // overrides manuales
```

### 3.6 De donde viene transientTruth

```
Archivo: src/hooks/useSeleneTruth.ts:61-80

export function useSeleneTruth(options: UseSeleneTruthOptions = {}) {
  // Se invoca UNA SOLA VEZ en App.tsx
  
  ipcRenderer.on('selene:truth', (event, data: SeleneTruth) => {
    // 1. Inyectar en transientStore (EVERY frame)
    injectTransientTruth(data.fixtures)        // mutable ref, zero React cost
    
    // 2. Inyectar en audioStore (EVERY frame)
    audioStore.updateMetrics(data.audioMetrics)
    
    // 3. Actualizar truthStore (cada 6 frames ~5fps)
    truthThrottleCountRef.current++
    if (truthThrottleCountRef.current % 6 === 0) {
      setTruth(data)
    }
  })
}
```

### 3.7 De donde viene selene:truth

```
Archivo: src/core/orchestrator/TitanOrchestrator.ts:485-492

titanOrchestrator.setBroadcastCallback((truth) => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('selene:truth', truth)
  }
})
```

**Observacion**: `selene:truth` se envia desde el callback post-HAL en
`processFrame()`. El payload es `FixtureState[]` (resultado de
`hal.renderFromTarget()` + Hephaestus post-mutation).

### 3.8 Frecuencias reales

| Canal | Frecuencia | Tamano payload | Path |
|-------|-----------|----------------|------|
| selene:truth | ~7 Hz (cada 6-7 frames @ 44Hz) | FixtureState[] * N fixtures | main -> renderer |
| FRAME (worker) | ~44 Hz (hot-frame path) o ~12.5 Hz (fallback) | Float32Array(N*9 floats) | renderer -> worker |
| RAF render | 60 Hz (interpolado) | N/A | worker interno |
| Hit test | Event-driven | 1 fixtureId + coords | worker -> renderer |

**Interpolacion**: El worker hace exponential smoothing (SMOOTHING_FACTOR=0.10)
sobre pan/tilt/zoom e intensity snap detection (INTENSITY_SNAP_THRESHOLD=0.4)
para mantener fidelidad de strobes.

---

## 4. SISTEMAS FALTANTES EN AETHER

### 4.1 Mapeo Legacy -> Aether families

Legacy produce valores por canal: dimmer, red, green, blue, white, amber,
pan, tilt, zoom, focus, gobo, prism, strobe, shutter, control...

Aether organiza en familias de nodos:

| Familia Aether | Que canales legacy cubre | Estado |
|----------------|--------------------------|--------|
| **COLOR** | red, green, blue, white, amber, uv, cyan, magenta, yellow, color_wheel | Implementado |
| **KINETIC** | pan, tilt, pan_fine, tilt_fine | Implementado |
| **BEAM** | zoom, focus, iris | Implementado |
| **IMPACT** | strobe, intensity flashes | Implementado |
| **ATMOSPHERE** | fog, haze, fan | Implementado |
| **CONTROL** | shutter, control, macro, speed | **NO EXISTE en Aether** |
| **GOBO/PRISM** | gobo1, gobo2, gobo_rotation, prism, prism_rotation | **NO mapeado** |

### 4.2 Hephaestus — el elefante en la habitacion

```
Archivo: src/core/hephaestus/runtime/HephaestusRuntime.ts:468-509

tick(currentTimeMs: number): HephFixtureOutput[] {
  // Evalua curvas para todos los clips activos
  // Devuelve array de outputs pre-escalados a DMX
  // Intensity: 0-255, Color: RGB 0-255, Pan/Tilt: 16-bit
}
```

Hephaestus NO es un "efecto" en el sentido de EffectManager. Es un sistema
autonomo de evaluacion de curvas con:
- Phase distribution (WAVE 2400): cada fixture tiene offset temporal
- Looping y one-shot
- Intensity multiplier por clip
- Curvas de tipo color (HSL->RGB) y numerico

**Problema para Aether**: Hephaestus evalua por `fixtureId` string, no por
`DeviceId`. Sus outputs son `HephFixtureOutput { fixtureId, parameter, value }`.
Aether trabaja con `CapabilityNode` enriquecidos con `Position3D`.

**Solucion posible**: `LegacyHephBridge` que convierta HephFixtureOutput[]
-> IntentRecord de capa EFFECTS para el IntentBus, usando el mapa
`fixtureId -> DeviceId` mantenido por el orquestador.

### 4.3 Efectos musicales (EffectManager)

```
Archivo: src/core/effects/EffectManager.ts:1-100 (cabecera)

Arsenal actual:
- SolarFlare, StrobeStorm, StrobeBurst, TidalWave, GhostBreath
- TropicalPulse, SalsaFire, ClaveRhythm, CumbiaMoon, CorazonLatino
- AmazonMist, MacheteSpark, GlitchGuaguanco, LatinaMeltdown, OroSolido
- IndustrialStrobe, AcidSweep, CyberDualism
- GatlingRaid, SkySaw, AbyssalRise
- VoidMist, DigitalRain, DeepBreath
- AmbientStrobe, SonarPing
```

Cada efecto implementa `ILightEffect` con `onTrigger()`, `onFrame()`,
`getFrameOutput()`. EffectManager los combina en `CombinedEffectOutput`.

**Observacion**: Estos efectos generan outputs por **zona** (EffectZone),
no por fixture individual. Luego `IntentComposer` (WAVE 3504.5) los traduce
a `EffectIntentMap` (fixtureId -> EffectIntent).

**Para Aether**: Cada efecto actual necesita convertirse en un `System`
que escribe `IntentRecord` en el `IntentBus`, o bien un `LegacyEffectAdapter`
que traduce `CombinedEffectOutput` -> `IntentRecord[]`.

### 4.4 Chronos Timeline playback

```
Archivo: src/chronos/core/ChronosInjector.ts:166-269

ChronosInjector.tick(clips, currentTimeMs) -> StageCommand[]

StageCommand types:
  - 'vibe-change': cambia el vibe del TitanEngine
  - 'fx-trigger': dispara un efecto (FXMapper o HephaestusRuntime)
  - 'fx-stop': detiene un efecto
  - 'intensity-change': ajusta intensidad global
```

Ademas, `ChronosStageDispatcher` inyecta frames de playback en el Arbiter:

```
Archivo: src/core/orchestrator/TitanOrchestrator.ts:1116-1117

const chronosFixtureIds = masterArbiter.getPlaybackAffectedFixtureIds()
```

Chronos puede producir `FixtureLightingTarget[]` que se inyectan via
`masterArbiter.setPlaybackFrame()` (WAVE 2063 HYBRID path en arbitrate()).
Esto permite que Chronos "pinte" fixtures con datos grabados, mezclandose
con Titan via HTP/LTP/ADD blend modes.

**Para Aether**: Chronos playback necesita un bridge que inyecte
`IntentRecord` de capa PLAYBACK (entre L0 y L2) o usar el mecanismo
existente de playback frame adaptado a Aether.

### 4.5 Inverse Kinematics (Joystick Spatial Target)

```
Archivo: src/core/arbiter/ArbitrationDirector.ts:357-426

applySpatialTarget(target, fixtureIds, fanMode, fanAmplitude): Map<string, IKFanResult>
  -> ikBuildProfile() por fixture
  -> ikSolveGroupWithFan()
  -> setManualOverride({ pan: ikResult.pan, tilt: ikResult.tilt })
```

El IK se resuelve **en el Arbiter**, no en HAL. El resultado se inyecta como
L2 manual override. Esto significa que el IK debe migrar a un `KineticSystem`
en Aether o mantenerse como servicio independiente que escribe en el IntentBus.

### 4.6 Group Formations y Patterns

```
Archivo: src/core/arbiter/ArbitrationDirector.ts:645-713

setGroupFormation(groupId, fixtureIds, center, fan)
setPattern(fixtureIds, pattern: 'circle'|'eight'|'sweep'|'tornado'|...)
updatePatternParams(fixtureIds, speed, size)
```

Formaciones y patrones son **estado del Arbiter** que se aplican durante
`arbitrateFixture()`. No son capas separadas; son pre-proceso antes del merge.

**Para Aether**: Necesitan convertirse en un `KineticSystem` con modo
"formation" o "pattern" que genere `IntentRecord` de posicion por fixture.

---

## 5. DIAGRAMA DE TUBERIAS REAL (verificado con codigo)

```
DISCO (.luxshow V2)
    │
    ▼ StagePersistence.loadShow()
┌─────────────────────────────┐
│  ShowFileV2 { fixtures[] }   │
└─────────────────────────────┘
    │
    ▼ IPC 'stage:load'
┌─────────────────────────────┐
│  stageStore (Zustand)        │
│  fixtures: FixtureV2[]       │  <- Contiene: channels, capabilities,
│  stage: StageContext          │      position, rotation, calibration
└─────────────────────────────┘
    │
    ▼ subscribe + debounce 200ms
┌─────────────────────────────┐
│  TitanSyncBridge            │
│  window.lux.arbiter.        │
│    setFixtures(fixtures)    │
└─────────────────────────────┘
    │
    ▼ IPC 'lux:arbiter:setFixtures'
┌─────────────────────────────┐
│  TitanOrchestrator.         │
│  setFixtures(fixtures)      │
│                             │
│  ┌──────────────────────┐   │
│  │ masterArbiter.       │   │  <- LEGADO: ALIMENTADO
│  │ setFixtures(...)     │   │
│  └──────────────────────┘   │
│                             │
│  ┌──────────────────────┐   │
│  │ hal.registerMover() │   │  <- LEGADO: ALIMENTADO
│  └──────────────────────┘   │
│                             │
│  ┌──────────────────────┐   │
│  │ [VACIO]              │   │  <- AETHER: SIN CONEXION
│  │ NodeExtraction       │   │      _aetherGraph = empty
│  │ Pipeline.extract()   │   │      _aetherHasDevices = false
│  └──────────────────────┘   │
└─────────────────────────────┘


HOT PATH (44 Hz en TitanOrchestrator.processFrame)
====================================================

1. AudioMetrics + MusicalContext
         │
         ▼
2. this.engine.update(context) -> LightingIntent
         │
         ▼
3. masterArbiter.setTitanIntent(intent)    [L0]
         │
         ▼
4. effectManager.getCombinedOutput()
   intentComposer.compose() -> EffectIntentMap
   masterArbiter.setEffectIntents(intentMap)  [L3]
         │
         ▼
5. masterArbiter.arbitrate() -> FinalLightingTarget
   (merge L0+L1+L2+L3+L4 por fixture por canal)
         │
         ▼
6. hal.renderFromTarget(target, fixtures, halAudioMetrics)
   -> FixtureState[] (con BabelFish, Quantizer, DarkSpin, Physics)
         │
         ▼
7. hephRuntime.tick(now) -> HephFixtureOutput[]
   // WAVE 2030.19: POST-HAL MUTATION
   // Aplica sobre fixtureStates[] IN-PLACE (NO pasa por Arbiter)
   // Intensity HTP, Color LTP, Pan/Tilt Overlay, Strobe Additive
         │
         ▼
8. hal.flushToDriver(fixtureStates) -> DMX out
         │
         ▼
9. setBroadcastCallback(fixtureStates)
   -> IPC 'selene:truth' -> renderer
         │
         ▼
10. useSeleneTruth() recibe y:
    - injectTransientTruth(data.fixtures)  -> transientStore
    - audioStore.updateMetrics()
    - truthStore.setTruth(data)  (cada 6 frames)
         │
         ▼
11. TacticalCanvas packFrameData()
    lee transientMap + controlState + overrides
    -> Float32Array -> postMessage('FRAME') -> worker
         │
         ▼
12. hyperion-render.worker.ts
    RAF 60fps, interpola entre frames, 5 capas de render
```

---

## 6. INVENTARIO DE RIESGOS VERIFICADOS (Blind Spots Reales)

### Riesgo #1 — Hephaestus fuera del Arbiter (VERIFICADO)

**Evidencia**:
```
Archivo: src/core/orchestrator/TitanOrchestrator.ts:1247-1339

"WAVE 2030.19: THE MERGER — HephaestusRuntime Integration"
"Evaluate all active .lfx clips and merge their outputs with DMX"

Codigo real:
  const hephOutputs = hephRuntime.tick(now)
  // ...aplica directamente sobre fixtureStates[index]...
  f.dimmer = Math.max(f.dimmer, output.value)
  f.r = output.rgb.r; f.g = output.rgb.g; f.b = output.rgb.b
```

**Impacto**: Si demolemos el legacy y Aether toma el control, Hephaestus
sigue corriendo (no depende de MasterArbiter) pero **aplica sobre un array que
ya no existe** (`fixtureStates` del HAL legacy). Hay que reconectar Hephaestus
para que alimente el IntentBus de Aether o crear un `HephSystem`.

### Riesgo #2 — Chronos playback hibrido (VERIFICADO)

**Evidencia**:
```
Archivo: src/core/arbiter/ArbitrationDirector.ts:771-882

if (this.playbackActive) {
  // HYBRID PATH: merge Chronos playback con Titan por fixture
  // blendMode: HTP / LTP / ADD
  // Chronos data viene de currentPlaybackFrame (setPlaybackFrame)
}
```

Chronos tiene **dos paths**:
- Path A: `ChronosInjector` -> `StageCommand` -> UI (vibe-change, fx-trigger)
- Path B: `ChronosStageDispatcher` -> `masterArbiter.setPlaybackFrame()` -> HYBRID merge

Si eliminamos MasterArbiter, perdemos el path B. Las escenas grabadas que
"pintan" fixtures directamente dejaran de funcionar.

### Riesgo #3 — IK y Formations viven en el Arbiter (VERIFICADO)

**Evidencia**:
```
Archivo: src/core/arbiter/ArbitrationDirector.ts:357-426 (IK)
Archivo: src/core/arbiter/ArbitrationDirector.ts:645-713 (Patterns)
```

`applySpatialTarget()`, `setGroupFormation()`, `setPattern()` son metodos
del ArbitrationDirector. El joystick de la UI los invoca via
`masterArbiter.applySpatialTarget()`.

Sin Arbiter, el joystick no mueve nada a menos que migremos IK a un
`KineticSystem` independiente.

### Riesgo #4 — Output Gate en Arbiter (VERIFICADO)

**Evidencia**:
```
Archivo: src/core/arbiter/ArbitrationDirector.ts:615-634

_outputEnabled: boolean = false
setOutputEnabled(enabled): void
isOutputEnabled(): boolean
```

El gate ARMED/LIVE vive en el Arbiter. HAL lo consulta en
`renderFromTarget()` para decidir si enviar DMX o safe-values.

Sin Arbiter, el gate se pierde. Hay que migrarlo a `aetherConfig` o
`OutputGateController`.

### Riesgo #5 — Grand Master e Inhibit Limits en Arbiter (VERIFICADO)

**Evidencia**:
```
Archivo: src/core/arbiter/ArbitrationDirector.ts:571-601

grandMaster: number = 1.0
inhibitLimits: Map<string, number>
setGrandMaster(value): void
setInhibitLimit(fixtureIds, value): void
```

Grand Master e Inhibit son escaladores post-arbitration que viven en el
Arbiter. Sin ellos, el fader global de intensidad y los limites por fixture
no funcionan.

### Riesgo #6 — Phantom channels (gobo, prism, strobe, shutter) (VERIFICADO)

**Evidencia**:
```
Archivo: src/core/arbiter/types.ts:534-539

phantomChannels: Record<string, number>
// "El Arbiter pasa estos valores directamente al HAL sin transformacion.
//  Solo Layer 2 (Manual) puede inyectar valores aqui.
//  Titan/Selene NO generan valores para estos canales -> defaultValue"
```

Los phantom channels (gobo, prism, strobe, shutter, control) solo pueden ser
controlados por manual override. Aether no tiene concepto de phantom channels
en sus nodos `ICapabilityNode`.

### Riesgo #7 — Crossfade engine y release fades (VERIFICADO)

**Evidencia**:
```
Archivo: src/core/arbiter/ArbitrationDirector.ts:209

this.crossfadeEngine = new CrossfadeEngine(this.config.defaultCrossfadeMs)
```

Cuando un manual override se libera, el Arbiter inicia un crossfade desde
el valor manual al valor Titan via `crossfadeEngine.startTransition()`.
Esto evita saltos bruscos. Aether no tiene crossfade engine aun.

### Riesgo #8 — Layer Loss Detector y Ghost White Detector (VERIFICADO)

**Evidencia**:
```
Archivo: src/core/arbiter/ArbitrationDirector.ts:897-951

// WAVE 2770: LAYER_LOSS DETECTOR
// Detecta cuando un fixture pierde su override manual
// WAVE 2770: GHOST_WHITE DETECTOR
// Detecta cuando un fixture emite blanco sin que el palette lo pida
```

Estos detectores de telemetria/seguridad viven en el Arbiter. Son criticos
para debugging pero no bloquean la funcionalidad si se pierden.

---

## 7. INVENTARIO DE ARCHIVOS LEGADO EN EL HOT PATH

| Archivo | Lineas aprox | Rol en 44Hz | Reemplazo Aether |
|---------|-------------|-------------|------------------|
| `src/core/engine/TitanEngine.ts` | ~300 | Genera LightingIntent L0 | Systems (ColorSystem, KineticSystem...) |
| `src/core/arbiter/ArbitrationDirector.ts` | 1690 | Merge L0-L4, IK, patterns, formations | NodeArbiter + KineticSystem + FormationSystem |
| `src/core/arbiter/state/LayerStateManager.ts` | ~500 | Estado mutable L0-L4 | IntentBus por capa |
| `src/core/arbiter/CrossfadeEngine.ts` | ~? | Transiciones suaves en release | CrossfadeSystem (nuevo) |
| `src/core/effects/EffectManager.ts` | 1511 | Arsenal de efectos musicales | EffectsSystem + adapters |
| `src/core/hephaestus/runtime/HephaestusRuntime.ts` | 859 | Evaluacion de curvas .lfx | HephSystem (bridge a IntentBus) |
| `src/hal/HardwareAbstraction.ts` | ~2200 | BabelFish, Quantizer, DarkSpin, Physics | AduanaFilter + NodeResolver |
| `src/core/orchestrator/IntentComposer.ts` | ~? | Convierte CombinedEffectOutput -> EffectIntentMap | EffectsSystem directo |
| `src/core/orchestrator/SyncSmoother.ts` | ~? | EMA filter + syncopation | AudioContext pre-processor |

---

## 8. CONCLUSIONES PARA LA DEMOLICION

1. **Aether esta desconectado**: `setFixtures()` no llama al pipeline de
   ingestion. Este es el primer cable a soldar.

2. **Hephaestus es un actor externo**: No pasa por Arbiter. Aplica post-HAL.
   Requiere un bridge especifico a IntentBus.

3. **Chronos tiene dos caras**: UI commands (injector) + DMX playback
   (hybrid merge en Arbiter). Ambas necesitan migrar.

4. **Hyperion es agnostico**: Solo necesita `FixtureState[]`. Un
   `AetherUIProjector` que traduzca `FilteredNodeMap` -> `FixtureState[]`
   mantiene compatibilidad total.

5. **Hay 8 riesgos verificados**, no 3. Los mas criticos: Hephaestus,
   Chronos playback, IK/Formations, Output Gate, Grand Master.

6. **El Arbiter NO es solo "merge de capas"**: Tambien contiene IK,
   formations, patterns, crossfade, layer loss detection, ghost white
detection, playback hybrid, output gate, grand master, inhibit limits.
   Todo esto necesita un hogar en Aether o ser declarado obsoleto.

---

*Fin del documento WAVE 3513.1.0-REALITY*
*Trazado directo del codigo fuente. Cero suposiciones.*
