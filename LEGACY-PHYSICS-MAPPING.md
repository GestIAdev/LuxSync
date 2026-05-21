# LEGACY-PHYSICS-MAPPING.md
## Forensic Inventory of Legacy Effect Generation Logic
### LuxSync Lighting Engine — WAVE 770–WAVE 4824 Archive

> **Purpose:** Pure data extraction. No migration code. No rewriting.
> This document inventories every mathematical waveform, phase-offset strategy, physical parameter mapping, timing model, and hardcoded special-case found in the legacy effect generation codebase.

---

## 1. MASTER DICTIONARY OF MATHEMATICAL WAVEFORMS

### 1.1 Core Oscillators (BaseEffect.ts)

| Name | Formula | Output Range | Usage |
|------|---------|--------------|-------|
| **Sine Pulse** | `(sin(phase * 2π) + 1) / 2` | 0 → 1 | Breathing, dimmer modulation, organic fade |
| **BPM Pulse** | `sin(elapsedMs / (60000/BPM) * 2π)` | -1 → 1 | Beat-synced LFO for all effect categories |
| **Square Pulse** | `sin(phase) > 0 ? 1 : 0` | 0 or 1 | Strobe gating, binary on/off decisions |
| **Linear Ramp** | `elapsedMs / durationMs` | 0 → 1 | Progress tracking, simple fade |
| **Exponential Decay** | `pow(1 - progress, curve)` | 1 → 0 | Decay phases, release envelopes |
| **Power Curve** | `pow(progress, exponent)` | 0 → 1 | Attack shaping (exponent < 1 = fast, > 1 = slow) |
| **Sine² Edge** | `pow(1 - normalizedDist, 2)` | 0 → 1 | Soft blade edges (AcidSweep volumetric falloff) |

### 1.2 Strobe Oscillators

| Name | Formula | Frequency | Used By |
|------|---------|-----------|---------|
| **Strict 15Hz** | `pos = elapsedMs % 66; isOn = pos < 33` | 15 Hz (66ms cycle) | IndustrialStrobe, CoreMeltdown, NeonBlinder |
| **Frame-Guaranteed Toggle** | `accumulator += deltaMs; while (acc >= halfPeriod) { acc -= halfPeriod; state = !state }` | configurable | CoreMeltdown (fixes missed toggles at 14Hz) |
| **Seeded Random Strobe** | `interval = baseInterval * (seededRandom(seed) * 0.6 + 0.7)` | 2–12 Hz variable | FeedbackStorm |
| **Accumulator Strobe** | `pos = elapsedMs % strobePeriodMs; intensity = pos < (period/2) ? max : 0` | configurable | IndustrialStrobe, NeonBlinder |

### 1.3 Color Interpolation

| Name | Formula | Used By |
|------|---------|---------|
| **HSL Lerp** | `h = h1 + (h2-h1)*t; s = s1 + (s2-s1)*t; l = l1 + (l2-l1)*t` | ThunderStruck (warmWhite → amber) |
| **RGBWA Lerp** | `ch = peak*intensity + decay*(1-intensity)` | SolarFlare (peak → decay color) |
| **HSL → RGB** | Standard conversion via `hslToRgb()` | TechnoStereoPhysics |
| **Hue Shift** | `hue = baseHue - progress * deltaHue` | VoidMist (270 → 220) |
| **Luminosity Modulation** | `l = baseL * (0.4 + intensity * 0.6)` | AcidSweep peak scaling |

---

## 2. MOVEMENT PATTERNS — THE GOLDEN DOZEN

### 2.1 Pattern Catalog (VibeMovementManager.ts)

| Pattern | X Formula | Y Formula | Phase Offset | Description |
|---------|-----------|-----------|--------------|-------------|
| **scan_x** | `sin(phase * 2π)` | `0` | `index * π / total` | Horizontal sweep, stereo split by index |
| **square** | `sign(sin(phase * 2π))` | `sign(cos(phase * 2π))` | none | Quantized corners |
| **diamond** | `sin(phase * 2π) * abs(cos(phase * 2π))` | `cos(phase * 2π) * abs(sin(phase * 2π))` | none | Lissajous diamond |
| **botstep** | `floor(phase * 4) / 3` (staircase) | same | `index * 0.25` | Quantized 4-step sweep |
| **figure8** | `sin(phase * 2π)` | `sin(phase * 4π)` | none | Lissajous 1:2 ratio |
| **wave_y** | `0` | `sin(phase * 2π)` | none | Vertical pendulum |
| **ballyhoo** | `sin(phase * 2π) * (1 + 0.3*phase)` | `cos(phase * 2π) * (1 + 0.3*phase)` | `index * 2π / total` | Expanding spiral |
| **random_walk** | Seeded perlin-like | Seeded perlin-like | fixture seed | Chaotic but deterministic |
| **chase** | `phase * 2 - 1` | `0` | `index / total` | Linear chase across fixtures |
| **cross** | `sin(phase * 2π)` | `sin(phase * 2π + π/2)` | none | Diagonal cross |
| **circle** | `sin(phase * 2π)` | `cos(phase * 2π)` | none | Perfect circle |
| **star** | `sin(phase * 2π) ^ 3` | `cos(phase * 2π) ^ 3` | none | Astroid curve |

### 2.2 Phase Offset Strategies

| Strategy | Formula | Applied To |
|----------|---------|------------|
| **Fixture Index** | `offset = index * (2π / total)` | scan_x, ballyhoo, chase, botstep |
| **Stereo Split** | `left = phase; right = phase + π` | L/R mover pairs |
| **Zone Derivation** | `offset = beatPhase * 2π * multiplier` | VoidMist (deterministic from beatPhase) |
| **Random Seed** | `seed = fixtureId + floor(elapsedMs / 100)` | FeedbackStorm chaotic movement |
| **BPM Phase** | `phase = (elapsedMs / beatPeriod) * 2π + offset` | All BPM-synced patterns |

---

## 3. PHYSICAL PARAMETERS CONTROLLED

### 3.1 Parameter Map

| Parameter | Type | Range | Controlled By | Merge Strategy |
|-----------|------|-------|---------------|----------------|
| **Dimmer** | Override | 0.0 – 1.0 | All effects | HTP (max) or LTP (replace) |
| **Pan** | Movement | -1.0 – 1.0 | VibeMovementManager, effect.movement | LTP absolute / additive offset |
| **Tilt** | Movement | -1.0 – 1.0 | VibeMovementManager, effect.movement | LTP absolute / additive offset |
| **Color (HSL)** | Override | h:0-360, s:0-100, l:0-100 | All effects | LTP replacement |
| **Red** | Zone Override | 0.0 – 1.0 | TechnoStereoPhysics, RGB effects | Max or replace |
| **Green** | Zone Override | 0.0 – 1.0 | TechnoStereoPhysics, RGB effects | Max or replace |
| **Blue** | Zone Override | 0.0 – 1.0 | TechnoStereoPhysics, RGB effects | Max or replace |
| **White** | Override | 0.0 – 1.0 | SolarFlare, TropicalPulse, NeonBlinder | HTP additive |
| **Amber** | Override | 0.0 – 1.0 | SolarFlare, TropicalPulse | HTP additive |
| **Zoom** | — | — | Not directly mapped in legacy effects | Future parameter |
| **Strobe Rate** | Override | Hz | IndustrialStrobe, CoreMeltdown | Max frequency wins |
| **Movement Speed** | Meta | 0.0 – 1.0 | BaseEffect | Scales pattern frequency |

### 3.2 Pan/Tilt Normalization

```
Pan:  -1.0 = 0°,   0.0 = 180°,   1.0 = 360°
Tilt: -1.0 = -90°, 0.0 = 0°,     1.0 = +90°
```

**Absolute mode:** Effect values replace physics entirely (`isAbsolute: true`).
**Offset mode:** Effect values sum to physics (`isAbsolute: false`).

---

## 4. TIMING & FREQUENCY HANDLING

### 4.1 BPM Sync Model

| Element | Formula | Notes |
|---------|---------|-------|
| **Ms per Beat** | `60000 / bpm` | Base unit for all BPM-synced effects |
| **Sweep Duration** | `msPerBeat * beatsPerSweep` | AcidSweep, ThunderStruck |
| **Cycle Duration** | `msPerBeat * beatsPerCycle` | CyberDualism |
| **Flash Duration** | `msPerBeat * beatsPerFlash` | ThunderStruck |
| **Total Duration** | `msPerBeat * beatsTotal` | FeedbackStorm |

### 4.2 Fixed Frequency Strobes

| Effect | Frequency | Cycle Math | Duty Cycle |
|--------|-----------|------------|------------|
| IndustrialStrobe | 15 Hz | `66ms period; pos < 33ms = ON` | 50% |
| CoreMeltdown | 15 Hz | `66ms period; pos < 33ms = ON` | 50% |
| NeonBlinder | 15 Hz | `66ms period; pos < 33ms = ON` | 50% (strobe phase only) |
| FeedbackStorm | 2–12 Hz variable | `interval = 1000 / freq / 2` | 50% with ±30% random variation |

### 4.3 Envelope Timing

| Effect | Attack | Sustain | Decay | Release | Total |
|--------|--------|---------|-------|---------|-------|
| SolarFlare | build: `1500ms` (pow 2.4 × 0.6) | flash: `300ms` @ 100% | decay: `2000ms` (pow 1.7) | — | ~3800ms |
| TropicalPulse | preDuck: `50ms` | flash: `70ms` × 3 | gap: `35ms` × 3 | release: `60ms` (quadratic) | ~500ms |
| ThunderStruck | attack: `10%` of flash (pow 0.3) | sustain: `40%` @ 95% | decay: `30%` (pow 0.5) | gap: `20%` @ 5% | max 3000ms |
| NeonBlinder | attack: `50ms` | strobe: `266ms` @ 15Hz | melt: `734ms` (exp -3×) | — | 1000ms |
| VoidMist | fade-in: `300ms` (linear) | sustain: `2400ms` | fade-out: `300ms` (linear) | — | 3000ms |

### 4.4 Safety Limits

| Limit | Value | Enforced By |
|-------|-------|-------------|
| Max Strobe Frequency | 10–15 Hz | IndustrialStrobe (10Hz), CoreMeltdown (15Hz) |
| Min Cooldown | 100–150 ms | IndustrialStrobe (150ms between bursts) |
| Max Effect Duration | 3000–8000 ms | ThunderStruck (3000ms), FeedbackStorm (8000ms) |
| Anti-Epilepsy | Hard cap at 15 Hz | All strobe effects |

---

## 5. PER-EFFECT FORENSIC BREAKDOWN

### 5.1 TECHNO Genre

#### IndustrialStrobe (`industrial_strobe`)
```
PHASE MACHINE:
  preDuck (80ms) → flash1 (60ms) → gap1 (55ms) → flash2 (40ms) → gap2 (45ms) → flash3 (40ms) → gap3 (55ms) → flash4 (40ms)

OSCILLATOR: Strict 15Hz during active window
  pos = activeElapsed % 66
  isFlashOn = pos < 33

SPECTRAL MODES:
  acidMode  = harshness > 0.6 → color = {h:180, s:100, l:70}   (Cyan)
  noiseMode = flatness  > 0.7 → color = {h:300, s:100, l:75}   (Magenta)
  default   → color = {h:0,   s:0,   l:100}                    (White)

MIX BUS: global (dictator)
ZONES: ['front', 'back', 'all-movers', 'all-pars']
```

#### CoreMeltdown (`core_meltdown`)
```
STROBE: Frame-guaranteed toggle at 15Hz
  halfPeriod = 500 / 15 = 33.33ms
  accumulator += deltaMs
  while (accumulator >= halfPeriod) { accumulator -= halfPeriod; state = !state }

COLOR ALTERNATION:
  pos = elapsedMs % 66
  isWhite = pos < 33
  color = isWhite ? White : NuclearMagenta

ZONES: ALL_ZONES (front, all-pars, back, all-movers, movers-left, movers-right)
BLEND: 'replace' (absolute override)
MIX BUS: global
ONE-SHOT: true
DURATION: 4200ms
```

#### AcidSweep (`acid_sweep`)
```
SWEEP MATH:
  sweepPos = direction ? sweepPhase : (1 - sweepPhase)
  zonePos  = zoneIndex / (numZones - 1)
  distance = abs(zonePos - sweepPos)
  
  if (distance < bladeWidth) {
    intensity = pow(1 - (distance / bladeWidth), 2)
  } else {
    intensity = 0
  }

PEAK FLASH: zoneIntensity > 0.95 → color switches to White
LUMINOSITY: baseL * (0.4 + scaledIntensity * 0.6)

BPM SYNC: actualDuration = (60000 / bpm) * beatsPerSweep
MIX BUS: htp
```

#### CyberDualism (`cyber_dualism`)
```
CYCLE MACHINE:
  cyclePhase += deltaMs / actualCycleDurationMs
  if (cyclePhase >= 1) {
    currentSide = !currentSide
    currentCycle++
    flashActive = true
  }
  flashActive = (cyclePhase * duration) < flashDurationMs

TARGETING:
  activeZone = currentSide === 'left' ? 'movers-left' : 'movers-right'
  darkZone   = currentSide === 'left' ? 'movers-right' : 'movers-left'

CHROMATIC MODE:
  left  = {h:180, s:100, l:70} (Cyan)
  right = {h:300, s:100, l:70} (Magenta)
STROBE MODE:
  both = White

MIX BUS: global
```

#### VoidMist (`void_mist`)
```
PARS BREATHING:
  parPeriod = 1000 / 0.25Hz = 4000ms
  breathPhase = (elapsedMs / parPeriod) * 2π + zonePhaseOffset
  breathPulse = (sin(breathPhase) + 1) / 2
  dimmer = (minIntensity + breathPulse * (maxIntensity - minIntensity)) * envelope * triggerIntensity

ZONE PHASE OFFSETS (deterministic from beatPhase):
  front:        beatPhase * 2π
  all-pars:     (beatPhase + 0.33) * 2π
  back:         (beatPhase + 0.66) * 2π
  movers-left:  beatPhase * 1.5π
  movers-right: (beatPhase + 0.5) * 1.5π

MOVERS: Color latched to Deep Purple {h:270, s:100, l:12}
  No pan/tilt — static obelisks
  Dimmer modulated by separate sine at 0.3Hz

COLOR TRANSITION: hue = 270 - progress * 50 (Purple → Midnight Blue)
MIX BUS: global
```

#### NeonBlinder (`neon_blinder`)
```
TWO-PHASE STRUCTURE:
  Phase 1 (0–266ms): STROBE @ 15Hz
    pos = elapsedMs % 66
    dimmer = pos < 33 ? 1.0 : 0
    color = strobeColor (matches flashColor)
  
  Phase 2 (266–1000ms): COLOR MELT
    meltProgress = (elapsedMs - 266) / (1000 - 266)
    dimmer = exp(-3 * meltProgress)
    color = flashColor

COLOR SELECTION (by trigger intensity):
  > 0.85: Blood Red     {h:0,   s:100, l:50}
  > 0.60: Magenta       {h:300, s:100, l:55}
  else:   Electric Cyan {h:185, s:100, l:55}

MOVERS: Color latched to flashColor, pan=0 (front), tilt=0 (horizontal)
MIX BUS: global, ONE-SHOT: true
```

### 5.2 LATINO Genre

#### SolarFlare (`solar_flare`)
```
ADSR ENVELOPE:
  BUILD:  intensity = pow(progress, 2.4) * 0.6   (0→60%, 1500ms)
  FLASH:  intensity = 1.0                         (100%, 300ms)
  DECAY:  intensity = pow(1 - progress, 1.7)     (exponential fall, 2000ms)

COLOR: RGBWA interpolation peak → decay
  Peak:  {R:255, G:200, B:80,  W:255, A:255}  (Golden)
  Decay: {R:255, G:60,  B:0,   W:0,   A:180}  (Warm Red)
  
  t = intensityScaled
  rgbwa = peak * t + decay * (1 - t)

OVERRIDES:
  dimmerOverride: intensityScaled
  whiteOverride: 1.0 (sustain) or (white/255)*intensity (decay)
  amberOverride: (amber/255)*intensity

ZONES: triggerConfig.zones || ['all']
MIX BUS: htp
ONE-SHOT: true
```

#### TropicalPulse (`tropical_pulse`)
```
STATE MACHINE:
  preDucking (50ms) → flash (70ms) → gap (35ms) → flash → gap → flash → gap → finale (45ms) → release (60ms)

COLOR ROTATION:
  stormColors = [Orange(16°), Turquoise(174°), Magenta(300°)]
  currentColor = stormColors[currentFlash % 3]
  finaleColor = Gold(45°)

RELEASE CURVE:
  releaseProgress = phaseTimer / releaseMs
  intensity = (1 - releaseProgress) ^ 2

FADE DYNAMICS (WAVE 1090):
  fadeIn:  (elapsed / fadeInMs) ^ 1.5
  fadeOut: ((duration - elapsed) / fadeOutMs) ^ 1.5

MIX BUS: global
```

### 5.3 POP-ROCK Genre

#### ThunderStruck (`thunder_struck`)
```
FLASH STRUCTURE (per flash, BPM-synced):
  attack:  10% of flashDuration — intensity = pow(progress, 0.3)    (explosive)
  sustain: 40% — intensity = 0.95 + sin(progress * π) * 0.05       (wobble)
  decay:   30% — intensity = (1 - pow(progress, 0.5)) * 0.95       (exponential)
  gap:     20% — intensity = 0.05                                    (near-black)

BACK vs FRONT:
  backIntensity  = flashIntensity (100%)
  frontIntensity = max(0, flashIntensity - 0.15) (syncopated delay)

COLOR TRANSITION (decay only):
  warmWhite {h:40, s:15, l:95} → amber {h:35, s:85, l:55}

MOVERS: Static, tilt=0.7 (down to audience)
MIX BUS: global, ONE-SHOT: true
```

#### FeedbackStorm (`feedback_storm`)
```
INTENSITY ENVELOPE:
  progress < 0.05:  intensity = pow(progress/0.05, 0.3) * 0.9
  progress < 0.85:  intensity = 0.85 + (seededRandom(seed) * 0.2 - 0.1)
  else:             intensity = 0.85 * (1 - pow(decayProgress, 0.5))
  final = intensity * (0.3 + harshness * 0.7)

STROBE (random, non-rhythmic):
  baseFreq = 4Hz * (0.5 + harshness * 1.5)
  interval = 1000 / freq / 2
  variation = seededRandom(seed) * 0.6 + 0.7  (±30%)
  toggle when elapsed >= interval * variation

CHAOTIC MOVEMENT (seeded, per-axis):
  seed = seedBase + timeSeed * prime
  pan/tilt = (seededRandom(seed) * 2 - 1) * amplitude * harshnessScaling

SEED GENERATOR: mulberry32
  t = seed + 0x6D2B79F5
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296

MIX BUS: global
```

---

## 6. LEGACY PHYSICS ENGINES (Pre-LiquidEngine)

### 6.1 TechnoStereoPhysics (`hal/physics/_legacy_archive/TechnoStereoPhysics.ts`)

**Status:** Deprecated WAVE 2488. Replaced by LiquidEngine41.

#### Zone Mapping
| Zone | Audio Band | Gate | Boost | Special Logic |
|------|-----------|------|-------|---------------|
| Front PAR | Bass | 0.50→0.30 (morph) | 3.0× | Velocity gate, Ignition Squelch, AGC rebound protection |
| Back PAR | Mid/Treble | 0.58→0.18 (morph) | 2.0→7.0× | Snare sniper, dynamic slapMult |
| Mover L | Mid (vocals) | 0.20 | 4.0× | The Body |
| Mover R | Treble (hats) | 0.14 | 8.0× | Schwarzenegger Mode |

#### Key Algorithms
```
MORPH FACTOR (liquid viscosity):
  avgMidProfiler = mid > avg ? avg*0.85 + mid*0.15 : avg*0.98 + mid*0.02
  morphFactor = clamp((avgMidProfiler - 0.30) / 0.40, 0, 1)

FRONT PAR (Kick Detection):
  velocity = punch - lastPunch
  isAttacking = velocity >= -0.005 || (wasAttacking && velocity >= -0.03)
  dynamicGate = avgPunchEffective + 0.02
  kickPower = pow((punch - dynamicGate) / requiredJump, crushExponent)
  crushExponent = 1.5 + 0.3 * (1 - morphFactor)

SIDECHAIN GUILLOTINE:
  if (frontPar > 0.1) {
    moverL *= 1.0 - (frontPar * 0.90)
    moverR *= 1.0 - (frontPar * 0.90)
  }

APOCALYPSE MODE:
  if (harshness > 0.55 && flatness > 0.55 && frontPar < 0.1) {
    backPar = max(backPar, chaosEnergy)
    movers = max(movers, chaosEnergy)
  }
```

### 6.2 LatinoStereoPhysics (`hal/physics/_legacy_archive/LatinoStereoPhysics.ts`)

**Status:** Deprecated WAVE 2488. Replaced by LiquidEngine71.

#### Zone Mapping
| Zone | Audio Band | Gate | Attack | Decay | Gain |
|------|-----------|------|--------|-------|------|
| Front PAR | Bass | 0.48 | 0.70 | — | 2.0× |
| Back PAR | Mid+Treble | 0.45 | 0.85 | 0.25 (heavy) | 5.0× |
| Mover (mono) | Mid - Treble×0.30 | 0.22 | 0.65 | 0.60 | 1.5× |
| Mover L | Mid pure | 0.28 | 0.65 | 0.25 (guillotine) | 1.5× |
| Mover R | Treble | 0.18 | 0.80 | 0.50 (liquid) | 4.0× |

#### Special Logic
```
MACHINE GUN BLACKOUT:
  trigger: energyDelta >= 0.4 && deltaTime <= 100ms && previousEnergy > 0.6
  action: dimmerOverride = 0 for 3 frames

SOLAR FLARE:
  trigger: bass > 0.55 && bassDelta > 0.08
  kickPower = (bass - threshold) / (1 - threshold)
  intensity = min(1.0, kickPower * 1.5)

WHITE PUNCTURE:
  trigger: justEnteredDrop
  dip: 2 frames @ 30% intensity
  flash: 1 frame @ 100% white

FAT BASS PEAK HOLD:
  frontParPeak tracks maximum bass with slow decay
```

### 6.3 RockStereoPhysics2 (`hal/physics/_legacy_archive/RockStereoPhysics2.ts`)

**Status:** Deprecated WAVE 2488. Replaced by LiquidEngine41.

#### Subgenre Detection
```
HARD_ROCK: centroid 1000-3000Hz, harshness > 0.20, clarity 0.7-0.95
PROG_ROCK: centroid 500-1500Hz, flatness < 0.05, clarity > 0.95, treble < 0.15

Hysteresis: 70% of 1800-frame window must agree to change subgenre
Minimum 600 frames (10s) between changes
```

#### Unified Zone Config
| Zone | Source Band | Gate | Decay | Gain |
|------|------------|------|-------|------|
| Front PAR | SubBass (20-80Hz) | 0.28 | 0.20 (fast pump) | 2.6× |
| Back PAR | Mid (500-2000Hz) | 0.05 | 0.75 (slow sustain) | 2.0× |
| Mover L | LowMid+HighMid | 0.10 | 0.65 | 1.8× |
| Mover R | Presence+Treble | 0.12 | 0.50 | 1.8× |

#### Special Logic
```
STEREO DIFFERENTIAL GATING:
  if (abs(L - R) < 0.20) {
    lowerChannel = 0  // force differential
  }

MoverRight DUAL-BAND (Prog Rock only):
  Uses Presence OR HighMid (detects buried solos)
```

### 6.4 ChillStereoPhysics (`hal/physics/_legacy_archive/ChillStereoPhysics.ts`)

**Status:** Deprecated. Oceanic metaphor engine.

#### Hydrostatic Depth Model
```
TIDE_CYCLE: 12 minutes
  tidePhase = (effectiveTime % 12min) / 12min
  tideWave = (1 - cos(tidePhase * 2π)) / 2
  targetDepth = tideWave * 10000m
  currentDepth = currentDepth * 0.992 + targetDepth * 0.008

DEPTH ZONES:
  SHALLOWS: 0–1000m    (Emerald Green)
  OCEAN:    1000–3000m (Tropical Blue)
  TWILIGHT: 3000–6000m (Indigo)
  MIDNIGHT: 6000–10000m (Bioluminescence)

COLOR PER ZONE:
  hue = baseHue + sin(now / 5000–8000) * 20–60
  sat = 65–85 + energy * 10–20
  lig = 25–55 + energy * 10–15

FLUID PHYSICS:
  Oscillators use prime-number denominators:
    oscL = sin(now/3659) + sin(now/2069)*0.25
    oscR = cos(now/3023) + sin(now/2707)*0.25
```

---

## 7. BLEND MODES & MIX BUSES

### 7.1 Mix Bus Types

| Bus | Behavior | Effects Using It |
|-----|----------|------------------|
| **htp** | High Takes Precedence. Effect sums with physics; brightest wins. | AcidSweep, SolarFlare, TropicalPulse |
| **global** | Dictator. Effect ignores physics completely; absolute replacement. | IndustrialStrobe, CoreMeltdown, CyberDualism, VoidMist, NeonBlinder, ThunderStruck, FeedbackStorm |

### 7.2 Blend Modes (per zoneOverride)

| Mode | Formula | Use Case |
|------|---------|----------|
| **max** (HTP) | `output = max(physics, effect)` | Energy additive (TropicalPulse, ClaveRhythm) |
| **replace** (LTP) | `output = effect` (ignores physics) | Spatial ducking, strict override (CyberDualism, TidalWave) |

### 7.3 Global Composition (WAVE 1080 Fluid Dynamics)

```
FinalOutput = (BasePhysics × (1 - α)) + (GlobalEffect × α)

Fade In:  α = (elapsed / fadeInMs) ^ 1.5
Fade Out: α = ((duration - elapsed) / fadeOutMs) ^ 1.5
```

---

## 8. SPECIAL HARDCODED LOGIC INVENTORY

### 8.1 One-Shot Effects (No Re-Trigger)

| Effect | Native Duration | Reason |
|--------|----------------|--------|
| CoreMeltdown | 4200ms | Nuclear event, must be unique |
| SolarFlare | ~3800ms | Peak moment, one-hit wonder |
| ThunderStruck | ~2000ms | Stadium blinder, single impact |
| NeonBlinder | 1000ms | Flash wall, single strike |
| GatlingRaid | — | Rapid-fire burst |
| MacheteSpark | — | Instant spark |

### 8.2 Spectral Reactive Modes

| Effect | Trigger | Acid Mode | Noise Mode |
|--------|---------|-----------|------------|
| IndustrialStrobe | `harshness > 0.6` | Cyan {h:180} | Magenta {h:300} |
| CoreMeltdown | always active | N/A | N/A (alternates white/magenta) |
| AcidSweep | `harshness > 0.6` | Toxic Green {h:120} | — |
| TechnoStereoPhysics | `harshness > 0.6` | acidMode flag | noiseMode flag |
| FeedbackStorm | `harshness` input | scales intensity | scales strobe freq |

### 8.3 Movement Suppression Rules

| Rule | Effect | Behavior |
|------|--------|----------|
| WAVE 2182 | VoidMist | Movers frozen; no pan/tilt; only dimmer breathes |
| WAVE 2690 | ThunderStruck | Movement PURGED; Selene paints photons only |
| WAVE 2690 | FeedbackStorm | Movement PURGED; chaotic pan/tilt removed from output |
| WAVE 985 | CyberDualism | Dimmer Lock: explicit 0 on dark side; no null returns |

### 8.4 Color Latching

| Effect | Latched Color | Applied To |
|--------|---------------|------------|
| VoidMist | Deep Purple {h:270, s:100, l:12} | Movers (both sides) |
| NeonBlinder | flashColor (by intensity tier) | Movers (all-movers zone) |
| ThunderStruck | Amber {h:35, s:85, l:55} | Movers (static) |

### 8.5 Safety & Limiters

| Limit | Value | Enforcer |
|-------|-------|----------|
| Max strobe frequency | 15 Hz | CoreMeltdown, IndustrialStrobe |
| Anti-epilepsy ceiling | 10 Hz | IndustrialStrobe (effective max) |
| Cooldown between bursts | 150 ms | IndustrialStrobe |
| Max total duration | 3000–8000 ms | ThunderStruck, FeedbackStorm |
| Front PAR ceiling | 0.80 (80%) | TechnoStereoPhysics FRONT_MAX_INTENSITY |
| Recovery gate (post-silence) | 0.80 on → 0.60 off, 2s window | TechnoStereoPhysics AGC rebound protection |

---

## 9. FILE REFERENCES

| File | Role | Key Extraction |
|------|------|----------------|
| `src/core/effects/BaseEffect.ts` | Abstract base | BPM pulse, sine pulse, phase helpers, color lerp, easing |
| `src/core/effects/EffectManager.ts` | Orchestration | Trigger validation, cooldown gating, vibe rules, overlay application |
| `src/chronos/core/EffectRegistry.ts` | Metadata catalog | All effect IDs, zones, strobe flags, dynamic flags, durations |
| `src/engine/movement/VibeMovementManager.ts` | Movement patterns | Golden Dozen waveforms, fixture phase offsets, stereo split |
| `src/core/effects/types.ts` | Type contracts | EffectFrameOutput, zoneOverrides, blend modes, movement overrides |
| `src/hal/physics/_legacy_archive/TechnoStereoPhysics.ts` | Techno physics | Gate math, slapMult, morph factor, AGC protection, sidechain |
| `src/hal/physics/_legacy_archive/LatinoStereoPhysics.ts` | Latino physics | Machine gun blackout, white puncture, fat bass, stereo split |
| `src/hal/physics/_legacy_archive/RockStereoPhysics2.ts` | Rock physics | Subgenre detection, unified zone config, differential gating |
| `src/hal/physics/_legacy_archive/ChillStereoPhysics.ts` | Chill physics | Hydrostatic depth, prime oscillators, oceanic triggers |

---

*Document generated from forensic code extraction.*
*All formulas are verbatim from source code. No approximations, no migrations, no rewrites.*
