# 🔬 FORENSIC AUDIT REPORT — DMX Output & UI Lag

**Wave:** 6014  
**Date:** 2026-06-09  
**Auditor:** Forensic Engine (Read-Only)  
**Target:** `OpenDMXStrategy.ts`, `TitanOrchestrator.ts`, `TickEngine.ts`, `TrinityProvider.tsx`, `TacticalCanvas.tsx`, `HyperionView.tsx`, `VisualizerCanvas.tsx`  
**Status:** ✅ Complete — Ready for Architect Review

---

## Executive Summary

Two independent pathologies confirmed:

1. **Physical DMX is zero** because `OpenDMXStrategy.ts` writes **512 bytes** to the serial port. The IMC UD 7S (and all standard DMX512 receivers) require **513 bytes** with the first byte being the **Start Code `0x00`**. The current packet is malformed and rejected by the hardware.
2. **UI lag at 3-5 FPS** is caused by a **convergence** of: (a) a `requestAnimationFrame` pump on the main thread burning CPU at 60fps inside `TacticalCanvas`, (b) `TrinityProvider` triggering 6-9 Zustand store updates per IPC message at ~7Hz, (c) dual overlapping IPC channels (`selene:truth` + `lux:state-update`) doubling the load, and (d) `audioStore.registerBeat` toggling `onBeat` at beat frequency causing `HyperionView` re-renders.

---

## 🔍 FINDING 1: DMX Buffer Size — Missing Start Code

**Verdict: The packet is 1 byte short. The hardware sees an invalid start code.**

### Evidence Chain

**`layout.ts:14`** — The SAB stores exactly 512 channels per universe, no start code offset:

```typescript
export const CHANNELS_PER_UNI = 512
```

**`DmxSabHandlers.ts:30-49`** — `DmxUniverseWriter.commitFrame()` writes the raw `Uint8Array` (512 bytes) directly into the SAB data region with no prefix:

```typescript
public commitFrame(frameId: number, universes: Uint8Array[], dirtyMask: bigint): void {
  // 1. Iniciar escritura: incrementar SEQLOCK a impar
  Atomics.add(this.i32, DmxHdr.SEQLOCK, 1)

  // 2. Volcar datos binarios (zero-allocation)
  for (let u = 0; u < universes.length; u++) {
    this.u8.set(universes[u], u * CHANNELS_PER_UNI)   // 512 bytes copied as-is
  }

  // 3. Actualizar metadata del header
  this.i32[DmxHdr.FRAME_ID] = frameId
  this.i32[DmxHdr.UNIVERSE_MASK] = Number(dirtyMask & BigInt(0xffffffff))
  this.i32[DmxHdr.UNIVERSE_MASK_HI] = Number(dirtyMask >> BigInt(32))

  // 4. Finalizar escritura: incrementar SEQLOCK a par
  Atomics.add(this.i32, DmxHdr.SEQLOCK, 1)

  // 5. Despertar a los workers que estén bloqueados esperando
  Atomics.notify(this.i32, DmxHdr.SEQLOCK)
}
```

**`OpenDMXStrategy.ts:140`** — The output loop slices exactly 512 bytes and writes them to the FTDI serial port:

```typescript
this.port.write(Buffer.from(new Uint8Array(frame.data.subarray(0, 512))))
```

- `frame.data` is the 25,600-byte scratch buffer from `DmxUniverseReader.readCoherent()`
- `subarray(0, 512)` extracts Universe 0's 512 channels
- The resulting `Buffer` is exactly **512 bytes**

### Root Cause

For a **dumb FTDI cable** (IMC UD 7S, Enttec Open DMX USB, Tornado, clones), the serial stream at 250000 baud is interpreted as raw DMX512 slots. The standard DMX512 packet structure is:

| Field | Duration / Size |
|-------|-----------------|
| BREAK | 88 µs |
| MAB | 8 µs |
| **Start Code** | **1 byte (`0x00`)** |
| Data Slots 1-512 | 512 bytes |

The current code sends **512 bytes** starting with whatever value is in DMX channel 1. The receiver treats channel 1's value as the Start Code. Unless channel 1 happens to be `0x00`, the packet is discarded.

### Recommended Fix Location

**The fix is NOT in the SAB layout.** The SAB correctly stores 512 channels per universe (the DMX protocol data payload is 512 slots). The fix is in `OpenDMXStrategy.ts:140`: prepend a `0x00` byte before the 512 channel bytes so the buffer written to `port.write()` is **513 bytes**.

```typescript
// BEFORE (broken):
this.port.write(Buffer.from(new Uint8Array(frame.data.subarray(0, 512))))

// AFTER (correct):
const channels = new Uint8Array(frame.data.subarray(0, 512))
const packet = Buffer.alloc(513)
packet[0] = 0x00  // DMX Start Code
Buffer.from(channels).copy(packet, 1)
this.port.write(packet)
```

---

## 🔍 FINDING 2: `_outputEnabled` — Open at Boot

**Verdict: The output gate IS open. This is NOT blocking DMX.**

### Evidence Chain

**`TitanOrchestrator.ts:556-557`**:

```typescript
// WAVE 6010 PATCH 1: _outputEnabled=true en boot para evitar Silent Blackout del Smart Gate
private _outputEnabled = true
```

**`TickEngine.ts:980`**:

```typescript
aetherSafety.setOutputEnabled(this._outputEnabled)   // receives true
```

**`TickEngine.ts:1058-1059`**:

```typescript
const outputEnabled = this._outputEnabled             // true
this.hal.setAetherOutputGateState(outputEnabled, blackoutActive)
```

### ⚠️ Contradiction Note

Line 676 in the same file contains a **stale comment**:

```typescript
// WAVE 4703: _outputEnabled starts false at boot — canonical state owned by TitanOrchestrator
```

This comment is **false**. The code at line 557 (`= true`) wins. The output gate is open; values are flowing through `aetherSafety.applyOutputGate()` and into the SAB.

### Recommendation

Remove or update the stale comment at `TitanOrchestrator.ts:676` to avoid future confusion.

---

## 🔍 FINDING 3: Frontend FPS Killer — Multiple Converging Pathologies

**Verdict: No single line kills FPS. It's a death-by-a-thousand-cuts convergence.**

---

### Pathology A: TrinityProvider Store Cascade (`~7Hz storm`)

**File:** `TrinityProvider.tsx:198-289`

`handleStateUpdate` is called on every `lux:state-update` IPC message (~7Hz). It performs **6-9 state mutations in a single callback**:

```typescript
const handleStateUpdate = useCallback((seleneState: SeleneStateUpdate) => {
  // 1. React local state
  setState(prev => ({
    ...prev,
    lastUpdateTime: Date.now(),
    framesReceived: prev.framesReceived + 1,
  }))

  // 2. Zustand: seleneStore
  incrementFrames()

  // 3. Zustand: audioStore
  if (seleneState.beat) {
    updateAudioStore({
      bpm: seleneState.beat.bpm,
      bpmConfidence: seleneState.beat.confidence,
      onBeat: seleneState.beat.onBeat,
      level: db,
    })
    if (seleneState.beat.onBeat) {
      registerBeat()   // triggers setTimeout → second update 100ms later
    }
  }

  // 4. Zustand: seleneStore (again)
  if (seleneState.brain) {
    updateBrainMetrics({
      currentMode: mode,
      confidence,
      beautyScore,
      energy,
    })
    if (mode !== lastModeRef.current) {
      addLogEntry({ type: 'MODE', message: `Switched to ${mode.toUpperCase()} mode` })
    }
  }

  // 5. Zustand: dmxStore
  if (seleneState.fixtures && seleneState.fixtures.length > 0) {
    updateFixtureValues(seleneState.fixtures)   // creates new Map every time
  }

  // 6. Zustand: luxsyncStore
  if (seleneState.effects) {
    setActiveEffects(activeEffects)
    setBlackout(seleneState.effects.blackout)
  }
}, [updateAudioStore, registerBeat, updateBrainMetrics, incrementFrames,
    addLogEntry, updateFixtureValues, setActiveEffects, setBlackout])
```

**Impact:** Every ~143ms, `TrinityProvider` (root context provider) re-renders, and Zustand broadcasts changes to `audioStore`, `seleneStore`, `dmxStore`, and `luxsyncStore`.

---

### Pathology B: Dual IPC Channel Overlap (`~14 messages/sec`)

**File:** `main.ts` ~606-675

The `setBroadcastCallback` sends **both** `selene:truth` AND `lux:state-update` from the same tick callback every `TRUTH_BROADCAST_DIVIDER = 6` ticks (~7Hz):

```typescript
// main.ts — same callback sends TWO IPC messages
mainWindow.webContents.send('selene:truth', truthPayload)     // ~7Hz
mainWindow.webContents.send('lux:state-update', statePayload)  // ~7Hz
```

**Frontend subscribers:**

- **`useSeleneTruth.ts:92`** subscribes to `selene:truth`:
  ```typescript
  window.lux.onTruthUpdate((data: SeleneTruth) => {
    injectTransientTruth(data)                    // ~7Hz, zero React cost (mutable ref)
    // Throttled to ~5fps:
    if (truthThrottleCountRef.current >= TRUTH_THROTTLE_INTERVAL) {
      setTruth(data)                               // Zustand truthStore update
      useAudioStore.getState().updateMetrics({...}) // Zustand audioStore update
    }
  })
  ```

- **`TrinityProvider.tsx:319`** subscribes to `lux:state-update`:
  ```typescript
  unsubscribeRef.current = window.lux.onStateUpdate(handleStateUpdate)  // ~7Hz, full cascade
  ```

**Impact:** The frontend processes **two IPC channels** carrying essentially the same fixture data, but they update **different stores** (`truthStore` vs `audioStore`/`seleneStore`/`dmxStore`). This causes redundant, overlapping React reconciliations.

---

### Pathology C: TacticalCanvas Main-Thread CPU Burn (`60fps pump`)

**File:** `TacticalCanvas.tsx:624-697`

When `isVisible=true` (default 2D view), a `requestAnimationFrame` loop runs **continuously on the main thread**:

```typescript
useEffect(() => {
  if (!isReady || !isVisible) return

  let frameNumber = 0
  let rafId = 0

  const pump = () => {
    const currentFixtures = fixturesRef.current
    if (currentFixtures.length === 0) {
      rafId = requestAnimationFrame(pump)
      return
    }

    // Read transient truth — rebuild Map every frame
    const transientTruth = getTransientTruth()
    const transientFixtures = transientTruth?.hardware?.fixtures
    if (transientFixtures && Array.isArray(transientFixtures)) {
      transientMapRef.current.clear()
      for (const f of transientFixtures) {
        if (f?.id) transientMapRef.current.set(f.id, f)
      }
      transientMap = transientMapRef.current
    }

    // Pack frame data — iterates ALL fixtures
    packFrameDataInto(buffer, currentFixtures, transientMap, controlState, overrides)

    frameNumber++
    mailboxRef.current = msg
    flushFrameMailbox()
    publishRuntimeMetrics()

    rafId = requestAnimationFrame(pump)   // 60fps, NO throttle
  }

  rafId = requestAnimationFrame(pump)
  return () => { if (rafId) cancelAnimationFrame(rafId) }
}, [isReady, isVisible, flushFrameMailbox, publishRuntimeMetrics])
```

Inside `packFrameDataInto` (`TacticalCanvas.tsx:131-183`), **every fixture** triggers a call to `calculateFixtureRenderValues()`:

```typescript
function packFrameDataInto(buffer, fixtures, transientMap, controlState, overrides) {
  for (let i = 0; i < fixtureCount; i++) {
    const id = fixtures[i].id
    const transientState = transientMap?.get(id)
    const offset = i * FLOATS_PER_FIXTURE

    if (transientState) {
      const fixtureOverride = overrides.get(id)
      const renderData = calculateFixtureRenderValues(
        transientState,
        cinema.globalMode,
        cinema.flowParams,
        cinema.activePaletteId,
        cinema.globalIntensity,
        cinema.globalSaturation,
        i,
        fixtureOverride?.values,
        fixtureOverride?.mask,
        cinema.targetPalette,
        cinema.transitionProgress
      )
      // ... 12 float writes per fixture
    }
  }
}
```

**Impact:** With 50 fixtures, this loop executes `50 × 60 = 3,000` iterations/second of `calculateFixtureRenderValues` on the **main thread**, directly competing with React's reconciler and IPC message processing.

---

### Pathology D: DMX Store Reference Thrashing (`dmxStore.ts:265-269`)

```typescript
updateFixtureValues: (values) => {
  const newMap = new Map<number, FixtureValues>()   // NEW Map EVERY call
  values.forEach(v => newMap.set(v.dmxAddress, v))
  set({ fixtureValues: newMap })   // NEW reference → Zustand always triggers re-render
}
```

Even if the fixture values are identical, Zustand sees a new `Map` object and triggers re-renders for any subscriber. `TrinityProvider` is the only subscriber, but it already re-renders from `setState`.

---

### Pathology E: `onBeat` Toggle Storm (`audioStore.ts:115-126`)

```typescript
registerBeat: () => {
  set((state) => ({
    onBeat: true,
    beatCount: state.beatCount + 1,
    lastBeatTime: Date.now(),
  }))

  // Auto-reset onBeat after 100ms → SECOND Zustand update
  setTimeout(() => {
    set({ onBeat: false })
  }, 100)
}
```

At 120 BPM = 2 beats/sec, this creates **4 Zustand transitions/sec** just for the `onBeat` boolean.

**`HyperionView.tsx:109`** reads `onBeat`:

```typescript
const { bpm, bpmConfidence, onBeat } = useAudioStore(useShallow(selectHyperionAudio))
```

`HyperionView` is **not memoized**. Every `onBeat` toggle causes `HyperionView` + its entire subtree (TacticalCanvas, VisualizerCanvas container, StageSidebar, etc.) to re-render.

---

### Pathology F: R3F `BeatTracker` 60fps State Updates (`VisualizerCanvas.tsx:124-139`)

When the 3D view is active, this component calls `setBeatIntensity` from `useFrame` at **60fps**:

```typescript
const BeatTracker: React.FC<{ onBeatIntensity: (intensity: number) => void }> = ({ onBeatIntensity }) => {
  const onBeat = useAudioStore(state => state.onBeat)
  const beatIntensityRef = useRef(0)

  useFrame((_, delta) => {
    if (onBeat) {
      beatIntensityRef.current = 1.0
    } else {
      beatIntensityRef.current *= Math.exp(-8 * delta)  // Exponential decay
    }
    onBeatIntensity(beatIntensityRef.current)   // setState at 60fps inside R3F
  })

  return null
}
```

This triggers `Scene` re-render at 60fps inside React Three Fiber's reconciler. While isolated from the DOM tree, it consumes GPU cycles and some main-thread CPU for the R3F render loop.

---

## 🎯 Exact Lines of Interest

| File | Lines | Finding |
|------|-------|---------|
| `electron-app/src/hal/drivers/strategies/OpenDMXStrategy.ts` | 140 | `this.port.write(Buffer.from(new Uint8Array(frame.data.subarray(0, 512))))` — **512 bytes, no start code** |
| `electron-app/src/core/aether/glass/layout.ts` | 14 | `CHANNELS_PER_UNI = 512` — confirms no start code slot in SAB |
| `electron-app/src/core/aether/glass/DmxSabHandlers.ts` | 30-49 | `commitFrame()` writes raw 512 bytes per universe |
| `electron-app/src/core/orchestrator/TitanOrchestrator.ts` | 556-557 | `private _outputEnabled = true` — gate is OPEN ✅ |
| `electron-app/src/core/orchestrator/TitanOrchestrator.ts` | 676 | Stale comment: "starts false at boot" — **false**, code says `true` |
| `electron-app/src/core/orchestrator/tick/TickEngine.ts` | 980 | `aetherSafety.setOutputEnabled(this._outputEnabled)` — receives `true` |
| `electron-app/src/core/orchestrator/tick/TickEngine.ts` | 1058-1059 | `const outputEnabled = this._outputEnabled` — propagated to HAL |
| `electron-app/src/providers/TrinityProvider.tsx` | 198-289 | `handleStateUpdate` does 6-9 store updates per IPC msg |
| `electron-app/src/providers/TrinityProvider.tsx` | 319 | Subscribes to `lux:state-update` via `window.lux.onStateUpdate` |
| `electron-app/src/hooks/useSeleneTruth.ts` | 92 | Subscribes to `selene:truth` via `window.lux.onTruthUpdate` (overlapping with above) |
| `electron-app/src/components/hyperion/views/tactical/TacticalCanvas.tsx` | 624-697 | RAF pump at 60fps on main thread |
| `electron-app/src/components/hyperion/views/tactical/TacticalCanvas.tsx` | 131-183 | `packFrameDataInto` calls `calculateFixtureRenderValues` per fixture |
| `electron-app/src/stores/dmxStore.ts` | 265-269 | `updateFixtureValues` creates new `Map` every call (~7Hz) |
| `electron-app/src/stores/audioStore.ts` | 115-126 | `registerBeat` toggles `onBeat` twice per beat (immediate + 100ms timeout) |
| `electron-app/src/components/hyperion/views/HyperionView.tsx` | 109 | Reads `onBeat` from `audioStore`, causing re-render of entire Hyperion subtree |
| `electron-app/src/components/hyperion/views/visualizer/VisualizerCanvas.tsx` | 124-139 | `BeatTracker` calls `setState` from `useFrame` at 60fps |
| `electron-app/electron/main.ts` | ~606-675 | Sends both `selene:truth` and `lux:state-update` from same callback |

---

## 📋 Summary Table

| Question | Answer |
|----------|--------|
| **Why are physical lights off?** | DMX packet is 512 bytes instead of 513. Missing `0x00` start code. Hardware rejects malformed packet. |
| **Is `_outputEnabled` blocking output?** | **No.** It is `true` at boot (WAVE 6010 PATCH 1). The Smart Gate is open. |
| **Why is UI at 3-5 FPS?** | Convergence of: TacticalCanvas 60fps main-thread pump + TrinityProvider 7Hz store cascade + dual IPC overlap + `onBeat` toggle storm. |
| **Is `selene:hot-frame` spamming IPC?** | **No.** `emitHotFrame()` in `TickEngine.ts` is an empty lambda; the callback is registered in `main.ts` but never invoked. |
| **Is `GlassCanvas.tsx` causing re-renders?** | **No.** It uses `useRef` to store frame data, not `setState`. Zero React overhead. |
| **Is GlassBridge working?** | **Yes.** `glassPool.pushFrame(view)` is called at 44Hz. `BufferPoolManager` sends frames to renderer. `GlassCanvas` receives them. |

---

## 🏗️ Architect Recommendations

### Priority 1: Fix DMX Output (Physical Lights)

- **Target:** `OpenDMXStrategy.ts:140`
- **Action:** Prepend `0x00` start code byte. Write 513 bytes instead of 512.
- **Risk:** Minimal. One-line change. No SAB layout modification needed.

### Priority 2: Fix UI Lag

- **Quick Wins:**
  1. Add `React.memo()` to `HyperionView` — prevents subtree re-renders from `onBeat` toggles
  2. Throttle the `TacticalCanvas` RAF pump to 22Hz (every 3rd frame) — the worker interpolates anyway
  3. Remove stale comment at `TitanOrchestrator.ts:676`
- **Medium Effort:**
  4. Consolidate `selene:truth` and `lux:state-update` into a single IPC channel — eliminates the dual-channel overlap
  5. Add deep-equality check in `dmxStore.updateFixtureValues` before creating new `Map`
  6. Replace `setTimeout` in `registerBeat` with a `requestAnimationFrame`-aligned reset to batch with React's render cycle

### Priority 3: Architectural Cleanup

- Consider moving the `TacticalCanvas` data pump to a **Web Worker** (SharedArrayBuffer already exists for DMX; extend pattern to fixture render data)
- The `BeatTracker` inside R3F should use `useRef` + imperative updates instead of `setState` at 60fps

---

**End of Report.** Ready for architect review and sprint planning.
