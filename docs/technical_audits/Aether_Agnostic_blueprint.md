# AETHER AGNOSTIC — NATIVE LASER & SPECIAL FX INTEGRATION BLUEPRINT

**Wave:** 7736 (design) → 7737 (implementation)
**Role:** Principal Systems Architect
**Ground truth:** `AETHER_MATRIX_AUDIT_PT1_REVISED.md`, `AETHER_MATRIX_AUDIT_PT2.md`, `OMNILIQUID_ENGINE_AUDIT.md`, `WAVE 7735` taxonomy audit.
**Status:** DESIGN. No code modified.

---

## 0. Executive Position

The proposed raw inventory of 18 new `ChannelType` literals is **structurally weak and I am rejecting 9 of them.** Not because they are wrong about the hardware — a laser genuinely does have an X galvo, a power channel, and a pattern bank — but because **naming them `laser_*` forks the engine.**

The central architectural fact, established by PT1 §2 (F6 retraction), is this:

> LuxSync solves complex hardware **once, at Forge compile time**, by decomposing a physical fixture into disjoint-channel logical nodes. The 44 Hz runtime never reasons about device *class*. It reasons about **families**: COLOR, IMPACT, KINETIC, BEAM, ATMOSPHERE.

A laser galvo pair is not a new kind of thing. **It is a pan/tilt.** It is a 2-axis angular deflection of a beam, driven by a `galvo` motor type that the `MotorType` enum *already declares* (`'stepper' | 'servo' | 'galvo'` — `core/aether/types.ts`). If we type the galvo channels as `pan`/`tilt`, then on day one, with zero new engine code:

- The **VibeMovementManager** orbits the laser.
- The **InverseKinematicsEngine** aims the laser at a 3D stage target.
- The **PhysicsPostProcessor** applies galvo-appropriate inertia.
- The **NodeArbiter** `_applyRelativeOffsetFusion` merges IK base + VMM offset.
- The **KineticsCathedral radar** drives it manually.
- **WAVE 7734's** coupled-axis hand-off works on it.

If we type them `laser_x`/`laser_y`, **every one of those subsystems must be re-implemented**, or the laser stays a dumb `custom` channel forever. This is the difference between two days of work and two months.

**The doctrine of this blueprint: add a new primitive only when no existing family verb can express the physical intent. Everything else is a rename, and renames are free — they happen in the Forge label, not the type system.**

---

## 1. Analysis & Discard — The Reuse Doctrine

### 1.1 Rejected primitives (9) — map onto the existing stack

| Proposed | **Verdict** | Maps to | Why this is strictly better |
|---|---|---|---|
| `laser_x` | **DISCARD** | `pan` | Inherits VMM, IK, galvo physics, radar, WAVE 7734 hand-off, 16-bit fine pairing. |
| `laser_y` | **DISCARD** | `tilt` | Same. Also inherits `TILT_ARBITER_MIN/MAX` clamping — a free retina guard. |
| `laser_power` | **DISCARD** | `dimmer` | Inherits HTP merge, Grand Master, inhibit limits, blackout mask, Omniliquid impact envelopes. |
| `laser_strobe` | **DISCARD** | `strobe` | Inherits `STRICT_PRIORITY_CHANNELS` handling in the arbiter (PT2 §1.3). |
| `laser_color` | **DISCARD** | `color_wheel` | Inherits ColorSystem, Mover Shield (PT2 §1.4.4), DarkSpin anti-rebote. Diode-RGB lasers use `red`/`green`/`blue` — also already present. |
| `laser_speed` | **DISCARD** | `speed` | Already a KINETIC primitive. |
| `laser_pattern` | **DISCARD** | `gobo` | A laser pattern bank **is** a gobo wheel: a discrete indexed selector of beam shapes. Inherits BeamSystem + DarkSpin. |
| `laser_rot_z` | **DISCARD** | `gobo_rotation` | In-plane pattern spin is exactly gobo rotation. |
| `smoke_fan` | **DISCARD** | `fan_speed` | Redundant. The *node context* (a fan channel inside a fog machine's ATMOSPHERE cell vs. a standalone fan fixture) disambiguates. One primitive, two uses. |

**The `customName` field already exists** on `FixtureChannel`. A `pan` channel on a laser profile is labelled `"Galvo X"` in the Forge and in the Programmer UI. The operator sees "Galvo X". The engine sees `pan`. Everybody wins.

### 1.2 Accepted primitives (10) — genuinely novel physical verbs

#### BEAM — pattern geometry (4)

These have **no existing analog**. `zoom` is uniaxial and semantically "beam angle"; a laser scales its *pattern* independently on two axes, and tumbles it in 3D. A 3D-gobo moving head has the same need, so these are named generically, not `laser_*`.

| Literal | Physical meaning | Family | Default | Merge |
|---|---|---|---|---|
| `scale_x` | Pattern horizontal scale | BEAM | 128 | LTP |
| `scale_y` | Pattern vertical scale | BEAM | 128 | LTP |
| `rot_x` | 3D pattern tumble, X axis | BEAM | 0 | LTP |
| `rot_y` | 3D pattern tumble, Y axis | BEAM | 0 | LTP |

> `rot_z` is deliberately absent — it is `gobo_rotation`.

#### SAFETY — the interlock (1)

| Literal | Physical meaning | Family | Default | Merge |
|---|---|---|---|---|
| `emission_gate` | Laser emission enable / legal interlock | ATMOSPHERE | **0** | LTP |

This is the one place I *add* a primitive that superficially resembles an existing one (`shutter`). It must be distinct **precisely so it can be quarantined**. A `shutter` is a light-blocking mechanic that the AI is *supposed* to drive. An `emission_gate` is a regulatory interlock that must **fail closed**, must **never** be written by L0/L1, and must be governed by a hard DMX Governor. Overloading `shutter` would let the Omniliquid ImpactSystem arm a Class 4 laser on a kick drum. That is unacceptable.

#### ATMOSPHERE — fluid & pyro (5)

| Literal | Physical meaning | Family | Default | Merge |
|---|---|---|---|---|
| `smoke_pump` | Fog/haze fluid pump output | ATMOSPHERE | 0 | LTP |
| `smoke_density` | Fluid density / mixture ratio | ATMOSPHERE | 0 | LTP |
| `fan_speed` | Fan velocity (dispersion or standalone) | ATMOSPHERE | 0 | LTP |
| `fire_valve` | Fuel valve / solenoid | ATMOSPHERE | **0** | LTP |
| `fire_ignite` | Ignition trigger | ATMOSPHERE | **0** | LTP |

**Net: 10 new literals, not 18.** And the 9 discards are what buy us free AI control.

### 1.3 The `AtmosphereType` fix

`_mapAtmosphereType` currently maps `FixtureType 'laser'` → `AtmosphereType 'spark'`. This is a live semantic bug: it subjects lasers to Sparkular logic (drop-only, `energy > 0.80`, 8-second cooldown). Under the new model, a laser is **not an atmosphere device at all** — it decomposes into IMPACT/KINETIC/BEAM/COLOR cells with only its interlock in ATMOSPHERE.

`AtmosphereType` gains `'laser'` **only** to type the residual interlock node:

```
export type AtmosphereType = 'fog' | 'haze' | 'spark' | 'fan' | 'pyro' | 'laser' | 'custom'
```

---

## 2. The Cell Distribution Strategy

### 2.1 The doctrine

PT1 §2.2 documents `_buildNodesFromForgeGraph` as *"the ÚNICA fuente de verdad when nodeGraph is present"*, with the Tungsten (kinetic + golden-master + petal-l/c/r + wash + wash-color + beam-color) as the worked example. WAVE 7122.1 Cross-Cell Isolation namespaces channel keys as `${aetherNodeId}:${channelType}` so homonymous channels in different cells never collide.

**A laser is a Tungsten.** It is a multicell fixture. We do not need one byte of new decomposition machinery.

### 2.2 Worked example — a 12-channel ILDA-style DMX laser

Physical DMX map:

| Ch | Manufacturer label | **Aether ChannelType** | **Cell** |
|---|---|---|---|
| 1 | Mode / Emission Enable | `emission_gate` | `laser-01:atmosphere` |
| 2 | Pattern Bank | `gobo` | `laser-01:beam` |
| 3 | Pattern Rotation | `gobo_rotation` | `laser-01:beam` |
| 4 | Horizontal Move (Galvo X) | `pan` | `laser-01:kinetic` |
| 5 | Vertical Move (Galvo Y) | `tilt` | `laser-01:kinetic` |
| 6 | Horizontal Size | `scale_x` | `laser-01:beam` |
| 7 | Vertical Size | `scale_y` | `laser-01:beam` |
| 8 | 3D Tumble X | `rot_x` | `laser-01:beam` |
| 9 | 3D Tumble Y | `rot_y` | `laser-01:beam` |
| 10 | Colour Select | `color_wheel` | `laser-01:color` |
| 11 | Scan Speed | `speed` | `laser-01:kinetic` |
| 12 | Dimmer / Strobe | `dimmer` | `laser-01:impact` |

### 2.3 What each engine now drives, for free

```
                    ┌──────────────────────────────────────┐
                    │        ONE PHYSICAL LASER            │
                    └──────────────────┬───────────────────┘
                                       │ Forge compile time
        ┌──────────────┬───────────────┼───────────────┬──────────────┐
        ▼              ▼               ▼               ▼              ▼
  :impact         :kinetic         :beam          :color      :atmosphere
  IMPACT          KINETIC          BEAM           COLOR       ATMOSPHERE
  dimmer          pan              gobo           color_wheel emission_gate
                  tilt             gobo_rotation
                  speed            scale_x/y
                                   rot_x/y
        │              │               │               │              │
        ▼              ▼               ▼               ▼              ▼
  Omniliquid      VMM + IK         BeamSystem     ColorSystem   QUARANTINE
  ImpactSystem    KineticSystem    + DarkSpin     + Selene      (manual/cue
  (L0 envelopes)  PhysicsPostProc  (L0)           + MoverShield  only, 4 Hz)
  Selene L1       KineticsCathedral
```

- The **galvos orbit to the music** because `pan`/`tilt` on a KINETIC node is what the VibeMovementManager has always driven.
- The laser **aims at a 3D stage point** because `targetX/Y/Z` + the IK solver operate on any KINETIC node — WAVE 7734's `_spatialCoupledLock` protects it identically.
- The **pattern bank changes on section boundaries** because that is what BeamSystem does with `gobo`.
- **DarkSpin** anti-rebote already protects the pattern wheel from mechanical thrash.
- The **beam brightness breathes** with the Omniliquid non-Newtonian envelopes, because it is a `dimmer` on an IMPACT node.
- **Grand Master, blackout mask, and inhibit limits** all apply, because they key off `dimmer`.

### 2.4 The galvo physics hook

`MotorType` already declares `'galvo'`. `IForgePhysics.motorType` is `'servo' | 'stepper' | 'brushless' | 'servo-pro' | 'stepper-pro'` — **it is missing `galvo`**. Adding it lets `PhysicsPostProcessor` select an ultra-low-inertia profile (galvos settle in ~1 ms; `SAFETY_MAX_VELOCITY_NORM` should be effectively unbounded for them, unlike a 3 kg moving head). This is a one-line enum addition that unlocks correct physics.

### 2.5 Reusing `LaserPhysics.ts` — the asset nobody wired up

`hal/physics/LaserPhysics.ts` (346 lines) **already exists** and is production-grade:

- `LaserPhysicsInput` — `ultraAir`, `clarity`, `texture`, `lowMid`, `energy`, `bpm`
- `LaserPhysicsResult` — `intensity`, `beamWidth`, `scanSpeed`, `mode`, `horizonPosition`, `waveOffset`, `safetyTriggered`
- **`LaserSafetyConfig` — a RETINA GUARD** with `horizonLimit`, `exclusionZone`, `maxIntensityNearHorizon`
- Three texture modes: `liquid_sky`, `sparkle_rain`, `standby`

It is a singleton (`laserPhysics`) that, per the Omniliquid audit's own file map, is **not connected to the Aether pipeline**. This blueprint wires it in as an L0 *modulator*, not a new system:

| `LaserPhysicsResult` field | Target channel | Target cell |
|---|---|---|
| `intensity` | `dimmer` | `:impact` |
| `scanSpeed` | `speed` | `:kinetic` |
| `horizonPosition` | **`tilt` ceiling clamp** | `:kinetic` |
| `waveOffset` | `tilt_offset` (VMM fusion) | `:kinetic` |
| `beamWidth` | `scale_x` / `scale_y` | `:beam` |
| `mode` | `gobo` bank hint | `:beam` |
| `safetyTriggered` | forces `emission_gate` → 0 | `:atmosphere` |

**`horizonPosition` mapping to a tilt clamp is the critical safety win.** The Retina Guard stops being advisory and becomes a hard mechanical limit enforced in the same place `TILT_ARBITER_MIN/MAX` already lives.

---

## 3. The Atmosphere Quarantine

### 3.1 The requirement

Smoke and fire must be **strictly manual or cue-driven**, never touched by 44 Hz fluid physics. A `LiquidEnvelope` firing a fog machine on every kick would empty a fluid tank in ninety seconds and overheat the heater block. A `LiquidEnvelope` firing `fire_ignite` is a liability event.

### 3.2 Current state — an accidental safety net

The `AtmosphereSystem` and `AtmosphereAdapter` emit intent keys `'output'`, `'fan_speed'`, `'density'`, `'level'`, `'speed'`. **None of these match any `ChannelType` literal.** The NodeResolver matches intents to physical channels by type string, so every atmosphere intent generated in the last N waves has been **silently discarded**.

This is why smoke has never misfired: the system is a no-op. If we naively "fix" the key alignment (as the WAVE 7735 audit suggested), we would **arm the AI to drive fog and pyro at 44 Hz overnight.** That is the single most dangerous change available in this codebase.

**Therefore: align the keys AND simultaneously demote the layer. Never one without the other.**

### 3.3 The four-ring quarantine

#### Ring 1 — L0 exclusion (the hard wall)

`LiquidAetherAdapter.ingest()` iterates `for (const family of Object.values(NodeFamily))` (PT2 §3.2). ATMOSPHERE is included today. It must be excluded by an explicit allow-list:

```
const L0_DRIVEN_FAMILIES = [COLOR, IMPACT, KINETIC, BEAM] as const
// ATMOSPHERE is deliberately absent. Omniliquid never touches fluid or pyro.
```

`AtmosphereSystem` is **removed from the L0 system registry entirely**. It is not deleted — it is re-hosted (Ring 2).

#### Ring 2 — Cue-rate decimation (4 Hz, not 44 Hz)

`TickEngine` already has the divider idiom (the 11 Hz broadcast divider). ATMOSPHERE resolves on an **`ATMOS_DIVIDER = 11`** counter → 4 Hz. Physical justification: a fog pump's mechanical response time is 200–500 ms. Commanding it at 44 Hz is 10× oversampled and produces nothing but solenoid chatter.

The re-hosted `AtmosphereCueDriver` runs inside that divider and pushes into the **L2/L3 band**, not L0 — so it is subject to the Manual Hard Lock and the operator always wins.

#### Ring 3 — Fail-closed DMX Governors (zero-cost, patch-time)

This is the mechanism PT1 §F9 already optimised: `IDMXGovernor` rules are precomputed into a 512-slot offset-indexed array at patch time (`buildGovernorLookupMap()`), so hot-path evaluation is `govMap[channelOffset]` — O(1), zero-alloc.

`GovernorIntentType` gains three members: `'emission'`, `'fire'`, `'smoke'`. Default rules shipped with every laser/fire profile:

| Channel | Rule | Effect |
|---|---|---|
| `emission_gate` | `{ when: { intentType: 'emission' }, then: { forceByte: 0 } }` unless armed | Laser cannot emit without explicit operator arm |
| `fire_ignite` | `{ when: { intentType: 'fire', max: 254 }, then: { forceByte: 0 } }` | Only a literal full-scale command ignites; no partial/noise value can |
| `smoke_pump` | `{ when: { intentType: 'smoke' }, then: { mapToRange: [0, 180] } }` | Hard 70 % cap on continuous pump duty |

Governors are the correct home for this because they are the **last mile** — they execute after all arbitration, so no layer, not even L3++ Calibration, can bypass them.

#### Ring 4 — Deadman & thermal state (reuse `AtmosphereSafetyState`)

`IAtmosphereNodeData.safety` (`cooldownRemaining`, `totalActiveMs`) already exists and the gate logic in `AtmosphereSystem` is sound (`FOG_MAX_CONTINUOUS_MS = 180_000`, per-type cooldowns 5 s / 2 s / 8 s / 30 s). It is preserved verbatim, now running at 4 Hz where it belongs, plus:

- **Deadman:** if no cue has been received for `> 2000 ms`, all `fire_*` and `emission_gate` channels drive to 0. Loss of control = safe state.
- **Blackout coupling:** L4 blackout must force `fire_valve`, `fire_ignite`, `emission_gate` → 0. Today the soft-blackout mask only covers `SOFT_BLACKOUT_INTENSITY_CHANNELS`. These three must be added to a new `HARD_SAFETY_CHANNELS` set that blackout zeroes unconditionally.

### 3.4 What the AI *is* allowed to do with atmosphere

Not nothing — but only through a **request/grant** shape, at 4 Hz, advisory:

- Selene may raise a `hazeDensityRequest ∈ [0, 0.4]` (capped, haze only — continuous-duty, no heater).
- Selene may **never** address `fire_*` or `emission_gate`. There is no code path. The channels are not in any L0/L1 allow-list.
- `spark`/`pyro`/`fire` remain **cue-only**: Chronos timeline or an explicit operator action, both L2/L3.

This gives the show organic haze that breathes with the set, and keeps every ignition source behind a human decision.

---

## 4. Implementation Blueprint

### Phase 0 — Safety commit
`git commit -am "chore: safety snapshot before WAVE 7737 laser/FX integration"`

### Phase 1 — The Type Trinity (no behaviour change)

**1.1 `types/FixtureDefinition.ts`** — add 10 literals to `ChannelType`:
```
// ── BEAM GEOMETRY (WAVE 7737) ──
| 'scale_x' | 'scale_y' | 'rot_x' | 'rot_y'
// ── SAFETY INTERLOCK ──
| 'emission_gate'
// ── ATMOSPHERE ──
| 'smoke_pump' | 'smoke_density' | 'fan_speed' | 'fire_valve' | 'fire_ignite'
```
Extend `DerivedCapabilities` with `hasLaserGeometry`, `hasAtmosphere`, `hasPyro`, `hasEmissionGate`; derive them in `deriveCapabilities`.
Add `'galvo'` to `IForgePhysics.motorType`.

**1.2 `core/arbiter/types.ts`** — mirror the 10 literals. Extend `DEFAULT_MERGE_STRATEGIES` (all LTP) and `CHANNEL_CATEGORY_MAP`. Add `'atmosphere'` to `ChannelCategory` (`scale_*`/`rot_*` → `'beam'`; the five atmosphere + `emission_gate` → `'atmosphere'`).

**1.3 `core/aether/types.ts`** — mirror the 10 in `AetherChannelType`. Add `'laser'` to `AtmosphereType`. **`NodeFamily` is NOT extended — there is no LASER family.**

*Gate: `tsc --noEmit` must pass. Exhaustive `Record<ChannelType, …>` maps will fail loudly until every table is updated — this is the type system doing our migration audit for us.*

### Phase 2 — Admittance & Extraction

**2.1 `core/forge/cellTypeAdmittance.ts`**
```
scale_x, scale_y, rot_x, rot_y   → [BEAM]
emission_gate                    → [ATMOSPHERE]           // quarantine-only
smoke_pump, smoke_density        → [ATMOSPHERE]
fan_speed                        → [ATMOSPHERE]
fire_valve, fire_ignite          → [ATMOSPHERE]           // quarantine-only
```
Single-family lists are deliberate: the operator physically cannot drag `fire_ignite` into an IMPACT cell where Omniliquid would find it.

**2.2 `core/aether/ingestion/NodeExtractionPipeline.ts`**
- `BEAM_CHANNEL_TYPES` += `scale_x, scale_y, rot_x, rot_y`
- `ATMOSPHERE_CHANNEL_TYPES` += the 5 atmosphere literals + `emission_gate`
- New `HARD_SAFETY_CHANNEL_TYPES = { emission_gate, fire_valve, fire_ignite }`; force `defaultValue = 0` at build time regardless of profile JSON.
- `_mapAtmosphereType`: `case 'laser': return 'laser'` (was `'spark'`).
- Remove `'laser'` from `ATMOSPHERE_FIXTURE_TYPES` — a laser now yields IMPACT/KINETIC/BEAM/COLOR nodes plus a residual interlock node, via the standard Forge multicell path.

### Phase 3 — The Quarantine (the safety-critical phase)

**3.1 `core/aether/adapters/LiquidAetherAdapter.ts`** — replace `Object.values(NodeFamily)` with the explicit `L0_DRIVEN_FAMILIES` allow-list (COLOR, IMPACT, KINETIC, BEAM). **Do this before Phase 4.**

**3.2 `core/aether/systems/index.ts`** — deregister `AtmosphereSystem` from the L0 list.

**3.3 New `core/aether/atmosphere/AtmosphereCueDriver.ts`** — re-host the existing per-type logic and safety gates verbatim; run on `ATMOS_DIVIDER = 11` (4 Hz); emit into L2/L3; add the 2 s deadman. Align emitted keys to real literals: `output`→`smoke_pump`, `density`→`smoke_density`, `fan_speed`→`fan_speed`.

**3.4 `types/FixtureDefinition.ts` + `core/aether/resolver/DMXGovernorEvaluator.ts`** — add `'emission' | 'fire' | 'smoke'` to `GovernorIntentType`; ship the three default fail-closed rules in the stock laser/fog/fire profiles.

**3.5 `core/aether/resolver/NodeResolver.ts`** — add `HARD_SAFETY_CHANNELS` to the blackout path; these zero unconditionally on L4.

### Phase 4 — Resolution & Egress

**4.1 `NodeResolver`** — the 4 BEAM geometry channels resolve through the standard normalized→DMX path (no special casing). `emission_gate` and `fire_*` bypass dithering (discrete channels; dithering on an ignition channel is a defect).

**4.2 `hal/mapping/FixtureMapper.ts`** — add explicit `case` branches in `buildDynamicChannels` for all 10. Critically, `emission_gate`/`fire_valve`/`fire_ignite` must **not** fall through to the `phantomChannels[customName]` default — they read only from an explicit armed-cue source, defaulting to 0.

### Phase 5 — LaserPhysics Integration

**5.1** Instantiate the existing `laserPhysics` singleton in the tick pipeline; feed it `ultraAir`/`clarity`/`texture`/`lowMid`/`energy` from the GodEarFFT frame already in `FrameContext`.

**5.2** New thin `LaserAetherAdapter` (L0) that maps `LaserPhysicsResult` onto the cell channels per §2.5 — targeting **existing** primitives (`dimmer`, `speed`, `tilt_offset`, `scale_x/y`, `gobo`). It emits to nodes whose device has `capabilities.hasLaserGeometry`.

**5.3 Retina Guard** — `horizonPosition` becomes a per-node `tiltCeiling` consumed alongside `TILT_ARBITER_MIN/MAX` in the arbiter's kinetic clamp. `safetyTriggered === true` forces `emission_gate → 0` through the governor.

### Phase 6 — Forge UI (no paradigm change)

**6.1 `FixtureForgeEmbedded.tsx`** — two new `FUNCTION_PALETTE` categories:
- **`LASER FX`**: `scale_x`, `scale_y`, `rot_x`, `rot_y`, `emission_gate` *(plus documentation that Galvo X/Y = drag `pan`/`tilt`, Pattern = drag `gobo`)*
- **`ATMOSPHERE`**: `smoke_pump`, `smoke_density`, `fan_speed`, `fire_valve`, `fire_ignite`

`getSmartDefaultValue`: `scale_x`/`scale_y` → 128; `rot_x`/`rot_y` → 0; all safety channels → **0**.

**6.2 `ForgeGeneralTab.tsx`** — extend `getChannelCategory` and `CATEGORY_COLORS` (`LASER FX` → `#00ff88`, `ATMOSPHERE` → `#6b7280`).

**6.3 `ForgeAetherCellsTab.tsx`** — no structural change; the 5 cells are unchanged. Add a **red warning badge** on ATMOSPHERE cells containing any `HARD_SAFETY_CHANNEL_TYPES`, reading *"Quarantined — manual/cue only, never AI-driven."*

### Phase 7 — Verification

- `tsc --noEmit` → 0 errors.
- **Regression:** existing moving-head/par/wash shows must be byte-identical. The only pre-existing behaviour intentionally changed is that ATMOSPHERE leaves L0 — which was a silent no-op anyway (§3.2), so DMX output should be unchanged.
- **Safety tests (new spec):**
  1. `LiquidAetherAdapter` emits zero intents for ATMOSPHERE nodes.
  2. `fire_ignite` stays 0 under max audio energy for 60 simulated seconds.
  3. Blackout zeroes `emission_gate`/`fire_valve`/`fire_ignite`.
  4. Deadman: 2 s of cue silence drives all safety channels to 0.
  5. `safetyTriggered` forces `emission_gate` to 0 within one 4 Hz cue frame.
- **Golden profile:** ship the 12-channel laser of §2.2 as a library fixture and assert it decomposes into exactly 5 nodes with the documented channel ownership.

---

## 5. Summary of Contradictions

| Your assumption | My position |
|---|---|
| Lasers need `laser_x` / `laser_y` | **No.** They need `pan`/`tilt`. This is the whole ballgame — it hands you VMM, IK, galvo physics, the radar, and WAVE 7734 for free. |
| Lasers need `laser_power` / `laser_strobe` / `laser_color` / `laser_speed` | **No.** `dimmer` / `strobe` / `color_wheel` / `speed`. Inherit Grand Master, blackout, strict-priority, Mover Shield. |
| Lasers need `laser_pattern` / `laser_rot_z` | **No.** A pattern bank is a `gobo`; in-plane spin is `gobo_rotation`. Inherit BeamSystem + DarkSpin. |
| We need a 6th `LASER` NodeFamily | **No.** A laser is a multicell fixture, exactly like the Tungsten. PT1 §2 already sanctioned this pattern. |
| `smoke_fan` and `fan_speed` are distinct | **No.** One primitive; node context disambiguates. |
| The AtmosphereSystem just needs its intent keys aligned | **Dangerously incomplete.** Aligning keys without demoting the layer would arm the AI to drive fog and pyro at 44 Hz. Key alignment and L0 exclusion must land in the same commit. |
| 18 new primitives | **10.** Nine are renames; one (`emission_gate`) I am adding that you did not ask for, because a laser interlock must not be overloaded onto `shutter`. |

**The measure of success is that after this wave, `NodeResolver`, `NodeArbiter`, `VibeMovementManager`, and the `InverseKinematicsEngine` contain the word "laser" exactly zero times** — and yet lasers work. That is what "Aether Agnostic" means: the engine reasons about families and physical verbs, never about device marketing categories.

---

*End of blueprint. No code modified. Awaiting approval for WAVE 7737 implementation.*
