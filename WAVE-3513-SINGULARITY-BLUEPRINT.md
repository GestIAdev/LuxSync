# 🌌 WAVE 3513 — THE AETHER SINGULARITY (F7 BLUEPRINT)

> **Documento**: Auditoria de demolicion legacy y plan de enrutamiento Aether
> **Version**: 3513.1.0
> **Estado**: BLUEPRINT — sin codigo, mapa del tesoro
> **Prerrequisito**: WAVE 3505.4 (Aether Matrix), WAVE 3510 (AduanaFilter), WAVE 3511 (Safety Gate), WAVE 3512 (Master Switch)
> **Objetivo Fase 7**: Convertir Aether en el unico motor del ecosistema. Decapitar el pipeline legacy.

---

## 0. MANIFIESTO DE LA SINGULARIDAD

Hoy hay **dos cerebros** corriendo en paralelo a 44 Hz:

1. **Legacy**: `TitanEngine -> MasterArbiter -> HAL.renderFromTarget -> flushToDriver`
2. **Aether**: `IntentBus -> NodeArbiter -> AduanaFilter -> NodeResolver -> sendUniverseRaw`

`AetherConfig` los separa por universo (WAVE 3512), pero el **Showfile** sigue
alimentando solo al legacy. Aether vive en el vacio: sin `IDeviceDefinition`
registrados, su pipeline es un no-op.

WAVE 3513 disena el puente que llena ese vacio y la guillotina que decapita
al legacy. **No hay codigo aqui** — solo el plano.

---

## 1. EL VACIO DE DATOS (Data Routing Deep-Dive)

### 1.1 Ciclo de vida actual de un Showfile

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          DISCO (.luxshow JSON V2)                              │
└──────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼  StagePersistence.loadShow()
┌──────────────────────────────────────────────────────────────────────────────┐
│  ShowFileV2 { fixtures: FixtureV2[], stage: StageContext, calibration, ...}   │
│  (validacion + migracion V1->V2 + normalizacion de zonas)                     │
└──────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼  IPC: 'stage:load' -> renderer
┌──────────────────────────────────────────────────────────────────────────────┐
│  RENDERER: stageStore (Zustand)                                                │
│  ├── fixtures: FixtureV2[]   (Forja: ADN del fixture)                          │
│  ├── stage:    StageContext   (StageBuilder: posicion 3D, zonas, rotacion)    │
│  └── library:  FixtureProfile[] (definiciones .fxt cargadas)                   │
└──────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼  TitanSyncBridge subscribe(state.fixtures)
                                     │  + debounce 200ms + hash diff
                                     ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│  IPC: window.lux.arbiter.setFixtures(arbiterFixtures)                          │
│  Canal: 'lux:arbiter:setFixtures'                                              │
└──────────────────────────────────────────────────────────────────────────────┘
                                     │
                                     ▼  ArbiterIPCHandlers.ts
┌──────────────────────────────────────────────────────────────────────────────┐
│  MAIN: orchestrator.setFixtures(fixtures)                                      │
│  └── masterArbiter.setFixtures(fixtures)        <-- LEGACY ONLY                │
│  └── hal.registerMover(fixtureId, installType)  <-- LEGACY PHYSICS             │
│  └── hal.invalidateProfileCache()                                              │
│                                                                                 │
│  ❌ Aether NO se entera. NodeGraph queda VACIO.                                 │
│  ❌ NodeExtractionPipeline NO se invoca.                                       │
│  ❌ SpatialRegistrar NO se invoca.                                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Diagnostico**: La Forja (FixtureV2.channels + capabilities) y el StageBuilder
(FixtureV2.position + rotation) viven en `stageStore` y bajan a backend, pero
el handler `lux:arbiter:setFixtures` solo alimenta al pipeline legacy.

### 1.2 Modulos Aether de ingestion ya existen

Los componentes para llenar el vacio **ya estan construidos**:

| Modulo | Archivo | Funcion |
|--------|---------|---------|
| `NodeExtractionPipeline` | `src/core/aether/ingestion/NodeExtractionPipeline.ts` | `FixtureDefinition -> IDeviceDefinition` con `CapabilityNode[]` por familia (COLOR, KINETIC, BEAM, IMPACT, ATMOSPHERE) |
| `SpatialRegistrar` | `src/core/aether/ingestion/SpatialRegistrar.ts` | Enriquece `IDeviceDefinition` con `Position3D` real del StageBuilder, calcula petalos para multi-emitters |
| `TitanOrchestrator.registerAetherDevice` | linea 296 | Punto de entrada: registra en NodeGraph + NodeResolver + AduanaFilter + AetherConfig |

**Lo que falta**: el orquestador NO los conecta. `setFixtures()` no llama a
`NodeExtractionPipeline.extract()`.

### 1.3 El puente exacto a construir

**Archivo target**: `src/core/orchestrator/TitanOrchestrator.ts:setFixtures()`

**Punto de inyeccion**:

```
TitanOrchestrator.setFixtures(fixtures: FixtureV2[]):
│
├─ [EXISTENTE] this.fixtures = normalize(fixtures)
├─ [EXISTENTE] masterArbiter.setFixtures(...)         ← LEGACY (a demoler en Fase 2)
├─ [EXISTENTE] hal.registerMover(...)                 ← LEGACY (a demoler en Fase 2)
│
└─ [NUEVO WAVE 3513] this._ingestAetherDevices(fixtures)
     │
     ├─ Para cada FixtureV2 en fixtures:
     │   1. profile = library.getProfile(fixture.profileId)        // .fxt cargado
     │   2. device  = nodeExtractionPipeline.extract(
     │                  profile,                  // ADN: canales + capabilities
     │                  fixture.address,
     │                  fixture.universe,
     │                  fixture.zone as ZoneId,
     │                  fixture.id as DeviceId
     │                )
     │   3. spatialRegistrar.register(
     │        device,
     │        fixture.position,                   // Stagebuilder 3D
     │        this                                // IAetherRegistrationTarget
     │      )
     │   // SpatialRegistrar llama internamente a registerAetherDevice()
     │   // que activa NodeGraph + Resolver + Aduana + claimUniverse
     │
     └─ this._reconcileRemovedFixtures(fixtures)
         // unregisterAetherDevice para fixtures que ya no existen
```

**Requisito**: el handler IPC `lux:arbiter:setFixtures` debe pasar el
**fixture profile completo** (channels[], capabilities, colorWheel) para que
`NodeExtractionPipeline` pueda analizar la topologia. Ya viene en `FixtureV2`
(WAVE 384: channels y capabilities estan persistidos inline).

### 1.4 Mapa unificado post-3513

```
.luxshow -> StagePersistence -> stageStore -> TitanSyncBridge -> IPC
                                                                  │
                                                                  ▼
                                            TitanOrchestrator.setFixtures()
                                            ├── (legacy path: masterArbiter)
                                            └── ✅ NUEVO:
                                                NodeExtractionPipeline.extract()
                                                  -> SpatialRegistrar.register()
                                                  -> registerAetherDevice()
                                                  -> NodeGraph + Resolver + Aduana
                                                  -> aetherConfig.claimUniverse()
```

---

## 2. DECAPITACION DEL LEGACY (Demolition Plan)

### 2.1 Modulos a extirpar del hot-path 44 Hz

Auditoria de `processFrame()` (`TitanOrchestrator.ts:1000-1500`). Cada
modulo legacy listado consume CPU por frame y debe ser desmontado en orden:

| # | Modulo | Archivo | Rol actual | Reemplazo Aether |
|---|--------|---------|-----------|------------------|
| 1 | `TitanEngine` | `src/core/engine/TitanEngine.ts` | Genera `LightingIntent` global por frame (color, dimmer, posiciones) | Systems agnosticos por familia: `ColorSystem`, `KineticSystem`, `BeamSystem` escriben en `IntentBus` |
| 2 | `MasterArbiter` / `ArbitrationDirector` | `src/core/arbiter/` | Merge L0-L4 -> `FinalLightingTarget[]` | `NodeArbiter` (zero-alloc, multi-layer sobre `ArbitratedNodeMap`) |
| 3 | `LayerStateManager` | `src/core/arbiter/state/LayerStateManager.ts` | Estado L0-L4 por fixture | `IntentBus` por capa + `NodeArbiter` interno |
| 4 | `IntentComposer` | `src/core/orchestrator/IntentComposer.ts` | Compone EffectIntents legacy | `EffectsSystem` directo a `IntentBus` |
| 5 | `EffectManager` legacy | `src/effects/EffectManager.ts` | Inyecta L3 effects al MasterArbiter | `EffectsSystem` (Aether System) |
| 6 | `HAL.renderFromTarget()` | `src/hal/HardwareAbstraction.ts:640-1840` | BabelFish + Quantizer + DarkSpin + Physics + Calibration sobre FixtureState[] | `AduanaFilter.filter()` ya implementa estos pasos sobre `ArbitratedNodeMap` |
| 7 | `HAL.flushToDriver(states)` | `src/hal/HardwareAbstraction.ts` | Aduana Inmutable + driver.send | Reusable: `AduanaFilter` lo invoca sobre Uint8Array de Resolver |

### 2.2 Plan de demolicion en 5 fases

**Fase 7.1 — Doble alimentacion (semana 1)**

- Implementar `_ingestAetherDevices()` en `setFixtures()`.
- Aether y legacy procesan el **mismo** fixture en paralelo.
- `aetherConfig` arbitra quien escribe DMX por universo (ya implementado).
- **Validacion**: toggle un universo a Aether, comparar visualmente con legacy.

**Fase 7.2 — Aether asume el manual override (semana 2)**

- Bridge `MasterArbiter.on('manualOverride') -> NodeArbiter.setManualOverride()`.
- UI sigue hablando solo con MasterArbiter; el bridge replica al NodeArbiter.
- **Validacion**: mover un fader manual mientras el universo esta en Aether.

**Fase 7.3 — Migrar Systems (semana 3-4)**

- Implementar `ColorSystem`, `KineticSystem`, `BeamSystem`, `ImpactSystem`,
  `AtmosphereSystem`. Cada uno consume `MusicalContext` + `AudioMetrics` y
  escribe `IntentRecord` en `IntentBus`.
- **Validacion**: con un universo en Aether y todos los Systems activos,
  reproducir un track y comparar con legacy frame-by-frame.

**Fase 7.4 — Borrar TitanEngine del hot path (semana 5)**

- Comentar la llamada a `titanEngine.generateIntent()` en `processFrame()`.
- Comentar `masterArbiter.setTitanIntent(titanLayer)`.
- El legacy sigue compilando pero ya no produce L0.
- **Validacion**: ningun universo legacy debe seguir respondiendo al audio
  (silencio total). Solo Aether canta.

**Fase 7.5 — Decapitacion final (semana 6)**

- Eliminar `processFrame()` legacy completo.
- Eliminar `MasterArbiter`, `ArbitrationDirector`, `LayerStateManager`.
- Eliminar `HAL.renderFromTarget()`, `HAL.flushToDriver()` legacy.
- `HAL.sendUniverseRaw()` se convierte en el **unico** path DMX.
- **Validacion**: la app arranca, todos los universos son Aether,
  cero referencias a `masterArbiter` quedan en el codigo.

### 2.3 Conexion directa NodeResolver -> HAL -> driver

Post-decapitacion, el flujo final:

```
┌────────────────────────────────────────────────────────────────────────────┐
│                       PROCESS FRAME (44 Hz, post-Fase 7.5)                   │
│                                                                              │
│  1. AudioMetrics + MusicalContext                                           │
│         │                                                                    │
│         ▼                                                                    │
│  2. Systems escriben en IntentBus                                            │
│     ├── ColorSystem    -> IntentRecord (familia COLOR)                      │
│     ├── KineticSystem  -> IntentRecord (familia KINETIC)                    │
│     ├── BeamSystem     -> IntentRecord (familia BEAM)                       │
│     ├── ImpactSystem   -> IntentRecord (familia IMPACT)                     │
│     ├── EffectsSystem  -> IntentRecord (capa EFFECTS)                        │
│     ├── ManualBridge   -> IntentRecord (capa MANUAL desde UI)                │
│     └── BlackoutSystem -> IntentRecord (capa BLACKOUT)                      │
│         │                                                                    │
│         ▼                                                                    │
│  3. NodeArbiter.arbitrate(IntentBus)                                         │
│     -> ArbitratedNodeMap (zero-alloc)                                        │
│         │                                                                    │
│         ▼                                                                    │
│  4. AduanaFilter.filter(arbitrated, graph, audio)                            │
│     ├── BabelFish (RGB -> color_wheel)                                      │
│     ├── HarmonicQuantizer (gate BPM)                                        │
│     ├── DarkSpinFilter (blackout en transito)                              │
│     ├── FixturePhysicsDriver (interpolacion pan/tilt)                      │
│     ├── CalibrationOffsets                                                   │
│     ├── ControlSourceTagger                                                 │
│     └── OutputGate (Aduana Inmutable: outputEnabled?)                       │
│     -> FilteredNodeMap                                                       │
│         │                                                                    │
│         ▼                                                                    │
│  5. NodeResolver.resolve(filtered)                                           │
│     -> Uint8Array(512) por universo (zero-alloc)                            │
│         │                                                                    │
│         ▼                                                                    │
│  6. for universe in registeredUniverses:                                     │
│       hal.sendUniverseRaw(universe, getUniverseBuffer(universe))             │
│         │                                                                    │
│         ▼                                                                    │
│  7. driver.sendUniverse(universe, data) -> USB/ArtNet                       │
│                                                                              │
└────────────────────────────────────────────────────────────────────────────┘
```

**Garantia**: cero allocaciones en el hot path. Cada modulo del pipeline ya
respeta el contrato zero-alloc de WAVE 3505.4.

---

## 3. RETROALIMENTACION DE LA UI (El Puente de Cristal)

### 3.1 Problema

Hoy la UI dibuja Hyperion/StageSimulator a partir de:

```
TitanOrchestrator.processFrame()
  -> masterArbiter.arbitrate()
  -> FinalLightingTarget[]
  -> hal.renderFromTarget(target) -> FixtureState[]
  -> setBroadcastCallback(truth) -> IPC 'selene:truth' -> renderer
```

`FixtureState[]` lleva: r, g, b, w, dimmer, pan, tilt, physicalPan, physicalTilt,
zoom, focus, gobo, prism, strobe, phantomChannels, _controlSources.

Si matamos `MasterArbiter` y `renderFromTarget`, la UI **se queda ciega**.

### 3.2 Solucion: derivar UI desde Aether

El `ArbitratedNodeMap` post-AduanaFilter contiene **todo** lo que la UI necesita:
valores normalizados (0-1) por canal por nodo, marcados con `_controlSources`.

Solo falta un **proyector** que convierta `ArbitratedNodeMap` -> `FixtureState[]`
para mantener el contrato del IPC.

### 3.3 Diseno: AetherUIProjector

```
┌─────────────────────────────────────────────────────────────────────────┐
│  AetherUIProjector (NUEVO — WAVE 3513)                                    │
│                                                                           │
│  Input:  FilteredNodeMap (output de AduanaFilter)                          │
│  Output: FixtureState[] (formato esperado por selene:truth)              │
│                                                                           │
│  ZERO-ALLOC:                                                              │
│  - FixtureState[] pre-allocado por device (size = fixtures.length)         │
│  - Cada FixtureState reusado frame a frame, mutado in-place              │
│  - Strings y arrays internos (phantomChannels, zone) cacheados            │
│                                                                           │
│  Pipeline:                                                                 │
│  - Por cada DeviceId en filtered:                                         │
│    1. state = this._statePool[deviceIdx]                                  │
│    2. state.r/g/b/w  = filtered[device].red * 255 (etc)                   │
│    3. state.dimmer   = filtered[device].dimmer * 255                      │
│    4. state.pan/tilt = filtered[device].pan * 255 / .tilt * 255           │
│    5. state.physicalPan = (mismo, despues de Physics ya aplicada)        │
│    6. state.zoom/focus = filtered[device].zoom * 255 (etc)                │
│    7. state._controlSources = filtered[device]._controlSources            │
│    8. state.phantomChannels = filtered[device]._phantomChannels           │
│  - Retorna this._statePool (mismo array, no se crea uno nuevo)            │
└─────────────────────────────────────────────────────────────────────────┘
```

### 3.4 Frecuencia y canales IPC

Mantener compatibilidad con WAVE 3250 (Hot Frame + Full Truth):

| Canal | Frecuencia | Payload | Origen pre-3513 | Origen post-3513 |
|-------|-----------|---------|----------------|------------------|
| `selene:hot-frame` | ~22 Hz | `{ bass, mid, high, energy, beatPhase, bpm }` | TitanEngine | AudioMetrics directo (sin cambio) |
| `selene:truth` | ~7 Hz | `FixtureState[]` + audio bands | `hal.renderFromTarget()` | `aetherUIProjector.project(filtered)` |
| `lux:arbiter:state` | on-change | `{ outputEnabled, blackout }` | masterArbiter | `aetherConfig` + outputGate state |

**Frecuencia de truth**: la UI no necesita 44 Hz. El proyector se invoca cada
6 frames (~7 Hz) para mantener el ancho de banda IPC actual. Frames intermedios
no proyectan.

### 3.5 Garantias zero-alloc del puente

1. `FixtureState[]` pre-allocado en `setFixtures()`, reutilizado.
2. `phantomChannels` y `_controlSources` son los **mismos objetos** que el
   filter ya muto in-place (referencia, no copia).
3. IPC structured-clone de Electron copia el payload una sola vez (ineludible),
   pero no genera GC en el main process si los objetos estan estables.
4. Throttling a 7 Hz reduce 6.3x el trabajo de serializacion vs 44 Hz.

---

## 4. ANALISIS DE PUNTOS CIEGOS (Blind Spot Heuristics)

### 4.1 RIESGO CATASTROFICO #1 — Manual Override Pierde el Hilo

**Sintoma**: el operador mueve un fader manual de pan en la UI. La UI envia
`Layer2_Manual` al `MasterArbiter`. Si MasterArbiter ya no existe, el override
desaparece.

**Causa raiz**: `MasterArbiter.setManualOverride()` es la API publica que la
UI conoce. `NodeArbiter.setManualOverride()` es interna y usa `DeviceId`,
no `fixtureId` legacy.

**Mitigacion**:

1. **Fase 7.2 (puente bidireccional)**: durante la doble alimentacion, todo
   `setManualOverride` que llega al MasterArbiter se replica al NodeArbiter
   via mapa `fixtureId -> DeviceId` mantenido en `setFixtures()`.

2. **Fase 7.5 (cutover)**: el handler IPC `lux:arbiter:setManualOverride`
   se reescribe para hablar directamente con `NodeArbiter`. La UI no se
   entera del cambio (mismo channel, mismo payload).

3. **Test de regresion obligatorio**: mover joystick + faders + MIDI
   simultaneamente, con grabacion de DMX. Comparar antes/despues.

### 4.2 RIESGO CATASTROFICO #2 — Efectos no-audio se Evaporan

**Sintoma**: Hephaestus (automation clips), GatlingRaid (LFO loops),
ChronosTimeline (escenas grabadas) inyectan efectos en `MasterArbiter` Layer 3.
Si lo borramos, todo el sistema de automatizacion deja de funcionar.

**Causa raiz**: estos modulos **no son musicales** — no derivan del audio,
sino de timelines, MIDI, OSC, o triggers de UI. Asumen que pueden hablar
con el MasterArbiter como si fuera el cerebro central.

**Inventario afectado**:

| Modulo | Tipo de efecto | Inyecta en |
|--------|----------------|-----------|
| `HephaestusRuntime` | Automation clips (.heph) | `masterArbiter.setEffectIntents()` |
| `GatlingRaid` | LFOs ciclicos | `masterArbiter.addEffect()` |
| `ChronosTimeline` | Cues / scenes | `masterArbiter.setEffectIntents()` |
| `MidiInputRuntime` | MIDI -> control | `masterArbiter.setManualOverride()` |
| `OSCBridge` | OSC -> control | `masterArbiter.setManualOverride()` |

**Mitigacion**:

1. Disenar un `LegacyEffectAdapter` que traduce `Layer3_Effect` -> `IntentRecord`
   de capa EFFECTS para el `IntentBus`. Cada modulo legacy sigue hablando
   "su lenguaje" pero el adapter lo traduce.

2. **No borrar** `HephaestusRuntime`, `GatlingRaid`, `ChronosTimeline` en la
   demolicion. Solo borrar `MasterArbiter`. Estos modulos siguen vivos.

3. El `LegacyEffectAdapter` vive en `src/core/aether/bridges/` y se documenta
   como "puente temporal hasta que cada modulo migre a System nativo".

### 4.3 RIESGO CATASTROFICO #3 — Calibration Lab y CalibrationOffsets

**Sintoma**: el usuario calibra un mover en CalibrationLab. Los offsets
(`panOffset`, `tiltInvert`, `tiltLimits`) se guardan en `FixtureV2.calibration`.
HAL legacy los aplica en `applyCalibrationOffsets()`. Si demolemos HAL legacy,
los offsets se ignoran y los movers apuntan al lugar equivocado.

**Causa raiz**: `AduanaFilter` ya tiene un paso de calibracion (paso 6 del
pipeline interno), pero usa `device.calibration`, que es el campo de
`IDeviceDefinition`. **El campo no se rellena automaticamente** desde
`FixtureV2.calibration` durante la extraccion.

**Mitigacion**:

1. Modificar `NodeExtractionPipeline._buildCalibration()` para leer
   `FixtureV2.calibration` (panOffset, tiltOffset, panInvert, tiltInvert,
   tiltLimits). Mapearlo a `IDeviceDefinition.calibration`.

2. En `setFixtures()`, cuando el usuario reemite cambios desde CalibrationLab,
   el `_ingestAetherDevices()` debe **re-extraer** y re-registrar el device
   (unregister + register) o exponer un metodo `updateDeviceCalibration()`
   en `NodeGraph` para mutacion zero-alloc.

3. **Test de regresion**: calibrar un mover, ejecutar movement test pattern,
   verificar que pan/tilt apuntan donde debe.

### 4.4 RIESGO CATASTROFICO #4 — Virtual Fixtures y phantomChannels

**Sintoma**: WAVE 3110 introdujo `isVirtual` para fixtures que existen en
la UI pero no envian DMX. WAVE 540+ introdujo `phantomChannels` (gobo, prism,
strobe, frost) que solo Layer 2 puede tocar. Aether no conoce ninguno.

**Causa raiz**: la lista de canales "phantom" es derivada de `ChannelType` y
vive en `arbiter/types.ts`. `IDeviceDefinition` no tiene un concepto equivalente.

**Mitigacion**:

1. Anadir `IDeviceDefinition.flags = { isVirtual?: boolean }`. Si true,
   el `NodeResolver` saltea la escritura del Uint8Array para ese device
   (pero el `AetherUIProjector` SI proyecta su FixtureState).

2. Anadir `ICapabilityNode.flags = { phantomChannels?: ChannelType[] }`
   que documenta los canales que solo MANUAL puede tocar. El `NodeArbiter`
   filtra en su merge: si la capa NO es MANUAL y el canal esta en
   phantomChannels, se ignora.

3. `NodeExtractionPipeline` debe detectar gobo/prism/strobe/frost y marcarlos
   como phantom en el ICapabilityNode correspondiente.

### 4.5 RIESGO ALTO #5 — Output Enable Gate (ARMED / LIVE)

**Sintoma**: el operador tiene la app en "ARMED" (luces apagadas, faders
manuales se ven en simulador). Si Aether escribe DMX sin respetar el gate,
se encienden las luces fisicas durante el ARMED.

**Causa raiz**: el gate vive en `masterArbiter.isOutputEnabled()`. Si
demolemos masterArbiter, el gate desaparece.

**Mitigacion**:

1. Mover el flag `outputEnabled` de `MasterArbiter` a `aetherConfig`
   (o a un nuevo `OutputGateController`). API: `getOutputEnabled()`,
   `setOutputEnabled(boolean)`.

2. `AduanaFilter` paso 8 (OutputGate) consulta este flag y aplica safe
   values cuando es false (excepto canales MANUAL).

3. El handler IPC `lux:setOutputEnabled` se redirige al nuevo controlador.
   La UI no nota el cambio.

### 4.6 RIESGO ALTO #6 — Vibe / Mood / Selene IA Conscious

**Sintoma**: la UI ofrece selectores de Vibe (techno-club, fiesta-latina, ...)
y Mood (calm, balanced, punk). Estos no son efectos: son **modos de
interpretacion** que afectan a TitanEngine. Sin TitanEngine, los selectores
no hacen nada.

**Mitigacion**:

1. La interpretacion vibe/mood se reimplementa en cada Aether System como
   parametro de configuracion: `colorSystem.setVibe('techno-club')`.

2. Crear un `VibeConductor` que recibe el evento UI `lux:setVibe` y reparte
   el cambio a todos los Systems registrados en el orquestador.

3. Decision arquitectonica: Selene IA Conscious (Layer 1, futuro) se
   implementa como un System Aether mas, no como una capa magica.

### 4.7 Resumen de riesgos

| # | Riesgo | Impacto | Probabilidad | Mitigacion |
|---|--------|---------|--------------|------------|
| 1 | Manual Override perdido | Catastrofico | Alta | LegacyManualBridge en Fase 7.2 |
| 2 | Efectos no-audio evaporados | Catastrofico | Alta | LegacyEffectAdapter, no borrar runtimes |
| 3 | Calibration ignorada | Catastrofico | Media | Extender NodeExtractionPipeline._buildCalibration |
| 4 | Virtual + phantomChannels | Alto | Media | Anadir flags a IDeviceDefinition / ICapabilityNode |
| 5 | OutputEnable gate perdido | Alto | Alta | Mover flag a aetherConfig u OutputGateController |
| 6 | Vibe/Mood sin efecto | Medio | Alta | VibeConductor + Systems con setVibe() |

---

## 5. PLAN DE ACCION CONSOLIDADO (sin codigo)

### Bloque A — Llenar el vacio de datos (Fase 7.1)

A.1 Modificar `TitanOrchestrator.setFixtures()` para invocar
    `_ingestAetherDevices(fixtures)`.

A.2 Implementar `_ingestAetherDevices()`:
    - Resolver `FixtureProfile` desde la library por `profileId`.
    - Por cada fixture, invocar `nodeExtractionPipeline.extract()` +
      `spatialRegistrar.register(this)`.
    - Reconciliar removidos via `unregisterAetherDevice()`.

A.3 Extender `NodeExtractionPipeline._buildCalibration()` para leer
    `FixtureV2.calibration` (mitigacion riesgo #3).

A.4 Anadir `IDeviceDefinition.flags.isVirtual` y mapear desde `FixtureV2.isVirtual`
    (mitigacion riesgo #4).

### Bloque B — Puentes de coexistencia (Fases 7.2-7.3)

B.1 `LegacyManualBridge`: replica `MasterArbiter.setManualOverride` ->
    `NodeArbiter.setManualOverride` con mapa `fixtureId -> DeviceId`
    (mitigacion riesgo #1).

B.2 `LegacyEffectAdapter`: traduce `Layer3_Effect` -> `IntentRecord` de
    capa EFFECTS. Aplica a Hephaestus, GatlingRaid, ChronosTimeline
    (mitigacion riesgo #2).

B.3 Implementar `ColorSystem`, `KineticSystem`, `BeamSystem`, `ImpactSystem`,
    `AtmosphereSystem` consumiendo MusicalContext + AudioMetrics.

### Bloque C — UI Bridge (paralelo a B)

C.1 Implementar `AetherUIProjector` con pool zero-alloc de FixtureState[].

C.2 Modificar `processFrame()` para invocar
    `setBroadcastCallback(aetherUIProjector.project(filtered))` cada 6 frames
    cuando todos los universos estan en Aether.

C.3 Mover `outputEnabled` de MasterArbiter a `OutputGateController`
    (mitigacion riesgo #5).

C.4 Crear `VibeConductor` para distribuir Vibe/Mood a Systems
    (mitigacion riesgo #6).

### Bloque D — Decapitacion (Fases 7.4-7.5)

D.1 Comentar TitanEngine.generateIntent() en processFrame.

D.2 Comentar masterArbiter.arbitrate() y hal.renderFromTarget().

D.3 Eliminar masterArbiter, ArbitrationDirector, LayerStateManager.

D.4 Eliminar HAL.renderFromTarget(), HAL.flushToDriver() legacy.

D.5 sendUniverseRaw se convierte en el unico path DMX.

### Bloque E — Validacion

E.1 Suite de regresion DMX: grabar output legacy de un track, comparar con
    output Aether post-decapitacion.

E.2 Test de manual override con joystick + MIDI + faders simultaneamente.

E.3 Test de calibracion (CalibrationLab -> apuntar a marca fisica).

E.4 Test de Hephaestus clip + GatlingRaid LFO + ChronosTimeline cue.

E.5 Test de ARMED/LIVE gate.

---

## 6. DIAGRAMA FINAL: SINGULARIDAD AETHER

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              POST-FASE 7.5 — UN SOLO MOTOR                    │
│                                                                                │
│  .luxshow ──► StagePersistence ──► stageStore ──► TitanSyncBridge ──► IPC    │
│                                                                                │
│                          ┌────────────────────────────────────┐               │
│                          ▼                                    │               │
│  ┌──────────────────────────────────────────────────────┐    │               │
│  │  TitanOrchestrator.setFixtures()                       │    │               │
│  │  └── NodeExtractionPipeline.extract()                  │    │               │
│  │  └── SpatialRegistrar.register()                       │    │               │
│  │  └── registerAetherDevice() x N                        │    │               │
│  └──────────────────────────────────────────────────────┘    │               │
│                          │                                    │               │
│                          ▼                                    │               │
│  ┌──────────────────────────────────────────────────────┐    │               │
│  │  NodeGraph (DeviceId -> ICapabilityNode[])           │    │               │
│  │  AduanaFilter.registerDevice()                         │    │               │
│  │  NodeResolver.registerUniverse()                       │    │               │
│  └──────────────────────────────────────────────────────┘    │               │
│                                                                │               │
│  ┌──────────────────────────────────────────────────────┐    │               │
│  │  HOT PATH (44 Hz)                                       │   │               │
│  │                                                          │   │               │
│  │  AudioMetrics + MusicalContext                          │   │               │
│  │       │                                                  │   │               │
│  │       ▼                                                  │   │               │
│  │  Systems escriben en IntentBus:                          │   │               │
│  │  - ColorSystem / KineticSystem / BeamSystem               │   │               │
│  │  - ImpactSystem / AtmosphereSystem                       │   │               │
│  │  - EffectsSystem (+ LegacyEffectAdapter)                 │   │               │
│  │  - LegacyManualBridge (UI faders / MIDI / OSC)          │   │               │
│  │  - BlackoutSystem                                        │   │               │
│  │       │                                                  │   │               │
│  │       ▼                                                  │   │               │
│  │  NodeArbiter.arbitrate(IntentBus)                        │   │               │
│  │       │                                                  │   │               │
│  │       ▼                                                  │   │               │
│  │  AduanaFilter.filter(arbitrated, graph, audio)           │   │               │
│  │  └── BabelFish, Quantizer, DarkSpin, Physics,           │   │               │
│  │      Calibration, OutputGate                             │   │               │
│  │       │                                                  │   │               │
│  │       ├──► NodeResolver.resolve(filtered)                │   │               │
│  │       │    └── for u in registeredUniverses:             │   │               │
│  │       │         hal.sendUniverseRaw(u, buf)              │   │               │
│  │       │         └── driver.sendUniverse(u, buf) ──► HW   │   │               │
│  │       │                                                  │   │               │
│  │       └──► AetherUIProjector.project(filtered) (cada 6f) │   │               │
│  │            └── FixtureState[] zero-alloc                 │   │               │
│  │            └── selene:truth IPC ──► renderer ──► UI     │   │               │
│  └──────────────────────────────────────────────────────┘    │               │
│                                                                │               │
│  ❌ ELIMINADO:                                                  │               │
│  - TitanEngine.generateIntent()                                 │               │
│  - MasterArbiter / ArbitrationDirector / LayerStateManager     │               │
│  - HAL.renderFromTarget() / HAL.flushToDriver()                │               │
│  - HAL.applyDynamicOptics() (movido a BeamSystem)              │               │
│                                                                                │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 7. GLOSARIO

| Termino | Definicion |
|---------|-----------|
| **Forja** | Sistema de definicion de fixtures: `FixtureProfile` + canales + capabilities. Vive en `src/core/library/` y se persiste como `.fxt` |
| **StageBuilder** | Editor 3D de posiciones y zonas. Produce `StageContext` y `Position3D` por fixture. Vive en `src/components/stage/` |
| **Showfile** | Archivo `.luxshow` JSON V2 que une Forja + StageBuilder + calibracion + escenas + automation |
| **NodeExtractionPipeline** | Adaptador FixtureProfile -> IDeviceDefinition con CapabilityNode[] |
| **SpatialRegistrar** | Enriquece IDeviceDefinition con Position3D real, registra en NodeGraph |
| **IDeviceDefinition** | Estructura inmutable con DeviceId, nodes, calibration, universe, dmxAddress |
| **ICapabilityNode** | Nodo agnostico por familia (COLOR/KINETIC/BEAM/IMPACT/ATMOSPHERE) con position 3D y constraints |
| **IntentBus** | Buffer zero-alloc donde los Systems escriben IntentRecord por capa por nodo |
| **NodeArbiter** | Resolver multicapa que merge IntentBus -> ArbitratedNodeMap |
| **AduanaFilter** | Modulo de seguridad WAVE 3510 que aplica BabelFish + Quantizer + DarkSpin + Physics + Calibration + OutputGate sobre ArbitratedNodeMap |
| **NodeResolver** | Convierte FilteredNodeMap -> Uint8Array(512) por universo |
| **AetherUIProjector** | NUEVO WAVE 3513: convierte FilteredNodeMap -> FixtureState[] para IPC selene:truth |
| **LegacyManualBridge** | NUEVO: replica setManualOverride legacy al NodeArbiter durante transicion |
| **LegacyEffectAdapter** | NUEVO: traduce Layer3_Effect -> IntentRecord para Hephaestus/GatlingRaid/Chronos |

---

*Fin del documento WAVE 3513.1.0*
*Blueprint arquitectonico — No implementar sin revision cruzada del equipo*
