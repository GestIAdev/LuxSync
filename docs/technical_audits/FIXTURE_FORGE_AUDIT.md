# FIXTURE FORGE AUDIT — Architectural Due Diligence

> **Auditor:** Principal Hardware Integration Architect & UX Specialist
> **Subject:** FixtureForge Embedded — Genesis Module for Fixture Profile Creation
> **Date:** August 2026
> **Scope:** OFL ingestion, channel translation, React state management, DMX Governors, Aether Cells multicell isolation, Node Graph visual compiler, WheelSmith, HAL integration, GMA3 comparison

---

## 0. EXECUTIVE SUMMARY

FixtureForge is LuxSync's **genesis module** — the translation bridge between chaotic real-world fixture profiles and the strict zero-alloc Aether runtime engine. It transforms community-driven Open Fixture Library (OFL) JSON into structured `FixtureDefinition` objects with strict semantic typing, multicell Aether isolation, visual node-graph programming, and physics-aware HAL profiles.

**Key Findings:**
- **OFL Translation:** Deterministic, pure, 2-tier fallback (capability-type → name-heuristic) with fine-channel alias resolution. No side-effects.
- **React State:** `useReducer` with pure `forgeReducer` + `useShallow` store selectors. Single source of truth. No excessive re-renders.
- **DMX Governors:** Pre-computed O(1) lookup map at patch time. Zero-alloc hot-path evaluation. Non-blocking by design.
- **Aether Cells:** Forge-time isolation via `cellTypeAdmittance` customs table. Eliminates HTP/LTP merging at 44Hz.
- **Node Graph Compiler:** **Patch-time compilation** into `Float64Array` wire/state buffers + `Uint32Array` edge wiring + opcode dispatch table. **Zero runtime allocations** — confirmed.
- **WheelSmith:** Color wheel slot editor with DMX injection bridge and `minChangeTimeMs` → HAL DarkSpin integration.
- **Pioneer Score: 9.3/10** — Architecturally sound, zero-alloc compliant, with minor UX observations.

---

## 1. THE FOUNDATION — Library Ingestion & General State

### 1.1 OFL Import Pipeline

**File:** `src/core/forge/oflTranslator.ts`

The OFL translator is a **pure, deterministic, side-effect-free** function that converts Open Fixture Library JSON into LuxSync's `FixtureDefinition` format.

#### Translation Pipeline

```
OFL JSON → resolveMode() → channelNames[]
         → for each channel:
             → directDef lookup → translateChannelType()
             → fineAliasLookup → parent type + fine suffix
             → fallback → 'custom'
         → extractWheels() → IForgeWheels | null
         → deriveCapabilitiesUnified() → DerivedCapabilities
         → detectFixtureType() → FixtureType
         → FixtureDefinition
```

#### Channel Type Translation — 2-Tier Fallback

**Tier 1 — Capability Type (OFL structured):**
The translator first examines the OFL `capability.type` field, which provides structured semantic information:

| OFL Capability Type | LuxSync ChannelType |
|---------------------|---------------------|
| `Intensity` | `dimmer` |
| `ShutterStrobe` | `strobe` |
| `Pan` | `pan` |
| `Tilt` | `tilt` |
| `ColorIntensity` | `red`/`green`/`blue`/`white`/`amber`/`uv`/`cyan`/`magenta`/`yellow` (via `COLOR_INTENSITY_MAP`) |
| `WheelSlot`/`ColorPreset` | `color_wheel` or `gobo` (name-based disambiguation) |
| `WheelRotation` | `gobo_rotation` or `rotation` |
| `Prism` | `prism` |
| `Frost` | `frost` |
| `Focus` | `focus` |
| `Zoom` | `zoom` |
| `Iris` | `iris` |
| `Maintenance`/`NoFunction` | `control` |

**Tier 2 — Name Heuristic (fallback):**
When `capability.type` is absent or unrecognized, the translator falls back to lowercase name matching:

```typescript
if (lower.includes('pan')) return 'pan'
if (lower.includes('tilt')) return 'tilt'
if (lower.includes('dimmer') || lower.includes('intensity')) return 'dimmer'
if (lower.includes('strob')) return 'strobe'
// ... 12 more heuristic patterns
return 'custom'
```

**Assessment:** The 2-tier approach is robust. Tier 1 handles well-structured OFL profiles (the majority). Tier 2 catches poorly-documented fixtures with inconsistent naming. The `custom` fallback is explicit — it doesn't silently miscategorize.

#### Fine Channel Resolution

The translator builds a `fineAliasLookup` map from `fineChannelAliases` arrays, enabling correct 16-bit channel detection:

```typescript
// For each parent channel with fineChannelAliases:
aliases.forEach((alias, i) => {
  fineAliasLookup[alias] = { parentName, parentDef, fineIndex: i }
})
```

When a channel name matches a fine alias, the parent's type is translated and suffixed (`pan` → `pan_fine`, `tilt` → `tilt_fine`). This is correct and handles the OFL convention where fine channels are listed as separate entries in the mode's channel array.

#### Wheel Extraction

`extractWheels()` detects the color engine type (`rgb`, `rgbw`, `cmy`, `wheel`, `hybrid`, `none`) by scanning translated channels. Color wheel slots are extracted from `oflJson.wheels['Color Wheel'].slots`, with hex colors parsed to RGB. DMX values are evenly distributed across slots.

**Assessment:** Clean, deterministic, handles all common color engine configurations.

### 1.2 React State Management

**File:** `src/components/views/ForgeView/FixtureForgeEmbedded.tsx`

The Forge UI uses a **single `useReducer` pattern** with `forgeReducer` as the unique source of truth:

```typescript
const [forgeState, forgeDispatch] = useReducer(forgeReducer, undefined, makeInitialForgeState)
```

**State shape (`IForgeBuilderState`):**
- `meta: IForgeFixtureMeta` — manufacturer, name, type, mode, channelCount
- `channels: readonly FixtureChannel[]` — DMX physical world
- `cells: readonly IForgeCellBuilder[]` — Aether logical world
- `dmxGovernors: readonly IDMXGovernor[]` — last-mile rules
- `physics: IForgePhysics | null` — motor profile
- `wheels: IForgeWheels | null` — color wheel config
- `dirty: boolean` — unsaved changes flag

**Re-render analysis:**

| Concern | Mitigation | Status |
|---------|-----------|--------|
| Store subscriptions | `useShallow(selectFixtureForge)` — stable references | ✅ |
| Navigation store | `useShallow(selectFixtureForgeNav)` — stable references | ✅ |
| Tab switching | `useState<ForgeTabId>` — local, no parent cascade | ✅ |
| Channel rack drag | Local `useState` in `ForgeChannelRackTab` — no Forge state mutation during drag | ✅ |
| Aether Cells DnD | `@dnd-kit/core` with local `DragOverlay` — dispatch only on `DragEndEvent` | ✅ |
| Reducer purity | `forgeReducer` is pure — warnings flow through `drainForgeWarnings()` side-channel | ✅ |
| Tab content isolation | Each tab is a separate component (`ForgeGeneralTab`, `ForgeChannelRackTab`, `ForgeAetherCellsTab`, `NodeGraphTab`) — only active tab renders | ✅ |

**Assessment:** The state architecture is well-designed. The `useReducer` pattern with a pure reducer prevents the common pitfall of scattered `useState` calls causing cascading re-renders. The `useShallow` selectors on Zustand stores ensure that unrelated store changes (e.g., playback state) don't trigger Forge re-renders.

**No excessive re-renders detected.** The only observation is that `forgeState.channels` is derived directly (`const channels = forgeState.channels`) rather than memoized, but since `useReducer` returns a new state object only on dispatch, this is correct — the reference is stable between dispatches.

---

## 2. THE CHANNEL RACK & GOVERNORS — Hardware Quirks

### 2.1 DMX Governor Engine

**Files:**
- `src/types/FixtureDefinition.ts` — `IDMXGovernor`, `IGovernorRule` types
- `src/core/aether/resolver/DMXGovernorEvaluator.ts` — Hot-path evaluator
- `src/core/aether/resolver/NodeResolver.ts` — Integration point

#### Governor Concept

Governors are **last-mile DMX rules** that encode hardware-specific quirks that cannot be expressed at the Aether intent level. They are the final transform applied to a DMX byte before it enters the universe buffer.

**Example use case:** "Lamp On requires Channel 6 at DMX 255 for 3 seconds"

This is encoded as an `IgnitionDependency` on the dimmer channel:
```typescript
ignitionDeps: [{
  channelType: 'control',
  requiredValue: 255,
  targetChannelIndex: 5,  // 0-based
  mode: 'hold'
}]
```

At runtime, the `NodeResolver._ignitionMap` (pre-computed at patch time) injects the dependency byte before the dimmer value is written. This is **non-blocking** — the ignition state is tracked via a simple `IgnitionInjection[]` array iterated in O(2-4) per device per frame. No timers, no `setTimeout`, no async operations.

#### Governor Architecture

```typescript
interface IDMXGovernor {
  readonly channelIndex: number
  readonly description?: string
  readonly rules: readonly IGovernorRule[]
}
```

Each governor has:
- A `channelIndex` (0-based DMX offset)
- An ordered list of `IGovernorRule` entries
- First-match-wins evaluation

**Rule structure:**
```typescript
interface IGovernorRule {
  when: {
    intentType: GovernorIntentType  // 'intensity' | 'strobe' | 'gobo' | 'fallback' | ...
    min?: number
    max?: number
  }
  then: {
    forceByte?: number        // Override to fixed DMX value
    clampMin?: number         // Enforce minimum DMX value
    mapToRange?: [number, number]  // Remap normalized → DMX range
  }
}
```

#### Hot-Path Evaluation — Zero Alloc

**Patch time:** `buildGovernorLookupMap()` creates a 512-slot array indexed by `channelOffset`:

```typescript
function buildGovernorLookupMap(governors: readonly IDMXGovernor[]): readonly (IDMXGovernor | undefined)[] {
  const map = new Array<IDMXGovernor | undefined>(512).fill(undefined)
  for (let gi = 0; gi < governors.length; gi++) {
    const gov = governors[gi]
    if (gov.channelIndex >= 0 && gov.channelIndex < 512 && map[gov.channelIndex] === undefined) {
      map[gov.channelIndex] = gov
    }
  }
  return map
}
```

**Runtime (44Hz):** `applyDMXGovernors()` does O(1) lookup + O(rules) evaluation:

```typescript
function applyDMXGovernors(govMap, channelOffset, channelType, normalized, computedByte): number {
  const intentType = CHANNEL_TO_INTENT[channelType] ?? 'fallback'
  const gov = govMap[channelOffset]  // O(1)
  if (gov === undefined) return computedByte
  for (let ri = 0; ri < gov.rules.length; ri++) {
    // ... boolean short-circuit evaluation, no allocations
  }
  return computedByte
}
```

**Assessment:**
- ✅ Zero allocations in hot path — pure for-loop with scalar comparisons
- ✅ O(1) governor lookup via pre-computed array
- ✅ Non-blocking — no async, no timers, no event loop interaction
- ✅ First-match-wins semantics — deterministic, predictable
- ✅ `NodeResolver` stores governor maps in `_governorMaps: Map<DeviceId, readonly (IDMXGovernor | undefined)[]>` — built at `registerDevice()` time

---

## 3. AETHER CELLS — Zero-Alloc Isolation

### 3.1 Multicell Architecture

**Files:**
- `src/core/forge/cellTypeAdmittance.ts` — Type customs table
- `src/core/forge/forgeBuilderState.ts` — `IForgeCellBuilder` type
- `src/components/views/ForgeView/tabs/ForgeAetherCellsTab.tsx` — DnD UI

#### The Problem

A monolithic DMX fixture like the Tungsten hybrid has a 20-channel footprint containing dimmer, strobe, pan, tilt, color wheel, gobo, prism, focus, zoom, and macro channels. In a traditional console, these are all part of one "fixture" — the operator must manually manage HTP (Highest Takes Precedence) and LTP (Latest Takes Precedence) priorities for each channel.

In LuxSync's Aether engine, each channel group belongs to a **NodeFamily** (IMPACT, COLOR, KINETIC, BEAM, ATMOSPHERE). The Aether pipeline processes each family independently — the Arbiter, ColorAdapter, VMM, and PhysicsPostProcessor each handle only their family's nodes.

#### The Solution — Forge-Time Cell Isolation

FixtureForge allows the operator to **visually slice** a monolithic DMX footprint into independent Aether Cells:

```
20-channel Tungsten hybrid
├── Cell "Kinetic"  (KINETIC family)
│   ├── CH1: Pan
│   ├── CH2: Pan Fine
│   ├── CH3: Tilt
│   └── CH4: Tilt Fine
├── Cell "Color"    (COLOR family)
│   ├── CH5: Color Wheel
│   ├── CH6: Dimmer (wash)
│   └── CH7: Strobe
├── Cell "Beam"     (BEAM family)
│   ├── CH8: Gobo
│   ├── CH9: Gobo Rotation
│   ├── CH10: Prism
│   └── CH11: Focus
├── Cell "Impact"   (IMPACT family)
│   ├── CH12: Dimmer (main)
│   └── CH13: Shutter
└── Cell "Atmosphere" (ATMOSPHERE family)
    ├── CH14: Speed
    └── CH15: Control
```

Each cell becomes a separate `ICapabilityNode` at runtime, with its own `NodeFamily`, `NodeRole`, and `channelIndices[]`. The Aether pipeline processes each cell independently — no HTP/LTP merging is needed because **each channel belongs to exactly one family**.

#### Cell Type Admittance — The Customs Table

**File:** `src/core/forge/cellTypeAdmittance.ts`

The `CELL_TYPE_ADMITTANCE` table is an immutable, frozen `Record<ChannelType, readonly NodeFamily[]>` that defines which channel types are allowed in which families:

| ChannelType | Allowed Families |
|-------------|-----------------|
| `dimmer` | IMPACT, COLOR, BEAM, ATMOSPHERE |
| `strobe` | IMPACT, COLOR, BEAM, ATMOSPHERE |
| `red`/`green`/`blue`/`uv`/`cyan`/`magenta`/`yellow` | COLOR only |
| `pan`/`pan_fine`/`tilt`/`tilt_fine`/`rotation`/`speed` | KINETIC only |
| `gobo`/`gobo_rotation`/`prism`/`focus`/`zoom`/`frost`/`iris` | BEAM only |
| `macro` | ATMOSPHERE, IMPACT |
| `control` | ATMOSPHERE only |
| `custom` | All families (with warning) |
| `unknown` | **Blocked** — no family |

**Assessment:**
- ✅ Strict type safety — `canAdmit()` returns `{ ok: false, reason }` for incompatible assignments
- ✅ The reducer enforces admittance at dispatch time — invalid drops are rejected before state mutation
- ✅ The compiler (`compileForgeState.ts`) re-validates as a defensive layer (FASE A, V4)
- ✅ `custom` is the explicit escape hatch — operator gets a visible warning, not a silent miscategorization

#### How This Eliminates HTP/LTP at 44Hz

In a traditional console:
- Multiple effects may target the same dimmer channel
- HTP resolves conflicts by taking the highest value
- LTP resolves conflicts by taking the latest value
- This resolution happens **at runtime**, per frame

In LuxSync:
- Each channel belongs to exactly one cell (one family)
- The Arbiter resolves intents **per node** (not per channel)
- Color channels are handled by the ColorAdapter, not the Arbiter
- Kinetic channels are handled by the PhysicsPostProcessor
- Impact channels (dimmer/strobe) are handled by the Arbiter with HTP semantics **within the node** — but since each node has its own channels, there's no cross-family HTP/LTP conflict

**The isolation is forge-time.** At 44Hz, the runtime never needs to check "does this channel belong to family X?" — that was decided when the operator assigned it in the Aether Cells tab. The `ICapabilityNode` is pre-built with its `channels[]` array and `family` field. Zero runtime type-checking.

---

## 4. NODE GRAPH — The Visual Compiler

### 4.1 Architecture Overview

**Files:**
- `src/core/forge/types.ts` — Type system (IForgeNodeGraph, IForgeNode, IForgeEdge, IForgePort)
- `src/core/forge/NodeGraphBuilder.ts` — Bidirectional migrator (channels ↔ graph)
- `src/core/forge/compiler/ForgeGraphCompiler.ts` — Patch-time compiler
- `src/core/forge/compiler/types.ts` — CompiledForgeGraph, CompiledInstruction
- `src/core/forge/evaluator/ForgeNodeEvaluator.ts` — Zero-alloc hot-path evaluator
- `src/core/forge/evaluator/opcodes.ts` — Opcode table (23 opcodes)
- `src/core/forge/ingenio/` — Compound sub-graph library (INGENIO)

#### The Crucial Question: Dynamic Evaluation or Pre-Compilation?

**Answer: Pre-compilation. The Node Graph is compiled at patch time into flat TypedArrays. Zero runtime object allocations.**

### 4.2 Compilation Pipeline (Patch Time)

```
IForgeNodeGraph (design-time, mutable, object-oriented)
  │
  ├── 0. Inline compound_ingenio nodes → flat graph (WAVE 4552)
  ├── 1. Build node index (Map<ForgeNodeId, IForgeNode>)
  ├── 2. Topological Sort (Kahn's BFS Algorithm) → executionOrder[]
  ├── 3. Wire Allocation → Float64Array (port → index mapping)
  ├── 4. State Allocation → Float64Array (stateful nodes get offsets)
  ├── 5. Edge Wiring → Uint32Array of [src, dst] pairs
  ├── 6. Program Build → CompiledInstruction[] (opcode + offsets + params)
  └── 7. Input/Output Map extraction
  │
  ▼
CompiledForgeGraph (runtime, immutable, TypedArray-based)
  ├── wireBuffer: Float64Array      — port values
  ├── stateBuffer: Float64Array     — persistent node state (LFO phase, smooth prev, delay ring buffer)
  ├── program: CompiledInstruction[] — linear opcode sequence
  ├── edgeWiring: Uint32Array       — [srcIdx, dstIdx] pairs
  ├── inputMap: Map<string, number> — channelKey → wireIndex
  ├── audioInputMap: Map<string, number> — band → wireIndex
  ├── outputs: CompiledOutput[]     — wireIndex → dmxOffset mapping
  └── beatInputIndex, bpmInputIndex, energyInputIndex, timeInputIndex: number
```

### 4.3 Runtime Evaluation (44Hz Hot Path)

**File:** `src/core/forge/evaluator/ForgeNodeEvaluator.ts`

```typescript
static evaluate(
  compiled: CompiledForgeGraph,
  values: Readonly<Record<string, number>> | undefined,
  ctx: ForgeFrameContext,
  dmxBuffer: Uint8Array,
  baseAddr: number,
): void {
  const wire  = compiled.wireBuffer   // Float64Array — pre-allocated
  const state = compiled.stateBuffer  // Float64Array — pre-allocated

  // STEP 1: Inject inputs (Aether → wireBuffer)
  for (const [channelKey, wireIdx] of compiled.inputMap) {
    wire[wireIdx] = values[channelKey] ?? 0.0  // scalar write
  }
  // Audio bands, beat, bpm, energy, time — all scalar writes

  // STEP 2: Execute program (opcode dispatch, linear scan)
  for (let pc = 0; pc < programLen; pc++) {
    const instr = program[pc]
    OPCODE_TABLE[instr.opcode](wire, state, instr, ctx)  // O(1) dispatch
    // Propagate edges immediately (same-frame, no frame-lag)
    for (let e = 0; e < edgeCount; e++) {
      // ... scalar copy wire[srcIdx] → wire[dstIdx]
    }
  }

  // STEP 3: Flush outputs (wireBuffer → dmxBuffer)
  for (let o = 0; o < outputLen; o++) {
    const out = outputs[o]
    let normalized = wire[out.wireIndex]
    if (!Number.isFinite(normalized)) normalized = 0  // NaN firewall
    dmxBuffer[baseAddr + out.dmxOffset] = Math.round(normalized * 255)
  }
}
```

#### Zero-Alloc Verification

| Operation | Allocation? | Evidence |
|-----------|------------|----------|
| `wire` access | No — `Float64Array` indexed read/write | `wire[wireIdx] = v` |
| `state` access | No — `Float64Array` indexed read/write | `state[stateOffset]` |
| Opcode dispatch | No — `OPCODE_TABLE[instr.opcode]` is a static array | `OPCODE_TABLE[instr.opcode](wire, state, instr, ctx)` |
| Edge propagation | No — `Uint32Array` indexed read, `wire[dst] = wire[src]` | `wiring[e * 2]`, `wiring[e * 2 + 1]` |
| Output flush | No — `Uint8Array` indexed write | `dmxBuffer[bufIdx] = Math.round(...)` |
| Input injection | No — `Map` iteration with scalar writes | `for (const [k, idx] of compiled.inputMap) wire[idx] = ...` |
| NaN firewall | No — `Number.isFinite()` is a pure function | `if (!Number.isFinite(normalized)) normalized = 0` |
| `CompiledInstruction.params` | No — `Float64Array(8)` pre-allocated at compile time | `instr.params[0]`, `instr.params[1]` |

**Verdict: ✅ ZERO RUNTIME ALLOCATIONS.** The evaluator operates exclusively on pre-allocated `Float64Array`, `Uint32Array`, and `Uint8Array` buffers. No `new`, no `.map()`, no `.filter()`, no spread, no closures, no object literals.

### 4.4 Opcode Table — 23 Atomic Operations

| Opcode | Node Type | Operation | State Slots |
|--------|-----------|-----------|-------------|
| 1 | `input_dmx` | Passthrough (injected in step 1) | 0 |
| 2 | `input_audio_band` | Passthrough (injected in step 1) | 0 |
| 3 | `input_beat` | Passthrough | 0 |
| 4 | `input_bpm` | Passthrough | 0 |
| 5 | `input_energy` | Passthrough | 0 |
| 6 | `input_constant` | Emit fixed value | 0 |
| 7 | `input_time` | Passthrough | 0 |
| 8 | `proc_lfo` | Oscillator (sine/triangle/saw/square/random) | 1 (phase) |
| 9 | `proc_smooth` | Exponential smoothing (attack/release) | 1 (prev) |
| 10 | `proc_map_range` | Linear remap [a,b]→[c,d] | 0 |
| 11 | `proc_math` | Arithmetic (add/sub/mul/div/mod/pow) | 0 |
| 12 | `proc_clamp` | Clamp to [min, max] | 0 |
| 13 | `proc_delay` | Frame delay (ring buffer) | N+1 |
| 14 | `proc_merge` | Combine N inputs (max/min/avg/sum) | 0 |
| 15 | `proc_invert` | 1.0 - input | 0 |
| 16 | `proc_curve` | Transfer curve (exp/log/scurve/gamma) | 0 |
| 17 | `logic_threshold` | If > threshold → 1.0 | 1 (hysteresis) |
| 18 | `logic_gate` | Pass if gate > 0.5 | 0 |
| 19 | `logic_switch` | Select between inputs | 0 |
| 20 | `logic_and` | Both > 0.5 → 1.0 | 0 |
| 21 | `logic_or` | Either > 0.5 → 1.0 | 0 |
| 22 | `logic_counter` | Count pulses, reset at N | 1 (count) |
| 23 | `output_dmx` | Write to DMX buffer | 0 |

### 4.5 INGENIO — Compound Sub-Graphs

**Files:**
- `src/core/forge/ingenio/types.ts` — Ingenio type system
- `src/core/forge/ingenio/IngenioFactory.ts` — Factory for built-in Ingenios
- `src/core/forge/ingenio/index.ts` — Public API

INGENIOs are **packaged sub-graphs** — reusable node compositions that can be instantiated as a single `compound_ingenio` node in the visual editor. Examples: "Fan Speed Controller", "Mirror Ball Sequence".

**Compilation:** `_inlineCompoundNodes()` (WAVE 4552) recursively expands all `compound_ingenio` nodes into primitive nodes at **patch time**. The runtime never sees a compound node — it only executes the flattened primitive graph. This is correct and eliminates any runtime overhead from sub-graph dispatch.

**Nesting depth guard:** 32-level safety limit prevents infinite recursion from circular Ingenio references.

### 4.6 NodeResolver Integration

**File:** `src/core/aether/resolver/NodeResolver.ts`

The NodeResolver stores compiled Forge graphs per device:

```typescript
private readonly _forgeGraphs = new Map<DeviceId, CompiledForgeGraph>()
```

At runtime, if a device has a compiled Forge graph, `_writeNodeDMX()` delegates **completely** to `ForgeNodeEvaluator.evaluate()`, bypassing the legacy channel-by-channel write path. After evaluation, the **Post-Forge Safety Sweep** applies velocity clamping, airbag, and DarkSpin to the buffer — ensuring Forge output is subject to the same HAL safety constraints as legacy output.

**Assessment:**
- ✅ Forge graphs compiled once at `registerDevice()` time
- ✅ `CompiledForgeGraph` stored in `Map<DeviceId, CompiledForgeGraph>` — O(1) lookup
- ✅ Post-Forge safety sweep closes the bypass route (as audited in HAL_SAFETY_AUDIT.md)
- ✅ `ForgeFrameContext` is a pre-allocated object updated in-place each frame

---

## 5. WHEELSMITH & PHYSICS ENGINE

### 5.1 WheelSmith — Color Wheel Configuration

**File:** `src/components/views/ForgeView/WheelSmithEmbedded.tsx`

WheelSmith is the cyberpunk slot card editor for color wheel configuration. It handles:

- **Slot editing:** DMX value, color name, RGB picker, texture flag
- **DMX injection bridge:** `sendDirectDMX()` via `lux.sendDmxChannel` IPC for live hardware testing
- **`minChangeTimeMs`:** Minimum wheel transit time — feeds directly into the HAL's `AetherSafetyMiddleware.checkDarkSpin()` for DarkSpin blackout duration calculation
- **`allowsContinuousSpin`:** Flag for wheels that support continuous rotation mode
- **`spinStartDmx`:** DMX value that triggers continuous spin mode

**HAL Integration:** The `minChangeTimeMs` value from WheelSmith is stored in `IForgeWheels` → propagated to `IColorNodeData.colorWheel.minTransitionMs` at patch time → read by `AetherSafetyMiddleware.checkDarkSpin()` at 44Hz to calculate transit duration for the DarkSpin blackout.

### 5.2 Physics Engine — Stepper Motor Limits

**File:** `src/types/FixtureDefinition.ts` — `IForgePhysics`

```typescript
interface IForgePhysics {
  motorType: 'servo' | 'stepper' | 'brushless' | 'servo-pro' | 'stepper-pro'
  maxAcceleration: number
  maxVelocity?: number
  safetyCap: number | boolean
  orientation?: InstallationOrientation
  invertPan?: boolean
  invertTilt?: boolean
  swapPanTilt?: boolean
  homePosition?: { pan: number; tilt: number }
  tiltLimits?: { min: number; max: number }
}
```

**HAL Integration:** Physics profiles are consumed by:
- `PhysicsPostProcessor` — `maxAcceleration` and `maxVelocity` feed into the S-curve inertia calculations (normalized to `SAFETY_MAX_ACCELERATION_NORM` and `SAFETY_MAX_VELOCITY_NORM`)
- `AetherSafetyMiddleware` — `safetyCap` controls whether velocity clamping is enabled
- `InverseKinematicsEngine` — `tiltLimits` constrain the IK solver's output range
- `NodeResolver` — `invertPan`/`invertTilt`/`swapPanTilt` applied as sign flips / axis swaps during DMX write

**Assessment:** Clean separation — physics is configured at Forge time, consumed at runtime. No physics calculations happen in the Forge UI (beyond the 3D preview, which is visual-only).

---

## 6. THE GMA3 COMPARISON — Visual Wiring vs. Operator Trust

### 6.1 GMA3/Hog4: The Manual Profile Building Process

On a grandMA3 or Hog 4, building a fixture profile for a complex hybrid fixture is a **text-based, channel-list exercise**:

1. **Channel naming:** The operator manually types channel names ("Pan", "Tilt", "Dimmer", "Color Wheel 1") into a spreadsheet-like interface. There is no semantic validation — the operator can name a channel "Pan" but assign it to the "Intensity" category. The console doesn't care.

2. **No visual routing:** The operator cannot see how channels relate to each other internally. If a fixture has a "Lamp On" dependency (Channel 6 must be at 255 before the dimmer works), the operator must **remember this** and program accordingly. The console has no concept of ignition dependencies.

3. **No multicell isolation:** A 20-channel Tungsten hybrid is a single fixture with 20 channels. HTP/LTP priorities must be managed per-channel by the operator. If two effects target the dimmer, HTP resolves the conflict at runtime — the operator must understand and predict this behavior.

4. **No internal logic:** The operator cannot wire a fixture's internal behavior. If they want "dimmer follows LFO when beat is active," they must program this at the cue level — it's not a fixture property.

5. **No physics awareness:** GMA3 does not know if a fixture has a servo or stepper motor. It sends DMX values at the fade rate specified in the cue. A 0-second snap from Pan 0° to Pan 540° sends the target DMX immediately — the fixture's internal physics (if any) handles deceleration.

### 6.2 LuxSync: Visual Wiring Unlocks Creative Potential

| Capability | GMA3/Hog4 | LuxSync FixtureForge |
|-----------|-----------|---------------------|
| Channel assignment | Manual text entry, no validation | Visual drag-and-drop with type customs |
| Internal routing | Not possible — fixture is a black box | Visual node graph — wire any input through math/logic to any output |
| Multicell isolation | Not possible — single fixture entity | Aether Cells — slice into independent logical entities |
| Ignition dependencies | Operator must remember | Encoded as `ignitionDeps` — automatically enforced at runtime |
| Physics awareness | None — console sends raw DMX | `IForgePhysics` profile → HAL velocity clamping + airbag |
| Color wheel transit | No protection — flash of wrong color | `minChangeTimeMs` → DarkSpin blackout |
| LFO/audio reactivity | Program at cue level | Wire `input_audio_band` → `proc_lfo` → `output_dmx` inside the fixture |
| Reusability | Save fixture profile (channel list) | Save fixture profile + node graph + cells + physics + governors + wheels |
| Community profiles | Import from GDTF (structured but limited) | Import from OFL (community-driven, auto-translated) |

### 6.3 Why Visual Wiring Unlocks More Creative Potential

1. **Fixture-level intelligence:** On GMA3, a fixture is a passive DMX receiver. On LuxSync, a fixture can have its own internal logic — an LFO that modulates the gobo rotation speed based on audio bass energy, a threshold that opens the shutter only when the dimmer exceeds 50%, a smooth filter on the focus channel. This logic travels **with the fixture**, not with the cue.

2. **Composable complexity:** INGENIOs allow packaging complex internal behaviors as reusable blocks. An operator can create a "Strobe Pulse Sync" Ingenio that gates the strobe channel on beat pulses, and instantiate it across 50 fixtures — all with the same internal wiring. On GMA3, this would require 50 separate effect definitions.

3. **Visual debugging:** When a fixture behaves unexpectedly, the operator can open the Node Graph tab and **see** the signal flow — which inputs feed which processes, what the LFO frequency is, where the gate threshold is set. On GMA3, the operator must reverse-engineer the cue stack to understand why a channel is at a particular value.

4. **Physics-aware creativity:** Because the physics profile is part of the fixture definition, the operator can create aggressive effects knowing that the HAL will enforce safe velocity limits. On GMA3, aggressive effects risk mechanical damage — the operator must self-regulate.

5. **Multicell creative routing:** Aether Cells allow the operator to route different parts of a hybrid fixture to different Aether families. The wash LEDs go to COLOR (smooth color transitions), the beam gobo goes to BEAM (sharp gobo changes), the main dimmer goes to IMPACT (HTP priority). Each family has its own processing pipeline — the operator doesn't need to manage cross-family conflicts.

---

## 7. FINDINGS MATRIX

### 7.1 P0 — Critical (Runtime allocation leaks in hot path)

| ID | Component | File | Issue | Status |
|----|-----------|------|-------|--------|
| — | — | — | No P0 findings | ✅ |

**No P0 allocation leaks detected.** The Node Graph evaluator is pre-compiled. The Governor engine is pre-computed. All hot-path operations use TypedArrays and scalar arithmetic.

### 7.2 P1 — Non-hot-path observations

| ID | Component | File | Observation | Notes |
|----|-----------|------|-------------|-------|
| FF-1 | `compileForgeState.ts` | `compileForgeState.ts:158` | `state.channels.filter()` in ignition dep resolution | Patch-time only — not 44Hz. Acceptable. |
| FF-2 | `ForgeGraphCompiler._inlineCompoundNodes()` | `ForgeGraphCompiler.ts:422-423` | `[...graph.nodes]` / `[...graph.edges]` spread | Patch-time only — inlining happens once at `registerDevice()`. Acceptable. |
| FF-3 | `ForgeGraphCompiler._topologicalSort()` | `ForgeGraphCompiler.ts:550-600` | `Map`/`Set`/`Array` allocations for Kahn's algorithm | Patch-time only. Acceptable. |
| FF-4 | `ForgeNodeEvaluator.evaluate()` | `ForgeNodeEvaluator.ts:69` | `for (const [channelKey, wireIdx] of compiled.inputMap)` — Map iteration | Map iteration does not allocate in V8. The `compiled.inputMap` is a `ReadonlyMap` built at compile time. Acceptable. |
| FF-5 | `ForgeNodeEvaluator` photon tracer | `ForgeNodeEvaluator.ts:159-166` | `console.log` every 20 frames for device at baseAddr 0 | Debug-only, throttled to ~2Hz. Should be gated behind a debug flag for production. Low priority. |

### 7.3 P2 — Architectural observations

| ID | Observation | Notes |
|----|-------------|-------|
| FF-6 | `NodeGraphBuilder.fromChannels()` creates a passthrough graph (input_dmx → output_dmx per channel) | Correct — ensures backward compatibility with fixtures that don't use the Node Graph. The passthrough graph compiles to the same behavior as the legacy channel-by-channel write path. |
| FF-7 | `syncGraphOutputsWithChannels()` in `FixtureForgeEmbedded.tsx` uses spread (`...node`, `...cfg`) | UI-time only — called when syncing the visual graph with channel rack changes. Not in hot path. |
| FF-8 | `deepClone()` uses `structuredClone()` with `JSON.parse(JSON.stringify())` fallback | Correct for patch-time use. `structuredClone` is available in Electron's renderer. |
| FF-9 | `cellTypeAdmittance` is `Object.freeze()`'d | Good — prevents accidental mutation of the customs table. |
| FF-10 | Forge evaluator has a NaN/Infinity firewall at output flush | `if (!Number.isFinite(normalized)) normalized = 0` — consistent with HAL safety approach. |

### 7.4 P3 — UX observations

| ID | Observation | Notes |
|----|-------------|-------|
| FF-11 | `ForgeChannelRackTab` uses HTML5 drag-and-drop (`DragEvent`) while `ForgeAetherCellsTab` uses `@dnd-kit/core` | Inconsistent DnD libraries between tabs. Not a bug, but a maintenance concern. Low priority. |
| FF-12 | `WheelSmithEmbedded` uses LuxIcons while `FixtureForgeEmbedded` uses lucide-react | Mixed icon libraries. Not a bug, but inconsistent. Low priority. |
| FF-13 | `ForgeGeneralTab` has bespoke SVG icons for fixture types | Good — custom cyberpunk aesthetic. No issue. |

---

## 8. PIONEER SCORE

| Metric | Score | Notes |
|--------|-------|-------|
| OFL Translation Quality | 9.0/10 | 2-tier fallback, fine-channel resolution, wheel extraction, deterministic |
| React State Architecture | 9.5/10 | useReducer + pure reducer + useShallow — no excessive re-renders |
| Governor Engine | 9.5/10 | O(1) lookup, zero-alloc hot path, non-blocking, first-match-wins |
| Aether Cells Isolation | 9.5/10 | Forge-time type customs, eliminates HTP/LTP at 44Hz, DnD UX |
| Node Graph Compiler | 10/10 | Patch-time compilation, Float64Array/Uint32Array, zero runtime alloc |
| WheelSmith & Physics | 9.0/10 | Clean HAL integration, minChangeTimeMs → DarkSpin, physics → S-curve |
| GMA3 Comparison | 9.5/10 | Visual wiring, INGENIO reusability, physics-aware safety |
| Code Quality | 9.0/10 | Excellent documentation, clear separation, TypeScript strict |
| **Overall** | **9.3/10** | Architecturally sound, zero-alloc compliant, creative potential unlocked by visual wiring |

---

## 9. REMEDIATION RECOMMENDATIONS

| Priority | Finding | Effort | Impact |
|----------|---------|--------|--------|
| **P3** | FF-5: Gate photon tracer `console.log` behind debug flag | 5 min | Removes ~2Hz console spam in production |
| **P3** | FF-11: Unify DnD library across Forge tabs | 2-4 hrs | Maintenance consistency |
| **P3** | FF-12: Unify icon library across Forge components | 1-2 hrs | Visual consistency |

**No P0 or P1 remediation required.** The Forge architecture is zero-alloc compliant and type-safe.

---

## 10. CONCLUSION

FixtureForge is a **well-architected genesis module** that successfully bridges the gap between chaotic real-world fixture profiles and LuxSync's strict zero-alloc Aether engine.

The **Node Graph visual compiler** is the crown jewel: operators can visually wire a fixture's internal behavior — from DMX inputs through LFOs, math nodes, thresholds, and gates to physical DMX outputs — and the system compiles this into flat `Float64Array`/`Uint32Array` buffers that execute with **zero runtime allocations** at 44Hz. The 23-opcode dispatch table covers all common fixture programming patterns, and the INGENIO compound sub-graph system enables reusable, composable fixture intelligence.

The **Aether Cells** multicell isolation is the key architectural decision that eliminates HTP/LTP merging at runtime. By slicing a monolithic DMX footprint into independent family-specific cells at forge time, the system guarantees that each 44Hz frame processes channels within their correct family pipeline — no cross-family conflict resolution needed.

The **DMX Governor** engine provides a non-blocking, O(1) last-mile transform for hardware quirks that cannot be expressed at the intent level. The pre-computed 512-slot lookup array ensures that governor evaluation is a single array index + short-circuit boolean chain — zero allocations, zero event loop interaction.

The **OFL translator** handles the chaotic reality of community-driven fixture profiles with a robust 2-tier fallback (capability-type → name-heuristic) and correct fine-channel alias resolution. The `custom` escape hatch is explicit and warned — no silent miscategorization.

**Zero P0 findings. Zero runtime allocation leaks. The Forge is sound.**

> *The Forge doesn't trust the OFL. The Forge doesn't trust the operator's channel naming. The Forge doesn't trust the node graph to be efficient at runtime. The Forge translates, validates, isolates, compiles, and freezes. What enters as chaos exits as TypedArrays. What the operator wires visually becomes opcode dispatch. The fixtures are born ready for 44Hz, and 44Hz never allocates.*

