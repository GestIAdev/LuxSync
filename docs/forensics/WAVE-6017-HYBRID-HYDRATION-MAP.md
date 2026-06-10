# WAVE-6017 — MAPA DE HIDRATACIÓN HÍBRIDA: Tubo Lento + Consumo Rápido
**Auditor:** Cascade (Core Engineer)  
**Date:** 2026-06-09  
**Status:** `READ-ONLY FORENSIC MAP — No code changed`

---

## 1. Resumen Ejecutivo

GlassBridge está sano: el `BufferPoolManager` envía `Float32Array` a 44Hz y `GlassCanvas.tsx` lo consume. El resto de la UI está ciega porque matamos **todo** el IPC de estado.

Este documento mapea los **puntos de conexión exactos** para reconectar sin rediseños masivos:
- **Tubo Lento:** Resucitar `selene:truth` a 1Hz (o event-driven) para hidratar stores.
- **Consumo Rápido:** Re-enrutar `TacticalCanvas` y `VisualizerCanvas` para que lean de `window.glass` en vez de `transientStore` + `useSeleneTruth`.

---

## 2. TARGET 1 — Tubo Lento: Resurrección de `selene:truth` (Modo Dieta)

### 2.1 Punto de Emisión (Main Process)

**File:** `electron/main.ts`  
**Lines:** `604-608` (currently dead)

**Current state (WAVE-6015):**
```typescript
@/electron-app/electron/main.ts:606-608
// 🛑 WAVE 6015 PARCHE 1: selene:truth IPC BROADCAST KILLED.
// Zero IPC messages to renderer. All visual data flows via BufferPoolManager (GlassBridge).
// titanOrchestrator.setBroadcastCallback((truth) => { ... }) — ERADICATED.
```

**Insertion point:** Uncomment / restore the callback block, but add a **1Hz throttle** using a simple frame counter or `setInterval` gate.

**Minimal change:**
```typescript
@/electron-app/electron/main.ts:604-608
  // 🩸 WAVE-6017: selene:truth RESURRECTED at 1Hz (was ~7Hz).
  // Only structural metadata + gate state. No fixture arrays.
  let _lastTruthFrame = 0
  titanOrchestrator.setBroadcastCallback((truth) => {
    _lastTruthFrame++
    // Emit once every 44 frames (~1Hz). Skip heavy payload if unchanged.
    if (_lastTruthFrame % 44 !== 0) return
    try {
      if (mainWindow && !mainWindow.isDestroyed() && mainWindow.webContents && !mainWindow.webContents.isDestroyed()) {
        // STRIP heavy arrays to avoid structured-clone tax:
        //   - truth.hardware.fixtures (leave count only)
        //   - truth.hardware.dmxOutput (leave gate status only)
        const leanTruth = {
          system: truth.system,
          sensory: truth.sensory,
          consciousness: truth.consciousness,
          context: truth.context,
          intent: truth.intent,
          hardware: {
            dmx: { ...truth.hardware.dmx, outputEnabled: titanOrchestrator.isOutputEnabled() },
            fixturesActive: truth.hardware.fixturesActive,
            fixturesTotal: truth.hardware.fixturesTotal,
          }
        }
        mainWindow.webContents.send('selene:truth', leanTruth)
      }
    } catch (err) { /* renderer destroyed, ignore */ }
  })
```

**Alternative (event-driven, zero Hz baseline):**
Instead of periodic broadcast, emit only on:
- Show loaded / show cleared
- `setOutputEnabled` toggle
- Vibe change
- Mode change (`auto` ↔ `manual`)

This requires wiring `titanOrchestrator` event hooks into the IPC emitter.

---

### 2.2 Punto de Construcción del Truth (TickEngine)

**File:** `src/core/orchestrator/tick/TickEngine.ts`  
**Lines:** `1158-1354`

The `SeleneTruth` object is already built in-place at `~7Hz` (every `TRUTH_BROADCAST_DIVIDER = 6` ticks). The `this.onBroadcast(truth)` call at `line 1343` is the hook that feeds the main.ts callback.

**Key insight:** The broadcast construction is **already throttled** in `TickEngine`. The main.ts callback just needs to be re-attached. No changes needed in `TickEngine.ts` unless we want to further strip the payload.

```typescript
@/electron-app/src/core/orchestrator/tick/TickEngine.ts:1158-1343
    if (this.onBroadcast && shouldBroadcastFullTruth) {
      // ... builds truth ...
      this.onBroadcast(truth)   // <-- this is the fire-hose
    }
```

If the main.ts callback applies its own `1Hz` throttle (as proposed above), `TickEngine` can remain untouched.

---

## 3. TARGET 2 — Recepción Lenta en Frontend

### 3.1 Hook Receptor

**File:** `src/hooks/useSeleneTruth.ts`  
**Lines:** `83-199`

**Current state:** Subscribes to `window.lux.onTruthUpdate` (IPC `selene:truth`). The hook is **alive** but receives **zero payloads**.

```typescript
@/electron-app/src/hooks/useSeleneTruth.ts:92
    const removeListener = window.lux.onTruthUpdate((data: SeleneTruth) => {
      // PATH 1: transientStore — EVERY frame (zero React cost)
      injectTransientTruth(data)
      // PATH 2 + 3: truthStore + audioStore — throttled to ~5fps
      setTruth(data)
      useAudioStore.getState().updateMetrics({...})
    })
```

**What happens if `selene:truth` returns at 1Hz:**
- `injectTransientTruth(data)` fires once per second → `transientStore` gets a slow snapshot.
- `truthStore` updates once per second → React re-renders at 1Hz (trivial cost).
- `audioStore` updates once per second → audio meters are slightly choppy but functional.

**No code changes needed in `useSeleneTruth.ts`**. It will automatically wake up once the IPC channel resumes.

---

### 3.2 Stores Dependientes del Tubo Lento

| Store | File | Key Data Needed from Truth | Impact if Starved |
|-------|------|-----------------------------|-------------------|
| `truthStore` | `src/stores/truthStore.ts` | `truth.system`, `truth.context`, `truth.intent` | UI shows defaults; no vibe/genre info |
| `seleneStore` | `src/stores/seleneStore.ts` | `system.mode`, `system.brainStatus` | Connection indicator shows offline |
| `audioStore` | `src/stores/audioStore.ts` | `sensory.audio`, `sensory.beat` | Meters frozen at 0; no beat flash |
| `dmxStore` | `src/stores/dmxStore.ts` | `hardware.dmx.connected`, `hardware.fixturesTotal` | Fixture count = 0; DMX gate unknown |
| `controlStore` | `src/stores/controlStore.ts` | `outputEnabled` (needs to be added to leanTruth) | Toggle button state unknown |

**Critical missing field:** `outputEnabled` is **not** currently present in the `SeleneTruth` payload. The `controlStore` reads it from nowhere. To fix the Cold Start deadlock (`_outputEnabled = false` with blind UI), the lean truth MUST include:

```typescript
leanTruth.hardware.dmx.outputEnabled = titanOrchestrator.isOutputEnabled()
```

---

## 4. TARGET 3 — Consumo Rápido en Simuladores (Hyperion)

### 4.1 TacticalCanvas.tsx — Data Pump

**File:** `src/components/hyperion/views/tactical/TacticalCanvas.tsx`  
**Lines:** `624-710` (the `requestAnimationFrame` data pump)

**Current consumption path:**
```
TickEngine emits hot-frame → IPC selene:hot-frame → useSeleneTruth injects transientStore
  → TacticalCanvas data pump reads getTransientTruth() every RAF
    → packs Float32Array → sends to Worker
```

**After WAVE-6015:** `selene:hot-frame` is dead. The pump reads `getTransientTruth()` which is **stale** (last injected 1Hz from truth, or completely empty).

**Proposed re-routing (minimal):**

Replace the transientStore read with a read from `window.glass`.

```typescript
@/electron-app/src/components/hyperion/views/tactical/TacticalCanvas.tsx:647-657
      // BEFORE (WAVE-2510, now starved):
      // const transientTruth = getTransientTruth()
      // const transientFixtures = transientTruth?.hardware?.fixtures

      // AFTER (WAVE-6017): Read from GlassBridge Float32Array directly.
      // The structural scaffold (fixture IDs, zones, positions) comes from useFixtureData().
      // The dynamic values (dimmer, color, pan, tilt) come from window.glass.
      const glassView = window.glass?.getLatestView?.() ?? null
      // Map glassView Float32Array[fi*16 + field] → transientMap format expected by packFrameDataInto()
```

**Problem:** `packFrameDataInto()` expects a `Map<string, fixtureObject>` with fields like `.color.r`, `.physicalPan`, `.intensity`. The GlassBridge `Float32Array` has a flat layout (`FIXTURE_FIELD` offsets).

**Minimal adapter needed:** A tiny conversion function inside `TacticalCanvas.tsx` (or `packFrameDataInto` itself) that reads the flat array instead of the object map.

```typescript
// Inline adapter (~20 lines) inside the RAF pump:
function buildTransientMapFromGlassView(
  glassView: Float32Array | null,
  fixtures: any[],
): Map<string, any> {
  const map = new Map<string, any>()
  if (!glassView || glassView.length === 0) return map
  for (let i = 0; i < fixtures.length && i < 2048; i++) {
    const off = i * 16  // FixField layout from GlassMemory
    const id = fixtures[i]?.id
    if (!id) continue
    map.set(id, {
      color: { r: glassView[off], g: glassView[off+1], b: glassView[off+2] },
      intensity: glassView[off+5] / 255,  // dimmer
      physicalPan: glassView[off+8] / 255,
      physicalTilt: glassView[off+9] / 255,
      zoom: glassView[off+10],
      focus: glassView[off+11],
      panVelocity: glassView[off+12],
      tiltVelocity: glassView[off+13],
    })
  }
  return map
}
```

Then replace `transientMapRef.current` population with this adapter.

---

### 4.2 VisualizerCanvas.tsx — 3D Consumption

**File:** `src/components/hyperion/views/visualizer/VisualizerCanvas.tsx`  
**Lines:** Unknown (needs audit)

**Likely pattern:** VisualizerCanvas uses R3F (`@react-three/fiber`) `useFrame()` to read fixture data. It probably subscribes to `transientStore` or `truthStore` via Zustand selectors.

**Assumed path (based on Hyperion architecture):**
```
useFrame() → read transientStore or truthStore → update fixture meshes
```

**Re-routing options:**
1. **Option A (Minimal):** Keep `transientStore` as the bridge. Have `GlassCanvas.tsx` (or a new invisible hydrator) call `injectTransientTruth()` on every `window.glass.onFrame`, converting the flat `Float32Array` into the object shape that `transientStore` expects. Then `VisualizerCanvas` needs **zero changes**.

2. **Option B (Direct):** In `VisualizerCanvas`, read `window.glass` directly inside `useFrame()`, bypassing Zustand entirely. Requires mapping fixture IDs to array indices.

**Recommendation:** Option A is cleaner. `transientStore` is already a mutable-ref store designed for 60fps reads. We just need to feed it from GlassBridge instead of IPC.

---

## 5. Mapeo de Cambios (Resumen Ejecutivo para el Arquitecto)

### 5.1 Backend (Main Process)

| File | Lines | Change | Effort |
|------|-------|--------|--------|
| `electron/main.ts` | `604-608` | Uncomment `setBroadcastCallback`, add 1Hz throttle, strip heavy arrays, inject `outputEnabled` | 15 min |
| `src/core/orchestrator/TickEngine.ts` | `1158-1343` | **No change needed** unless further payload stripping | 0 min |

### 5.2 Frontend Stores (Tubo Lento)

| File | Lines | Change | Effort |
|------|-------|--------|--------|
| `src/hooks/useSeleneTruth.ts` | `83-199` | **No change needed** — wakes automatically when IPC resumes | 0 min |
| `src/stores/controlStore.ts` | Unknown | Add `outputEnabled` hydration from truth payload (if not already) | 5 min |

### 5.3 Frontend Canvas (Consumo Rápido)

| File | Lines | Change | Effort |
|------|-------|--------|--------|
| `src/components/GlassCanvas.tsx` | `17-24` | Keep `onFrame` callback. Optionally add `injectTransientTruth()` adapter inside the callback to feed Hyperion. | 10 min |
| `src/components/hyperion/views/tactical/TacticalCanvas.tsx` | `647-657` | Replace `getTransientTruth()` with `buildTransientMapFromGlassView()` reading `window.glass` | 20 min |
| `src/components/hyperion/views/visualizer/VisualizerCanvas.tsx` | Unknown | Either: (a) rely on `transientStore` fed by GlassCanvas adapter, or (b) direct `window.glass` read in `useFrame()` | 10-30 min |
| `src/stores/transientStore.ts` | Unknown | If Option A chosen, add `injectTransientTruthFromGlassView(view, fixtures)` helper | 15 min |

---

## 6. The Cold Start Deadlock — Specific Fix

**Problem:** `_outputEnabled = false` at boot + no UI feedback = user cannot arm DMX.

**Fix via Tubo Lento:**
The lean `selene:truth` MUST include `hardware.dmx.outputEnabled`. Then `useSeleneTruth` throttles this into `controlStore` (or `truthStore` exposes it). `CommandDeck.tsx` reads `controlStore.outputEnabled` and renders the toggle correctly.

**Code insertion in main.ts leanTruth builder:**
```typescript
leanTruth.hardware.dmx.outputEnabled = titanOrchestrator.isOutputEnabled()
leanTruth.hardware.dmx.blackoutActive = titanOrchestrator.isBlackoutActive() // if exists
```

---

## 7. Files Referenced

- `electron-app/electron/main.ts`
- `electron-app/src/core/orchestrator/tick/TickEngine.ts`
- `electron-app/src/hooks/useSeleneTruth.ts`
- `electron-app/src/stores/truthStore.ts`
- `electron-app/src/stores/seleneStore.ts`
- `electron-app/src/stores/audioStore.ts`
- `electron-app/src/stores/dmxStore.ts`
- `electron-app/src/stores/controlStore.ts`
- `electron-app/src/stores/transientStore.ts`
- `electron-app/src/components/GlassCanvas.tsx`
- `electron-app/src/components/hyperion/views/tactical/TacticalCanvas.tsx`
- `electron-app/src/components/hyperion/views/visualizer/VisualizerCanvas.tsx`
- `electron-app/electron/preload.ts` (`window.lux.onTruthUpdate` binding)

---

*End of forensic map. No code modified. Awaiting architect directive on which path (1Hz IPC vs. event-driven vs. full GlassBridge conversion) to execute.*
