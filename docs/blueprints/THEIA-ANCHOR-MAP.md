# THEIA ANCHOR MAP — LuxSync Pre-Flight Audit
> **WAVE 4850** | Phantom Worker Theia Engine — Architectural Audit & Integration Blueprint

---

## Executive Summary

This document maps the 4 structural pillars required to anchor a new **Phantom Worker (Theia Engine)** dedicated to native video reproduction inside LuxSync.

| Pillar | Status | Verdict |
|--------|--------|---------|
| **1. LED / Pixel Mapping** | Audited | **No native pixel-matrix or LED-grid support.** DMX universe is 1-D channel-per-fixture only. Theia would need to introduce a new fixture family or an external media-server bridge. |
| **2. Native Video Playback** | Audited | **Zero video infrastructure.** No `BrowserWindow` for output, no `screen` API usage, no video element, no second-monitor logic. Theia must be built from scratch. |
| **3. Phantom Worker Infra** | Audited | **Mature & extensible.** TrinityOrchestrator spawns BETA/GAMMA via `worker_threads`, SharedArrayBuffer audio ring, typed WorkerProtocol, heartbeat + Phoenix resurrection. A third worker (THETA) fits cleanly. |
| **4. Synchronization Hooks** | Audited | **Rich & high-frequency.** `AudioAnalysis` + `MusicalContext` flow 44 Hz into `FrameContext`. Beat phase, BPM, spectral energy, kick/snare/hihat flags, and `onBeat` boolean are all available every engine tick. Theia can sync to the same `FrameContext` or subscribe to `TrinityOrchestrator` events. |

---

## Pillar 1 — LED / Pixel Mapping Audit

### 1.1 Fixture Type Universe
`FixtureType` enum (`src/types/FixtureDefinition.ts:48-63`) defines the hardware taxonomy:

```ts
export type FixtureType = 
  | 'moving-head'
  | 'scanner'
  | 'par'
  | 'bar'
  | 'wash'
  | 'strobe'
  | 'effect'
  | 'laser'
  | 'blinder'
  | 'fan'
  | 'fog'
  | 'mirror-ball'
  | 'pyro'
  | 'generic';
```

**Finding:** There is **no `'led'`, `'pixel'`, `'matrix'`, `'panel'`, `'video-wall'`** or any multi-cell fixture type. Every fixture is treated as a single DMX device with a 1-D channel map.

### 1.2 Derived Capabilities
`DerivedCapabilities` (`FixtureDefinition.ts:69-91`) auto-detects:
- `hasPanTilt`, `hasColorMixing`, `colorMixingType: 'rgb' | 'cmy' | 'rgbw' | 'none'`
- `hasColorWheel`, `hasGobos`, `hasShutter`, `hasDimmer`
- `hasRotation`, `hasCustomChannels`

**Finding:** No `hasPixels`, `pixelCount`, `pixelRows`, `pixelCols`, or any 2-D geometry.

### 1.3 NodeRole — The `'pixel'` Hint
`NodeRole` (`src/core/aether/types.ts:108-117`) includes `'pixel'`:

```ts
export type NodeRole =
  | 'primary' | 'percussion' | 'breath' | 'accent'
  | 'ambient' | 'decoration' | 'atmosphere' | 'pixel'
  | (string & {})
```

`ColorSystem._selectPaletteColor()` (`ColorSystem.ts:216-226`) uses it to assign a palette gradient slot based on a `nodeId`-derived fraction:

```ts
case 'pixel': {
  const pixelFraction = this._derivePixelFraction(node.nodeId)
  const paletteIdx = (pixelFraction * palette.length) | 0
  ...
}
```

**Finding:** The `'pixel'` role is **purely chromatic** — it decides *which color* a pixel receives, not *where* it is in a 2-D grid. There is **no pixel coordinate (x, y), no mapping texture, no LED-panel geometry.**

### 1.4 LiquidAetherAdapter — Zone-Based Intensity
`LiquidAetherAdapter.ingest()` (`LiquidAetherAdapter.ts:196-218`) iterates all nodes and routes `zoneIntensity` (from `LiquidStereoResult`) to:
- `dimmer` for IMPACT nodes with physical dimmer
- `brightness` for COLOR nodes with RGB/CMY/W channels

**Finding:** The L0 adapter is **zone-scalar, not pixel-matrix.** It writes a single intensity value per fixture/node. No per-pixel bitmap or video-frame sampling exists.

### 1.5 NodeResolver / AetherUIProjector — Channel-Per-Node Output
`NodeResolver._writeNode()` writes DMX buffers one channel at a time per node. `AetherUIProjector` (`AetherUIProjector.ts`, referenced in memories) projects fixture state by reading arbitrated node channels (`dimmer`, `r`, `g`, `b`, etc.).

**Finding:** The renderer (Canvas 2D/3D) is a **visualization of DMX state**, not a media server. It does not render video frames onto LED matrices.

### 1.6 LED/Pixel Anchor Points for Theia
| # | Anchor | File / Line | Integration Strategy |
|---|--------|-------------|----------------------|
| A | **FixtureType extension** | `src/types/FixtureDefinition.ts` | Add `'led-matrix'`, `'pixel-bar'`, `'media-panel'` to enum. Derive pixel geometry from new JSON fields (`pixelCount`, `pixelRows`). |
| B | **DerivedCapabilities** | `src/types/FixtureDefinition.ts:69` | Add `hasPixelArray`, `pixelRows`, `pixelCols`, `pixelProtocol: 'dmx' \| 'artnet' \| 'sacn'`. |
| C | **NodeFamily / NodeRole** | `src/core/aether/types.ts` | `'pixel'` role already exists. Could add new `NodeFamily.VIDEO` or keep pixels under `COLOR` + new `mixingType: 'pixel'`. |
| D | **NodeGraphBuilder** | `src/core/forge/NodeGraphBuilder.ts` | When hydrating fixtures with pixel geometry, emit multiple `COLOR_NODE` instances per cell, or a single `VIDEO_NODE` with a pixel-map channel layout. |
| E | **AetherUIProjector** | `src/core/aether/egress/AetherUIProjector.ts` | Canvas 2D path: add `drawPixelGrid()` to preview video-mapped LED panels alongside conventional fixtures. |

---

## Pillar 2 — Native Video Playback Audit

### 2.1 Electron Main Process Windowing
`src/main.tsx` is the **React renderer entry point**, not the Electron main process. It mounts `<AppCommander />` and has zero window management code.

`StageIPCHandlers.ts` imports `BrowserWindow` **only** for:
- `dialog` open/save helpers
- Broadcasting `lux:stage:loaded` to the single main renderer window via `webContents.send()`

`IPCHandlers.ts` references `BrowserWindow` in the `IPCDependencies` interface for the same purpose.

**Finding:** LuxSync currently operates with **one renderer window** (the UI). There is no second output window, no `screen.getAllDisplays()`, no HDMI/secondary monitor detection, no `setFullScreen()` for video output.

### 2.2 Media / Video Code Search
Searches for the following returned **zero architectural hits**:
- `video.*player`, `media.*player`, `MP4`, `video.*play`, `play.*video`
- `fullscreen`, `secondary.*display`, `display.*manage`, `HDMI`
- `BrowserWindow` creation for video (only dialogs)

**Finding:** The codebase contains **no video player, no HTML `<video>` controller, no native media module, no frame grabber, no texture bridge.**

### 2.3 Native Video Anchor Points for Theia
| # | Anchor | File / Line | Integration Strategy |
|---|--------|-------------|----------------------|
| A | **New Electron Window** | New file: `src/core/theia/TheiaOutputWindow.ts` | Create a secondary `BrowserWindow` with `fullscreen: true`, positioned on the external display (using `screen.getAllDisplays()`). Frameless, transparent, `skipTaskbar: true`. |
| B | **Main Process IPC** | `src/core/orchestrator/IPCHandlers.ts` | Add `lux:theia:load`, `lux:theia:play`, `lux:theia:seek`, `lux:theia:stop` channels. Route commands to Theia Worker or directly to the output window. |
| C | **Video Element Surface** | New file: `src/core/theia/TheiaRenderer.tsx` | Minimal React/Vanilla component inside the secondary window: `<video>` or canvas-based WebGL texture renderer. |
| D | **Hardware Abstraction** | `src/core/orchestrator/TitanOrchestrator.ts` | Instantiate `TheiaEngine` alongside `TitanEngine`. Provide it the same `FrameContext` for sync. |

---

## Pillar 3 — Phantom Worker Infrastructure Audit

### 3.1 Trinity Orchestrator (ALPHA)
`TrinityOrchestrator` (`src/workers/TrinityOrchestrator.ts`) lives in the **Electron main process** and manages the worker lifecycle.

**Worker Registry (line 175):**
```ts
const nodeIds: NodeId[] = ['beta', 'gamma'];
```

**Spawn logic (line 275-284):**
```ts
private async spawnWorker(nodeId: NodeId): Promise<void> {
  const node = this.nodes.get(nodeId)!;
  node.worker = new Worker(this.WORKER_PATHS[nodeId], {
    workerData: { config: this.config, sharedAudioBuffer: this.sharedAudioBuffer }
  });
  node.worker.on('message', (msg) => this.handleWorkerMessage(nodeId, msg));
  node.worker.on('error', (err) => this.handleWorkerFailure(nodeId, err));
  node.worker.on('exit', (code) => { if (code !== 0) this.handleWorkerFailure(nodeId, new Error(`Exit ${code}`)); });
}
```

**Finding:** Adding a **third worker** (`theta`) requires:
1. Extend `NodeId` type: `'alpha' | 'beta' | 'gamma' | 'theta'`
2. Add `theta: path.join(workerDir, 'theia.js')` to `WORKER_PATHS`
3. Add `'theta'` to `nodeIds` array
4. Handle `MessageType` routing for Theia-specific payloads

### 3.2 WorkerProtocol — Typed Message Bus
`WorkerProtocol.ts` (`src/workers/WorkerProtocol.ts`) defines the contract:

```ts
export enum MessageType {
  INIT, READY, SHUTDOWN,
  HEARTBEAT, HEARTBEAT_ACK,
  AUDIO_BUFFER, AUDIO_ANALYSIS,
  MUSICAL_CONTEXT,
  CONFIG_UPDATE, SET_VIBE, SET_BPM,
  SYSTEM_SLEEP, SYSTEM_WAKE,
  // ...
}
```

**Finding:** The protocol is **extensible.** New message types for Theia can be appended:
- `VIDEO_LOAD`, `VIDEO_PLAY`, `VIDEO_PAUSE`, `VIDEO_SEEK`
- `VIDEO_FRAME` (host → worker: next frame descriptor)
- `VIDEO_SYNC_BEAT` (worker → host: beat-aligned marker)

### 3.3 SharedArrayBuffer — SPSC Audio Ring
`SharedRingBuffer.ts` (`src/core/audio/SharedRingBuffer.ts`) implements a lock-free ring buffer:
- **Layout:** `Int32Array` metadata (writeHead, readHead, sampleRate, channels) + `Float32Array` audio data (8192 samples)
- **Producer:** `AudioMatrix` / `LegacyBridgeProvider` (main process)
- **Consumer:** `SharedRingBufferReader` inside BETA worker
- **Mechanism:** `Atomics.store/load` for cross-thread visibility. Zero mutex.

**Finding:** The SAB pattern can be **replicated** for video frame transport:
- A `SharedVideoFrameBuffer` (RGBA or YUV) with metadata (frameIndex, pts, width, height)
- Producer: Theia Worker (decodes video, writes frames)
- Consumer: Theia Output Window (reads frames, blits to Canvas/WebGL)

### 3.4 Frame Rate Budgets
| System | Frequency | File |
|--------|-----------|------|
| BETA SAB poll | ~47 Hz (21 ms interval) | `senses.ts:203` |
| TITAN engine tick | **44 Hz** (23 ms interval) | `FrameScheduler.ts:61` |
| Frontend WebAudio | 60 fps | `TitanOrchestrator.ts` comments |
| Heartbeat | 1 Hz | `TrinityOrchestrator.ts` |
| Health report | 0.2 Hz (every 5 s) | `mind.ts:550` / `senses.ts:389` |

**Finding:** The main lighting engine runs at **44 Hz.** Theia Engine should target the same cadence for sync, or run at its own video frame rate (e.g., 30 Hz) with interpolation against the 44 Hz `FrameContext`.

### 3.5 Phoenix Protocol (Resurrection)
`TrinityOrchestrator` implements circuit-breaker logic:
- `CIRCUIT_THRESHOLD = 3` failures → OPEN
- `CIRCUIT_TIMEOUT = 5000` ms → HALF_OPEN test
- `CIRCUIT_HALF_OPEN_SUCCESS = 2` → CLOSED again
- Dead worker triggers `_resurrectWorker()` which spawns a replacement and restores `stateSnapshot`.

**Finding:** Theia Worker inherits this resilience **for free** once registered in the node map.

### 3.6 Worker Infrastructure Anchor Points for Theia
| # | Anchor | File / Line | Integration Strategy |
|---|--------|-------------|----------------------|
| A | **NodeId extension** | `src/workers/WorkerProtocol.ts:14` | Add `'theta'` to `NodeId` union and `NODE_NAMES`. |
| B | **Worker spawn path** | `src/workers/TrinityOrchestrator.ts:161` | Add `theta: path.join(workerDir, 'theia.js')`. |
| C | **MessageType enum** | `src/workers/WorkerProtocol.ts:26` | Append video-specific message types. |
| D | **Shared memory** | `src/core/audio/SharedRingBuffer.ts` | Clone pattern for `SharedVideoFrameBuffer` (RGBA ring). |
| E | **FrameScheduler sync** | `src/core/orchestrator/scheduler/FrameScheduler.ts` | Theia can either piggyback on the 44 Hz tick or run its own `setInterval` and sample `FrameContext`. |
| F | **State snapshot** | `src/workers/TrinityOrchestrator.ts:605` | Theia Worker can implement `STATE_SNAPSHOT` / `STATE_RESTORE` to survive resurrection. |

---

## Pillar 4 — Synchronization Hooks Audit

### 4.1 Audio Analysis Payload (BETA → ALPHA)
`AudioAnalysis` interface (`WorkerProtocol.ts:111-197`) is the richest sync primitive:

```ts
export interface AudioAnalysis {
  timestamp: number; frameId: number;
  bpm: number; bpmConfidence: number;
  onBeat: boolean; beatPhase: number; beatStrength: number;
  kickCount?: number;
  syncopation: number; groove: number; subdivision: 4 | 8 | 16;
  bass: number; mid: number; treble: number;
  subBass?: number; lowMid?: number; highMid?: number;
  harshness?: number; spectralFlatness?: number; crestFactor?: number;
  kickDetected?: boolean; snareDetected?: boolean; hihatDetected?: boolean;
  rawBassEnergy?: number;
  key?: string; mood?: 'dark' | 'bright' | 'neutral';
  energy: number;
  spectralCentroid: number; spectralFlux: number; zeroCrossingRate: number;
  chroma?: number[];          // 12-bin pitch classes
  rawTreble?: number; ultraAir?: number;
  inputPeakAbs?: number; inputRMS?: number;
}
```

### 4.2 Musical Context (GAMMA → ALPHA)
`MusicalContext` (produced in `mind.ts`, consumed in `TrinityBrain.ts`) carries:
- `key`, `mode`, `bpm`, `beatPhase`, `syncopation`
- `section: { type, current, confidence, isTransition }`
- `energy`, `mood`, `genre: { macro, subGenre, confidence }`
- `spectral: { clarity, texture, flatness, centroid, harshness, bands }`
- `narrative: { buildupScore, relativeEnergy, consensus }`

### 4.3 TrinityBrain — EventEmitter Bridge
`TrinityBrain.connectToOrchestrator()` (`src/brain/TrinityBrain.ts:68-87`) wires:

```ts
orchestrator.on('context-update', (context: MusicalContext) => {
  this.handleContextUpdate(context)
})
orchestrator.on('audio-analysis', (analysis: AudioAnalysis) => {
  this.handleAudioAnalysis(analysis)
})
```

**Finding:** Any subsystem can subscribe to the same events from `TrinityOrchestrator` (which extends `EventEmitter`).

### 4.4 TitanOrchestrator.processFrame() — The 44 Hz Sync Hub
`processFrame()` (`TitanOrchestrator.ts:1159`) is the **single synchronization point** for the entire lighting engine:

```ts
private async processFrame(): Promise<void> {
  const context = this.brain.getCurrentContext()
  // ... staleness detection ...
  // ... build FrameContext with audio + beatState ...
  this.engine.update(frameContext)
  // ... HephaestusRuntime tick ...
  // ... HAL egress ...
}
```

**Finding:** Theia Engine should either:
- **Option A — Inline:** Be called inside `processFrame()` after `engine.update()`, receiving the same `FrameContext`.
- **Option B — Evented:** Subscribe to `TrinityOrchestrator` events (`audio-analysis`, `context-update`) and maintain its own internal sync state.

### 4.5 BeatDetector (PLL Flywheel)
`TitanOrchestrator` owns a `BeatDetector` (`TitanOrchestrator.ts:998-1004`) that acts as a PLL:
- `setBpm(workerBpm)` — lock to worker truth
- `freewheelAt(lastStableWorkerBpm)` — inertia during silence
- `tick(now)` — advances `phase`, `onBeat`, `predictedNextBeatTime`

**Finding:** Theia can call `beatDetector.tick()` or read `beatState` from `FrameContext` to align video cuts, scratches, or strobe frames to the musical beat.

### 4.6 HephaestusRuntime & Curve Sync
`HephaestusRuntime` (`HephaestusRuntime.ts`) evaluates automation curves at 44 Hz. It receives the same `FrameContext` via `TitanEngine`. Clips can have `valueType: 'color'` with HSL keyframes.

**Finding:** Theia could expose its own parameters (e.g., `videoBrightness`, `videoSaturation`, `videoPlaybackRate`) as curves in the Hephaestus system, or simply read the current `energy`/`beatPhase` from `FrameContext` to modulate video effects.

### 4.7 Selene / DecisionMaker Energy Gate
From prior sessions (WAVE 4829):
- `ConsciousnessOutput.ts`: `ENERGY_OVERRIDE_THRESHOLD = 0.75`
- `MoodController.ts`: `cooldownMultiplier = 2.2` for latino vibes
- `NodeArbiter.ts`: L3 Absolute Override (`_l3DominatedChannels`) blocks L0/L1 on channels written by effects/Hephaestus.

**Finding:** If Theia emits video-derived light intents (e.g., mapping video brightness to DMX dimmer), it should emit on **L3 layer** (`'effect'` or `'hephaestus'`) so it participates correctly in the Arbiter's priority shield.

### 4.8 Synchronization Anchor Points for Theia
| # | Anchor | File / Line | Integration Strategy |
|---|--------|-------------|----------------------|
| A | **AudioAnalysis stream** | `src/workers/WorkerProtocol.ts:111` | Subscribe to `TrinityOrchestrator` `'audio-analysis'` event for raw spectral + beat data. |
| B | **MusicalContext stream** | `src/brain/TrinityBrain.ts:79` | Subscribe to `'context-update'` for high-level section/mood/genre decisions. |
| C | **FrameContext** | `src/core/orchestrator/TitanOrchestrator.ts:1159` | Inject Theia update call inside `processFrame()`; pass the same `FrameContext` used by the lighting engine. |
| D | **BeatState object** | `src/core/orchestrator/TitanOrchestrator.ts:1266-1281` | Read `beatState.phase`, `beatState.onBeat`, `beatState.predictedNextBeatTime` for frame-accurate video cuts. |
| E | **Hephaestus curves** | `src/core/hephaestus/runtime/HephaestusRuntime.ts` | Define a new `VideoParameter` curve family (`playbackRate`, `brightnessOverlay`, `fxIntensity`) so Theia can be automated from the Timeline. |
| F | **NodeArbiter L3** | `src/core/aether/NodeArbiter.ts` (WAVE 4829) | If Theia maps video to fixture channels, emit intents with `layer: 'effect'` so L3 override logic applies. |

---

## Integration Architecture — Proposed Theia Placement

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ELECTRON MAIN PROCESS                        │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │   TrinityBrain   │  │ TitanOrchestrator│  │ TrinityOrchestrator│ │
│  │   (EventEmitter) │  │   44 Hz FrameSch │  │   (Worker Mgr)   │ │
│  └────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘ │
│           │ 'audio-analysis'     │ processFrame()       │ spawn     │
│           │ 'context-update'     │ FrameContext ────────┼────────►  │
│           └──────────────────────┘                      │         │
│                              │                            ▼         │
│                              │                    ┌─────────────┐  │
│                              │                    │    THETA    │  │
│                              │                    │ Theia Worker │  │
│                              │                    └──────┬──────┘  │
│                              │                           │ SAB     │
│                              ▼                           ▼         │
│                    ┌─────────────────┐          ┌──────────────┐  │
│                    │   TitanEngine   │          │SharedVideo   │  │
│                    │  (Aether Matrix)│          │  FrameBuffer  │  │
│                    └─────────────────┘          └──────┬───────┘  │
│                                                       │            │
│                              ▼                        ▼            │
│                    ┌─────────────────┐      ┌─────────────────┐  │
│                    │  HAL / NodeResolver│     │ Theia OutputWin │  │
│                    │   DMX Egress      │     │  (2nd Display)  │  │
│                    └─────────────────┘      └─────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

### Theia Worker's Responsibilities
1. **Video Decode:** Load MP4/WebM, decode frames via `ffmpeg` or WebCodecs API.
2. **Sync Sample:** Read `FrameContext` metadata (beat phase, section type, energy) from a shared state or IPC message.
3. **Frame Queuing:** Push decoded RGBA frames into a `SharedVideoFrameBuffer`.
4. **Beat-Cut Logic:** Trigger hard cuts, loops, or speed ramps on `onBeat` / section transition.

### Theia Output Window's Responsibilities
1. **Consumer Loop:** `requestAnimationFrame` reading the shared buffer and blitting to a `<canvas>` or WebGL surface.
2. **Display Target:** Positioned on the secondary monitor via Electron `screen` API, `fullscreen: true`, frameless.
3. **Blackout / Gate:** Respect `outputEnabled` (Blind/Armed) and `blackoutActive` from the main process.

---

## Gaps & Recommended Next Steps

| # | Gap | Risk | Recommendation |
|---|-----|------|----------------|
| 1 | **No LED pixel fixture types** | Theia cannot natively drive LED walls without a new fixture family. | Extend `FixtureType` + `DerivedCapabilities` with pixel-grid geometry. |
| 2 | **No video window / display API usage** | Building video output from scratch. | Create `TheiaOutputWindow.ts` using Electron `BrowserWindow` + `screen` module. |
| 3 | **No video codec / frame pipeline** | Must integrate `ffmpeg`, WebCodecs, or a native addon. | Evaluate `ffmpeg-static` + `fluent-ffmpeg` for frame extraction, or WebCodecs in a renderer window. |
| 4 | **No texture-to-DMX bridge** | Video brightness/color cannot yet be mapped to conventional RGB fixtures. | Build `TheiaAetherAdapter` (L3) that samples video frames and emits `COLOR` / `IMPACT` intents per zone. |
| 5 | **Hephaestus lacks video parameters** | Timeline cannot automate video properties. | Extend `HephaestusParameter` enum with video-relevant curves. |
| 6 | **No 2-D spatial stage grid for pixels** | Pixel fixtures need `(x, y)` placement in `ShowFileV2`. | Add `pixelMap: { rows, cols, spacingMm }` to fixture definition and stage placement. |

---

## File Index — Key Source Files Referenced

| File | Relevance |
|------|-----------|
| `src/types/FixtureDefinition.ts` | Fixture taxonomy & capabilities |
| `src/core/aether/types.ts` | `NodeRole`, `NodeFamily` |
| `src/core/aether/systems/ColorSystem.ts` | Chromatic pixel-role logic |
| `src/core/aether/adapters/LiquidAetherAdapter.ts` | L0 zone-intensity routing |
| `src/core/orchestrator/TitanOrchestrator.ts` | 44 Hz sync hub, `processFrame()` |
| `src/core/orchestrator/scheduler/FrameScheduler.ts` | Engine tick timer (23 ms) |
| `src/brain/TrinityBrain.ts` | Event bridge: `audio-analysis`, `context-update` |
| `src/workers/TrinityOrchestrator.ts` | Worker spawn, heartbeat, Phoenix |
| `src/workers/WorkerProtocol.ts` | Typed message bus, `AudioAnalysis`, `MusicalContext` |
| `src/workers/senses.ts` | BETA worker shell, SAB consumer @ 47 Hz |
| `src/workers/mind.ts` | GAMMA worker shell, musical context extraction |
| `src/core/audio/SharedRingBuffer.ts` | Lock-free SAB pattern |
| `src/core/hephaestus/runtime/HephaestusRuntime.ts` | Curve evaluation @ 44 Hz |
| `src/core/aether/NodeArbiter.ts` | L3 absolute override (WAVE 4829) |
| `src/core/stage/ShowFileV2.ts` | 9 canonical zones |
| `src/core/orchestrator/IPCHandlers.ts` | IPC channel registry |

---

*End of audit. Ready for Theia Engine implementation planning.*
