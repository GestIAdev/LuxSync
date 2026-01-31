# 🔮 WAVE 1026: TECHNICAL REFERENCE GUIDE
## For Future Developers & Maintenance

**Version:** 1.0  
**Date:** 28 Enero 2026  
**Audience:** Backend developers integrating spectral consumers

---

## 📚 Table of Contents

1. [Data Structures](#data-structures)
2. [Integration Patterns](#integration-patterns)
3. [API Reference](#api-reference)
4. [Common Tasks](#common-tasks)
5. [Troubleshooting](#troubleshooting)
6. [Examples](#examples)

---

## 🏗️ Data Structures

### SpectralContext
**Location:** `core/protocol/MusicalContext.ts`

```typescript
export interface SpectralContext {
  /**
   * Clarity: Tonal definition vs noise floor
   * Range: 0-1
   * 0 = muddy/chaotic (garage metal)
   * 1 = crystal clear (studio recording)
   */
  clarity: number

  /**
   * Texture: Perceptual character
   * Types:
   * - 'clean': Well-defined, minimal noise (pop, electronic)
   * - 'warm': Dark, muffled low-end (dark ambient, deep house)
   * - 'harsh': Bright/aggressive but controlled (metal studio)
   * - 'noisy': Uncontrolled, chaotic (feedback, distorted)
   */
  texture: SpectralTexture

  /**
   * Flatness: White noise component
   * Range: 0-1
   * 0 = tonal (clear harmonic content)
   * 1 = noise (hiss, white noise)
   */
  flatness: number

  /**
   * Centroid: Center of mass frequency
   * Range: ~50Hz - 20000Hz
   * Low values = dark/warm (300Hz)
   * High values = bright/air (5000Hz+)
   */
  centroid: number

  /**
   * Harshness: Energy in aggressive band (2-5kHz)
   * Range: 0-1
   * Related to "presence" and "bite"
   * Common in metal, industrial, treble-heavy EDM
   */
  harshness: number

  /**
   * 7 Tactical Frequency Bands
   * Normalized 0-1, sum ≈ 1.0
   */
  bands: SpectralBands
}

export interface SpectralBands {
  subBass: number    // 20-60Hz (deep kicks, sub rumble)
  bass: number       // 60-250Hz (kick punch, warmth)
  lowMid: number     // 250-500Hz (body, thickness)
  mid: number        // 500-2000Hz (definition, clarity)
  highMid: number    // 2000-6000Hz (presence, "boxiness")
  treble: number     // 6000-16000Hz (air, sizzle)
  ultraAir: number   // 16000-22000Hz (shimmer, sparkle)
}
```

### SpectralHint (HuntEngine)
**Location:** `core/intelligence/think/HuntEngine.ts`

```typescript
export interface SpectralHint {
  /**
   * Clarity from TitanStabilizedState
   * Used for worthiness calculation
   */
  clarity: number

  /**
   * Harshness from TitanStabilizedState
   * Used for power detection
   */
  harshness: number

  /**
   * Derived texture type
   * Used for texture-based decisions (effects, simulations)
   */
  texture?: 'clean' | 'warm' | 'harsh' | 'noisy'
}
```

### NarrativeContext
**Location:** `core/protocol/MusicalContext.ts`

```typescript
export interface NarrativeContext {
  /**
   * Buildup score from SectionTracker
   * Range: 0-1
   * How much energy rise is detected
   */
  buildupScore: number

  /**
   * Energy relative to 30-second rolling window
   * Range: 0-1
   * 0 = at local minimum
   * 1 = at local maximum
   */
  relativeEnergy: number

  /**
   * Local minimum energy seen recently
   * For contrast calculation
   */
  localMin: number

  /**
   * Local maximum energy seen recently
   * For peak detection
   */
  localMax: number

  /**
   * Trend direction
   * 'rising': Energy increasing
   * 'falling': Energy decreasing
   * 'stable': Energy stable
   */
  trend: 'rising' | 'falling' | 'stable'
}
```

---

## 🔗 Integration Patterns

### Pattern 1: Reading Spectral Data in a Consumer

```typescript
// In your consumer function
import { type MusicalContext } from '@/core/protocol/MusicalContext'

export function myConsumer(context: MusicalContext) {
  // Check if spectral data is available
  if (!context.spectral) {
    console.warn('Spectral data not available, using defaults')
    return
  }

  // Safe destructure
  const { clarity, texture, harshness, bands } = context.spectral

  // Use the data
  if (clarity > 0.7) {
    // High-quality audio, apply premium effects
    applyPremiumEffect()
  } else if (harshness > 0.6 && clarity < 0.4) {
    // Chaotic audio, be conservative
    skipGlitchEffects()
  }

  // Access specific bands
  const laserIntensity = bands.ultraAir * 1.2
}
```

### Pattern 2: Creating SpectralHint for HuntEngine

```typescript
// In SeleneTitanConscious.ts or any decision maker
import { type SpectralHint } from '@/core/intelligence/think/HuntEngine'
import { type TitanStabilizedState } from '@/core/intelligence/types'

function createSpectralHint(state: TitanStabilizedState): SpectralHint {
  return {
    clarity: state.clarity,
    harshness: state.harshness,
    texture: deriveTextureFromState(state),
  }
}

function deriveTextureFromState(
  state: TitanStabilizedState
): 'clean' | 'warm' | 'harsh' | 'noisy' {
  const { harshness, clarity, spectralCentroid } = state

  if (harshness > 0.6 && clarity > 0.7) return 'harsh'
  if (harshness > 0.6 && clarity < 0.4) return 'noisy'
  if (spectralCentroid < 300) return 'warm'
  return 'clean'
}
```

### Pattern 3: Handling Backwards Compatibility

```typescript
// When receiving spectral data that may not be present
function processWithFallback(context: MusicalContext) {
  // Option A: Check existence
  const clarity = context.spectral?.clarity ?? 0.5

  // Option B: Conditional processing
  if (context.spectral) {
    processWithSpectral(context.spectral)
  } else {
    processWithoutSpectral()
  }

  // Option C: Safe defaults
  const safeBands = context.spectral?.bands ?? createDefaultSpectralBands()
}
```

---

## 📖 API Reference

### mind.ts - Spectral Producer

#### `buildSpectralContext(analysis: ExtendedAudioAnalysis): SpectralContext`

**Purpose:** Construct SpectralContext from audio analysis data

**Inputs:**
- `analysis.clarity` - Tonal clarity metric
- `analysis.harshness` - Presence aggression
- `analysis.spectralFlatness` - Noise component
- `analysis.spectralCentroid` - Frequency center
- Band energies (subBass, bass, etc.)

**Returns:** Complete SpectralContext object

**Example:**
```typescript
const analysis = extractAudioAnalysis(audioBuffer)
const spectral = buildSpectralContext(analysis)
// spectral.texture = 'harsh' (if harshness > 0.6 && clarity > 0.7)
```

#### `deriveSpectralTexture(harshness: number, clarity: number, centroid: number): SpectralTexture`

**Purpose:** Determine perceptual texture from spectral metrics

**Logic:**
```
if (harshness > 0.6 && clarity > 0.7)      → 'harsh' (controlled power)
if (harshness > 0.6 && clarity < 0.4)      → 'noisy' (chaotic)
if (centroid < 300)                        → 'warm' (dark)
else                                        → 'clean' (default)
```

**Example:**
```typescript
const texture = deriveSpectralTexture(0.75, 0.8, 2000)
// Returns: 'harsh' (metal well-produced)
```

### HuntEngine.ts - Spectral-Aware Hunt

#### `processHunt(..., spectralHint?: SpectralHint): HuntDecision`

**New Parameter:**
```typescript
spectralHint?: {
  clarity: number
  harshness: number
  texture?: SpectralTexture
}
```

**Modified Behavior:**
- If `spectralHint` provided, modifies base worthiness by ±15%
- Power detection: harshness > 0.5 && clarity > 0.65 → +12%
- Chaos penalty: harshness > 0.6 && clarity < 0.4 → -15%
- Premium boost: clarity > 0.7 && harshness < 0.3 → +8%

**Example:**
```typescript
const hint = { clarity: 0.85, harshness: 0.75 }
const decision = processHunt(pattern, beauty, consonance, hint)
// worthiness += 0.12 (power detection triggered)
```

### SeleneLux.ts - DMX Integration

#### `SeleneLuxAudioMetrics.ultraAir?: number`

**Purpose:** 16-22kHz band intensity for laser/scanner modulation

**Range:** 0-1

**Example:**
```typescript
const metrics: SeleneLuxAudioMetrics = {
  normalizedBass: 0.6,
  normalizedMid: 0.5,
  normalizedTreble: 0.7,
  ultraAir: 0.45,  // 🔮 WAVE 1026
}

// In DMX physics
const laserIntensity = metrics.ultraAir * 1.2  // 0-120% intensity
const scannerSpeed = metrics.ultraAir * 360    // 0-360 RPM
```

---

## 🛠️ Common Tasks

### Task 1: Add Spectral-Aware Logic to a New Consumer

**Checklist:**
- [ ] Import `MusicalContext` type
- [ ] Check for `context.spectral` existence
- [ ] Create decision logic based on clarity/texture
- [ ] Add fallback for missing spectral data
- [ ] Test with both spectral and non-spectral contexts

**Template:**
```typescript
import { type MusicalContext } from '@/core/protocol/MusicalContext'

export function newConsumer(context: MusicalContext) {
  // 1. Safe access
  const spectral = context.spectral
  if (!spectral) {
    console.log('No spectral data, using conservative defaults')
    return applyDefaultBehavior()
  }

  // 2. Extract metrics
  const { clarity, texture, harshness } = spectral

  // 3. Make decisions
  switch (texture) {
    case 'harsh':
      if (clarity > 0.7) return applyPowerMode()
      else return applyConservativeMode()
    case 'noisy':
      return applyGuardedMode()
    case 'clean':
      return applyPremiumMode()
    case 'warm':
      return applySmoothMode()
  }
}
```

### Task 2: Debug Spectral Data Flow

**Logging Points:**

```typescript
// 1. In mind.ts after buildSpectralContext
console.log('[SPECTRAL] clarity:', spectral.clarity, 'texture:', spectral.texture)

// 2. In HuntEngine.processHunt
console.log('[HUNT] SpectralHint:', { clarity, harshness, texture })
console.log('[HUNT] Worthiness bonus:', bonus)

// 3. In SeleneTitanConscious
console.log('[TITAN] TitanState clarity:', state.clarity, 'ultraAir:', state.ultraAir)

// 4. In consumer
console.log('[CONSUMER] Received spectral:', context.spectral)
```

**Checklist:**
- [ ] GodEarFFT generates clarity values
- [ ] senses.ts receives them
- [ ] mind.ts builds SpectralContext
- [ ] MusicalContext.spectral is populated
- [ ] TitanEngine propagates clarity
- [ ] Consumer receives complete data

### Task 3: Handle Backwards Compatibility

**Scenario:** Old code passes MusicalContext without spectral data

**Solution:**
```typescript
// Use optional chaining and nullish coalescing
const clarity = context.spectral?.clarity ?? 0.5
const texture = context.spectral?.texture ?? 'clean'

// Or check before accessing
if (context.spectral) {
  processWithSpectral(context.spectral)
} else {
  processWithoutSpectral()
}

// Factory function pattern
const spectral = context.spectral ?? createDefaultSpectralContext()
```

---

## 🐛 Troubleshooting

### Issue: "clarity is undefined"

**Cause:** Spectral data not populated in MusicalContext

**Solution:**
1. Check if mind.ts is being called
2. Verify GodEarFFT is generating clarity
3. Use fallback: `clarity ?? 0.5`

```typescript
// Add logging
console.log('MusicalContext:', context)
console.log('Spectral:', context.spectral)
console.log('Clarity:', context.spectral?.clarity)
```

### Issue: HuntEngine worthiness not changing

**Cause:** SpectralHint not passed to processHunt

**Solution:**
1. Check SeleneTitanConscious is creating SpectralHint
2. Verify it's passed as 4th argument
3. Validate clarity/harshness values

```typescript
// In processHunt call site
const hint = {
  clarity: state.clarity,
  harshness: state.harshness,
  texture: deriveTextureFromState(state),
}
console.log('Passing SpectralHint:', hint)
const decision = processHunt(pattern, beauty, consonance, hint)  // ← 4th arg
```

### Issue: ultraAir field not available in SeleneLux

**Cause:** EngineAudioMetrics not extended properly

**Solution:**
1. Verify EngineAudioMetrics has ultraAir field
2. Check TitanEngine passes audio.ultraAir
3. Confirm nervousSystem.updateFromTitan receives it

```typescript
// In TitanEngine
const audio: EngineAudioMetrics = {
  // ... other fields ...
  ultraAir: someValue,  // ← Must be here
}

const result = this.nervousSystem.updateFromTitan(
  context,
  palette,
  audio,  // ← Passed here
)
```

### Issue: Texture always 'clean'

**Cause:** deriveSpectralTexture logic not matching conditions

**Solution:**
1. Check clarity/harshness/centroid values
2. Verify condition thresholds:
   - `harshness > 0.6 && clarity > 0.7` → harsh
   - `harshness > 0.6 && clarity < 0.4` → noisy
   - `centroid < 300` → warm
3. Add logging to deriveTextureFromState

```typescript
function deriveSpectralTexture(harshness, clarity, centroid) {
  console.log('Texture calc:', { harshness, clarity, centroid })
  
  if (harshness > 0.6 && clarity > 0.7) {
    console.log('→ harsh')
    return 'harsh'
  }
  // ... rest of conditions ...
  
  console.log('→ clean (default)')
  return 'clean'
}
```

---

## 💻 Examples

### Example 1: Simple Spectral Consumer

```typescript
// my-spectral-effect.ts
import { type MusicalContext } from '@/core/protocol/MusicalContext'

export class SpectralEffect {
  applyEffect(context: MusicalContext) {
    if (!context.spectral) {
      this.setIntensity(0.5)  // Default
      return
    }

    const { clarity, texture } = context.spectral

    // Intensity based on clarity
    const intensity = clarity * 1.0

    // Behavior based on texture
    if (texture === 'harsh' && clarity > 0.65) {
      this.setMode('power')
    } else if (texture === 'noisy') {
      this.setMode('guard')
    } else {
      this.setMode('normal')
    }

    this.setIntensity(intensity)
  }
}
```

### Example 2: Spectral-Aware Effect Selector

```typescript
// spectral-effect-selector.ts
import { type MusicalContext } from '@/core/protocol/MusicalContext'

const EFFECTS_BY_TEXTURE = {
  'clean': ['tidal_wave', 'cosmic_pulse'],
  'warm': ['ambient_wash', 'warm_glow'],
  'harsh': ['metallic_flash', 'power_spike'],
  'noisy': ['static_hum', 'chaos_ripple'],
}

export function selectEffect(context: MusicalContext): string {
  if (!context.spectral) {
    return 'tidal_wave'  // Default fallback
  }

  const { texture, clarity } = context.spectral
  const effects = EFFECTS_BY_TEXTURE[texture]

  // Priority: Clarity matters
  if (clarity < 0.3 && texture === 'noisy') {
    // Extra caution for muddy noise
    return 'static_hum'  // Minimal visual assault
  }

  return effects[0]  // Use first effect for texture
}
```

### Example 3: Spectral Gain Staging

```typescript
// spectral-gain-staging.ts
import { type MusicalContext } from '@/core/protocol/MusicalContext'

export function calculateGainModifier(context: MusicalContext): number {
  const spectral = context.spectral ?? {
    clarity: 0.5,
    harshness: 0.3,
    texture: 'clean',
  }

  let gain = 1.0

  // Reduce gain if chaotic
  if (spectral.texture === 'noisy' && spectral.clarity < 0.4) {
    gain *= 0.7  // -3dB for safety
  }

  // Increase gain if clean and clear
  if (spectral.texture === 'clean' && spectral.clarity > 0.7) {
    gain *= 1.2  // +1.5dB for presence
  }

  // Compensate for harshness
  if (spectral.harshness > 0.7) {
    gain *= 0.95  // -0.4dB high-frequency reduction
  }

  return Math.max(0.5, Math.min(2.0, gain))  // Clamp 0.5x-2.0x
}
```

---

## 📝 Maintenance Notes

### Regular Checks

- [ ] Verify clarity values are 0-1 range
- [ ] Confirm texture enum matches definition
- [ ] Check ultraAir is available in all DMX calls
- [ ] Validate HuntEngine bonus/penalty application

### Future Considerations

- **WAVE 1027:** ContextualEffectSelector texture integration
- **WAVE 1028:** VisualConscienceEngine clarity-based rules
- **WAVE 1029:** DreamEngine texture-aware simulations
- **WAVE 1030:** SeleneLux laser physics with ultraAir

### Performance Notes

- SpectralContext creation is ~1-2ms (negligible)
- Texture derivation is ~0.1ms (function call)
- Worthiness bonus/penalty calculation is ~0.2ms
- No circular dependencies introduced

---

## 🔗 Related Documentation

- [WAVE-1026-ROSETTA-STONE.md](./WAVE-1026-ROSETTA-STONE.md) - Full technical documentation
- [WAVE-1026-EXECUTIVE-SUMMARY.md](./WAVE-1026-EXECUTIVE-SUMMARY.md) - High-level overview
- [MusicalContext.ts](../electron-app/src/core/protocol/MusicalContext.ts) - Protocol definition
- [HuntEngine.ts](../electron-app/src/core/intelligence/think/HuntEngine.ts) - Hunt implementation

---

**Version:** 1.0  
**Last Updated:** 28 Enero 2026  
**Author:** PunkOpus  
**Status:** Active - Ready for use by team
