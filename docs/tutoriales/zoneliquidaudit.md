Let me audit the `air` and `floor` zones in the physics engine.

Let me read the key sections in detail and find the profile/envelope definitions.

Now let me find the `routeZones` method and the profile/envelope definitions to understand how zones get their kinematic parameters.

Let me read the routeZones implementations and the profile interface to understand how `air`/`floor` are consumed downstream.

Now let me read the profile interface to understand the envelope parameter structure, and the techno profile to see what's defined for air/floor.

Now let me read the LiquidEnvelope config structure and the techno profile to see what envelope parameters exist.

Now let me check the techno profile to see if there are any air/floor-specific parameters defined, and check how `airIntensity`/`floorIntensity` are consumed downstream.

Let me check how `airIntensity`/`floorIntensity` are consumed in the aether adapter — that's the downstream consumer.

Now let me check the LaserPhysics.ts file to see if there's any existing laser-specific physics, and look at the bands structure to understand what audio features are available.

Now let me read the input interface and the bands structure to understand all available audio features.

Now let me check the GodEarPhoton to see what spectral features are available (spectralFlux, whiteNoiseScore, etc.).

Now I have the complete picture. Let me also check the techno profile's envelope configs to see the existing kinematic patterns I should match against.

I now have the complete picture. Let me compile the diagnostic report.

---

# 🔬 WAVE 7749.26 — DIAGNOSTIC REPORT: THE LASER DOMAIN (AIR & FLOOR KINEMATICS)

## EXECUTIVE SUMMARY

| Zone | Current State | Verdict |
|------|--------------|---------|
| **`air`** | Active but **soft** — EMA follower of (treble×0.6 + highMid×0.4) with ~8-frame attack, ~20-frame release, soft-compressed via `1 - e^(-x×3)`. Gated by AGC recovery. Boosted ×1.4. | **Wrong kinematics for a laser.** The EMA smoothing and soft compression produce a "haze" envelope, not a "light-saber" envelope. No zero-attack, no high-contrast. |
| **`floor`** | Active but **dumb** — instant (no envelope) linear mix of (subBass×0.65 + lowMid×0.35) × recoveryFactor. No gate, no decay shaping, no crush. | **Wrong identity.** It's a bass mirror, not a distinct zone. Fully overlaps `frontLeft` (envSubBass) and `frontRight` (envKick). Adds zero new vocabulary. |

**Neither zone uses a `LiquidEnvelope` instance.** Both are computed inline in `LiquidEngineBase.applyBands()` (lines 453-461 for air, lines 1067-1070 for floor) and passed through `routeZones()` as raw passthrough. They bypass the entire envelope pipeline (velocity gate, adaptive floor, dynamic gate, squelch, crush, decay morphology).

---

## 1. THE "AIR" ZONE AUTOPSY

### Current calculation
<ref_snippet file=".../hal/physics/LiquidEngineBase.ts" lines="453-461" />

```ts
// Air EMA: soft-compressed follower of (treble × 0.6 + highMid × 0.4)
const _airSignal = 1.0 - Math.exp(-(bands.treble * 0.60 + bands.highMid * 0.40) * 3.0)
if (_airSignal > this._airEMA) {
  this._airEMA = this._airEMA * 0.88 + _airSignal * 0.12   // attack ~8 frames
} else {
  this._airEMA = this._airEMA * 0.95 + _airSignal * 0.05   // release ~20 frames
}
```

Then at output (<ref_snippet file=".../hal/physics/LiquidEngineBase.ts" lines="1095-1097" />):
```ts
const airIntensity = Math.min(1.0, Math.max(0.0, this._airEMA * recoveryFactor * 1.4))
```

### What feeds it
- **`bands.treble`** (6-16kHz) — hi-hats, cymbals, sibilance, synth sparkle
- **`bands.highMid`** (2-6kHz) — snare crack, guitar presence, synth lead edge
- **`recoveryFactor`** — AGC rebound gate (0→1 over `RECOVERY_DURATION` after silence)

### Why it's wrong for a laser
1. **Soft compression** (`1 - e^(-x×3)`) flattens transients. A laser stab at treble=0.8 produces `_airSignal = 1 - e^(-2.4) = 0.909`, while ambient haze at treble=0.3 produces `1 - e^(-0.9) = 0.593`. The contrast ratio is only 1.53:1 — a laser needs >5:1.
2. **8-frame attack** (~180ms at 44Hz) — a laser arpeggio note is 50-150ms. The EMA doesn't even reach peak before the note ends. The laser would always look "late" and "smeared".
3. **20-frame release** (~450ms) — the laser glows for nearly half a second after the note. Not a "saber" — a "candle".
4. **No gate** — any treble > 0 lights the air zone. Hi-hats, reverb tails, even noise floor all trigger it. No threshold discrimination.
5. **No velocity detection** — the EMA tracks amplitude, not transients. A sustained synth pad at treble=0.5 produces the same air intensity as a sharp stab at treble=0.5.

### Mathematical sharpening strategy
To transform `air` into an aerial laser, we need to **replace the EMA with a `LiquidEnvelope` instance** (or an equivalent inline implementation) with these properties:

- **Zero attack**: `riseRate = 1.0` (instantaneous jump to peak — the saber ignites)
- **Fast decay**: `decayBase = 0.08` (same as envKick — ~45-65ms cutoff, the saber retracts)
- **High gate**: `gateOn = 0.35` (only sharp HF transients pass — hi-hats and reverb tails blocked)
- **High crush**: `crushExponent = 2.5` (convex curve — silence stays black, only peaks ignite)
- **High boost**: `boost = 4.0` (compensate for the high gate)
- **No squelch**: `squelchBase = 0.02` (let the gate do the work)
- **No ghost**: `ghostCap = 0.0` (absolute black between stabs)

The input signal should shift from the current `(treble×0.6 + highMid×0.4)` mix toward **treble-dominant** to isolate the laser's frequency domain from the snare's (highMid). Proposed: `(treble×0.8 + ultraAir×0.2)` — this pushes the air zone into the 6-22kHz range, above the snare's 2-6kHz body, making it spectrally distinct from `backRight` (envSnare).

---

## 2. THE "FLOOR" ZONE DISCOVERY

### Current calculation
<ref_snippet file=".../hal/physics/LiquidEngineBase.ts" lines="1067-1070" />

```ts
const floorIntensity = Math.min(1.0, Math.max(0.0,
  (bands.subBass * 0.65 + bands.lowMid * 0.35) * recoveryFactor
))
```

### Is it unmapped/bypassed?
**No — it's active, but it's a dumb passthrough.** There is:
- No `LiquidEnvelope` instance
- No gate (any subBass > 0 lights the floor)
- No decay shaping (instantaneous — follows the band value frame-by-frame)
- No crush exponent (linear response)
- No velocity detection (doesn't distinguish a kick onset from a continuous sub-bass drone)
- No squelch (no anti-sustain)

It is a **linear amplitude mirror** of the sub-bass + low-mid bands. It is **100% redundant** with `frontLeft` (envSubBass, which processes `bands.subBass` through a full envelope) — except worse, because `frontLeft` has gating, crush, and decay morphology, while `floor` has none.

### Why it overlaps with `back` and `front`
- **vs `frontLeft` (envSubBass)**: Both react to subBass. `frontLeft` has a gate (0.08), crush (1.0), decay (0.40+0.166×morph), and squelch. `floor` has none. When subBass=0.5, `frontLeft` might output 0.3 (after gate+crush+decay), while `floor` outputs 0.5×0.65 = 0.325 + lowMid contribution. They're ~identical.
- **vs `frontRight` (envKick)**: Both react to the bass region. `frontRight` has velocity-gated kick detection. `floor` doesn't — it lights on continuous sub-bass too.

### What should drive `floor` to make it distinct
The Architect's suggestion of **mid-high `spectralFlux` for synth arpeggios** or **rapid `bassDelta` derivation for ground-sweeping lasers** is the right instinct. The goal is to make `floor` the **ground-sweeping laser** — distinct from `air` (aerial laser, HF-driven) and from `back`/`front` (rhythmic/melodic).

**Proposed driver: `spectralFlux` gated by `bassDelta`**

The `spectralFlux` (available in `GodEarPhoton.spectralFlux`) measures spectral change rate — it spikes on any new note onset (arpeggio, stab, kick). The `bassDelta` (already computed at line 495) measures bass-region transient velocity.

Strategy:
- **Primary signal**: `spectralFlux` — fires on ANY new note, not just bass. This makes `floor` react to arpeggios and stabs that `frontLeft`/`frontRight` miss (they're band-specific).
- **Gate**: `bassDelta > 0.04` OR `spectralFlux > 0.15` — require either a bass transient OR a spectral change. This filters out ambient noise but allows non-bass notes (mid arpeggios) to sweep the floor.
- **Decay**: fast (0.12) — the floor laser sweeps and cuts, not holds.
- **Crush**: high (2.0) — only sharp onsets ignite the floor.

This makes `floor` the **"ground sweep"** — it fires on arpeggio notes and stabs, sweeping the floor lasers in a way that's visually distinct from the kick-driven `frontRight` and the sub-bass-driven `frontLeft`.

---

## 3. PROPOSED KINEMATIC MATRICES

### Architecture decision: `LiquidEnvelope` vs inline

Both `air` and `floor` currently bypass the `LiquidEnvelope` pipeline. The cleanest integration is to **add two new `LiquidEnvelope` instances** (`envAir`, `envFloor`) to `LiquidEngineBase`, with their configs exposed in `ILiquidProfile` as `envelopeAir` and `envelopeFloor` (optional, with fallback defaults). This:

- Reuses the entire velocity-gate + adaptive-floor + dynamic-gate + squelch + crush + decay pipeline
- Makes the zones profile-configurable (techno vs latino vs chill can tune them independently)
- Follows the existing architectural pattern (6 envelopes → 8 envelopes)
- Zero new abstraction, zero new classes

### Input signal matrices

| Zone | Input Formula | Spectral Target | Rationale |
|------|--------------|-----------------|-----------|
| **`air`** | `bands.treble × 0.8 + bands.ultraAir × 0.2` | 6-22kHz | Above snare body (2-6kHz), isolates HF sparkle/laser domain from `backRight` |
| **`floor`** | `max(spectralFlux × 0.7, bassDelta_normalized × 0.5)` | Onset-driven (any band) | Distinct from `frontLeft` (subBass amplitude) and `frontRight` (kick velocity) — reacts to spectral CHANGE, not amplitude |

### Envelope config matrices (fallback defaults)

#### `envelopeAir` — The Aerial Laser

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `gateOn` | **0.35** | High threshold — only sharp HF transients pass. Hi-hats (treble ~0.2-0.3) blocked. Laser stabs (treble > 0.5) ignite. |
| `boost` | **4.0** | Compensate for high gate. Effective gain = (signal - 0.35) × 4.0. |
| `crushExponent` | **2.5** | Convex — silence stays black, only peaks ignite. Contrast ratio >5:1. |
| `decayBase` | **0.08** | Fast cut — ~45-65ms decay. The saber retracts, no glow trail. Matches envKick's decay. |
| `decayRange` | **0.03** | Narrow morph range — laser identity is consistent across genres. |
| `maxIntensity` | **1.0** | Full brightness — lasers are binary (on/off), not dimmed. |
| `squelchBase` | **0.02** | Minimal — let the gate do the discrimination. |
| `squelchSlope` | **0.0** | No morph-dependent squelch — laser stays sharp in melodic modes too. |
| `ghostCap` | **0.0** | Absolute black between stabs. No subliminal glow. |
| `gateMargin` | **0.02** | Tight margin — fast response, no lag. |
| `riseRate` | **1.0** | Instantaneous attack — zero-attack is the laser identity. |
| `attackSlopeMin` | **0.02** | Require minimum velocity — filters out slow swells. Only stabs ignite. |

#### `envelopeFloor` — The Ground Sweep Laser

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| `gateOn` | **0.12** | Moderate — spectralFlux baseline is ~0.044 (normal) to 0.076 (buildup). Gate above baseline, below arpeggio onsets (0.15-0.40). |
| `boost` | **3.0** | Compensate for moderate gate. |
| `crushExponent` | **2.0** | Convex — only onset spikes sweep the floor. Continuous spectralFlux (buildup density) stays dark. |
| `decayBase` | **0.12** | Fast sweep — ~70ms decay. Slower than `air` (the ground sweep has a tiny trail), faster than `frontRight` (0.08, kick). |
| `decayRange` | **0.05** | Narrow — consistent sweep speed across genres. |
| `maxIntensity` | **0.90** | Near-full — slightly dimmer than `air` (floor lasers are less blinding than aerials). |
| `squelchBase` | **0.04** | Low — let the gate + crush discriminate. |
| `squelchSlope` | **0.0** | No morph-dependent squelch. |
| `ghostCap` | **0.0** | Absolute black between sweeps. |
| `gateMargin` | **0.015** | Tight — fast response to onsets. |
| `riseRate` | **1.0** | Instantaneous attack — zero-attack is the laser identity. |
| `attackSlopeMin` | **0.0** | No minimum velocity — spectralFlux already encodes velocity (it IS the change rate). |

### Spectral separation matrix

| Zone | Driver | Frequency Range | Temporal Identity |
|------|--------|----------------|-------------------|
| `frontLeft` | subBass amplitude | 20-60Hz | Continuous ocean |
| `frontRight` | bass velocity (kick) | 60-250Hz | Impulsive sniper |
| `backLeft` | mid cross-filter | 500-2000Hz | Synth pad |
| `backRight` | treble transient | 6-16kHz | Percussive whip |
| `moverLeft` | treble tonal gate | 6-16kHz | Melodic arpeggios |
| `moverRight` | vocal EQ | 500-2000Hz | Vocal wash |
| **`air`** (new) | **treble + ultraAir velocity** | **6-22kHz** | **Aerial laser stab** |
| **`floor`** (new) | **spectralFlux + bassDelta** | **Onset-driven (all bands)** | **Ground sweep laser** |
| `ambient` | subBass EMA | 20-60Hz | Slow breath |

**Zero overlap**: `air` is HF-velocity-only (above snare's 2-6kHz body, above moverL's tonal gate). `floor` is onset-driven (spectralFlux fires on ANY new note, not amplitude-specific). Neither shares a driver with any existing zone.

---

## 4. INTEGRATION TOUCHPOINTS (for the Architect's review)

### `LiquidEngineBase` changes needed
1. Add `private envAir: LiquidEnvelope` and `private envFloor: LiquidEnvelope` instances, initialized from `profile.envelopeAir` / `profile.envelopeFloor` (with fallback defaults).
2. Add `private _prevSpectralFlux: number = 0` for floor's bassDelta-independent flux tracking.
3. In `applyBands()`, after the existing envelope processing (line ~539), add:
   - `const airInput = bands.treble * 0.8 + bands.ultraAir * 0.2`
   - `const airOut = this.envAir.process(airInput, morphFactor, now, isBreakdown)`
   - `const flux = photon?.spectralFlux ?? 0`
   - `const floorInput = Math.max(flux * 0.7, Math.max(0, bassDelta) * 2.0)` (bassDelta × 2.0 to normalize the 0-0.12 range to 0-0.24)
   - `const floorOut = this.envFloor.process(floorInput, morphFactor, now, isBreakdown)`
4. Replace the inline `airIntensity` and `floorIntensity` calculations with `airOut` and `floorOut`.
5. In `reset()`, add `this.envAir.reset()` and `this.envFloor.reset()`.
6. In `setProfile()`, add `this.envAir.setConfig(profile.envelopeAir ?? DEFAULT_ENVELOPE_AIR)` etc.

### `ILiquidProfile` changes needed
Add two optional envelope configs:
```ts
readonly envelopeAir?: LiquidEnvelopeConfig
readonly envelopeFloor?: LiquidEnvelopeConfig
```
Optional with fallback defaults — existing profiles (techno, latino, poprock, chilllounge) don't need to define them unless they want to override the laser kinematics.

### `LiquidEngine41` / `LiquidEngine71` changes
**None.** Both already pass `floorIntensity` and `airIntensity` through from `ProcessedFrame` to `LiquidStereoResult`. The routeZones passthrough is already wired.

### `LaserPhysics.ts` — the existing standalone laser engine
There is a separate `LaserPhysics` class (WAVE 1031) that processes `ultraAir` + `clarity` + `texture` with its own Retina Guard safety system. This is a **different system** — it drives pan/tilt/beamWidth/scanSpeed for dedicated laser fixtures, not the zone intensity. The `air`/`floor` zone intensities feed into the `selectZoneFromResult()` zone→intensity map for **non-laser fixtures** assigned to the `air`/`floor` zones (hazers, uplights, aerials). The two systems are complementary, not conflicting — `LaserPhysics` handles laser fixture kinematics, `air`/`floor` zones handle the intensity envelope for fixtures assigned to those zones.

---

## CONFIDENCE

- **Air zone diagnosis**: High — the EMA + soft compression is plainly visible and mathematically incompatible with laser kinematics.
- **Floor zone diagnosis**: High — the inline linear passthrough is unambiguous and clearly redundant with `frontLeft`.
- **Proposed kinematic matrices**: Medium-high — the envelope parameters are derived from the existing `envKick` pattern (proven for impulsive response) with adjustments for the laser identity. The `floor` driver (spectralFlux + bassDelta) is novel but grounded in available photon data. The exact gate/boost/crush values will need Monte Carlo calibration against real tracks, but the proposed defaults are in the right ballpark.
- **Spectral separation**: High — the frequency ranges and temporal identities are cleanly orthogonal.

No code was modified or committed. Ready for Architect review.