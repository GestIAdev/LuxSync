Let me read the blueprint first, then audit the Hephaestus frontend.

Now I have the full blueprint. Phase 6 is the Forge UI section. Let me audit the Hephaestus frontend components.

The search found that `LASER FX` and `ATMOSPHERE` palettes already exist. Let me read the full FUNCTION_PALETTE and the key helper functions to verify completeness.

Good — the palettes exist. Now let me check `getChannelCategory`, `getCategoryColor`, `getSmartDefaultValue`, and the MotorType dropdown.

`getSmartDefaultValue` is complete. Now let me check `ForgeGeneralTab.tsx` for `getChannelCategory` and `CATEGORY_COLORS`:

Now let me find the MotorType dropdown — where the user selects the motor type. It seems to only display it as a badge. Let me search for where motorType is selected/edited:

Now let me check where the MotorType dropdown is actually rendered for user selection. Let me look at the PhysicsTuner or physics tab:

Critical finding — `MotorType` in `ShowFileV2.ts` does NOT include `'galvo'`. Let me check the PhysicsTuner dropdown options and `IForgePhysics` in FixtureDefinition:

Important finding — two parallel `MotorType` definitions. `IForgePhysics` has `'galvo'`, but `ShowFileV2.MotorType` + `DEFAULT_PHYSICS_PROFILES` + `MOTOR_TYPE_INFO` do not. Let me check the Aether Cells tab and the FX Curve Editor.

The quarantine badge is implemented. Now let me audit the FX Curve Editor (The Programmer). Let me find the effect/curve editor UI:

Now let me look at `ParameterLane.tsx` and `PARAM_META` to see what parameter IDs are available for curve drawing:

Now let me look at `HephParamId` type definition to confirm what's available:

Let me see the full `HephParamId` type:

Now let me check how `HephParamId` maps to actual fixture channels in the runtime — to see if `scale_x`/`rot_x` etc. could even be driven:

Let me check `scaleToDMX` to see how params map to DMX:

Now let me check how the HephaestusAetherAdapter maps `paramName` to actual fixture channels — the last mile:

Let me check the `HephaestusAetherAdapter` to see how it maps paramName to channel types:

I now have a complete picture. Let me verify the `HARD_SAFETY_CHANNEL_TYPES` export exists:

I have everything I need. Let me compile the audit report.

# 🩸 WAVE 7749.28 — HEPHAESTUS LASER & FX PARAMETERIZATION AUDIT

**Status:** READ-ONLY diagnostic. No code modified.
**Scope:** Phase 6 of the Aether Agnostic Blueprint — Forge UI + FX Curve Editor readiness for physical laser/pyro hardware testing.

---

## 1. FIXTURE FORGE (Profile Creation) — ✅ COMPLETE

### 1.1 FUNCTION_PALETTE — ✅ Both categories present

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\ForgeView\FixtureForgeEmbedded.tsx" lines="268-285" />

- **`LASER FX`** (`#00ff88`): `scale_x`, `scale_y`, `rot_x`, `rot_y`, `emission_gate` — all 5 present, correctly colored. `emission_gate` uses `#ff0044` (safety red) with a `Lock` icon — good visual signaling.
- **`ATMOSPHERE`** (`#6b7280`): `smoke_pump`, `smoke_density`, `fan_speed`, `fire_valve`, `fire_ignite` — all 5 present. `fire_valve`/`fire_ignite` use `#ff0044` with `AlertTriangle`/`Zap` icons — pyro channels visually distinguished from haze/fog.

**Verdict:** Blueprint §6.1 fully satisfied. Drag-and-drop primitives are available.

### 1.2 getSmartDefaultValue — ✅ Correct fail-closed defaults

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\ForgeView\FixtureForgeEmbedded.tsx" lines="1013-1035" />

- `scale_x`/`scale_y` → 128 (50% pattern scale) ✅
- `rot_x`/`rot_y` → 0 ✅
- `emission_gate` + all 5 atmosphere channels → **0** (fail-closed) ✅

**Verdict:** Blueprint §6.1 defaults satisfied. Matches the `HARD_SAFETY_CHANNEL_TYPES` forced-`defaultValue=0` in `NodeExtractionPipeline._resolveDefaultValue` (line 1410).

### 1.3 getChannelCategory + CATEGORY_COLORS — ✅ Complete

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\ForgeView\tabs\ForgeGeneralTab.tsx" lines="183-209" />

- `CATEGORY_COLORS`: `'LASER FX': '#00ff88'`, `ATMOSPHERE: '#6b7280'` ✅
- `getChannelCategory`: routes all 10 new literals to their categories ✅
- `getCategoryColor`: normalizes via `toUpperCase()` ✅

**Verdict:** Blueprint §6.2 fully satisfied. DMX ribbon will color-code the new channels.

### 1.4 MotorType dropdown — ⚠️ CRITICAL GAP (two parallel type systems)

This is the **most significant finding** of the audit. There are two divergent `MotorType` definitions:

| Location | Definition | Has `'galvo'`? |
|----------|-----------|----------------|
| `types/FixtureDefinition.ts:370` (`IForgePhysics.motorType`) | `'servo' \| 'stepper' \| 'brushless' \| 'servo-pro' \| 'stepper-pro' \| 'galvo'` | ✅ Yes |
| `core/stage/ShowFileV2.ts:155` (`MotorType`) | `'servo-pro' \| 'stepper-quality' \| 'stepper-cheap' \| 'unknown'` | ❌ **No** |

The `PhysicsTuner.tsx` component — the actual UI dropdown the operator uses to select motor type — is keyed off `ShowFileV2.MotorType`:

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\shared\PhysicsTuner\PhysicsTuner.tsx" lines="60-90" />

`MOTOR_TYPE_INFO` has only 4 entries (`servo-pro`, `stepper-quality`, `stepper-cheap`, `unknown`). `DEFAULT_PHYSICS_PROFILES` (ShowFileV2.ts:288) has the same 4. **There is no `galvo` option in the dropdown.**

Meanwhile, `FixtureForgeEmbedded.tsx:515` casts `statePhysics.motorType as any` when saving — so the Forge *could* persist a `'galvo'` value if it got into state, but the PhysicsTuner UI has no way to select it, and `DEFAULT_PHYSICS_PROFILES['galvo']` would return `undefined`, causing `handleReset` (line 176) to crash.

**Impact:** The Architect cannot select `'galvo'` for a laser profile in the Forge UI. The `PhysicsPostProcessor` will never receive the galvo inertia profile for laser fixtures. The blueprint's §2.4 "one-line enum addition that unlocks correct physics" was done in `IForgePhysics` but **not propagated to the runtime/UI type system**.

**Required fix (3 files):**
1. `ShowFileV2.ts:155` — add `'galvo'` to `MotorType` union.
2. `ShowFileV2.ts:288` — add a `galvo` entry to `DEFAULT_PHYSICS_PROFILES` (ultra-low inertia: `maxAcceleration: ~10000 °/s²`, `maxVelocity: ~2000 °/s`, `safetyCap: false` — galvos settle in ~1ms, no belt slip risk).
3. `PhysicsTuner.tsx:60` — add a `galvo` entry to `MOTOR_TYPE_INFO` (label: "Galvo (Laser)", icon: "⚡", `recommendedAccel: ~8000`).

### 1.5 ForgeAetherCellsTab quarantine badge — ✅ Complete

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\components\views\ForgeView\tabs\ForgeAetherCellsTab.tsx" lines="192-212" />

- Imports `HARD_SAFETY_CHANNEL_TYPES` from `NodeExtractionPipeline` ✅
- Renders red warning badge on ATMOSPHERE cells containing `emission_gate`/`fire_valve`/`fire_ignite` ✅
- Text: *"⚠️ Quarantined — Manual/Cue Only, Never AI-Driven"* ✅
- Visual: `#1a0a0a` background, `#ef4444` border, `#fca5a5` text ✅

**Verdict:** Blueprint §6.3 fully satisfied. The badge correctly keys off the canonical `HARD_SAFETY_CHANNEL_TYPES` set, not a hardcoded list.

---

## 2. THE FX CURVE EDITOR (The Programmer) — ❌ CRITICAL GAP

This is where the audit reveals a **structural deficiency** that blocks the Architect from drawing FX curves for the new laser primitives.

### 2.1 HephParamId does not include the new primitives

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\hephaestus\types.ts" lines="164-181" />

`HephParamId` is a closed union of **16 literals**:
`'intensity' | 'color' | 'white' | 'amber' | 'speed' | 'pan' | 'tilt' | 'zoom' | 'focus' | 'iris' | 'gobo1' | 'gobo2' | 'prism' | 'strobe' | 'globalComp' | 'width' | 'direction'`

**Missing:** `scale_x`, `scale_y`, `rot_x`, `rot_y`, `emission_gate`, `smoke_pump`, `smoke_density`, `fan_speed`, `fire_valve`, `fire_ignite`, `gobo_rotation`.

The `ParameterLane.tsx` `PARAM_META` and `ALL_PARAM_IDS` (line 69) are `Record<HephParamId, ...>` — so they are **exhaustively bounded** by the union. Adding the new literals to `HephParamId` will cause `tsc` to flag every `Record<HephParamId, ...>` as incomplete, which is the type system doing the migration audit for us (same pattern as Phase 1 of the blueprint).

### 2.2 The runtime scaling pipeline has no branches for the new params

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\hephaestus\runtime\HephUtils.ts" lines="45-60" />

- `DMX_SCALED_PARAMS`: `intensity, strobe, white, amber, zoom, focus, iris, gobo1, gobo2, prism` — no `scale_x/y`, `rot_x/y`, `emission_gate`, atmosphere channels.
- `DMX_16BIT_PARAMS`: `pan, tilt, dimmer` — galvo channels use `pan`/`tilt` so they inherit 16-bit ✅.
- `FLOAT_PASSTHROUGH_PARAMS`: `speed, width, direction, globalComp`.

**A new `scale_x` curve would fall through to the "engine-internal" branch and emit a 0-1 float, not a 0-255 DMX byte.** The laser would never see the pattern scale change.

### 2.3 HephaestusAetherAdapter has no mapping for the new params

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\aether\adapters\HephaestusAetherAdapter.ts" lines="327-354" />

`_paramFamily()` returns `null` for anything not in the 16-literal set. `_populateValues()` (line 369) has a `default:` fallthrough that silently drops the value. **Even if `HephParamId` were extended, the adapter would route the new params to nowhere.**

### 2.4 gobo (discrete) vs gobo_rotation (continuous) — ⚠️ Partially handled, semantically conflated

The blueprint (§1.1) maps `laser_pattern` → `gobo` (discrete indexed selector) and `laser_rot_z` → `gobo_rotation` (continuous spin). The current Hephaestus param model has:
- `gobo1` → maps to `gobo` channel (discrete bank) ✅
- `gobo2` → maps to `gobo_rotation` channel (continuous) ✅ — *see HephaestusAetherAdapter.ts:452-453*

**But:** There is no UI concept of "discrete stepping" vs "continuous curve" in the Curve Editor. Both `gobo1` and `gobo2` use the same Bezier keyframe editor. For a laser pattern bank, the operator should see a **stepped quantizer** (snap to integer indices), not a smooth Bezier curve. Drawing a smooth ramp on a gobo wheel produces mid-values that either round unpredictably or cause DarkSpin anti-rebote to suppress the change entirely.

**Required:** A `curveMode: 'continuous' | 'stepped'` flag on `HephCurve` (or a `quantizeSteps` field), with the CurveEditor rendering a staircase overlay for stepped params. The blueprint's §6 mention of "discrete stepping for pattern selection while allowing continuous curves for rotation" is **not implemented**.

---

## 3. SUMMARY — UI IMPLEMENTATION STRATEGY

### ✅ Already complete (Forge UI — Phase 6.1/6.2/6.3)
| Item | Status |
|------|--------|
| `LASER FX` palette (5 channels, `#00ff88`) | ✅ |
| `ATMOSPHERE` palette (5 channels, `#6b7280`) | ✅ |
| `getSmartDefaultValue` (fail-closed 0 for safety) | ✅ |
| `getChannelCategory` + `CATEGORY_COLORS` | ✅ |
| Quarantine red badge on ATMOSPHERE cells | ✅ |
| `HARD_SAFETY_CHANNEL_TYPES` export + forced `defaultValue=0` | ✅ |

### ❌ Missing — requires implementation before hardware testing

| Priority | Gap | Files | Effort |
|----------|-----|-------|--------|
| **P0** | `MotorType` in `ShowFileV2.ts` missing `'galvo'`; `DEFAULT_PHYSICS_PROFILES` + `MOTOR_TYPE_INFO` have no galvo entry → PhysicsTuner dropdown cannot select galvo | `ShowFileV2.ts`, `PhysicsTuner.tsx` | Small (3 edits) |
| **P1** | `HephParamId` union missing 11 new literals (`scale_x/y`, `rot_x/y`, `emission_gate`, 5 atmosphere, `gobo_rotation`) → Curve Editor cannot draw curves for laser primitives | `hephaestus/types.ts` | Small (1 edit, but cascades) |
| **P2** | `PARAM_META` + `ALL_PARAM_IDS` + `PARAM_CATEGORIES` in `ParameterLane.tsx` need entries for all 11 new params (labels, colors, icons, category) | `ParameterLane.tsx` | Medium (~11 entries) |
| **P3** | `DMX_SCALED_PARAMS` in `HephUtils.ts` needs `scale_x/y`, `rot_x/y`, `smoke_pump`, `smoke_density`, `fan_speed` (8-bit DMX). `emission_gate`/`fire_valve`/`fire_ignite` should **not** be in the curve editor at all (quarantine) — or if present, read-only. | `HephUtils.ts` | Small |
| **P4** | `_paramFamily()` + `_populateValues()` in `HephaestusAetherAdapter.ts` need branches for `scale_x/y` → BEAM, `rot_x/y` → BEAM, `gobo_rotation` → BEAM; atmosphere channels → blocked (return null, quarantine) | `HephaestusAetherAdapter.ts` | Medium |
| **P5** | `HephFixtureOutput` scaling doc + `HephaestusRuntime._emitTrackSample` — no `case` for new params; currently falls through to `writeOutput` with `paramName` but `scaleToDMX` returns 0-1 float | `HephaestusRuntime.ts` | Small |
| **P6** | Discrete stepping for `gobo`/pattern bank — `HephCurve` needs `curveMode: 'continuous' \| 'stepped'` or `quantizeSteps: number`; CurveEditor renders staircase overlay for stepped params | `types.ts`, `CurveEditor.tsx`, `ParameterLane.tsx` | Medium-large |

### Recommended implementation order
1. **P0 first** (galvo motor) — unblocks physical laser physics. 3-file edit.
2. **P1 + P2 + P3 + P4 + P5 as one wave** (HephParamId extension) — these are coupled; extending the union without wiring the runtime is a no-op. The `tsc` exhaustive-Record errors will guide the migration.
3. **P6 last** (discrete stepping) — UX refinement; not a hard blocker for hardware testing but required for correct gobo/pattern authoring.

### Safety note on P3/P4
`emission_gate`, `fire_valve`, `fire_ignite` should **not** be authorable in the Curve Editor. They are cue-only / manual-only by blueprint §3.4. The `HephParamId` union could either (a) omit them entirely, or (b) include them but have `_paramFamily()` return `null` and the ParameterLane hide them from the add-param dropdown. Option (b) is safer for type-exhaustiveness but requires a filter in `ALL_PARAM_IDS`. The atmosphere fluid channels (`smoke_pump`, `smoke_density`, `fan_speed`) **can** be curve-authored at 4 Hz cue rate, but the Curve Editor should display a "CUE RATE — 4 Hz max" warning badge on those lanes.

---

**Bottom line:** The Forge profile-creation UI (Phase 6.1–6.3) is production-ready. The FX Curve Editor (the Programmer) is **not** ready — `HephParamId` is a closed 16-literal union that predates WAVE 7737, and the entire Hephaestus runtime→adapter→DMX pipeline has no branches for the 10 new primitives. The Architect can *build* a laser fixture profile today, but cannot *program* a laser effect curve. Recommend authorizing P0–P5 before hardware testing begins.