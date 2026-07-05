# WAVE 7128 — Canonical Vibe Mapping & Experimental Purge

**Date:** 2026-07-03  
**Author:** Chief Systems Architect  
**Status:** COMPLETE  

---

## 0. Purge Summary

- **Deleted:** `electron-app/src/core/arsenal/builtins/chill-lounge/boreal_ocean.lfx` — the experimental .lfx clip that bypassed the engine.
- **No bypass logic found in code:** The `.lfx` file was a standalone clip in the arsenal catalog. No hardcoded injection, no forced playback, no bypass logic was added to `TitanEngine.ts`, `TickEngine.ts`, or any other module to auto-trigger this clip on vibe selection. The system is clean.
- **Other "boreal" references in codebase:** All pre-existing (aurora borealis comments in `colorConstitutions.ts`, `WaveformLayer.tsx`, `nodeGraphPresets.ts`, `ContextualEffectSelector.ts`). Untouched.

---

## 1. Canonical Frame Lifecycle at 44Hz

The frame loop is driven by `TickEngine.tick()` (`src/core/orchestrator/tick/TickEngine.ts:171`), called by a `FrameScheduler` at ~44Hz. Here is the complete chain:

### Phase 0 — Audio Ingestion (`TickEngine.ts:216-502`)

1. **Brain → MusicalContext:** `this.brain.getCurrentContext()` produces key, mode, energy, BPM, section type, syncopation, mood.
2. **Audio metrics:** `audioPipeline.lastAudioData` provides bass/mid/high/energy/subBass/lowMid/highMid/ultraAir/spectralCentroid/spectralFlatness/kickDetected/etc.
3. **Phantom buffer override:** If Chronos is playing, heatmap values replace raw audio (`TitanEngine.ts:530-570`).
4. **Beat detection:** Worker BPM + PLL flywheel produce `beatState` (bpm, phase, beatCount, onBeat, confidence).
5. **Engine audio metrics assembled:** `engineAudioMetrics` object with all bands + beat info.

### Phase 1 — TitanEngine.update() (`TitanEngine.ts:507-1353`)

This is the main brain of the engine. It receives `MusicalContext` + `EngineAudioMetrics` and produces a `LightingIntent`.

#### Step 1: Stabilization Layer (`TitanEngine.ts:636-693`)

| Stabilizer | Window | Output |
|---|---|---|
| `EnergyStabilizer` | Rolling 2s | `smoothedEnergy`, `rawEnergy`, `isRelativeDrop`, `isRelativeBreakdown` |
| `KeyStabilizer` | Buffer 12s, lock 10s | `stableKey` |
| `MoodArbiter` | Buffer 10s, lock 5s | `stableEmotion` (BRIGHT/DARK/NEUTRAL), `thermalTemperature` |
| `StrategyArbiter` | Rolling 15s | `stableStrategy` (analogous/complementary/triadic/split-complementary) |

#### Step 2: SeleneColorEngine — Palette Generation (`TitanEngine.ts:695-804`)

**Where the constitution is consulted:**

```
TitanEngine.ts:758
  → getColorConstitution(vibeProfile.id)     // colorConstitutions.ts:497
  → returns GenerationOptions for the vibe
```

**How the palette is generated:**

```
TitanEngine.ts:787
  → this.colorInterpolator.update(audioAnalysis, isDrop, constitution)
    → SeleneColorEngine.generate(audioAnalysis, constitution)    // SeleneColorEngine.ts:~1000
      → 1. baseHue from musical key + mode
      → 2. moodDrift applied (currently FORCED NEUTRAL — WAVE 2791)
      → 3. applyThermalGravity(finalHue, atmosphericTemp, thermalGravityStrength)
      → 4. Constitutional Hue Enforcement (WAVE 144):
           - hueRemapping
           - forbiddenHueRanges → Elastic Rotation
           - allowedHueRanges → Snap to nearest
      → 5. Saturation + Lightness calculated
      → 6. Anti-Mud Protocol (WAVE 81)
      → 7. Strategy applied (analogous/triadic/complementary) to derive secondary/tertiary/accent hues
      → Output: SelenePalette { primary, secondary, accent, ambient, contrast, meta }
```

**Conversion to protocol palette:**

```
TitanEngine.ts:794
  → selenePaletteToColorPalette(selenePalette)    // ColorProcessors.ts:86
  → ColorPalette { primary, secondary, accent, ambient }  // 4 colors — contrast is DISCARDED
```

**Constitution enforcement (WAVE 4755):** If `constitution.forceStrategy` is set (e.g., `CHILL_CONSTITUTION.forceStrategy = 'analogous'`), the StrategyArbiter CANNOT override it. The constitution is supreme.

#### Step 3: NervousSystem — Physics Evaluation (`TitanEngine.ts:806-879`)

```
TitanEngine.ts:837
  → this.nervousSystem.updateFromTitan(vibeContext, palette, audioMetrics, elementalMods)
    → SeleneLux.ts (the "nervous system")
      → For chill: LiquidEngine71.applyBands() with morphFactorOverride from ChillAmbientEngine
      → For techno: TechnoStereoPhysics (legacy) OR LiquidEngine71 (if liquidStereo enabled)
      → For latina: LatinoStereoPhysics (legacy) OR LiquidEngine71
      → For rock: RockStereoPhysics2 (legacy) OR LiquidEngine71
      → Output: SeleneLuxOutput {
          zoneIntensities: { front, back, frontL, frontR, backL, backR, mover, moverL, moverR },
          physicsApplied: 'liquid-stereo' | 'techno' | 'latino' | 'rock' | 'chill',
          mechanics: { moverL: {pan,tilt}, moverR: {pan,tilt} } | undefined,
          palette: ColorPalette,
          strobeActive, laserResult, washerResult, ...
        }
```

#### Step 4: Zone Intent Construction (`TitanEngine.ts:881-956`)

The `LightingIntent.zones` map is built. Each zone gets an intensity (0-1) and a `paletteRole` that selects which color from the palette to use:

| Zone | paletteRole | Color used |
|---|---|---|
| `frontL` / `frontR` | `primary` | Palette primary |
| `backL` / `backR` | `accent` | Palette accent |
| `left` (movers) | `secondary` | Palette secondary |
| `right` (movers) | `ambient` | Palette ambient |
| `front` (legacy mono) | `primary` | Palette primary |
| `back` (legacy mono) | `accent` | Palette accent |
| `ambient` | `ambient` | Palette ambient |

**This mapping is STATIC and identical for all vibes.** No vibe-specific color-to-zone routing exists.

#### Step 5: Movement Generation (`TitanEngine.ts:960-990`)

Two paths:

**Path A — Mechanics Bypass (chill path):**
```
if (nervousOutput.mechanics) {
  → buildMechanicsBypassIntent(mech.moverL, mech.moverR)    // MovementGenerators.ts:182
  → Output: MovementIntent with mechanicsL/R = { pan, tilt } [0,1]
  → VMM is NOT called
}
```

**Path B — VMM (standard reactive path):**
```
else {
  → generateStereoMovement(vibeId, audio, musical)    // MovementGenerators.ts:156
    → vibeMovementManager.generateIntent(vibeId, context, fixtureIndex=0, total=2, gearboxSpeed)
    → vibeMovementManager.generateIntent(vibeId, context, fixtureIndex=1, total=2, gearboxSpeed)
    → Output: MovementIntent with x/y coordinates, pattern, speed, amplitude
}
```

#### Step 6: Effects + Consciousness (`TitanEngine.ts:992-1126`)

- `EffectManager` processes active effects (manual strikes, AI-triggered effects).
- `SeleneTitanConscious.process()` generates consciousness decisions (color modifications, physics modifiers, effect decisions).
- Effects are HTP-blended (Highest Takes Precedence) into the master intensity.

#### Step 7: LightingIntent Assembled (`TitanEngine.ts:1128-1353`)

The final `LightingIntent` object contains:
- `palette`: 4-color `ColorPalette` (possibly modified by consciousness)
- `masterIntensity`: 0-1 global dimmer
- `zones`: `ZoneIntentMap` with intensity + paletteRole per zone
- `movement`: `MovementIntent` (VMM or mechanics bypass)
- `effects`: active effect overlays
- `optics`: zoom/focus/iris defaults

This `LightingIntent` is returned to `TickEngine.tick()`.

---

### Phase 2 — Aether Pipeline (`TickEngine.ts:504-1200`)

After `engine.update()` returns the `LightingIntent`, the TickEngine runs the Aether pipeline:

#### Step 1: L0 — Liquid Aether Adapter (`TickEngine.ts:990-1003`)
```
liquidAetherAdapter.ingest(liqFrame, liqResult, _aetherBus)
```
Reads the last frame from the active LiquidEngine and writes dimmer/intensity intents to the `_aetherBus` at **L0 (priority 10)**.

#### Step 2: System Adapters (`TickEngine.ts:1005-1063`)
- **ImpactAdapter:** Processes IMPACT family nodes (dimmer envelopes from liquid result).
- **ColorAdapter:** Receives the 4-color palette from `engine.getLastColorPalette()` and writes RGB intents to COLOR family nodes at **L0**.
- **KineticAdapter:** Processes KINETIC family nodes — reads VMM output from `intent.movement` and writes pan/tilt intents at **L0**.
- **BeamAdapter:** Processes BEAM family nodes (gobos, prisms, zoom, focus).
- **AtmosphereAdapter:** Processes ATMOSPHERE family nodes (fog, haze, fan).

#### Step 3: Mechanics Bypass Override (`TickEngine.ts:1028-1051`)
For chill: if `intent.movement.mechanicsL/R` exist, they are injected as **absolute pan/tilt intents at priority 50** (overriding L0 KineticAdapter output). Source is `'selene-bypass'` with `mergeStrategy: 'LTP'`.

#### Step 4: L3 — Selene Aether Adapter (`TickEngine.ts:1066-1082`)
```
seleneAetherAdapter.ingest(consciousnessOutput, effectOutput, deltaMs, _effectBus)
```
Translates consciousness decisions (effect triggers, color decisions, physics modifiers) into L3 intents on the `_effectBus`. L3 dominates L0/L1 via the **Anti-Sangrado Shield** (WAVE 4829).

#### Step 5: L2 — Manual Overrides
The `aetherKineticEngine.tick()` writes manual pattern pan/tilt at **L2**. Manual L2 overrides from the Programmer UI are already in the Arbiter's `_manualOverrides` map. L2 dominates L0/L1 but is dominated by L3 in dominated channels.

#### Step 6: Arbitration (`TickEngine.ts:1124-1131`)
```
aetherArbiter.setSystemIntents(_aetherBus)      // L0
aetherArbiter.setEffectIntents(_effectBus)      // L3
aetherArbiter.arbitrate()
→ Output: ArbitratedNodeMap (Map<nodeId, Record<channel, value>>)
```

The Arbiter applies the priority hierarchy:
1. **L3 (effect/hephaestus)** — dominates via Anti-Sangrado Shield
2. **L2 (manual)** — operator authority
3. **L1 (chronos)** — timeline playback
4. **L0 (system)** — base engine output

#### Step 7: Physics Post-Processor (`TickEngine.ts:1133-1140`)
Applies inertia smoothing to KINETIC nodes.

#### Step 8: Aether Safety Middleware (`TickEngine.ts:1142-1156`)
- **Phase 0:** Output gate (mute if `outputEnabled=false`)
- **Phase 1:** Velocity clamp, airbag, DarkSpin (inside NodeResolver)
- **Phase 2:** Universe throttle (30Hz for OpenDMX, passthrough for Enttec Pro/ArtNet)

#### Step 9: NodeResolver (`TickEngine.ts:1158-1184`)
```
aetherResolver.resolve(arbitrated)
→ Translates ArbitratedNodeMap → Uint8Array(512) per universe
→ Applies IK (InverseKinematicsEngine) for spatial targets
→ Applies safety middleware (velocity clamp, airbag, DarkSpin)
→ Applies Forge compiled graphs (per-device custom logic)
```

#### Step 10: DMX Egress (`TickEngine.ts:1200-1270`)
For each universe, if `aetherSafety.shouldSendUniverse()` passes:
- Read `Uint8Array(512)` from `aetherResolver.getUniverseBuffer()`
- Write to SharedArrayBuffer (SAB) for the HAL driver to read at its own pace

---

## 2. Detailed Subsystem Analysis

### A. Physics (LiquidEngine / HAL)

**Standard reactive vibe (e.g., techno-club):**

1. `SeleneLux.updateFromTitan()` is called with audio metrics + palette.
2. If `useLiquidStereo` is true: `LiquidEngine71.applyBands(input)` processes 7-band spectral envelopes.
3. If false: legacy physics engine runs (e.g., `TechnoStereoPhysics.apply()`).
4. LiquidEngine71 produces:
   - `frontLeftIntensity`, `frontRightIntensity`, `backLeftIntensity`, `backRightIntensity`
   - `moverLeftIntensity`, `moverRightIntensity`
   - `strobeActive`
5. These are stored in `this.liquidStereoOverrides` and returned as `zoneIntensities` in the `SeleneLuxOutput`.
6. The `LiquidAetherAdapter` (L0) reads `liquidEngine.lastFrame` and `liquidEngine.lastResult` and writes dimmer intents to the Aether bus.

**Key files:**
- `src/hal/physics/LiquidEngine71.ts` — 7-band stereo envelope engine
- `src/core/reactivity/SeleneLux.ts` — NervousSystem coordinator
- `src/core/aether/adapters/LiquidAetherAdapter.ts` — L0 bridge

### B. Color (SeleneColorEngine)

**Full chain:**

1. `getColorConstitution(vibeId)` retrieves the `GenerationOptions` for the active vibe (`colorConstitutions.ts:497`).
2. `SeleneColorEngine.generate(audioAnalysis, constitution)` produces a 5-color `SelenePalette`:
   - `primary` — base hue from musical key + mode, constrained by constitution
   - `secondary` — derived from strategy (analogous: ±30°, complementary: +180°, triadic: +120°)
   - `accent` — further derivation
   - `ambient` — muted version
   - `contrast` — high contrast version (DISCARDED in conversion)
3. `selenePaletteToColorPalette()` converts to 4-color `ColorPalette` (HSL 0-360 → 0-1 normalization).
4. TitanEngine stores palette in `this.state.lastPalette`.
5. `SeleneLux` includes the palette in its output as `output.palette`.
6. `TickEngine` reads `this.engine.getLastColorPalette()` and passes it to `colorAdapter.setIngress()`.
7. `ColorAdapter.process()` writes RGB values to COLOR family nodes in the Aether bus at L0.
8. The `NodeResolver._translateColor()` converts RGB → DMX channels (either RGB mixing or color wheel translation via BabelFish).

**Constitution enforcement points:**
- **In SeleneColorEngine.generate():** `forbiddenHueRanges` (Elastic Rotation), `allowedHueRanges` (Snap to nearest), `forceStrategy`, `atmosphericTemp` (Thermal Gravity), `saturationRange`, `lightnessRange`.
- **In VibeManager.constrainColor():** Post-hoc clamping of temperature, saturation, and strategy. Rarely invoked in the hot path.
- **In EffectManager:** `CHILL_LOUNGE_ALLOWED_EFFECTS` is an empty array — all external effects are blocked in chill-lounge (CHILL SHIELD TOTAL).

**Key files:**
- `src/engine/color/SeleneColorEngine.ts` — palette generator (2400+ lines)
- `src/engine/color/colorConstitutions.ts` — 5 constitutions (idle, techno, latina, rock, chill)
- `src/engine/color/ColorProcessors.ts` — pure conversion + consciousness application
- `src/core/aether/adapters/ColorAdapter.ts` — L0 color bridge to Aether

### C. Movement (VibeMovementManager)

**Standard reactive path:**

1. `generateStereoMovement(vibeId, audio, musical)` calls `vibeMovementManager.generateIntent()` for left (index=0) and right (index=1) movers.
2. VMM uses `VIBE_CONFIG[vibeId]` to determine:
   - `panScale`, `tiltScale` — amplitude of movement
   - `baseFrequency` — speed of oscillation
   - `patterns` — array of allowed patterns (e.g., `scan_x`, `square`, `diamond`)
   - `homeOnSilence` — whether to return to center on silence
3. VMM advances phase using `smoothedBPM` and `chillSedationFactor` (for chill).
4. Output: `MovementIntent { x, y }` in normalized [-1, 1] coordinates.
5. `assembleStereoMovementIntent()` packages into protocol `MovementIntent` with `centerX`, `centerY`, `mechanicsL/R`.
6. In TickEngine, `KineticAdapter.process()` reads the movement intent and writes pan/tilt to KINETIC nodes at L0.
7. `NodeResolver` converts pan/tilt to DMX values (with IK if spatial targets exist, or classic coarse/fine channel mapping).

**Mechanics bypass path (chill):**

1. `ChillAmbientEngine.tick()` produces `moverL/R: { pan, tilt }` as normalized [0, 1] Lissajous coordinates.
2. These are stored in `SeleneLux.deepFieldMechanics`.
3. `SeleneLux` returns them in `nervousOutput.mechanics`.
4. `TitanEngine` sees `nervousOutput.mechanics` is defined → calls `buildMechanicsBypassIntent()` instead of VMM.
5. In TickEngine, the mechanics bypass block (`TickEngine.ts:1028-1051`) writes absolute pan/tilt at priority 50, overriding L0 KineticAdapter.

**Key files:**
- `src/engine/movement/VibeMovementManager.ts` — pattern generation, phase advancement
- `src/engine/generators/MovementGenerators.ts` — pure module wrapping VMM calls
- `src/core/aether/adapters/KineticAdapter.ts` — L0 kinetic bridge to Aether
- `src/hal/physics/ChillAmbientEngine.ts` — stateless chill movement generator

---

## 3. Chillout Integration Diagnosis

### Where ChillAmbientEngine injects into the canonical chain

| Chain Point | Injection | What it does |
|---|---|---|
| **A. Physics** | `SeleneLux.ts:610` — `chillAmbientEngine.tick()` | Produces `morphFactor` (→ LiquidEngine71 override), `dimmer` (→ dimmer override), `frontL/R/backL/R` (→ liquidStereoOverrides override), `moverL/R` (→ deepFieldMechanics) |
| **B. Color** | **NOWHERE** | ChillAmbientEngine does NOT inject into SeleneColorEngine. Color is generated by SeleneColorEngine using `CHILL_CONSTITUTION` (cyan/blue/magenta, 8500K thermal gravity). |
| **C. Movement** | `SeleneLux.ts:679-682` — `deepFieldMechanics` populated from `chillFrame.moverL/R` | Lissajous coordinates stored. Then `TitanEngine.ts:967-970` sees `nervousOutput.mechanics` → calls `buildMechanicsBypassIntent()`. Then `TickEngine.ts:1028-1051` injects at priority 50, overriding L0 KineticAdapter. |

### Why ChillAmbientEngine is disconnected from SeleneColorEngine

**ChillAmbientEngine produces NO color output.** Its `ChillAmbientFrame` interface contains only:
- `morphFactor` (float 0.20-0.80)
- `dimmer` (float 0.20-0.80)
- `frontL`, `frontR`, `backL`, `backR` (float 0.10-0.60) — **intensities only, not colors**
- `moverL`, `moverR` — `{ pan, tilt }` positions

Color flows exclusively through:
```
TitanEngine.ts:758 → getColorConstitution('chill-lounge') → CHILL_CONSTITUTION
TitanEngine.ts:787 → SeleneColorEngine.generate(audioAnalysis, constitution) → SelenePalette
TitanEngine.ts:794 → selenePaletteToColorPalette() → ColorPalette (4 colors)
TickEngine.ts:1014 → colorAdapter.setIngress(palette) → ColorAdapter.process() → L0 Aether bus
```

ChillAmbientEngine has no hook into this chain. It only controls **intensity** and **movement**, not hue/saturation/lightness.

### Why ChillAmbientEngine is disconnected from VibeMovementManager

**ChillAmbientEngine bypasses VMM entirely.** The decision point is in `TitanEngine.ts:967`:

```typescript
if (nervousOutput.mechanics) {
  // MECHANICS BYPASS: La física manda, VMM calla
  movement = buildMechanicsBypassIntent(mech.moverL, mech.moverR);
} else {
  // Sin mechanics: Delegar al VMM
  movement = generateStereoMovement(vibeId, audio, musical);
}
```

For chill-lounge, `SeleneLux` always populates `deepFieldMechanics` (line 679), which means `nervousOutput.mechanics` is always defined, which means **VMM is never called for chill-lounge**. The Lissajous coordinates from ChillAmbientEngine replace VMM output completely.

Then in TickEngine, the mechanics bypass block (line 1028) injects these coordinates at priority 50, which overrides the L0 KineticAdapter (priority 10) that would normally read VMM output.

### Summary of chill-lounge integration gaps

1. **Color is fully connected** — SeleneColorEngine generates the palette using `CHILL_CONSTITUTION` (oceanic cyan/blue/magenta). The palette reaches all zones via the static `paletteRole` mapping. **No gap here.**

2. **Movement is intentionally bypassed** — ChillAmbientEngine replaces VMM via the mechanics bypass. This is by design (WAVE 6055). The Lissajous coordinates are injected at priority 50 in the Aether. **No gap here, but VMM is dormant for chill.**

3. **Intensity is overridden** — ChillAmbientEngine's "La Ola" wave replaces LiquidEngine71's zone intensities for `frontL/R/backL/R` (line 671-678). Mover intensities still come from LiquidEngine71. **Partial override — mover intensity is still audio-reactive.**

4. **Effects are blocked** — `CHILL_LOUNGE_ALLOWED_EFFECTS` is empty. The CHILL SHIELD blocks all external effects. **Chill is self-contained.**

5. **ChillLoungeProfile contradicts CHILL_CONSTITUTION** — The VibeProfile says warm/naranja (2800K, hue 0-60 + 300-360), the Constitution says cold/azul (8500K, hue 180-260 + 290-320). The Constitution wins in practice. **This is a known inconsistency, not a functional gap.**

---

## 4. Architecture Diagram (Text)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         TickEngine.tick() @ 44Hz                         │
│                                                                          │
│  1. Brain → MusicalContext                                               │
│  2. AudioPipeline → EngineAudioMetrics                                   │
│  3. await TitanEngine.update(context, audio)                             │
│     │                                                                    │
│     ├─ Stabilization (Energy/Key/Mood/Strategy)                          │
│     ├─ getColorConstitution(vibeId) ──→ CHILL_CONSTITUTION               │
│     ├─ SeleneColorEngine.generate(audio, constitution)                   │
│     │   └─→ SelenePalette (5 colors) → ColorPalette (4 colors)           │
│     ├─ SeleneLux.updateFromTitan(vibe, palette, audio)                   │
│     │   ├─ [CHILL] ChillAmbientEngine.tick()                             │
│     │   │   └─→ morphFactor, La Ola (frontL/R/backL/R), Lissajous        │
│     │   ├─ LiquidEngine71.applyBands(input with morphOverride)           │
│     │   │   └─→ zoneIntensities, strobeActive                            │
│     │   │   └─→ [CHILL] La Ola overrides frontL/R/backL/R                │
│     │   └─ Output: SeleneLuxOutput                                       │
│     │       ├─ zoneIntensities                                           │
│     │       ├─ mechanics: { moverL/R } (CHILL only)                      │
│     │       └─ palette: ColorPalette                                     │
│     │                                                                    │
│     ├─ Zone Intent Construction                                          │
│     │   └─→ zones = { front: {primary}, back: {accent}, ... }            │
│     │                                                                    │
│     ├─ Movement Generation                                               │
│     │   ├─ [CHILL] buildMechanicsBypassIntent(moverL, moverR)            │
│     │   └─ [OTHER]  generateStereoMovement() → VMM.generateIntent()      │
│     │                                                                    │
│     ├─ Consciousness (SeleneTitanConscious.process())                    │
│     └─ → LightingIntent { palette, zones, movement, effects, optics }    │
│                                                                          │
│  4. Aether Pipeline                                                      │
│     ├─ L0: LiquidAetherAdapter.ingest() → dimmer intents                 │
│     ├─ L0: ImpactAdapter.process() → impact nodes                        │
│     ├─ L0: ColorAdapter.process() → RGB to COLOR nodes                   │
│     ├─ L0: KineticAdapter.process() → pan/tilt to KINETIC nodes          │
│     ├─ [CHILL] Mechanics Bypass → pan/tilt @ priority 50                 │
│     ├─ L0: BeamAdapter, AtmosphereAdapter                                │
│     ├─ L3: SeleneAetherAdapter.ingest() → effect/color/strobe            │
│     ├─ L2: AetherKineticEngine.tick() → manual patterns                  │
│     ├─ L1: ChronosAetherAdapter.ingest() → timeline                      │
│     │                                                                    │
│     ├─ NodeArbiter.arbitrate() → ArbitratedNodeMap                       │
│     │   └─ Priority: L3 > L2 > L1 > L0 (Anti-Sangrado Shield)            │
│     │                                                                    │
│     ├─ PhysicsPostProcessor → inertia on KINETIC                         │
│     ├─ AetherSafetyMiddleware → output gate, velocity clamp, airbag      │
│     ├─ NodeResolver.resolve() → Uint8Array(512) per universe             │
│     │   └─ IK, BabelFish color wheel, Forge graphs                       │
│     │                                                                    │
│     └─ DMX Egress → SharedArrayBuffer → HAL Driver                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Key File Reference

| File | Role |
|---|---|
| `src/core/orchestrator/tick/TickEngine.ts` | Frame loop driver, Aether pipeline orchestrator |
| `src/engine/TitanEngine.ts` | Main engine: stabilization, color, physics, movement, consciousness |
| `src/engine/color/SeleneColorEngine.ts` | Procedural palette generator (5 colors, constitutional enforcement) |
| `src/engine/color/colorConstitutions.ts` | 5 vibe constitutions (GenerationOptions) |
| `src/engine/color/ColorProcessors.ts` | Pure conversion SelenePalette → ColorPalette + consciousness application |
| `src/core/reactivity/SeleneLux.ts` | NervousSystem: physics engine dispatch, zone intensity calculation |
| `src/hal/physics/LiquidEngine71.ts` | 7-band stereo envelope engine (primary physics for all vibes) |
| `src/hal/physics/ChillAmbientEngine.ts` | Stateless chill-only engine: morph, La Ola, Lissajous movers |
| `src/engine/movement/VibeMovementManager.ts` | Pattern-based movement generation (scan_x, square, diamond, etc.) |
| `src/engine/generators/MovementGenerators.ts` | Pure module: generateStereoMovement + buildMechanicsBypassIntent |
| `src/core/aether/NodeArbiter.ts` | Multi-layer intent arbitration (L0/L1/L2/L3) with Anti-Sangrado Shield |
| `src/core/aether/adapters/LiquidAetherAdapter.ts` | L0 bridge: LiquidEngine → Aether bus |
| `src/core/aether/adapters/ColorAdapter.ts` | L0 bridge: ColorPalette → COLOR nodes |
| `src/core/aether/adapters/KineticAdapter.ts` | L0 bridge: VMM movement → KINETIC nodes |
| `src/core/aether/egress/AetherSafetyMiddleware.ts` | Safety: output gate, velocity clamp, airbag, DarkSpin |
| `src/engine/vibe/VibeManager.ts` | Vibe profile management, constrainColor() |
| `src/engine/vibe/profiles/ChillLoungeProfile.ts` | Chill-lounge VibeProfile (contradicts constitution) |

---

## 6. Acceptance Criteria

- [x] `boreal_ocean.lfx` deleted from arsenal catalog.
- [x] No bypass/injection logic found in codebase — system is clean.
- [x] Architecture document generated describing the canonical frame lifecycle (A: Physics, B: Color, C: Movement).
- [x] Chillout integration diagnosis included with exact injection points and disconnection analysis.
