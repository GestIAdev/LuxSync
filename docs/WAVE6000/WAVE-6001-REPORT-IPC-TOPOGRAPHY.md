# WAVE 6001 — INFORME TOPOGRÁFICO EXHAUSTIVO DE CANALES IPC
**Target:** KIMI / DEEPSEEKER (Strict Read-Only Mode)  
**Scope:** Toda comunicación cruzada de proceso en LuxSync Electron (Main ↔ Renderer / Workers)  
**Mandato:** ZERO modificaciones. Solo levantamiento cartográfico.

---

## RESUMEN EJECUTIVO
Se auditó el árbol `electron-app/src` + `electron-app/electron`. Se identificaron **>80 canales IPC** cruzando la frontera OS entre el proceso principal (Node/Electron main) y el renderer (Chromium). Además se detectaron **~18 tipos de mensaje** en el protocolo interno `WorkerProtocol` usado por `worker_threads` (Trinity BETA/GAMMA).  

**Hallazgo crítico de arquitectura:** No existe un canal de datos plano ni binario compartido entre Main y Renderer para el estado de fixtures. Toda la inteligencia lumínica cruza como **Structured Clone de objetos JSON anidados** a 22Hz y ~7.3Hz, saturando ambos lados del puente.

---

## 🔍 TAREA 1: EMISORES (MAIN → RENDERER / WORKERS)

### 1.1 Broadcasts de Alta Frecuencia (Hot Path)

| Canal | Origen | Frecuencia Teórica | Payload | Tipo de Carga |
|---|---|---|---|---|
| `selene:truth` | `electron/main.ts:598` | **~7.3Hz** (44Hz tick ÷ `TRUTH_BROADCAST_DIVIDER=6`). En modo Chronos: **44Hz** | Objeto `SeleneTruth` completo: `system`, `sensory`, `consciousness`, `context`, `intent`, `hardware` (incluye array `fixtures` con N objetos anidados: `color:{r,g,b}`, `zone`, `dmxAddress`, etc.) | **MASA CRÍTICA**: objeto raíz nuevo + array fixtures completo en cada envío. Cada fixture es un objeto con ~20 campos. |
| `selene:hot-frame` | `electron/main.ts:672` | **22Hz** (44Hz ÷ `HOT_FRAME_DIVIDER=2`). En Chronos: **44Hz** | `{ frameNumber, timestamp, onBeat, beatConfidence, bpm, bass, mid, high, energy, ringBufferFillLevel, activeAudioSource, fixtures: [...] }` donde `fixtures` es un array de objetos `{id, dimmer, r, g, b, white, amber, pan, tilt, zoom, focus, physicalPan, physicalTilt, panVelocity, tiltVelocity}` | **MASA CRÍTICA**: array de fixtures reconstruido desde cero con `.map()` en cada emisión. |
| `lux:log` | `electron/main.ts:688` | Event-driven (cada log emitido por TitanOrchestrator) | `{ id, timestamp, category, message, data?, level }` | Ligero (objeto plano). |
| `lux:state-update` | `electron/main.ts:657` | **~7.3Hz** (ligado al callback de `selene:truth`) | `{ isRunning, isConsciousnessEnabled, currentVibe, mode, frameId, timestamp }` | Ligero (primitivas). |

### 1.2 Emisores de Eventos y Window State

| Canal | Origen | Disparador | Payload |
|---|---|---|---|
| `lux:fixtures-loaded` | `electron/main.ts:426` | Evento (después de `app.whenReady` si hay fixtures precargados) | Array `patchedFixtures[]` (definiciones de fixture) |
| `window:maximized` | `electron/main.ts:447` | Evento native `maximize` | `true` |
| `window:unmaximized` | `electron/main.ts:450` | Evento native `unmaximize` | `false` |
| `artnet:ready` | `electron/main.ts:748` | Evento `artNetDriver.on('ready')` | `artNetDriver.getStatus()` (objeto estado) |
| `artnet:error` | `electron/main.ts:752` | Evento `artNetDriver.on('error')` | `error.message` (string) |
| `artnet:disconnected` | `electron/main.ts:755` | Evento `artNetDriver.on('disconnected')` | Sin payload |

### 1.3 Emisores del Preload Bridge (Renderer recibe vía `ipcRenderer.on`)
Expuesto en `electron/preload.ts`. Los canales que el **renderer escucha** desde el main:

| Canal | Origen en Preload | Payload Documentado |
|---|---|---|
| `selene:decision` | `preload.ts:248` | `decision: any` |
| `selene:mood` | `preload.ts:251` | `mood: string` |
| `selene:decision-log` | `preload.ts:266` | `{ id, timestamp, category, message, data? }` |
| `chronos:analysis-progress` | `preload.ts:302` | `{ progress: number, phase: string }` |
| `chronos:analysis-complete` | `preload.ts:309` | `{ analysisData: any, audioUrl: string }` |
| `chronos:analysis-error` | `preload.ts:316` | `{ message: string, code?: string }` |
| `selene:truth` | (implícito en `onTruthUpdate`) | `SeleneTruth` |
| `selene:hot-frame` | (implícito en `onHotFrame`) | HotFrame object |
| `lux:log` | (implícito en `onLog`) | LogEntry |

### 1.4 Comunicación Interna Worker Threads (Trinity Protocol)
Ubicación: `src/workers/TrinityOrchestrator.ts`, `src/workers/senses.ts`, `src/workers/mind.ts`, `src/workers/WorkerProtocol.ts`.

| Tipo de Mensaje | Dirección | Payload / Descripción | Frecuencia |
|---|---|---|---|
| `AUDIO_BUFFER` | Alpha → BETA | `Float32Array` (transferable, zero-copy) | **~60Hz** (audio raw) |
| `AUDIO_ANALYSIS` | BETA → Alpha | `{ bass, mid, high, energy, bpm, ... }` | **44Hz** (post-analysis) |
| `LIGHTING_DECISION` | GAMMA → Alpha | `LightingDecision` (colores, intensidades por zona) | **44Hz** (post-brain) |
| `MUSICAL_CONTEXT` | GAMMA → Alpha | Contexto musical puro (post-lobotomy WAVE 230) | **44Hz** |
| `HEARTBEAT` / `HEARTBEAT_ACK` | Bidireccional | `{ sequence, timestamp }` | **~1Hz** |
| `HEALTH_REPORT` | BETA/GAMMA → Alpha | `WorkerHealth` (CPU, memoria, latencia) | **~1Hz** |
| `STATE_SNAPSHOT` | Alpha → Workers | Estado completo para resurrección | Evento (Phoenix Protocol) |
| `SET_MODE`, `SET_VIBE`, `SET_BPM`, `RESET_PACEMAKER` | Alpha → GAMMA/BETA | Comandos de control | Evento (interacción usuario) |
| `SYSTEM_SLEEP` / `SYSTEM_WAKE` | Alpha → Workers | Pausa/reanudación de procesamiento | Evento (power on/off) |
| `CONFIG_UPDATE` | Alpha → Workers | `TrinityConfig` | Evento (cambio configuración) |

**Nota arquitectónica:** A partir de WAVE 3401, el path `AUDIO_BUFFER` usa **SharedArrayBuffer** (`SharedRingBuffer`) en lugar de `postMessage` cuando la fuente activa no es `legacy-bridge`. El fallback a `postMessage` con `Float32Array` transferable sigue existente (`TrinityOrchestrator.ts:769`).

---

## 🔍 TAREA 2: RECEPTORES Y HANDLERS (RENDERER → MAIN)

### 2.1 Núcleo Selene / Lux (`src/core/orchestrator/IPCHandlers.ts`)

| Canal | Tipo | Payload | Acción Desencadenada |
|---|---|---|---|
| `lux:start` | `handle` | — | `titanOrchestrator.start()` |
| `lux:stop` | `handle` | — | `titanOrchestrator.stop()` |
| `lux:getState` | `handle` | — | Devuelve `titanOrchestrator.getState()` (objeto grande) |
| `lux:setMode` | `handle` | `mode: string` | `titanOrchestrator.setMode(mode)` |
| `lux:setUseBrain` | `handle` | `enabled: boolean` | `titanOrchestrator.setUseBrain(enabled)` |
| `lux:setConsciousness` | `handle` | `enabled: boolean` | `titanOrchestrator.setConsciousnessEnabled(enabled)` |
| `lux:setLiquidStereo` | `handle` | `enabled: boolean` | `titanOrchestrator.setLiquidStereo(enabled)` |
| `lux:setLiquidLayout` | `handle` | `mode: '4.1' \| '7.1'` | `titanOrchestrator.setLiquidLayout(mode)` |
| `lux:forceStrike` | `handle` | `{ effect, intensity, scope? }` | `titanOrchestrator.forceStrikeNextFrame(config)` |
| `lux:setInputGain` | `handle` | `gain: number` | `titanOrchestrator.setInputGain(gain)` |
| `lux:setVibe` | `handle` | `vibeId: string` | `titanOrchestrator.setVibe(vibeId)` |
| `lux:setMood` | `handle` | `moodId: 'calm' \| 'balanced' \| 'punk'` | `titanOrchestrator.setMood(moodId)` + broadcast `lux:mood-changed` |
| `lux:getMood` | `handle` | — | Devuelve mood actual |
| `lux:setLivingPalette` | `handle` | `palette: string` | NO-OP (TODO) |
| `lux:setMovementPattern` | `handle` | `pattern: string` | NO-OP (TODO) |
| `lux:setMovementSpeed` | `handle` | `speed: number` | NO-OP (TODO) |
| `lux:setMovementIntensity` | `handle` | `intensity: number` | NO-OP (TODO) |
| `lux:setGlobalColorParams` | `handle` | `{ saturation?, intensity? }` | NO-OP (TODO) |
| `lux:forceMutation` | `handle` | — | NO-OP (TODO) |
| `lux:get-vibe` | `handle` | — | Devuelve `{ success, vibeId }` |
| `lux:get-full-state` | `handle` | — | Devuelve estado completo (DMX, Selene, etc.) |
| `lux:audio-frame` | `on` (fire-and-forget) | `data: Record<string, unknown>` | `titanOrchestrator.processAudioFrame(data)` a **60Hz** desde renderer |
| `lux:audio-buffer` | `on` (fire-and-forget) | `buffer: Buffer` → reconstruido a `Float32Array` | `titanOrchestrator.processAudioBuffer(float32)` a **~120 veces/segundo** |
| `selene:setMode` | `handle` | `mode: string` | `titanOrchestrator.setMode(mode)` |
| `selene:getBrainStats` | `handle` | — | Devuelve stats del cerebro |
| `chronos:setVibe` | `handle` | `vibeId: string` | Cambia vibe desde Chronos |
| `chronos:triggerFX` | `handle` | `{ effectId, intensity, durationMs?, hephCurves? }` | Dispara efecto |
| `chronos:stopFX` | `handle` | `effectId: string` | Detiene efecto |
| `chronos:triggerHeph` | `handle` | `{ filePath, intensity, durationMs?, loop? }` | Dispara clip Heph |
| `chronos:stopHeph` | `handle` | `instanceId?: string` | Detiene instancia Heph |
| `chronos:tickHeph` | `handle` | `currentTimeMs: number` | Evalúa clips Heph activos a **60Hz** desde renderer |
| `chronos:load-heatmap` | `handle` | `heatmap: any` | `titanOrchestrator.setChronosHeatmap(heatmap)` |
| `chronos:sync-playhead` | `handle` | `timeMs: number, isPlaying: boolean` | `titanOrchestrator.setChronosPlayhead(timeMs, isPlaying)` a **~25Hz** |

### 2.2 Aether Control & DMX (`src/core/aether/AetherIPCHandlers.ts`)

| Canal | Tipo | Payload | Descripción |
|---|---|---|---|
| `lux:aether:setManualOverrides` | `handle` | `ManualOverridePayload[]` | Escribe en L2 del NodeArbiter |
| `lux:aether:clearManualOverrides` | `handle` | `nodeIds: string[]` | Limpia overrides L2 |
| `lux:aether:clearAllManualOverrides` | `handle` | — | Limpia TODO L2 |
| `lux:aether:setGlobalKineticChaos` | `handle` | `{ amount, seed }` | Caos cinético global |
| `lux:aether:clearAllMotorKineticOverrides` | `handle` | — | Limpia overrides cinéticos |
| `lux:aether:clearMotorKineticOverrides` | `handle` | `nodeIds: string[]` | Limpia cinéticos por nodo |
| `lux:aether:setInhibitLimit` | `handle` | `{ nodeIds, limit }` | Cap de dimmer (L2) |
| `lux:aether:clearInhibitLimit` | `handle` | `nodeIds: string[]` | Quita cap |
| `lux:aether:setBlackout` | `handle` | `{ active: boolean }` | Blackout global |
| `lux:aether:setOutputEnabled` | `handle` | `{ enabled: boolean }` | Gate ARM/LIVE |
| `lux:aether:getControlState` | `handle` | — | Devuelve `{ blackout, outputEnabled, grandMaster, ... }` |
| `lux:aether:setGrandMaster` | `handle` | `{ value: number }` | Master intensity |
| `lux:aether:setGrandMasterSpeed` | `handle` | `{ value: number }` | VMM speed |
| `lux:aether:setManualPattern` | `handle` | `{ fixtureIds, pattern, speed, amplitude, fan, anchorPan, anchorTilt }` | Patrón cinético manual |
| `lux:aether:updateKineticScalars` | `handle` | `{ fixtureIds?, speed, amplitude, fan }` | Actualiza parámetros cinéticos en caliente |
| `lux:aether:getKineticNodeStates` | `handle` | `fixtureIds: string[]` | Snapshot de estado cinético |
| `lux:aether:getManualKineticState` | `handle` | — | Estado manual del motor cinético |
| `lux:aether:setKineticFanOffsets` | `handle` | `_offsets: Record<string, number>` | **NO-OP** (legacy) |
| `lux:aether:applySpatialTarget` | `handle` | `{ target, fixtureIds, fanMode, fanAmplitude, fixturePositions, fixtureIKProfiles }` | Target espacial (IK) |
| `lux:aether:releaseSpatialTarget` | `handle` | `{ fixtureIds }` | Libera target espacial |
| `lux:aether:setFixtures` | `handle` | `{ fixtures, stageBounds? }` | **MASA**: carga definiciones completas de fixtures + stage bounds. Resync del NodeGraph |
| `lux:aether:fireTungstenNuke` | `handle` | `{ target, release?, value? }` | Detonador manual Tungsten |
| `lux:aether:getL2State` | `handle` | `{ nodeIds }` | Devuelve overrides L2 actuales |
| `lux:ik:setDebug` | `handle` | `{ enabled }` | Activa/desactiva logs IK |
| `lux:arbiter:enterCalibrationMode` | `handle` | `{ fixtureId }` | Modo calibración |
| `lux:arbiter:exitCalibrationMode` | `handle` | `{ fixtureId }` | Sale calibración |
| `lux:arbiter:isCalibrating` | `handle` | `{ fixtureId }` | Query estado calibración |
| `lux:arbiter:calibrateFixture` | `handle` | `{ fixtureId }` | Ejecuta calibración |

### 2.3 Stage Persistence (`src/core/stage/StageIPCHandlers.ts`)

| Canal | Tipo | Payload |
|---|---|---|
| `lux:stage:load` | `handle` | `filePath?: string` |
| `lux:stage:loadActive` | `handle` | — |
| `lux:stage:save` | `handle` | `showFile: ShowFileV2, filePath?: string` |
| `lux:stage:saveAs` | `handle` | `showFile: ShowFileV2, name: string` |
| `lux:stage:list` | `handle` | — |
| `lux:stage:recent` | `handle` | — |
| `lux:stage:delete` | `handle` | `filePath: string` |
| `lux:stage:getPath` | `handle` | — |
| `lux:stage:exists` | `handle` | `name: string` |
| `lux:stage:openDialog` | `handle` | — |
| `lux:stage:saveAsDialog` | `handle` | `showFile, suggestedName?` |
| `lux:stage:confirmUnsaved` | `handle` | `showName: string` |

### 2.4 Hephaestus Effects (`src/core/hephaestus/HephIPCHandlers.ts`)

| Canal | Tipo | Payload |
|---|---|---|
| `heph:save` | `handle` | `clipData: HephAutomationClipSerialized` |
| `heph:load` | `handle` | `idOrPath: string` |
| `heph:list` | `handle` | — |
| `heph:delete` | `handle` | `idOrPath: string` |
| `heph:exists` | `handle` | `name: string` |
| `heph:getPath` | `handle` | — |
| `heph:generateId` | `handle` | — |

### 2.5 Chronos Audio / Project (`electron/ipc/ChronosIPCHandlers.ts`)

| Canal | Tipo | Payload |
|---|---|---|
| `chronos:analyze-audio` | `handle` | `{ buffer?, filePath?, fileName }` |
| `chronos:save-temp-audio` | `handle` | `{ buffer: ArrayBuffer, fileName }` |
| `chronos:cleanup-temp-audio` | `handle` | `filePath: string` |
| `chronos:read-audio-file` | `handle` | `filePath: string` |
| `chronos:save-project` | `handle` | `{ json: string, currentPath?, defaultName }` |
| `chronos:load-project` | `handle` | `{ path? }` |
| `chronos:check-file-exists` | `handle` | `filePath: string` |
| `chronos:browse-audio` | `handle` | — |
| `chronos:write-auto-save` | `handle` | `{ path, json }` |
| `chronos:check-auto-save` | `handle` | `{ path }` |
| `chronos:load-auto-save` | `handle` | `{ path }` |
| `chronos:delete-auto-save` | `handle` | `{ path }` |

### 2.6 Playback Timeline (`electron/ipc/PlaybackIPCHandlers.ts`)

| Canal | Tipo | Payload | Nota |
|---|---|---|---|
| `lux:playback:load` | `handle` | `project: LuxProject` | Carga proyecto en timeline engine |
| `lux:playback:tick` | `on` (fire-and-forget) | `timeMs: number` | **60Hz** desde renderer RAF loop |
| `lux:playback:stop` | `handle` | — | Detiene timeline |
| `lux:playback:state` | `handle` | — | Devuelve estado timeline |
| `lux:stage:sync` | `on` (fire-and-forget) | `fixtures: FixtureInstance[]` | Sync fixtures a TitanOrchestrator |

### 2.7 Phantom Worker (DMX Analysis) (`electron/workers/PhantomWorkerManager.ts`)

| Canal | Tipo | Payload | Nota |
|---|---|---|---|
| `phantom:analysis-complete` | `on` | `AnalysisResult` | Worker → Main |
| `phantom:analysis-error` | `on` | `AnalysisResult` | Worker → Main |
| `phantom:analysis-progress` | `on` | `AnalysisProgress` | Worker → Main |
| `phantom:ready` | `on` | — | Señal de vida del worker |

### 2.8 KeyForge (`src/core/keyforge/KeyForgeIPCHandlers.ts`)

| Canal | Tipo | Payload |
|---|---|---|
| `lux:keyforge:export` | `handle` | `loadout: KeyForgeLoadoutShape` |
| `lux:keyforge:import` | `handle` | — (abre diálogo nativo) |

---

## 🔍 TAREA 3: IDENTIFICACIÓN DE CARGAS MASIVAS (PAYLOAD PROFILING)

### 3.1 Canales con Payload Estructuralmente Masivo (Objetos Anidados + Arrays Grandes)

| Canal | Dirección | Razón de Masa | Tamaño Estimado* |
|---|---|---|---|
| `selene:truth` | Main → Renderer | Array `hardware.fixtures` con N objetos fixture completos (cada uno ~20 campos anidados: `color:{r,g,b}`, `zone`, `profileId`, etc.). Además: `consciousness`, `context`, `intent` son objetos profundos. | **~50–200 KB** (depende de N fixtures) |
| `selene:hot-frame` | Main → Renderer | Array `fixtures` reconstruido vía `.map()` a **22Hz**. Cada elemento: `{id, dimmer, r, g, b, white, amber, pan, tilt, zoom, focus, physicalPan, physicalTilt, panVelocity, tiltVelocity}` (13 campos). | **~10–40 KB** por mensaje |
| `lux:aether:setFixtures` | Renderer → Main | Carga definiciones completas de fixtures (`FixtureState[]`) + `stageBounds`. Puede contener cientos de fixtures con metadatos completos (channels, capabilities, orientation, physics, etc.). | **~100 KB–1 MB** (burst) |
| `lux:fixtures-loaded` | Main → Renderer | Mismo payload que `setFixtures` pero emitido desde main hacia renderer al boot. | **~100 KB–1 MB** (burst) |
| `chronos:load-heatmap` | Renderer → Main | `heatmap: any` — objeto completo de análisis de audio con bandas por frame. Puede ser enorme. | **Variable (MBs)** |
| `lux:playback:load` | Renderer → Main | `LuxProject` completo (timeline, clips, fixtures, efectos). | **~50 KB–500 KB** |
| `lux:get-full-state` | Renderer → Main | Estado completo del sistema (DMX, Selene, audio, etc.). | **~10–50 KB** |
| `lux:stage:save` / `saveAs` | Renderer → Main | `ShowFileV2` completo (escenario, fixtures, grupos, escenas, paletas, stage config). | **~50 KB–1 MB** |
| `heph:save` / `heph:load` | Renderer ↔ Main | `HephAutomationClipSerialized` (curvas Bezier, keyframes, fixtures targets). | **~10–100 KB** |
| `chronos:analyze-audio` | Renderer → Main | `ArrayBuffer` de archivo de audio + metadatos. | **~1–50 MB** (raw audio) |
| `lux:audio-buffer` | Renderer → Main | `Buffer` → `Float32Array`. Frecuencia **~120 veces/segundo**. | **~4–16 KB** por mensaje, pero **alto volumen** |
| `lux:audio-frame` | Renderer → Main | `{ bass, mid, high, energy, bpm }`. Frecuencia **60Hz**. | **~200 bytes**, pero **alto volumen** |
| `chronos:tickHeph` | Renderer → Main | `currentTimeMs`. Respuesta: `outputs: HephFixtureOutput[]` (valores evaluados de curvas para todos los fixtures). **60Hz**. | **Variable** según número de clips activos |
| `lux:playback:tick` | Renderer → Main | `timeMs: number` a **60Hz**. Ligero en payload, pero masivo en frecuencia. | **~8 bytes** |

\* Estimaciones basadas en estructura de objetos JSON; no se midieron en runtime.

### 3.2 Patrones de Clonación Identificados (Allocators en Hot Path)

1. **`BroadcastManager.emitHotFrame`** (`src/core/orchestrator/tick/BroadcastManager.ts:98`):
   ```typescript
   fixtures: fixtureStates.map((f: any, i: number) => { return { id: realId, dimmer: f.dimmer/255, r: Math.round(f.r), ... } })
   ```
   **Efecto:** Nuevos array + N objetos por tick a 22Hz.

2. **`BroadcastManager.emitFullTruth`** (`src/core/orchestrator/tick/BroadcastManager.ts:248`):
   ```typescript
   fixtures: fixtureStates.map((f: any, i: number) => { return { id: realId, name: f.name, type: f.type, zone: mappedZone, color: { r:..., g:..., b:... }, ... } })
   ```
   **Efecto:** Nuevos array + N objetos por tick a ~7.3Hz (44Hz en Chronos).

3. **`TacticalCanvas` → Worker** (`src/components/hyperion/views/tactical/TacticalCanvas.tsx` y `HyperionRenderBuffer.ts`):
   **NO es IPC de Electron**, sino `postMessage` dentro del renderer. Pero usa `Float32Array` transferable (zero-copy) para evitar clonación. Es la única ruta de datos planos del sistema.

---

## 🗺️ MAPA DE FRECUENCIAS CRÍTICAS (Hz)

```
Renderer → Main (Inbound IPC):
  lux:audio-buffer      ~120 msg/s   (Float32Array raw audio)
  lux:audio-frame       ~60 msg/s    (metrics object)
  lux:playback:tick       ~60 msg/s    (timeMs)
  chronos:tickHeph      ~60 msg/s    (Heph evaluation)
  chronos:sync-playhead ~25 msg/s    (Chronos playhead)
  aether:*              Variable     (event-driven / interacción)

Main → Renderer (Outbound IPC):
  selene:hot-frame      ~22 msg/s    (fixture dynamics array)
  selene:truth          ~7.3 msg/s   (full SeleneTruth object)
  lux:state-update      ~7.3 msg/s   (summary primitives)
  lux:log               Variable     (log events)

Worker Threads (Internal):
  AUDIO_BUFFER (SAB)    ~60 msg/s    (Float32Array zero-copy)
  AUDIO_ANALYSIS        ~44 msg/s    (analysis object)
  LIGHTING_DECISION     ~44 msg/s    (decision object)
```

---

## ⚠️ VEREDICTO ARQUITECTÓNICO

1. **El cuello de botella principal no es la cantidad de canales, sino la naturaleza de los payloads en el hot-path.** `selene:truth` y `selene:hot-frame` son los únicos canales que operan por encima de 5Hz con objetos JSON anidados de tamaño significativo. Todo el resto de la carga alta-frecuencia son primitivas pequeñas o binarios crudos (`audio-buffer`).

2. **No existe un mecanismo de diff/delta en el backend.** Cada tick de broadcast reconstruye arrays completos con `.map()` + spreads implícitos en objetos literales. Esto fuerza a V8 Structured Clone a recorrer y copiar todo el árbol en cada emisión, bloqueando el event loop del main process.

3. **El renderer tiene un doble consumo:** recibe `selene:hot-frame` a 22Hz (inyectado en `transientStore` sin React re-renders) Y `selene:truth` a ~7.3Hz (inyectado en `truthStore` vía Zustand, causando invalidación de referencias y re-render de componentes suscritos a objetos compuestos).

4. **La única ruta zero-copy del sistema es el `Float32Array` transferable hacia el `hyperion-render.worker`.** Todas las demás fronteras (Main↔Renderer, Renderer→Worker Trinity) usan serialización estructurada o JSON.

---

*Fin del levantamiento topográfico. Documento listo para entrega al Arquitecto (Opus / DeepSeeker).*
