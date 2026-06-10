# WAVE-6016 — FORENSIC AUDIT: GlassBridge Architecture Disconnect
**Auditor:** Cascade (Core Engineer)  
**Date:** 2026-06-09  
**Scope:** Post-IPC-eradication system state after WAVE-6015 patches.  
**Status:** `ARCHITECTURAL — Code changes deferred to architect discretion`

---

## 1. Executive Summary

After the complete eradication of high-frequency IPC (`selene:truth`, `lux:state-update`, `selene:hot-frame`) per WAVE-6015, the **GlassBridge (BufferPoolManager)** is confirmed operational at 44Hz. However, **zero data reaches the end-user UI** and **no DMX output reaches the physical hardware**.

The GlassBridge transports a raw `Float32Array` to `GlassCanvas.tsx`. The rest of the React tree (stores, CommandDeck, fixture lists, audio viz) remains starved because it depended on structured JSON via IPC. Meanwhile, the DMX hardware path relies entirely on the Aether pipeline (`registeredUniverses`), which is currently gated shut by `_outputEnabled = false` (Cold Start Protocol) with no UI-visible mechanism to arm it.

**This is not a bug in GlassBridge. It is a consumption-side disconnect.**

---

## 2. Evidence Log

```
[GlassBridge] 🏓 Ping-Pong Status: Sent: 986 | Dropped: 8 | In-Flight: 1 | PoolFree: 2
[TitanOrchestrator] 🎧 WORKER BPM=85 conf=0.73 | PLL=FREEWHEEL ...
[TitanEngine 🌊 LIQUID 7-ZONE] FL:0% FR:0% BL:0% BR:0%
[AetherAduana 🛂] VelClamp:0 Airbag:0 DarkSpin:0 AduanaGate:1496
[CHOREO] fiesta-latina | #0:figure8 [SNAKE ×2] | scene:43b | Pan:-243 Tilt:20
```

- **Sent: 986** → `BufferPoolManager.pushFrame()` is executing. Main→Renderer transfer works.
- **FL:0% … BR:0%** → Engine zones are zeroed (fixtureStates exist but zone intensities are nil).
- **AduanaGate:1496** → `AetherSafetyMiddleware` has blocked 1,496 egress attempts. Gate is closed.

---

## 3. Findings

### F1 — UI Data Pipeline Severed
**Severity:** Critical  
**Location:** `src/hooks/useSeleneTruth.ts`, `src/providers/TrinityProvider.tsx`, all Zustand stores

`useSeleneTruth` subscribes to `window.lux.onTruthUpdate` (IPC). After WAVE-6015, no emitter feeds this channel. The hook fires once at mount, detects the channel exists but receives **zero payloads**, and the app tree never hydrates.

**Impact:**
- `truthStore` → empty
- `dmxStore` → empty
- `seleneStore` → default pessimistic state (`brainConnected = false`)
- `audioStore` → stale
- All downstream selectors return defaults.

### F2 — GlassBridge Only Feeds the Canvas
**Severity:** High  
**Location:** `src/components/GlassCanvas.tsx`

The `BufferPoolManager` delivers a raw `Float32Array(32768)` representing up to 2,048 fixtures. `GlassCanvas.tsx` consumes this in an imperative `requestAnimationFrame` loop and paints a single 800×200 intensity bar. **No other component reads from `window.glass`**. The stores do not know GlassBridge exists.

**Result:** The canvas may be technically rendering, but every React-bound UI surface is blind.

### F3 — DMX Hardware Pipeline Status: Structurally Sound but Gated
**Severity:** High  
**Location:** `src/core/orchestrator/tick/TickEngine.ts:1123-1139`

`TickEngine` writes to `DMX_UNIVERSE_SAB` via `DmxUniverseWriter.commitFrame()` every tick. The SAB is read by:
- `OpenDMXStrategy.ts` (self-managed, reads SAB directly in Main Process)
- `dmxPhantomWorker.ts` (reads SAB in Node `worker_thread`)

**However**, the arrays written into the SAB are sourced from `aetherResolver.registeredUniverses` (line 1127). If this set is empty, only Universe 0 (forced empty) is committed. The physical driver therefore receives empty frames.

**Historical note:** Before WAVE-6015, the UI showed fixture data from the **legacy engine pipeline** (`fixtureStates` → IPC), while the **Aether pipeline** (`NodeResolver` → `registeredUniverses`) was already silent. The hardware was not receiving usable data even when IPC was alive.

### F4 — Cold Start Protocol Lockout
**Severity:** Critical  
**Location:** `src/core/orchestrator/TitanOrchestrator.ts:557`, `AetherSafetyMiddleware.ts:71`

- `_outputEnabled` initializes to `false` (WAVE-6015 Parche 2).
- `AetherSafetyMiddleware._outputEnabled` mirrors this state.
- `applyOutputGate()` (line 152) zeros all non-KINETIC / non-manual channels when the gate is closed.
- `shouldSendUniverse()` will skip universes if the gate logic deems them blocked.

**Because the UI is blind (F1+F2), the user cannot see the gate status and cannot arm it.** Even if they click the CommandDeck toggle, the UI cannot reflect the new state because there is no feedback channel.

### F5 — Legacy HAL Path Disconnected
**Severity:** Medium (Architectural)  
**Location:** `src/core/orchestrator/tick/TickEngine.ts:770`

```typescript
// ⚡ WAVE-4592: flushToDriver() ELIMINADO
// this.hal.flushToDriver(fixtureStates)  ← DISCONNECTED
```

The legacy `HAL.flushToDriver()` path was severed in WAVE-4592. All DMX egress is now Aether-only. If the Aether `NodeGraph` is empty or devices are not registered via `registerAetherDevice()`, **no DMX packets are ever produced**.

---

## 4. Root Cause Map

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         TITAN ENGINE (44Hz)                               │
│  Engine produces fixtureStates + arbitrated nodes                         │
└───────────────────────┬────────────────┬─────────────────┬───────────────────┘
                        │                │                 │
                        ▼                ▼                 ▼
           ┌───────────────┐   ┌──────────────┐   ┌─────────────┐
           │  _glassView   │   │ AetherResolver│   │ Legacy HAL  │
           │  (Float32)    │   │ (NodeGraph)   │   │ (WAVE-4592) │
           └───────┬───────┘   └──────┬───────┘   │ DISCONNECTED│
                   │                  │             └─────────────┘
                   │                  │
                   ▼                  ▼
        ┌─────────────────┐  ┌──────────────────┐
        │ BufferPoolManager│  │ DMX_UNIVERSE_SAB │
        │ (MessagePortMain)│  │ (seqlock)        │
        └────────┬────────┘  └────────┬─────────┘
                 │                      │
                 ▼                      ▼
      ┌──────────────────┐    ┌──────────────────┐
      │ GlassCanvas.tsx   │    │ OpenDMXStrategy / │
      │ (rAF + ackFrame)  │    │ DMXPhantomWorker  │
      └──────────────────┘    └────────┬─────────┘
                                     │
                                     ▼
                              ┌─────────────┐
                              │  HARDWARE   │
                              │   DMX OUT   │
                              └─────────────┘

DETACHED / STARVED:
- useSeleneTruth → truthStore → ALL REACT COMPONENTS
- dmxStore → Fixture lists, preview grids, CommandDeck status
- seleneStore → Connection status, mode indicators
- audioStore → Visualizers, VU meters
```

---

## 5. Conclusions for the Architect

1. **GlassBridge (Transport Layer) is innocent.** The ping-pong metrics prove zero-allocation transport at 44Hz. Do not refactor `BufferPoolManager`.

2. **The consumption layer is missing.** Two possible architectural paths:
   - **Path A — Extend GlassBridge payload:** Reserve trailing floats in the `Float32Array` for system metadata (`outputEnabled`, `blackoutActive`, `bpm`, `beat`, `vibeId`). Build a `GlassBridgeHydrator` that decodes these into Zustand stores on every `window.glass.onFrame`.
   - **Path B — Dual-channel control plane:** Keep GlassBridge for high-frequency fixture data, but open a **low-frequency, command-only** IPC channel (e.g., `lux:state-sync` at 1Hz or on-demand `invoke`) for store hydration and gate control. This is not “IPC spam”; it is a control plane distinct from the 44Hz data plane.

3. **DMX hardware silence is a pre-existing Aether pipeline issue.** Even before IPC was killed, the hardware path depended on Aether `registeredUniverses`. Verify whether Aether devices are actually registered in the current showfile. If the legacy fixture list is not mapped into the `NodeGraph`, the Aether resolver produces zero universes.

4. **Cold Start Protocol is currently a deadlock.** With `_outputEnabled = false` at boot and no UI feedback channel, the system is in an unrecoverable state. Either:
   - Default `_outputEnabled = true` (revert WAVE-6015 Parche 2), or
   - Provide a physical/headless arming mechanism (e.g., auto-arm after audio lock + 5s).

---

## 6. Recommended Next Steps (Architectural, not Code)

| # | Action | Owner | Priority |
|---|--------|-------|----------|
| 1 | Decide UI hydration strategy: Extend GlassBridge payload vs. low-freq control IPC | Architect | P0 |
| 2 | Verify Aether device registration for current showfile | Architect / Show Designer | P0 |
| 3 | Define Cold Start UX: How does the user arm the gate if the UI is initially blind? | UX / Architect | P0 |
| 4 | Audit `registerAetherDevice()` calls to confirm fixture→NodeGraph mapping | Core Engineer | P1 |
| 5 | If Path A chosen, spec the metadata float layout and `GlassBridgeHydrator` contract | Architect | P1 |

---

## 7. Files Referenced

- `electron-app/electron/main.ts` — IPC eradication site
- `electron-app/src/core/orchestrator/TitanOrchestrator.ts` — `_outputEnabled` gate
- `electron-app/src/core/orchestrator/tick/TickEngine.ts` — `_glassView`, `commitFrame`, Aether egress
- `electron-app/src/core/aether/egress/AetherSafetyMiddleware.ts` — Smart Gate logic
- `electron-app/src/core/aether/glass/BufferPoolManager.ts` — Ping-pong metrics
- `electron-app/src/components/GlassCanvas.tsx` — Sole consumer of GlassBridge
- `electron-app/src/hooks/useSeleneTruth.ts` — Starved IPC subscriber
- `electron-app/src/stores/truthStore.ts` — Empty source of truth
- `electron-app/src/stores/dmxStore.ts` — Empty DMX state
- `electron-app/src/stores/seleneStore.ts` — Pessimistic default state
- `docs/WAVE6000/WAVE-6005-AETHER-DMXENGINE-BLUEPRINT-V2.md` — GlassBridge v2 spec

---

*End of report. No code modified. Architecture preserved pending architect directive.*
