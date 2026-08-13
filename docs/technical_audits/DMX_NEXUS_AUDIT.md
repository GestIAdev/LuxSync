# DMX NEXUS — Structural Mapping & Architectural Audit

> **Scope:** Visual swarm autopatch tool — UI → Store → Aether ingestion → NodeResolver → DMX SAB → Hardware driver
> **Codebase:** LuxSync electron-app
> **Date:** 2026-08-13
> **Status:** READ-ONLY AUDIT — no code modified

---

## 1. DIRECTORY MAP & KEY FILES

```
electron-app/src/
├── components/views/VisualPatcher/
│   └── VisualPatcher.tsx          (2131 lines) — Core UI: canvas, batch patch, collision, sidebar
├── stores/
│   ├── stageStore.ts              (1324 lines) — Zustand: fixtures, saveShow, updateFixture, selectVisualPatcher
│   └── dmxStore.ts                (280 lines)  — Zustand: DMX interfaces, patched fixtures, connection state
├── core/stage/
│   └── ShowFileV2.ts              (1523 lines) — FixtureV2 interface, Position3D, calibration, zones
├── core/aether/
│   ├── ingestion/
│   │   └── NodeExtractionPipeline.ts (1337 lines) — FixtureV2 → IDeviceDefinition → ICapabilityNode[]
│   ├── NodeArbiter.ts             — L0/L1/L2/L3 intent arbitration → ArbitratedNodeMap
│   ├── resolver/
│   │   └── NodeResolver.ts        (2083 lines) — ArbitratedNodeMap → Uint8Array(512) per universe
│   ├── egress/
│   │   └── AetherSafetyMiddleware.ts — Output gate, velocity clamp, airbag, throttle, virtual skip
│   ├── glass/
│   │   ├── DmxSabHandlers.ts      — DmxUniverseWriter (seqlock commit to SAB) + DmxUniverseReader
│   │   ├── GlassMemory.ts         — getDmxSab() singleton SAB allocation
│   │   └── layout.ts              — CHANNELS_PER_UNI, MAX_UNIVERSES, DMX_DATA_BYTES constants
│   └── adapters/
│       ├── LiquidAetherAdapter.ts  — L0: liquid engine → IntentBus
│       ├── ColorAdapter.ts         — L0: color palette → IntentBus
│       ├── selene-aether-adapter.ts— L3: Selene cognitive → effectBus
│       └── HephaestusAetherAdapter.ts — L3: .lfx clips → arbiter
├── core/orchestrator/
│   ├── TitanOrchestrator.ts       (1268 lines) — Owns NodeGraph, NodeArbiter, NodeResolver, HAL
│   └── tick/
│       └── TickEngine.ts          (1694 lines) — 44Hz frame loop: adapters → arbiter → resolver → SAB
├── hal/
│   ├── HardwareAbstraction.ts     — Legacy HAL (flushToDriver fallback)
│   └── drivers/
│       ├── DMXDriver.interface.ts — IDMXDriver interface: send(), sendUniverse(), sendAll()
│       ├── CompositeDMXDriver.ts  — Fan-out: USB + ArtNet in parallel
│       ├── UniversalDMXDriver.ts  (1133 lines) — FTDI/CH340/Prolific/CP210x USB serial
│       └── strategies/
│           ├── EnttecProStrategy.ts — Enttec Pro DMX USB protocol
│           └── OpenDMXStrategy.ts   — Open DMX USB protocol
└── core/protocol/
    └── DMXPacket.ts               — DMXPacket, DMXOutput, applyPacketToUniverse(), clampDMX()
```

---

## 2. DATA STRUCTURES

### 2.1 FixtureV2 (`ShowFileV2.ts:723-857`)

```typescript
interface FixtureV2 {
  id: string
  name: string
  model: string
  manufacturer: string
  type: 'moving-head' | 'par' | 'wash' | 'strobe' | 'laser' | 'blinder'
     | 'scanner' | 'bar' | 'spot' | 'effect'
     | 'fan' | 'fog' | 'mirror-ball' | 'pyro'
     | 'generic'

  // DMX CONFIGURATION
  address: number       // 1-512
  universe: number      // 0-based (ArtNet convention)
  channelCount: number
  profileId: string

  // PHYSICAL
  position: Position3D  // real-world meters
  rotation: Rotation3D
  orientation: InstallationOrientation  // 'ceiling' | 'floor' | 'truss-front' | ...
  isPlaced?: boolean
  placementMode?: FixturePlacementMode
  rigId?: string

  // SAFETY
  physics: PhysicsProfile
  isVirtual?: boolean   // WAVE 3110: excluded from DMX output, kept in rendering

  // CHANNEL DATA (persisted inline)
  channels?: Array<{
    index: number
    name: string
    type: string
    is16bit: boolean
    defaultValue?: number
  }>

  calibration?: FixtureCalibration  // panOffset, tiltInvert, etc.
  zone: FixtureZone
  enabled: boolean
}
```

### 2.2 PatchedFixture (`dmxStore.ts`)

```typescript
interface PatchedFixture {
  id: string
  name: string
  type: string
  manufacturer: string
  channelCount: number
  dmxAddress: number
  universe: number
  filePath: string
  zone?: string
  manualOverride?: string
}
```

> **Note:** `dmxStore` maintains a parallel fixture registry for connection/UI state.
> The authoritative fixture data lives in `stageStore.showFile.fixtures[]` as `FixtureV2[]`.
> `VisualPatcher` reads from `stageStore` via `selectVisualPatcher` selector.

### 2.3 DMXPacket (`DMXPacket.ts:90-102`)

```typescript
interface DMXPacket {
  universe: number    // 1-based in protocol, 0-based in FixtureV2
  address: number     // 1-512
  channels: number[]  // 0-255 each
  fixtureId?: string
}
```

### 2.4 IDMXDriver (`DMXDriver.interface.ts:79-156`)

```typescript
interface IDMXDriver {
  connect(): Promise<boolean>
  close(): Promise<void>
  send(packet: DMXPacket): boolean
  sendUniverse(universe: number, data: Uint8Array): boolean
  sendAll?(): Promise<boolean>
  blackout(): void
  readonly isConnected: boolean
  readonly state: DriverState
  getStatus(): DriverStatus
}
```

---

## 3. AUTOPATCH & ANTI-COLLISION LOGIC

### 3.1 Channel Footprint Math

Each fixture occupies a contiguous block of DMX channels:

```
footprint = [address, address + channelCount - 1]
```

- `address`: 1-512 (DMX standard, 1-indexed)
- `channelCount`: derived from `fixture.channels?.length` or `fixture.channelCount`
- `universe`: 0-based in FixtureV2, 0-63 range (ArtNet)

**`getChannelCount(fixture)`** in VisualPatcher reads `fixture.channels?.length ?? fixture.channelCount ?? 0`.

### 3.2 Collision Detection (`VisualPatcher.tsx` — `checkCollision`)

```typescript
const checkCollision = (target: FixtureV2): { hasCollision: boolean; conflicts: FixtureV2[] } => {
  const start = target.address;
  const end = start + getChannelCount(target) - 1;
  const targetUni = target.universe || 0;

  const conflicts = fixtures.filter(f => {
    if (f.id === target.id) return false;
    if ((f.universe || 0) !== targetUni) return false;

    const fStart = f.address;
    const fEnd = fStart + getChannelCount(f) - 1;
    return (start <= fEnd && end >= fStart);  // interval overlap
  });

  return { hasCollision: conflicts.length > 0, conflicts };
};
```

**Algorithm:** Classic interval overlap test `[A_start, A_end] ∩ [B_start, B_end]`.
Two fixtures collide iff `A.start <= B.end AND A.end >= B.start` within the same universe.

### 3.3 Batch Patching (`VisualPatcher.tsx` — `handleBatchPatch`)

```typescript
const handleBatchPatch = useCallback(async () => {
  if (selectedIds.length < 2) return;

  let currentUniverse = selectedUniverse;
  let nextAddress = batchStartAddress;

  selectedIds.forEach((id) => {
    const fixture = fixtures.find(f => f.id === id);
    const chCount = fixture ? getChannelCount(fixture) : batchOffset;

    // AUTO-SPLIT: if current address + footprint exceeds 512, advance universe
    if (nextAddress > 512 || (nextAddress + Math.max(chCount, 1) - 1) > 512) {
      currentUniverse += 1;
      nextAddress = 1;
    }

    updateFixture(id, { address: nextAddress, universe: currentUniverse });

    nextAddress += batchOffset;  // offset = channelCount (dense) or channelCount + gap
  });

  // Post-assignment collision detection & warnings
  // Auto-save
  await handleSave();
}, [selectedIds, batchStartAddress, batchOffset, selectedUniverse, updateFixture, fixtures, handleSave, getChannelCount]);
```

**Key behaviors:**
- **Start Address:** User-configurable (1-512), clamped.
- **Offset/Gap:** User-configurable (1-100). Two auto-offset buttons:
  - `AUTO-OFFSET: Nch` — sets offset = channelCount (zero gap, maximum density)
  - `+2 GAP: Nch` — sets offset = channelCount + 2 (safety margin for split fixtures)
- **Universe Auto-Split:** If `nextAddress + chCount - 1 > 512`, increments universe and resets address to 1.
- **Overflow Warning:** If offset < channelCount, UI warns "fixtures will overlap!"
- **Post-patch:** Collision detection runs on all fixtures, generates `batchWarnings[]` displayed in sidebar.
- **Auto-save:** Calls `handleSave()` immediately after assignment.

### 3.4 Universe Bar Visualization

Bottom bar shows channel allocation for the selected universe:
- Each fixture rendered as a colored block positioned at `(start-1)/512 * 100%` with width `(end-start+1)/512 * 100%`.
- Collision blocks colored red (`COLORS.state.danger`).
- Selected fixture blocks colored cyan.
- Free channel count displayed.
- Clicking a block selects that fixture.

### 3.5 Save Validation Gate (`stageStore.ts:551-607`)

Before persisting to disk, `saveShow()` calls `validateShowFileDeep(showFile)`:
- Blocks save if validation errors found.
- Displays error count and first 3 errors in `lastError` state.
- Warnings logged but don't block.
- On success: `showFile.modifiedAt` updated → IPC `stageAPI.save()` → `isDirty = false`.

---

## 4. VISUAL SWARM UX PARADIGM

### 4.1 Concept

The VisualPatcher replaces traditional spreadsheet-style DMX patching with a **canvas-based spatial map** where fixtures are rendered as shapes at their real-world positions. The "swarm" metaphor comes from multi-selection + batch operations: select N fixtures → assign addresses in one action.

### 4.2 Canvas Rendering

- **Grid:** Stage floor grid with fixture positions from `FixtureV2.position` (x, z in meters).
- **Shapes:** Each fixture type has a distinct shape (moving-head = circle, par = rectangle, etc.).
- **Colors:** By fixture type and state:
  - Default: type-specific color from `COLORS` palette
  - Selected: cyan glow (`COLORS.accent.cyan`)
  - Collision: red pulse (`COLORS.state.danger`)
  - Virtual: amber dashed border
  - Flashing: orange strobe overlay
- **Snake Line:** Connects selected fixtures in selection order, visualizing the batch sequence.
- **Zoom/Pan:** Mouse wheel zoom, drag pan.

### 4.3 Selection Modes

The sidebar adapts to selection state:

| Mode | Condition | Sidebar Content |
|------|-----------|-----------------|
| `none` | 0 selected | Empty state with instructions |
| `single` | 1 selected | Fixture inspector: identity, virtual toggle, DMX address input, universe selector, channel footprint, collision warnings, flash button |
| `multi` | 2+ selected | Swarm mode: unit count, batch virtual toggle (ALL VIRTUAL / ALL PHYSICAL), batch patching panel, preview assignment list, collision warnings, PATCH + FLASH ALL buttons |

### 4.4 Flash / Strobe Test

- **Single flash:** Hold FLASH button → `handleFlash(true)` → injects max values via HAL.
- **Auto-off:** 5-second timeout.
- **Multi flash:** FLASH ALL triggers all selected fixtures simultaneously.
- **Implementation:** Directly injects DMX values into the hardware path, bypassing the Aether pipeline for immediate physical feedback.

### 4.5 Virtual Fixture Toggle

- **Single:** Toggle `isVirtual` on one fixture.
- **Batch:** "ALL VIRTUAL" / "ALL PHYSICAL" buttons set `isVirtual` for all selected.
- **Impact:** Virtual fixtures participate in rendering and Aether arbitration but are **excluded from DMX output** by `AetherSafetyMiddleware.shouldSendUniverse()` (Phase 2 virtual-only skip).

### 4.6 UI Design Language

- **VFD (Vacuum Fluorescent Display) style:** Monospace fonts (`JetBrains Mono`), cyan/amber glow, dark backgrounds.
- **Color tokens:**
  - Cyan (`#22d3ee`): selection, active state, DMX channels
  - Amber (`#f59e0b` / `#fbbf24`): warnings, virtual, flash
  - Red (`#ef4444`): collisions, errors, danger
  - Purple (`#7c4dff`): auto-patch action
  - Green (`#22c55e`): success, free channels
- **Glass cards:** Semi-transparent panels with subtle borders (`rgba(255,255,255,0.05)`).

---

## 5. DATA FLOW: UI → DMX HARDWARE

### 5.1 Patch Time Flow (VisualPatcher → ShowFile → Aether Graph)

```
VisualPatcher.tsx
  │
  ├─ updateFixture(id, { address, universe })
  │    └─ stageStore.updateFixture()
  │         ├─ showFile.fixtures[idx] = { ...old, ...updates }  (new ref for Zustand reactivity)
  │         ├─ _syncDerivedState()  → updates `fixtures` derived array
  │         └─ _setDirty()
  │
  ├─ handleSave()
  │    └─ stageStore.saveShow()
  │         ├─ validateShowFileDeep(showFile)  → blocks if errors
  │         ├─ showFile.modifiedAt = now
  │         └─ stageAPI.save(showFile, path)   → Electron IPC → disk
  │
  └─ On show load / fixture change:
       └─ FixtureHydrationEngine.hydrate()
            ├─ NodeExtractionPipeline.extract(fixtureDef, fixtureV2)
            │    ├─ Reads fv2.address, fv2.universe, fv2.channelCount
            │    ├─ Reads fv2.position, fv2.orientation, fv2.zone, fv2.isVirtual
            │    ├─ _analyzeTopology() → classifies channels into families
            │    │    (COLOR, IMPACT, KINETIC, BEAM, ATMOSPHERE)
            │    ├─ _buildAllNodes() or _buildNodesFromForgeGraph()
            │    │    └─ Each ICapabilityNode gets dmxOffset per channel
            │    └─ Returns IDeviceDefinition { dmxAddress, universe, nodes[], calibration }
            │
            └─ NodeGraph.registerDevice(deviceDef)
                 └─ NodeResolver.registerDevice(deviceDef)
                      ├─ Allocates Uint8Array(512) per universe
                      ├─ Pre-computes baseAddr = dmxAddress - 1 (0-indexed)
                      ├─ Pre-computes bufIdx = baseAddr + chDef.dmxOffset per channel
                      └─ Builds IgnitionInjection[] and DarkSpinEntry[]
```

### 5.2 Runtime Hot Path (44Hz Frame Loop)

```
TickEngine.tick()
  │
  ├─ 1. ADAPTERS → INTENT BUSSES
  │   ├─ LiquidAetherAdapter.ingest()     → _aetherBus (L0)
  │   ├─ ImpactAdapter.process()          → _aetherBus (L0)
  │   ├─ ColorAdapter.process()           → _aetherBus (L0)
  │   ├─ KineticAdapter.process()         → _aetherBus (L0)
  │   ├─ BeamAdapter.process()            → _aetherBus (L0)
  │   ├─ AtmosphereAdapter.process()      → _aetherBus (L0)
  │   ├─ SeleneAetherAdapter.ingest()     → _effectBus (L3)
  │   ├─ ChronosAetherAdapter.ingest()    → chronosBus (L1)
  │   ├─ HephaestusAetherAdapter.ingest() → arbiter (L3+)
  │   ├─ AetherKineticEngine.tick()       → arbiter (L2 manual)
  │   └─ PixelMapAdapter.ingest()         → arbiter (L3 pixel)
  │
  ├─ 2. ARBITRATION
  │   ├─ aetherArbiter.setSystemIntents(_aetherBus)      (L0)
  │   ├─ aetherArbiter.setEffectIntents(_effectBus)      (L3)
  │   ├─ aetherArbiter.setChronosBus(chronosBus)         (L1)
  │   └─ aetherArbiter.arbitrate()
  │        ├─ Layer priority: L0 (liquid) → L1 (chronos) → L2 (manual) → L3 (selene/effects)
  │        ├─ Smart Gate: opaque channels per node (L0/L1 blocked where L2/L3 writes)
  │        ├─ L3 Anti-Sangrado Shield: L0/L1 silenced on channels L3 already wrote
  │        ├─ Manual Hard Lock: L2 manual overrides are final authority
  │        └─ Returns: ArbitratedNodeMap (Map<NodeId, Record<channel, value>>)
  │
  ├─ 3. PHYSICS POST-PROCESSOR
  │   └─ PhysicsPostProcessor.process(arbitrated, graph, deltaMs, vibe)
  │        └─ Applies inertia/smoothing to KINETIC nodes
  │
  ├─ 4. AETHER SAFETY MIDDLEWARE — PHASE 0 (Pre-Resolve)
  │   ├─ aetherSafety.applyOutputGate(arbitrated)
  │   │    └─ If outputEnabled=false: zeroes all channels (except L2 manual overrides)
  │   └─ Virtual fixture filtering
  │
  ├─ 5. NODE RESOLVER — Translate to DMX bytes
  │   └─ aetherResolver.resolve(arbitrated)
  │        ├─ For each node in arbitrated:
  │        │   ├─ _writeNode(nodeId, channelValues)
  │        │   │   ├─ device = graph.getDevice(nodeId)  → { dmxAddress, universe }
  │        │   │   ├─ buf = _universeBuffers.get(device.universe)  (Uint8Array(512))
  │        │   │   ├─ baseAddr = device.dmxAddress - 1  (0-indexed)
  │        │   │   ├─ For each channel def:
  │        │   │   │   ├─ bufIdx = baseAddr + chDef.dmxOffset
  │        │   │   │   ├─ Translate: normalized value → DMX byte (0-255)
  │        │   │   │   ├─ Apply calibration, transfer curve, constraints
  │        │   │   │   ├─ Apply GovernorEngine if present
  │        │   │   │   └─ buf[bufIdx] = safeDmxValue
  │        │   │   └─ 16-bit: write fine byte at bufIdx+1
  │        │   └─ IK path (_writeNodeIK): InverseKinematicsEngine → pan/tilt DMX
  │        ├─ DarkSpin cross-node sweep: zero dimmer during color wheel transit
  │        ├─ Ignition injection: HTP shutter=255 when source channel active
  │        └─ Returns: IDMXPacket[] (universe → Uint8Array(512) mapping)
  │
  ├─ 6. AETHER SAFETY — PHASE 2 (Post-Resolve Egress)
  │   ├─ For each universe in aetherResolver.registeredUniverses:
  │   │   ├─ aetherSafety.shouldSendUniverse(universe)
  │   │   │    ├─ Virtual-only skip: if all fixtures in universe are virtual → skip
  │   │   │    └─ Throttle: 30Hz for OpenDMX, pass-through for Enttec Pro/ArtNet
  │   │   ├─ Soft blackout: if blackoutActive → getSoftBlackoutUniverseBuffer()
  │   │   │    (zeros dimmer/color channels, preserves pan/tilt/speed)
  │   │   ├─ Golden Nuke injection: if locked → force CH2-6 to 255
  │   │   └─ Snapshot: copy egressBuf to _universeSnapshots
  │   └─
  │
  ├─ 7. DMX SAB COMMIT (Zero-copy to hardware)
  │   ├─ dmxWriter.commitFrame(frameCount, uniList, dirtyMask)
  │   │    ├─ Atomics.add(seqlock, 1)  → odd = writing
  │   │    ├─ u8.set(universeBuf, offset)  → zero-copy into SharedArrayBuffer
  │   │    ├─ Update header: frameId, dirtyMask (64-bit)
  │   │    ├─ Atomics.add(seqlock, 1)  → even = done
  │   │    └─ Atomics.notify(seqlock)  → wake DMX worker
  │   │
  │   └─ DMX Phantom Worker (worker_thread)
  │        ├─ DmxUniverseReader.readCoherent()  → seqlock-protected read
  │        ├─ CompositeDMXDriver.sendUniverse(universe, data)
  │        │    ├─ UniversalDMXDriver.sendUniverse()  → USB serial (FTDI/CH340/...)
  │        │    │    └─ Strategy: EnttecProStrategy or OpenDMXStrategy
  │        │    └─ ArtNetDriver.sendUniverse()  → UDP Art-Net packets
  │        └─ Both drivers receive SAME data in parallel
  │
  └─ 8. GLASS BROADCAST (UI preview, 44Hz)
      └─ glassPool.pushFrame(view)  → SharedArrayBuffer → window.glass.onFrame()
           └─ TacticalCanvas / GlassCanvas → 3D render
```

### 5.3 Legacy Fallback Path

When `_aetherHasDevices === false` (no Aether-registered fixtures):
```
TickEngine → hal.flushToDriver(fixtureStates)
  └─ HardwareAbstraction.renderFromTarget() → CompositeDMXDriver.send()
```

This path is disconnected when Aether devices exist (WAVE-4592).

---

## 6. DMX DRIVER ARCHITECTURE

### 6.1 CompositeDMXDriver (`CompositeDMXDriver.ts`)

```
CompositeDMXDriver (implements IDMXDriver)
  ├─ UniversalDMXDriver (USB serial)
  │   ├─ EnttecProStrategy  — private framing, 44Hz max
  │   └─ OpenDMXStrategy    — raw DMX512 stream, 30Hz throttle
  └─ ArtNetDriver (UDP)
```

- **Fan-out:** `sendUniverse()` calls all connected drivers in parallel.
- **isConnected:** true if ANY driver is connected.
- **Multi-universe USB:** UniversalDMXDriver supports multiple dongles (Universe 0 → Dongle 1, Universe 1 → Dongle 2, ...).

### 6.2 USB Chip Support (`UniversalDMXDriver.ts`)

| Chip | VID | Confidence | Notes |
|------|-----|-----------|-------|
| FTDI | 0403 | 95% | Enttec Open DMX, Tornado |
| IMC UD 7S | 0403 | 98% | Classic DMX interface |
| CH340/CH341 | 1a86 | 80% | Cheap Chinese interfaces |
| Prolific PL2303 | 067b | 70% | Generic USB-Serial |
| Silicon Labs CP210x | 10c4 | 85% | Professional interfaces |
| QinHeng CH9102 | 1a86 | 75% | New generation Chinese |

### 6.3 SAB-Based DMX Transport (WAVE 6010+)

The modern path uses a **SharedArrayBuffer** (`DMX_UNIVERSE_SAB`) for zero-copy DMX data transport:

- **Writer:** `DmxUniverseWriter` (main process, TickEngine) — seqlock atomic commit.
- **Reader:** `DmxUniverseReader` (DMX Phantom Worker) — seqlock-protected coherent read.
- **Layout:** Header (frameId, seqlock, dirtyMask) + `MAX_UNIVERSES * 512` bytes.
- **Notify:** `Atomics.notify()` wakes the worker thread on new frame.
- **Zero allocation:** Pre-allocated `Uint8Array(512)` per universe in NodeResolver, reused every frame.

---

## 7. UNIVERSE & ADDRESS CONVENTIONS

| Layer | Convention | Range |
|-------|-----------|-------|
| FixtureV2.universe | 0-based | 0-63 (ArtNet) |
| DMXPacket.universe | 1-based | 1-64 |
| NodeResolver buffers | Map key = FixtureV2.universe (0-based) | 0-63 |
| DmxUniverseWriter | Array index = universe number | 0-based |
| ArtNet protocol | 0-based | 0-32767 |
| DMX512 address | 1-based | 1-512 |
| NodeResolver bufIdx | 0-based | 0-511 |

> **Potential friction point:** Universe numbering is 0-based in FixtureV2 but DMXPacket declares 1-based. The NodeResolver uses FixtureV2's 0-based convention for buffer indexing. The CompositeDMXDriver receives universe numbers from the SAB which are 0-based.

---

## 8. KEY ARCHITECTURAL OBSERVATIONS

### 8.1 Dual Registry

`dmxStore` maintains `PatchedFixture[]` (connection state, UI display) while `stageStore` holds the authoritative `FixtureV2[]`. VisualPatcher reads from `stageStore` via `selectVisualPatcher`. The `dmxStore` appears to be a legacy/parallel registry for the DMX connection panel, not the patching UI.

### 8.2 Patch-Time vs Hot-Path Separation

- **Patch time:** `NodeExtractionPipeline.extract()` runs only on fixture add/edit/show-load. Translates `FixtureV2` → `IDeviceDefinition` with `ICapabilityNode[]`. Heavy computation (topology analysis, channel classification, forge graph compilation).
- **Hot path (44Hz):** `NodeResolver.resolve()` runs every frame. Pre-allocated buffers, zero allocation, in-place mutation. Reads `bufIdx = baseAddr + dmxOffset` from cached indices.

### 8.3 Virtual Fixture Egress Filtering

Virtual fixtures (`isVirtual: true`) are:
- **Included** in: NodeGraph, NodeArbiter arbitration, AetherUIProjector (UI preview), Glass broadcast.
- **Excluded** from: `AetherSafetyMiddleware.shouldSendUniverse()` — if ALL fixtures in a universe are virtual, that universe is skipped entirely.

### 8.4 Collision Detection Scope

Collision detection in VisualPatcher is **UI-side only**. It warns the user but does not prevent saving. The `validateShowFileDeep()` in `stageStore.saveShow()` is the hard gate that blocks invalid data from reaching disk. However, the Aether pipeline itself does not re-validate addresses at patch time — it trusts the `FixtureV2.address` and `FixtureV2.universe` values.

### 8.5 Batch Patch Offset Semantics

The batch offset is a **fixed stride**, not per-fixture channel count. If fixtures have different channel counts, the offset may create gaps (wasteful) or overlaps (if offset < channelCount of a later fixture). The UI warns about this but still allows the operation. A more sophisticated autopatch would use per-fixture channelCount as the stride, packing tightly.

---

## 9. FILE CITATION INDEX

| File | Lines | Role |
|------|-------|------|
| `VisualPatcher.tsx` | 1-2131 | UI: canvas, batch patch, collision, sidebar, universe bar |
| `stageStore.ts` | 1-1324 | State: fixtures, updateFixture, saveShow, selectVisualPatcher |
| `dmxStore.ts` | 1-280 | State: DMX interfaces, patched fixtures, connection |
| `ShowFileV2.ts` | 720-857 | Type: FixtureV2 interface (address, universe, channels, isVirtual) |
| `NodeExtractionPipeline.ts` | 272-438 | Ingestion: FixtureV2 → IDeviceDefinition (extract method) |
| `NodeArbiter.ts` | — | Arbitration: L0-L3 intent merge → ArbitratedNodeMap |
| `NodeResolver.ts` | 222-279, 997-1344 | Resolution: ArbitratedNodeMap → Uint8Array(512) per universe |
| `AetherSafetyMiddleware.ts` | — | Egress: output gate, velocity clamp, airbag, throttle, virtual skip |
| `DmxSabHandlers.ts` | 14-57 | SAB writer: seqlock commit to SharedArrayBuffer |
| `TickEngine.ts` | 1008-1401 | Frame loop: adapters → arbiter → resolver → SAB commit |
| `TitanOrchestrator.ts` | 332-475 | Owner: NodeGraph, NodeArbiter, NodeResolver lifecycle |
| `DMXDriver.interface.ts` | 79-156 | Contract: IDMXDriver interface |
| `CompositeDMXDriver.ts` | 33-80 | Fan-out: USB + ArtNet parallel send |
| `UniversalDMXDriver.ts` | 1-80 | USB: FTDI/CH340/Prolific/CP210x serial driver |
| `DMXPacket.ts` | 90-200 | Protocol: DMXPacket, DMXOutput, applyPacketToUniverse |

---

## 10. SUMMARY

The DMX Nexus is a **visual swarm autopatch tool** that replaces spreadsheet-style DMX addressing with a canvas-based spatial interface. Its architecture spans 7 layers:

1. **UI Layer** — `VisualPatcher.tsx`: Canvas rendering, multi-selection, batch patching with universe auto-split, collision detection, virtual toggle, flash test.
2. **State Layer** — `stageStore.ts`: Authoritative `FixtureV2[]` with `updateFixture()` and `saveShow()` (validated persistence).
3. **Ingestion Layer** — `NodeExtractionPipeline.ts`: Patch-time translation of `FixtureV2` → `ICapabilityNode[]` with DMX offsets.
4. **Arbitration Layer** — `NodeArbiter.ts`: 4-layer priority merge (L0 liquid → L1 chronos → L2 manual → L3 selene/effects).
5. **Resolution Layer** — `NodeResolver.ts`: Zero-alloc translation of arbitrated values → `Uint8Array(512)` per universe using pre-computed `bufIdx = baseAddr + dmxOffset`.
6. **Safety Layer** — `AetherSafetyMiddleware.ts`: Output gate, velocity clamp, airbag, DarkSpin, throttle, virtual fixture skip.
7. **Transport Layer** — `DmxUniverseWriter` → SAB → `DmxUniverseReader` (Phantom Worker) → `CompositeDMXDriver` → USB serial + ArtNet UDP.

The autopatch logic uses a simple stride-based assignment with universe overflow detection. Collision detection is interval-overlap within the same universe. The save validation gate (`validateShowFileDeep`) is the hard barrier preventing corrupt patching from reaching disk.
