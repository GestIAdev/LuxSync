# ⌨ KEYFORGE ENGINE — ARCHITECTURAL AUDIT & STRUCTURAL MAPPING

> **Codename:** `KeyForge` (referred to in the directive as "Keystone")
> **Audit Scope:** Virtual hardware engine that transforms a QWERTY keyboard into a professional, multi-layered DMX control surface.
> **WAVE Lineage:** 4800-A through 5021
> **Audit Date:** 2026-08-10
> **Code Touched:** READ-ONLY. No modifications.

---

## 0 — EXECUTIVE SUMMARY

KeyForge is a **modal keyboard virtualization engine** that treats a standard QWERTY keyboard as a 6-page Command Wing surface. It is **not** a shortcut mapper. It is a fighting-game-grade input processor with chord detection, charge moves, layer pivoting, and zero-allocation hot-path discipline. The engine bridges into LuxSync's existing `MidiActionRegistry` as a parallel transport — MIDI and keyboard share the same action catalog and dispatch infrastructure.

**Pioneer Score: 92/100** — Production-grade virtual console with minor wiring gaps in continuous-control prefixes (`ctrl-*`, `flow-*`).

---

## 1 — DIRECTORY & COMPONENT SCOUTING

### 1.1 File Map

```
electron-app/src/
├── keyforge/                         ← Core engine (pure logic, no React)
│   ├── types.ts                      ← Type system: KeyCode, LayerId, KeyBehavior, KeyBinding, ChordBinding
│   ├── normalizeKeyCode.ts           ← KeyboardEvent.code → KeyCode (layout-independent)
│   ├── captureGuard.ts               ← Focus-aware interception (6 defensive rings)
│   ├── layerResolver.ts              ← Held-key set → active LayerId (6-layer stack)
│   ├── chordMatcher.ts               ← Tekken-style simultaneous combo detection
│   ├── KeyActionDispatcher.ts        ← Action resolution + prefix-based dispatch (651 lines)
│   ├── stadiumLoadout.ts             ← Default battle plan (57 bindings + 2 chords)
│   └── (no index.ts — direct imports)
│
├── hooks/
│   └── useKeyboardCortex.ts          ← Global event loop (keydown/keyup/blur → pipeline)
│
├── stores/
│   └── keyMapStore.ts                ← Zustand store: bindings CRUD, learn mode, loadout I/O
│
├── components/
│   ├── KeyForgeOverlay.tsx           ← Holographic keyboard overlay (1063 lines)
│   └── KeyForgeView.tsx              ← Re-export shim → KeyForgeOverlay
│
└── core/keyforge/
    └── KeyForgeIPCHandlers.ts        ← Electron main: loadout export/import (fs.promises)
```

### 1.2 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        KEYFORGE CORTEX (AppCommander.tsx mount)              │
│                                                                              │
│   window.keydown ──┐                                                         │
│   window.keyup   ──┤                                                         │
│   window.blur    ──┤                                                         │
│                    ▼                                                         │
│           ┌──────────────────────┐                                           │
│           │  Master Arm Gate     │  ← isArmed? if false, no-op (WAVE 4808)   │
│           └─────────┬────────────┘                                           │
│                     ▼                                                         │
│           ┌──────────────────────┐                                           │
│           │  e.repeat filter     │  ← OS autorepeat discarded                │
│           └─────────┬────────────┘                                           │
│                     ▼                                                         │
│           ┌──────────────────────┐                                           │
│           │  normalizeKeyCode()  │  ← e.code → KeyCode (layout-independent)  │
│           └─────────┬────────────┘                                           │
│                     ▼                                                         │
│           ┌──────────────────────┐                                           │
│           │  captureGuard()      │  ← 6-ring focus-aware interception       │
│           └─────────┬────────────┘                                           │
│                     ▼                                                         │
│           ┌──────────────────────┐                                           │
│           │  heldKeys.add(key)   │  ← Mutable Set (zero-alloc, reused)      │
│           │  downTimes.set(key)  │  ← Mutable Map (timestamp tracking)      │
│           └─────────┬────────────┘                                           │
│                     ▼                                                         │
│           ┌──────────────────────┐                                           │
│           │  resolveActiveLayer()│  ← forge > kinetic > select > cmd > alt  │
│           └─────────┬────────────┘                                           │
│                     ▼                                                         │
│           ┌──────────────────────┐                                           │
│           │  Learn Mode?         │  ← if isLearning: capture key → store    │
│           └─────────┬────────────┘                                           │
│                     ▼                                                         │
│           ┌──────────────────────┐                                           │
│           │  chordMatcher()      │  ← Tekken combo: all keys held + window  │
│           └─────────┬────────────┘                                           │
│                     ▼                                                         │
│           ┌──────────────────────┐                                           │
│           │  Binding Lookup      │  ← getBindingSnapshot(layer, key)        │
│           │  + requiredMods check│                                           │
│           └─────────┬────────────┘                                           │
│                     ▼                                                         │
│           ┌──────────────────────┐                                           │
│           │  executePress()      │  ← Behavior dispatcher (tap/hold/toggle/  │
│           │  or executeRelease() │     momentary/charge/repeat)             │
│           └─────────┬────────────┘                                           │
│                     ▼                                                         │
│           ┌──────────────────────┐                                           │
│           │  KeyActionDispatcher │  ← Prefix routing:                        │
│           │  .dispatchAction()   │     fx-* → forceStrike                    │
│           │                      │     vibe-* → setVibe                      │
│           │                      │     arb-* → blackout/kill/grand-master    │
│           │                      │     tung-* → fireTungstenNuke             │
│           │                      │     sel-* → selectionStore                │
│           │                      │     grp-* → group inhibit toggle          │
│           │                      │     kin-* → movementStore (pan/tilt)      │
│           │                      │     cue-* → sceneStore                    │
│           │                      │     ui-*  → navigationStore               │
│           │                      │     ctrl/flow/lux-* → log (pending Batch 3)│
│           └─────────┬────────────┘                                           │
│                     ▼                                                         │
│            Backend (window.lux.*) / Zustand Stores                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 1.3 Component Roles

| Component | File | Lines | Role |
|-----------|------|-------|------|
| **useKeyboardCortex** | `hooks/useKeyboardCortex.ts` | 515 | Global event loop. Mounts once at `AppCommander.tsx`. Owns mutable `heldKeys` Set, `downTimes` Map, `repeatTimers` Map, `chordSuppressed` Set. Implements press/release behavior execution. |
| **captureGuard** | `keyforge/captureGuard.ts` | 119 | 6-ring focus-aware interception. Decides whether KeyForge should consume a `KeyboardEvent` or let it pass to the focused element. |
| **normalizeKeyCode** | `keyforge/normalizeKeyCode.ts` | 149 | Maps `KeyboardEvent.code` (USB HID physical position) to normalized `KeyCode`. Layout-independent. |
| **layerResolver** | `keyforge/layerResolver.ts` | 92 | Derives active `LayerId` from the held-key set + modifier state + forge mode. 6-layer priority stack. |
| **chordMatcher** | `keyforge/chordMatcher.ts` | 112 | Tekken-style simultaneous combo detector. Order-independent, temporal-windowed, most-specific-wins. |
| **KeyActionDispatcher** | `keyforge/KeyActionDispatcher.ts` | 651 | Two-stage bridge: resolve `actionId` against `MidiActionRegistry` → prefix-based dispatch to stores/IPC. |
| **keyMapStore** | `stores/keyMapStore.ts` | 584 | Zustand persisted store. Bindings/chords CRUD, learn mode, loadout I/O, master arm. |
| **stadiumLoadout** | `keyforge/stadiumLoadout.ts` | 293 | Default battle plan: 57 bindings across 5 layers + 2 scoped chords. Idempotent initialization + migration patching. |
| **KeyForgeOverlay** | `components/KeyForgeOverlay.tsx` | 1063 | Holographic keyboard visualization. Action-family color coding, learn-mode click-to-bind, right-click-to-unbind. |
| **KeyForgeIPCHandlers** | `core/keyforge/KeyForgeIPCHandlers.ts` | 187 | Electron main process: native save/open dialogs for `.kf.json` loadout files. Schema validation in main. |

---

## 2 — POLLING vs EVENT-DRIVEN ARCHITECTURE

### 2.1 Hybrid: OS Events + State-Map Polling

KeyForge uses a **hybrid architecture** that combines OS-level event listeners with a game-engine-style state map:

**Event-Driven Layer (OS → KeyForge):**
- `window.addEventListener('keydown', onKeyDown)` — fires on every physical key press
- `window.addEventListener('keyup', onKeyUp)` — fires on every physical key release
- `window.addEventListener('blur', onBlur)` — fires on focus loss (Alt+Tab, window switch)

**State-Map Layer (KeyForge internal):**
- `heldKeys: Set<KeyCode>` — mutable, reused across all events. Tracks the **physical truth** of which keys are down at any instant.
- `downTimes: Map<KeyCode, number>` — per-key keydown timestamp (ms via `performance.now()`). Used for chord temporal windows, tap duration measurement, and charge ratio calculation.
- `repeatTimers: Map<KeyCode, intervalHandle>` — per-key `setInterval` handles for `repeat` behavior.
- `chordSuppressed: Set<KeyCode>` — keys whose individual actions were suppressed because they joined a chord.

### 2.2 Why Not Pure Polling?

KeyForge does **not** run a 60fps polling loop. The design rationale:

1. **Keyboard events are sparse** (< 100 events/sec even during aggressive play). A polling loop would waste CPU cycles checking a state that rarely changes.
2. **OS keydown/keyup is instantaneous** — latency is < 1ms from physical press to event dispatch. Polling at 60fps would introduce up to 16.7ms of artificial latency.
3. **The state map IS the polling surface** — downstream consumers (layerResolver, chordMatcher, binding lookup) read the `heldKeys` Set synchronously at event time, not on a timer.

### 2.3 OS Repeat-Delay Elimination

The critical problem with standard OS keyboard events is **autorepeat**: holding a key fires repeated `keydown` events at the OS repeat rate (typically 30Hz after a 500ms delay). KeyForge solves this:

```typescript
// useKeyboardCortex.ts:317-320
if (e.repeat) {
  runtime.lastConsumed = false
  return
}
```

**All OS-generated repeat events are discarded.** KeyForge implements its own semantic repeat via the `KeyBehavior` system:

| Behavior | OS Repeat | KeyForge Repeat | Mechanism |
|----------|-----------|-----------------|-----------|
| `tap` | Discarded | None | Fires once on keyup if within `tapMaxMs` (default 250ms) |
| `hold` | Discarded | None | Action "ON" on press, "OFF" on release |
| `toggle` | Discarded | None | Press flips state; release ignored |
| `momentary` | Discarded | None | Press fires `actionId`; release fires `releaseActionId` |
| `charge` | Discarded | None | Tap (< threshold) fires weak; held (≥ threshold) fires strong |
| `repeat` | Discarded | **`setInterval` at `periodMs`** | Custom timer per key, cleared on keyup |

This guarantees **jitter-free, deterministic** repeat behavior independent of OS settings. The `repeat` behavior is the only one that uses timers, and each timer is per-key (not global), so different keys can repeat at different rates (e.g., tempo nudge at 100ms, pan/tilt at 60ms).

### 2.4 Blur Safety: The Stuck-Key Killer

When the window loses focus (Alt+Tab, OS notification, second monitor click), the OS does **not** send keyup events for held keys. Without protection, this would leave `heldKeys` polluted and the layer resolver stuck in a phantom state.

```typescript
// useKeyboardCortex.ts:470-485
const onBlur = (): void => {
  runtime.heldKeys.clear()
  runtime.downTimes.clear()
  runtime.chordSuppressed.clear()
  for (const t of runtime.repeatTimers.values()) clearInterval(t)
  runtime.repeatTimers.clear()
  runtime.lastConsumed = false
  // Reset layer to base (or forge if learning)
  const storeState = useKeyMapStore.getState()
  const baseLayer: LayerId = storeState.isLearning ? 'forge' : 'base'
  if (runtime.lastLayer !== baseLayer) {
    runtime.lastLayer = baseLayer
    storeState.setLayer(baseLayer)
  }
}
```

**Total state flush on blur.** Every held key, every timestamp, every repeat timer, every chord suppression — all cleared. The layer resets to `base`. This is the single most important safety mechanism in the engine.

---

## 3 — VIRTUAL KINEMATICS (Digital to Analog)

### 3.1 The Problem

A keyboard sends **discrete binary signals**: a key is either pressed (1) or released (0). DMX faders need **continuous analog values** (0.0 to 1.0, or 0-255 in 8-bit DMX). KeyForge bridges this gap through the `KeyBehavior` system, which models temporal semantics on top of binary events.

### 3.2 The 6 Behavior Models

#### 3.2.1 `tap` — Instantaneous Pulse

```
keydown ──────── keyup
  │               │
  │   < tapMaxMs  │ → fire actionId with intensity=1.0
  │               │
  └───────────────┘
```

- **Press:** No action (deferred).
- **Release:** If `heldMs ≤ tapMaxMs` (default 250ms) → fire with `intensity=1.0`, `phase='press'`.
- **If held > tapMaxMs:** No action fires. The tap "expired."
- **Use case:** Group recall (`1`-`9`), blackout toggle (`Space`), vibe cycle (`V`, `C`).

#### 3.2.2 `hold` — Sustained Gate

```
keydown ──────────────────────── keyup
  │                                │
  │ fire intensity=1.0, phase=press │ fire intensity=0.0, phase=release
  │                                │
  └────────────────────────────────┘
```

- **Press:** Fire immediately with `intensity=1.0`, `phase='press'`.
- **Release:** Fire with `intensity=0.0`, `phase='release'`.
- **Use case:** Strobe (`F` = `fx-strobe_storm` hold). The strobe is ON while F is held, OFF on release.

#### 3.2.3 `toggle` — Latching Switch

- **Press:** Fire with `intensity=1.0`, `phase='press'`. The downstream action owns the toggle semantics.
- **Release:** No action (ignored by contract).
- **Use case:** AI toggle (`Y` = `ctrl-ai-toggle`), freeze frame (`H` = `arb-freeze-frame`).

#### 3.2.4 `momentary` — Press/Release Pair

- **Press:** Fire `actionId` with `intensity=1.0`, `phase='press'`.
- **Release:** Fire `releaseActionId` (if defined) or `actionId` with `intensity=0.0`, `phase='release'`.
- **Use case:** Not used in stadium defaults, but available for custom bindings where press and release need different actions.

#### 3.2.5 `charge` — Analog Intensity from Hold Duration

```
keydown ──────────────────────── keyup
  │                                │
  │  heldMs < thresholdMs          │ → fire actionId with intensity = heldMs/threshold
  │  heldMs ≥ thresholdMs          │ → fire chargedActionId with intensity = 1.0
  │                                │
  └────────────────────────────────┘
```

**This is the primary digital→analog bridge.** The charge behavior maps hold duration to a continuous intensity value:

```typescript
// useKeyboardCortex.ts:218-230
case 'charge': {
  const charged = heldMs >= b.thresholdMs
  const ratio = Math.min(1, heldMs / Math.max(1, b.thresholdMs))
  const targetActionId = charged && b.chargedActionId !== undefined
    ? b.chargedActionId
    : binding.actionId
  return dispatchAction(targetActionId, {
    source:    'keyforge',
    intensity: charged ? 1.0 : ratio,  // ← continuous 0..1 from discrete input
    modifiers: mods,
    phase:     'press',
  })
}
```

**Math:**
- `ratio = min(1, heldMs / thresholdMs)` — linear ramp from 0 to 1 over the threshold window.
- If `heldMs ≥ thresholdMs` → `charged = true`, `intensity = 1.0`, and `chargedActionId` fires instead.
- **Clamp:** `Math.max(1, b.thresholdMs)` prevents division by zero.

**Stadium example:** `B` = `tung-petal-l` with `charge, thresholdMs: 600, chargedActionId: 'tung-nuke-all'`.
- Tap B (< 600ms) → `tung-petal-l` at proportional intensity.
- Hold B (≥ 600ms) → `tung-nuke-all` at full intensity.
- This is the "yo no sé qué hacer, sorpréndeme" → "nuclear option" escalation path.

#### 3.2.6 `repeat` — Discrete Stepping at Custom Rate

```
keydown ─┬─────┬─────┬─────┬──── keyup
         │     │     │     │
         fire  fire  fire  fire  (clearInterval)
         1.0   1.0   1.0   1.0
```

- **Press:** Fire immediately with `intensity=1.0`, `phase='press'`. Then schedule `setInterval(periodMs)`.
- **Each tick:** Fire with `intensity=1.0`, `phase='repeat'`.
- **Release:** `clearInterval(timer)`. No release action fired.

**Stadium examples:**
- `Q`/`E` = `ctrl-intensity` at `periodMs: 80` → Grand Master nudge every 80ms (12.5 steps/sec).
- `,` / `.` = tempo nudge at `periodMs: 100` → 10 steps/sec.
- Kinetic layer `WASD` = pan/tilt at `periodMs: 60` → 16.6 steps/sec.

**Kinematic step calculation** (in `KeyActionDispatcher.ts:443-444`):

```typescript
const KIN_STEP_DEG = 5
const KIN_STEP_FAST_DEG = 15
```

The dispatcher uses `payload.intensity >= 1.0 ? KIN_STEP_FAST_DEG : KIN_STEP_DEG` to select step size. Since `repeat` always sends `intensity=1.0`, all repeat-driven kinetic actions use the fast step (15°/tick). At 60ms period, that's **250°/sec** — fast enough for live mover control without being uncontrollable.

**Clamping** (in `dispatchKinAction`):
- Pan: `Math.max(0, pan - step)` / `Math.min(540, pan + step)` — 540° physical limit.
- Tilt: `Math.max(0, tilt - step)` / `Math.min(270, tilt + step)` — 270° physical limit.

### 3.3 Intensity Flow Summary

| Source | Behavior | Intensity | Phase |
|--------|----------|-----------|-------|
| Keyboard tap | `tap` | 1.0 | `press` |
| Keyboard hold | `hold` | 1.0 (press) / 0.0 (release) | `press` / `release` |
| Keyboard toggle | `toggle` | 1.0 | `press` |
| Keyboard momentary | `momentary` | 1.0 (press) / 0.0 (release) | `press` / `release` |
| Keyboard charge (sub-threshold) | `charge` | `heldMs / thresholdMs` (0..1) | `press` |
| Keyboard charge (super-threshold) | `charge` | 1.0 | `press` |
| Keyboard repeat | `repeat` | 1.0 per tick | `press` / `repeat` |
| Chord | any | 1.0 | `press` |

The `ActionPayload.intensity` field is the universal analog bridge. Downstream consumers (`forceStrike`, `setGrandMaster`, `fireTungstenNuke`) interpret it as a 0..1 continuous value regardless of whether it came from a MIDI CC (value/127), a keyboard charge (ratio), or a keyboard tap (1.0).

---

## 4 — MULTI-TIER LAYERING & SHADOWING

### 4.1 The 6-Layer Stack

KeyForge implements a **modal layer system** where the entire keyboard changes meaning based on held keys. This is inspired by Vim modals, Ableton Push mode-switching, and Cyberpunk 2077 quickhack menus.

| Priority | Layer | Trigger | Focus | Stadium Bindings |
|----------|-------|---------|-------|-----------------|
| 1 (highest) | `forge` | F2 toggle (not hold) | Editor mode — no show actions fire | 0 (sovereign) |
| 2 | `kinetic` | K + Shift (double pivot) | Pan/tilt WASD control | 7 |
| 3 | `select` | S + any non-modifier key | Multi-selection operations | 12 |
| 4 | `cmd` | Ctrl or Meta (Cmd/Win) | RTS-style group assignment | 9 |
| 5 | `alt` | Alt | Vibes + signature effects | 17 |
| 6 (lowest) | `base` | Default (no modifiers) | Effects + drops + groups | 29 |

### 4.2 Layer Resolution Algorithm

```typescript
// layerResolver.ts:40-61
export function resolveActiveLayer(
  held: ReadonlySet<KeyCode>,
  mods: ModifierState,
  forgeMode: boolean,
): LayerId {
  if (forgeMode) return 'forge'                                    // 1. Sovereign toggle
  if (held.has('K') && mods.shift) return 'kinetic'                // 2. Double pivot
  if (held.has('S') && hasNonModifierCompanion(held, 'S')) return 'select'  // 3. Pivot + companion
  if (mods.ctrl || mods.meta) return 'cmd'                         // 4. Standard modifiers
  if (mods.alt) return 'alt'                                       // 5. Alt
  return 'base'                                                    // 6. Fallback
}
```

**Key design decisions:**

- **`kinetic` requires K+Shift (double pivot):** Bare K is a common typing key (bound to `cue-go` in base layer). Requiring Shift as a co-pivot prevents accidental layer activation. This leaves K free for its base-layer binding while still providing a kinetic entry path.

- **`select` requires S + companion:** Bare S tap is `grp-2-blackout` in base layer. The `hasNonModifierCompanion()` function ensures S only activates the select layer when at least one other non-modifier key is also held. This prevents the layer from activating on every S press.

- **`forge` is a toggle, not a hold:** F2 toggles forge mode on/off. When active, **no show actions fire** — the keyboard becomes a binding editor. This is the sovereign layer for configuration.

### 4.3 Chord System (Tekken-Style Combos)

#### 4.3.1 Detection Rule

```typescript
// chordMatcher.ts:52-95
export function matchChord(
  anchor: KeyCode,          // the key just pressed
  held: ReadonlySet<KeyCode>,
  downTimes: KeyDownTimes,
  layer: LayerId,
  chords: readonly ChordBinding[],
  now: number,
): ChordBinding | null
```

**Algorithm:**
1. For each registered chord that includes the `anchor` key:
   a. **Layer filter:** Chord's layer must match active layer OR be `base` (universal).
   b. **Anchor membership:** Chord must include the just-pressed key.
   c. **All held:** Every key in `chord.keys` must be in `held`.
   d. **Temporal window:** Every key's `downTime` must be within `CHORD_WINDOW_MS` (150ms) of `now`.
2. **Most specific wins:** The chord with the most keys wins. Ties broken by registration order.

#### 4.3.2 Chord Suppression (Anti-Double-Fire)

When a chord fires, the individual actions of all participating keys are **suppressed**:

```typescript
// useKeyboardCortex.ts:369-373
for (const k of chord.keys) runtime.chordSuppressed.add(k)
```

On keyup, suppressed keys skip their release-phase dispatch:

```typescript
// useKeyboardCortex.ts:441-455
const wasChordSuppressed = runtime.chordSuppressed.delete(key)
// ...
if (wasChordSuppressed) return  // skip release dispatch
```

This prevents the "1+F strobe on group 1" chord from also firing `sel-group-1` (from key `1`) and `fx-strobe_storm` (from key `F`) individually.

#### 4.3.3 Scoped Chords (WAVE 4802-D)

Chords can declare a `scopeGroupIndex` that targets a specific fixture group **without altering the UI selection**:

```typescript
// stadiumLoadout.ts:159-177
const STADIUM_CHORDS: readonly ChordBinding[] = [
  {
    chordId: 'chord-group1-strobe',
    keys: ['1', 'F'],
    layer: 'base',
    actionId: 'fx-strobe_storm',
    behavior: { kind: 'hold' },
    scopeGroupIndex: 1,  // scope = group 1 fixture IDs
  },
  // ... chord-group2-strobe
]
```

At dispatch time, `resolveGroupScope(groupIndex)` reads the live `stageStore` groups and populates `ActionPayload.scope` with the target fixture IDs. The backend `forceStrike` receives the scope and applies the effect **only to those fixtures**, leaving the visual selection untouched.

### 4.4 Shadowing Conflict Resolution

#### 4.4.1 The Stuck-Key Problem

The classic keyboard layering problem: if key `A` is pressed in `base` layer (firing `grp-1-blackout`), then `Alt` is pressed (switching to `alt` layer), then `A` is released — which layer's `A` binding should handle the release?

**KeyForge's solution:** The release phase uses a **best-effort layer re-derivation**:

```typescript
// useKeyboardCortex.ts:462-463
const binding = getBindingSnapshot(activeLayer, key)
  ?? getBindingSnapshot(runtime.lastLayer, key)
```

It first tries the **current** active layer (which may have changed since keydown), then falls back to the **last known** layer. This is a pragmatic compromise — sophisticated keydown-layer memoization (storing the exact layer at press time per key) is noted as a Batch 2 enhancement.

#### 4.4.2 The `chordSuppressed` Set

The `chordSuppressed` Set is the **only mechanism** that prevents individual key actions from bleeding through when a chord fires. It is:

- **Populated on chord match:** All chord participant keys are added.
- **Checked on keyup:** `runtime.chordSuppressed.delete(key)` returns `true` if the key was suppressed → release dispatch is skipped.
- **Cleared on blur:** Total flush prevents phantom suppression across focus changes.

#### 4.4.3 The `requiredMods` Filter

Individual bindings can declare `requiredMods` that must be held **in addition to** the layer requirements:

```typescript
// useKeyboardCortex.ts:407-413
if (binding.requiredMods !== undefined) {
  const req = binding.requiredMods
  if (req.shift !== undefined && req.shift !== mods.shift) { runtime.lastConsumed = false; return }
  if (req.ctrl  !== undefined && req.ctrl  !== mods.ctrl ) { runtime.lastConsumed = false; return }
  if (req.alt   !== undefined && req.alt   !== mods.alt  ) { runtime.lastConsumed = false; return }
  if (req.meta  !== undefined && req.meta  !== mods.meta ) { runtime.lastConsumed = false; return }
}
```

This allows `Shift+1` to differ from `1` within the same layer, enabling fine-grained combinatorics without consuming an entire layer.

#### 4.4.4 Store-Level Collision Rejection

The `keyMapStore` prevents binding collisions at write time:

```typescript
// keyMapStore.ts:236-245
if (current !== undefined && (
  current.actionId !== binding.actionId
  || !sameRequiredMods(current.requiredMods, binding.requiredMods)
)) {
  const warning = `[KeyForge] Collision rejected: ${formatKeyCombo(binding.key, binding.requiredMods)} is already bound to ${current.actionId}`
  console.warn(warning)
  set({ lastMappingWarning: warning })
  return
}
```

The `setMapping` action (UI remapping path) force-unbinds the slot first before reassigning, allowing explicit overwrites.

---

## 5 — PERFORMANCE FOOTPRINT

### 5.1 Integration Point: AppCommander.tsx

KeyForge mounts **once** at the application root, sibling to `useMidiLearn()`:

```typescript
// AppCommander.tsx:42-45
useMidiLearn()
useKeyboardCortex()
```

The hook installs three `window` event listeners in a `useEffect` with empty dependency array `[]` — meaning the listeners are created **once** and never recreated:

```typescript
// useKeyboardCortex.ts:495-497
window.addEventListener('keydown', onKeyDown)
window.addEventListener('keyup', onKeyUp)
window.addEventListener('blur', onBlur)
```

### 5.2 Zero-Allocation Analysis

#### 5.2.1 Hot-Path Allocations (Per Keydown/Keyup Event)

| Operation | Allocation? | Details |
|-----------|-------------|---------|
| `normalizeKeyCode(e)` | **No** | Pure string mapping via `const` lookup tables. Returns a cached string from the `KeyCode` union. |
| `captureModifiers(e)` | **Yes** (1 object) | Returns `{ shift, ctrl, alt, meta }` literal. **Minor** — 4-field object, V8 short-lifetime. |
| `shouldInterceptKey(e, key)` | **No** | Set lookups + DOM `closest()` calls. No object creation. |
| `heldKeys.add(key)` / `.delete(key)` | **No** | Mutable `Set` — in-place mutation. |
| `downTimes.set(key, now)` / `.delete(key)` | **No** | Mutable `Map` — in-place mutation. |
| `resolveActiveLayer(held, mods, forgeMode)` | **No** | Pure function. Reads Set/booleans. Returns cached `LayerId` string. |
| `matchChord(...)` | **No** | Iterates `chords` array. No intermediate allocations. Returns reference to existing `ChordBinding` or `null`. |
| `getBindingSnapshot(layer, key)` | **No** | `useKeyMapStore.getState().bindings[bindingKey(layer, key)]` — direct property access on existing object. |
| `executePress()` / `executeRelease()` | **Yes** (1 object per dispatch) | Creates `ActionPayload` literal `{ source, intensity, modifiers, phase }`. **Unavoidable** — the dispatcher contract requires a payload object. |
| `dispatchAction(actionId, payload)` | **No** | Prefix string matching + store method calls. The payload is passed by reference. |

**Total per-event allocations:** 2 small short-lifetime objects (modifier snapshot + action payload). Both are eligible for V8's young-generation GC and do not pressure the old space. This is **acceptable** for keyboard event rates (< 100/sec).

#### 5.2.2 What Was Avoided

- **No `new` keyword** anywhere in the hot path.
- **No `Array.from()`, `Array.slice()`, `.map()`, `.filter()`, `.reduce()`** in event handlers.
- **No closures created per event** — `onKeyDown`/`onKeyUp`/`onBlur` are created once in `useEffect` and reused.
- **No React state updates per event** — the store is read via `getState()` snapshots, not `useKeyMapStore()` subscriptions. Layer changes are only pushed to the store when they **actually change** (`activeLayer !== runtime.lastLayer`), avoiding setState storms.
- **No `setInterval` per repeat tick** — the interval is created once on keydown and cleared on keyup. The callback reuses the same `mods` reference captured at creation time.

#### 5.2.3 Store-Level Allocations

The Zustand store (`keyMapStore.ts`) uses immutable updates for binding CRUD:

```typescript
const nextBindings: Record<string, KeyBinding> = { ...get().bindings }
nextBindings[storageKey] = binding
set({ bindings: nextBindings })
```

This creates a shallow copy of the bindings record on every `bindKey`/`unbindKey` call. However, **these operations are not in the hot path** — they happen during configuration (learn mode, loadout import, UI remapping), not during live performance. The shallow copy is O(N) where N = total bindings (~57 in stadium default), which is negligible at configuration-time rates.

### 5.3 TickEngine / RAF Integration

**KeyForge does NOT integrate with the TickEngine or RAF loop.** This is by design:

- The keyboard cortex is **purely event-driven** — it activates only on OS keyboard events.
- The TickEngine runs at 44Hz for DMX output and audio processing. KeyForge does not participate in this loop.
- The only timer-based mechanism is `setInterval` for `repeat` behavior, which runs at the behavior's `periodMs` (60-100ms) and is per-key, not global.

**Implication:** KeyForge has **zero CPU cost when idle**. No polling, no RAF, no TickEngine overhead. The engine consumes resources only when keys are physically pressed.

### 5.4 Master Arm Gate (WAVE 4808)

A safety gate that prevents KeyForge from intercepting **any** keyboard event until the operator explicitly arms the system:

```typescript
// useKeyboardCortex.ts:308-315
if (!useKeyMapStore.getState().isArmed) {
  if (e.code === 'Space') e.preventDefault()
  return
}
```

- **Default on boot:** `isArmed = false` (safe-off state).
- **Persistence (WAVE 4914):** `isArmed` is persisted to localStorage so the operator doesn't have to re-arm on every reboot. Migration v2→v3 defaults to `true` for existing users.
- **Even disarmed, Space is absorbed** — this prevents focused CommandDeck buttons (GO, ARM, Blackout) from receiving native Space-activation when the operator expects KeyForge to be active.

### 5.5 CaptureGuard: The 6-Ring Defense

The `shouldInterceptKey()` function implements 6 concentric defense rings to decide whether KeyForge should consume a keyboard event:

| Ring | Check | Result | Purpose |
|------|-------|--------|---------|
| 0 | `e.isComposing` / keyCode 229 | **Pass** | IME composition (Asian input methods) — never intercept |
| 5 | `ALWAYS_INTERCEPT` (Escape, F1) | **Intercept** | Universal escapes reach KeyForge even inside inputs |
| 4 | `[data-keyforge-claim="true"]` ancestor | **Intercept** | Container reclaims keyboard control (e.g., TheProgrammer WASD) |
| 3 | `[data-keyforge-bypass="true"]` ancestor | **Pass** | Panel-level opt-out (e.g., timecode editor) |
| 1 | `EDITABLE_TAGS` (INPUT, TEXTAREA, SELECT) | **Pass** | User is typing — cannot intercept |
| 2 | `isContentEditable` | **Pass** | Rich text editors, code mirrors |

**Ring 5 (always-intercept) has highest priority** — it is evaluated before the editable checks. This ensures `Escape` always reaches KeyForge even if the operator is typing in an input field.

**Ring 4 (claim) overrides ring 1/2** — a container with `data-keyforge-claim="true"` can reclaim keyboard control even if an editable element inside it has focus. This is used by TheProgrammer to get WASD pan/tilt even when a search input is present.

### 5.6 Persistence & Migration

**Zustand `persist` middleware** with localStorage key `luxsync-keyforge`:

| Version | Migration |
|---------|-----------|
| v1 → v2 | Add `loadoutName` (default: `'stadium-default'`) |
| v2 → v3 | Add `isArmed` (default: `true` for existing users) |

**Partialize:** Only `bindings`, `chords`, `loadoutName`, `isArmed` are persisted. Transient state (`currentLayer`, `isLearning`, `listeningSlot`, `lastBoundKey`, `lastMappingWarning`) is excluded.

**Stadium loadout patching** (`patchMissingStadiumBindings`): Runs at boot, injects any missing stadium defaults into an existing user store **without touching user-customized slots**. Includes slot migrations (e.g., `base::D` moved from `arb-blackout` to `grp-3-blackout` in WAVE 5020).

---

## 6 — ACTION DISPATCH TABLE

### 6.1 Prefix Routing Map

| Prefix | Handler | Target | Phase Filter | Stadium Bindings |
|--------|---------|--------|--------------|-----------------|
| `fx-*` | `lux.forceStrike()` | Backend IPC | `release` → no-op | 14 |
| `vibe-*` | `lux.setVibe()` | Backend IPC | `release` → no-op | 6 |
| `tung-*` | `lux.aether.fireTungstenNuke()` | Backend IPC | `release` → release signal | 1 |
| `arb-*` | `lux.aether.setBlackout()` / `cancelAllEffects()` / `setGrandMaster()` | Backend IPC + effectsStore | `release` → no-op | 3 |
| `sel-*` | `useSelectionStore` / `useStageStore` | Renderer store | `release` → no-op | 24 |
| `grp-*` | `useSelectionStore.toggleMute()` + `lux.aether.setSelInhibit()` | Renderer + IPC | `release` → no-op | 5 |
| `kin-*` | `useMovementStore.setPanTilt()` / `setPatternSpeed()` | Renderer store | Both phases | 7 |
| `cue-*` | `useSceneStore.loadScene()` / `cancelTransition()` | Renderer store | `release` → no-op | 6 |
| `ui-*` | `useNavigationStore.setActiveTab()` / `goBack()` | Renderer store | `release` → no-op | 3 |
| `ctrl-*` | **Log only** (pending Batch 3) | — | `release` → no-op | 5 |
| `flow-*` | **Log only** (pending Batch 3) | — | `release` → no-op | 0 |
| `lux-*` | **Log only** (pending Batch 3) | — | `release` → no-op | 0 |
| `kf-*` | **Log only** (pending Batch 4) | — | `release` → no-op | 0 |

### 6.2 Kinetic Dispatch Detail

The `kin-*` handler is the only prefix that reads `payload.intensity` for step-size selection:

```typescript
// KeyActionDispatcher.ts:458-490
function dispatchKinAction(actionId: string, payload: ActionPayload): boolean {
  const mvStore = useMovementStore.getState()
  const sub = actionId.slice(4)
  const step = payload.intensity >= 1.0 ? KIN_STEP_FAST_DEG : KIN_STEP_DEG
  // 15° per tick when intensity=1.0 (repeat), 5° per tick otherwise
  switch (sub) {
    case 'pan-left':   mvStore.setPanTilt(Math.max(0, mvStore.pan - step), mvStore.tilt)
    case 'pan-right':  mvStore.setPanTilt(Math.min(540, mvStore.pan + step), mvStore.tilt)
    case 'tilt-up':    mvStore.setPanTilt(mvStore.pan, Math.max(0, mvStore.tilt - step))
    case 'tilt-down':  mvStore.setPanTilt(mvStore.pan, Math.min(270, mvStore.tilt + step))
    case 'home':       mvStore.setPanTilt(270, 135)  // reset to defaults
    case 'speed-up':   mvStore.setPatternSpeed(Math.min(100, mvStore.patternSpeed + 10))
    case 'speed-down': mvStore.setPatternSpeed(Math.max(0, mvStore.patternSpeed - 10))
  }
}
```

### 6.3 Selection Kill (WAVE 5020)

The `sel-blackout` action implements **contextual panic**:

- **If fixtures are selected** → toggle inhibit (latch) on those fixtures only via `toggleMute()` + `setSelInhibit()` IPC.
- **If NO fixtures are selected** → **PANIC MODE**: toggle global blackout via `setBlackout()`.

This dual-mode behavior means `Space` (bound to `arb-blackout` in base) and `sel-blackout` (available via custom binding) provide both surgical and global panic responses from the same conceptual action.

### 6.4 Group Blackout (WAVE 5021)

The `grp-N-blackout` actions target a **saved group** without modifying the current UI selection:

```typescript
// KeyActionDispatcher.ts:269-313
function dispatchGrpAction(actionId: string): boolean {
  const match = actionId.match(/^grp-(\d+)-(.+)$/)
  const groupIndex = parseInt(match[1], 10)
  const fixtureIds = getGroupFixtureIds(groupIndex)
  // Toggle latch on these fixtures
  const action = selStore.toggleMute(fixtureIds)
  const active = action === 'muted'
  bridge.setSelInhibit(fixtureIds, active)
}
```

**Stadium mapping:** `A`→grp-1, `S`→grp-2, `D`→grp-3, `Z`→grp-4, `X`→grp-5. These are the 6 natural left-hand keys for instant group blackout toggles during live performance.

---

## 7 — STADIUM DEFAULT LOADOUT

### 7.1 Base Layer (29 bindings)

| Key | Action | Behavior | Semantic |
|-----|--------|----------|----------|
| Space | `arb-blackout` | tap | DROP / blackout toggle |
| Slash | `arb-kill-effects` | tap | PANIC — kill all effects |
| 1-9 | `sel-group-N` | tap | Instant group recall |
| 0 | `sel-all` | tap | Select all fixtures |
| F | `fx-strobe_storm` | hold | Strobe (momentary) |
| G | `cue-go` | tap | Advance to next scene |
| H | `arb-freeze-frame` | toggle | Freeze current DMX frame |
| N | `fx-oro_solido` | tap | "Magic" — surprise effect |
| B | `tung-petal-l` | charge 600ms → `tung-nuke-all` | Escalating nuke |
| A | `grp-1-blackout` | tap | Group 1 inhibit toggle |
| S | `grp-2-blackout` | tap | Group 2 inhibit toggle |
| D | `grp-3-blackout` | tap | Group 3 inhibit toggle |
| Z | `grp-4-blackout` | tap | Group 4 inhibit toggle |
| X | `grp-5-blackout` | tap | Group 5 inhibit toggle |
| Q | `ctrl-intensity` | repeat 80ms | Grand Master nudge (down) |
| E | `ctrl-intensity` | repeat 80ms | Grand Master nudge (up) |
| V | `vibe-fiesta-latina` | tap | Vibe: Latino |
| C | `vibe-techno-club` | tap | Vibe: Techno |
| M | `ctrl-tap-tempo` | tap | Tap tempo |
| Comma | `ctrl-tempo-nudge-down` | repeat 100ms | Tempo down |
| Period | `ctrl-tempo-nudge-up` | repeat 100ms | Tempo up |
| Y | `ctrl-ai-toggle` | toggle | AI Selene on/off |
| ArrowRight / PageDown | `cue-next` | tap | Next scene |
| ArrowLeft / PageUp | `cue-prev` | tap | Previous scene |
| ArrowUp | `cue-play` | tap | Play/resume |
| ArrowDown | `cue-pause` | tap | Pause/freeze |
| F2 | `ui-toggle-forge` | tap | Toggle BUILD view |
| F3 | `ui-toggle-zen` | tap | Toggle LIVE view |
| F4 | `ui-toggle-3d` | tap | Toggle CHRONOS view |

### 7.2 Kinetic Layer (7 bindings, K+Shift)

| Key | Action | Behavior | Step |
|-----|--------|----------|------|
| W | `kin-tilt-up` | repeat 60ms | 15°/tick |
| S | `kin-tilt-down` | repeat 60ms | 15°/tick |
| A | `kin-pan-left` | repeat 60ms | 15°/tick |
| D | `kin-pan-right` | repeat 60ms | 15°/tick |
| R | `kin-home` | tap | Reset to 270°/135° |
| Q | `kin-speed-down` | repeat 80ms | -10/tick |
| E | `kin-speed-up` | repeat 80ms | +10/tick |

### 7.3 Alt Layer (17 bindings, hold Alt)

| Key | Action | Behavior |
|-----|--------|----------|
| 1-4 | `vibe-fiesta-latina` / `vibe-techno-club` / `vibe-pop-rock` / `vibe-chill-lounge` | tap |
| Q | `fx-deep_breath` | tap |
| W | `fx-ghost_breath` | tap |
| E | `fx-digital_rain` | tap |
| R | `fx-cyber_dualism` | tap |
| T | `fx-tidal_wave` | tap |
| Y | `fx-sky_saw` | tap |
| U | `fx-solar_flare` | tap |
| A | `fx-core_meltdown` | tap |
| S | `fx-strobe_burst` | tap |
| D | `fx-neon_blinder` | tap |
| F | `fx-gatling_raid` | tap |
| G | `fx-oro_solido` | tap |
| Space | `fx-latina_meltdown` | tap |

### 7.4 Chords (2 scoped combos)

| Chord | Keys | Action | Scope | Behavior |
|-------|------|--------|-------|----------|
| `chord-group1-strobe` | `1` + `F` | `fx-strobe_storm` | Group 1 | hold |
| `chord-group2-strobe` | `2` + `F` | `fx-strobe_storm` | Group 2 | hold |

---

## 8 — FINDINGS & VALORATION

### 8.1 Strengths

- **F1 — Modal layer system:** 6-layer stack with pivot-key activation is a world-class UX design. Double-pivot for `kinetic` (K+Shift) prevents accidental activation while keeping K free for base-layer binding. `select` layer requiring companion key is equally elegant.
- **F2 — Chord system:** Tekken-style order-independent combo detection with temporal windowing and most-specific-wins resolution. Chord suppression prevents double-fire. Scoped chords (WAVE 4802-D) enable group-targeted effects without altering UI selection.
- **F3 — Charge behavior:** The `heldMs / thresholdMs` ratio is a clean digital→analog bridge. The escalation path (sub-threshold → super-threshold action swap) is unique among lighting software.
- **F4 — Blur safety:** Total state flush on window blur is the correct solution to the stuck-key problem. No partial cleanup, no heuristics — full reset.
- **F5 — Zero-allocation discipline:** Mutable `Set`/`Map` reused across events. No subscriptions in listeners. Store read via `getState()` snapshots. Only 2 small object allocations per event (modifier snapshot + action payload).
- **F6 — CaptureGuard 6-ring defense:** Focus-aware interception with claim/bypass attributes and always-intercept whitelist. IME composition protection. This is production-grade.
- **F7 — Master Arm gate:** Safe-off default with persisted arm state. Prevents accidental keyboard takeover during configuration sessions.
- **F8 — Loadout portability:** `.kf.json` file format with schema validation in Electron main process. Export/import via native dialogs. Stadium default patching with migration support.

### 8.2 Findings (Areas for Improvement)

| ID | Severity | Finding | Impact |
|----|----------|---------|--------|
| K1 | **Medium** | `ctrl-*`, `flow-*`, `lux-*` prefixes are **log-only** (pending Batch 3). Grand Master nudge (`Q`/`E`), tap tempo (`M`), tempo nudge (`,`.`), and AI toggle (`Y`) do not reach the backend. | 5 stadium bindings are inert. The operator sees log output but no DMX response. |
| K2 | **Low** | Release-phase layer re-derivation uses "best effort" (current layer ?? lastLayer) instead of storing the exact layer at keydown time per key. | A key pressed in `base` then released in `alt` (after pressing Alt mid-hold) will try `alt` layer's binding first. If `alt` has a different binding for that key, the wrong release action fires. Edge case — most behaviors are `tap` (release-only) or `hold` (release sends intensity=0.0 regardless of actionId). |
| K3 | **Low** | `KeyForgeView.tsx` is a 1-line re-export shim to `KeyForgeOverlay.tsx`. | Dead indirection — should be consolidated or the shim documented as intentional. |
| K4 | **Info** | No `index.ts` barrel export in `keyforge/` directory. All imports are direct file paths. | Inconsistent with the rest of the codebase (physics, midi, etc. have barrel exports). Minor — direct imports are faster for tree-shaking. |
| K5 | **Info** | `KeyActionDispatcher.ts` imports 6 Zustand stores directly (`selectionStore`, `movementStore`, `sceneStore`, `navigationStore`, `effectsStore`, `stageStore`). | This creates a dense dependency graph. The module comment explicitly acknowledges this and justifies it as "one-way" (dispatcher → stores, never stores → dispatcher). Acceptable for a centralized dispatcher. |
| K6 | **Low** | `setMapping()` in `keyMapStore` always creates bindings with `behavior: { kind: 'tap' }`. Rich behavior selection (hold, charge, repeat) is not available from the `setMapping` path — only from `bindKey` (used by learn mode and stadium loadout). | UI remapping via `setMapping` loses behavior metadata. If a user remaps a `hold` binding via the UI, it becomes a `tap`. |

### 8.3 Pioneer Score: 92/100

| Category | Score | Notes |
|----------|-------|-------|
| Architecture & Design | 98/100 | World-class modal layer system, chord detection, charge behavior. Fighting-game-grade input processing. |
| Hot-Path Efficiency | 95/100 | Near-zero allocations. Event-driven (no polling). Only 2 small objects/event. No TickEngine/RAF overhead. |
| Safety & Robustness | 96/100 | Blur flush, Master Arm, CaptureGuard 6-ring, collision rejection, OS repeat elimination. |
| Feature Completeness | 82/100 | `ctrl-*`/`flow-*`/`lux-*` wiring pending (K1). 5 stadium bindings inert. Release-layer re-derivation is best-effort (K2). |
| Code Quality | 90/100 | Excellent documentation, exhaustive switch guards, clear separation of concerns. Minor: dead shim (K3), no barrel export (K4), `setMapping` behavior loss (K6). |

---

## 9 — DATA FLOW SUMMARY

```
                    PHYSICAL KEYBOARD
                          │
                    ┌─────▼─────┐
                    │  OS Event │
                    └─────┬─────┘
                          │
                 ┌────────▼────────┐
                 │  window keydown │
                 └────────┬────────┘
                          │
              ┌───────────▼───────────┐
              │  Master Arm Gate      │ ─── false → no-op (absorb Space)
              └───────────┬───────────┘
                          │ true
              ┌───────────▼───────────┐
              │  e.repeat filter      │ ─── repeat → discard
              └───────────┬───────────┘
                          │
              ┌───────────▼───────────┐
              │  normalizeKeyCode()   │ ─── e.code → KeyCode
              └───────────┬───────────┘
                          │
              ┌───────────▼───────────┐
              │  captureGuard()       │ ─── editable? IME? bypass? claim?
              └───────────┬───────────┘
                          │ intercept
              ┌───────────▼───────────┐
              │  heldKeys.add(key)    │
              │  downTimes.set(key)   │
              └───────────┬───────────┘
                          │
              ┌───────────▼───────────┐
              │  resolveActiveLayer() │ ─── forge > kinetic > select > cmd > alt > base
              └───────────┬───────────┘
                          │
              ┌───────────▼───────────┐
              │  Learn Mode?          │ ─── yes → capture key → store → done
              └───────────┬───────────┘
                          │ no
              ┌───────────▼───────────┐
              │  chordMatcher()       │ ─── match? → suppress individual keys → dispatch chord
              └───────────┬───────────┘
                          │ no chord
              ┌───────────▼───────────┐
              │  getBindingSnapshot() │ ─── layer + key → KeyBinding
              │  + requiredMods check │
              └───────────┬───────────┘
                          │
              ┌───────────▼───────────┐
              │  executePress()       │ ─── tap: defer / hold: fire / toggle: fire /
              │                       │     momentary: fire / charge: defer / repeat: fire+timer
              └───────────┬───────────┘
                          │
              ┌───────────▼───────────┐
              │  KeyActionDispatcher  │ ─── fx-* → forceStrike
              │  .dispatchAction()    │     vibe-* → setVibe
              │                       │     arb-* → blackout/kill/grand-master
              │                       │     tung-* → fireTungstenNuke
              │                       │     sel-* → selectionStore
              │                       │     grp-* → toggleMute + setSelInhibit
              │                       │     kin-* → movementStore
              │                       │     cue-* → sceneStore
              │                       │     ui-*  → navigationStore
              │                       │     ctrl/flow/lux-* → LOG (pending)
              └───────────┬───────────┘
                          │
                    ┌─────▼─────┐
                    │  Backend  │
                    │  window.  │
                    │  lux.*    │
                    └───────────┘
```

---

## APÉNDICE — GLOSARIO DE TÉRMINOS

| Término | Definición |
|---------|-----------|
| **KeyCode** | Identificador físico de tecla derivado de `KeyboardEvent.code` (no `e.key`). Layout-independent. |
| **LayerId** | Página modal del teclado. 6 capas: base, alt, cmd, select, kinetic, forge. |
| **KeyBinding** | Contrato de qué hace una tecla en un layer dado. Incluye actionId, behavior, requiredMods. |
| **ChordBinding** | Combo simultáneo (2-4 teclas). Detección Tekken-style: orden-independiente, ventana temporal. |
| **KeyBehavior** | Comportamiento temporal: tap, hold, toggle, momentary, charge, repeat. |
| **Charge** | Behavior que mapea duración de hold a intensidad continua (0..1). Threshold determina acción débil vs fuerte. |
| **Pivot Key** | Tecla que, al mantenerse, activa un layer. K = kinetic, S = select. Double-pivot (K+Shift) evita activación accidental. |
| **Chord Suppression** | Cuando un chord dispara, las acciones individuales de sus teclas componentes son suprimidas. |
| **Scoped Chord** | Chord con `scopeGroupIndex` que aplica el efecto a un grupo guardado sin alterar la selección visual. |
| **Master Arm** | Gate de seguridad. Cuando `false`, KeyForge no intercepta ningún evento. Default: false en boot. |
| **CaptureGuard** | Sistema de 6 anillos defensivos que decide si KeyForge debe consumir un evento o dejarlo pasar. |
| **Stadium Loadout** | Battle plan default: 57 bindings + 2 chords. Carga idempotente + migración de slots. |
| **Loadout** | Perfil portable de KeyForge. Serializado como `.kf.json`. Incluye bindings, chords, metadata. |
| **HoldRegistry** | Set mutable de teclas físicamente presionadas. Reusado zero-alloc. |
| **Tidal Gate** | *(N/A en KeyForge — término del OmniliquidEngine)* |
| **Selection Kill** | `sel-blackout` contextual: si hay selección → inhibit selectivo; si no → blackout global (PANIC). |

---

*FIN DEL AUDIT — KEYFORGE ENGINE ARCHITECTURAL BLUEPRINT*
