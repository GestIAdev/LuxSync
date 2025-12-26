# 🕵️‍♂️ POP/ROCK STATUS AUDIT
## Investigation Report: Genre-Specific Logic Analysis

**Date**: December 26, 2025  
**Investigator**: Opus (Claude)  
**Directive**: Analyze current code state for 'Pop-Commercial' and 'Rock-Live' presets  
**Status**: ⚠️ FALLING THROUGH TO GENERIC FALLBACK

---

## 🔍 Executive Summary

**FINDING**: Pop and Rock genres have **NO dedicated color logic** in SeleneLux.ts. They are using the **generic SeleneColorEngine procedural generation** with default parameters. The Techno Prism is properly isolated and does NOT leak into other genres.

---

## 📊 Detailed Findings

### 1️⃣ **Lógica de Color: ❌ NO SPECIFIC LOGIC**

**Evidence**:
- **File**: `SeleneLux.ts` lines 1575-1750
- **Code Snippet**:
```typescript
// 🔷 WAVE 127: TECHNO PRISM INTEGRATION (SSOT)
const activeVibe = this.lastTrinityData?.activeVibe ?? 
                   this.lastTrinityData?.debugInfo?.activeVibe ?? 
                   'idle'

const isTechnoVibe = activeVibe.toLowerCase().includes('techno')

if (isTechnoVibe) {
  // ... Techno Prism logic (180+ lines)
}
// 🔺 FIN WAVE 133 🔺
```

**Analysis**:
- Only **Techno** has a dedicated `if (isTechnoVibe)` block
- **Pop-Rock** falls through to the generic path (line 1750+)
- No `if (activeVibe.includes('pop-rock'))` block exists

**Consequence**: Pop/Rock uses the **SeleneColorEngine.generate()** method with default parameters from the Brain, without genre-specific tuning.

---

### 2️⃣ **Reactividad: ⚠️ GENERIC THRESHOLDS**

**Evidence**:
- **File**: `SeleneLux.ts` lines 900-1000
- **Code Snippet**:
```typescript
const hasTrinityContext = this.lastTrinityData?.macroGenre && 
                          this.lastTrinityData.macroGenre !== 'UNKNOWN'

if (hasTrinityContext) {
  // Generic procedural generation for ALL non-Techno genres
  const proceduralPalette = this.colorInterpolator.update(safeAnalysis as any, isDrop)
  
  // No genre-specific bass/treble thresholds here
  this.lastColors = {
    primary: this.applyGlobalMultipliers(rgbPalette.primary),
    secondary: this.applyGlobalMultipliers(rgbPalette.secondary),
    accent: this.applyGlobalMultipliers(rgbPalette.accent),
    ambient: this.applyGlobalMultipliers(rgbPalette.ambient),
    intensity: this.lastColors.intensity,
    saturation: this.globalSaturation
  }
}
```

**Analysis**:
- Pop/Rock uses **same reactividad as all genres** (energy, syncopation, key)
- No custom `bassThreshold` or `trebleThreshold` for Rock
- Default behavior from `ColorInterpolator` and `SeleneColorEngine`

**Missing**:
- Rock could benefit from higher treble sensitivity (guitars, cymbals)
- Pop could use higher saturation for "commercial brightness"

---

### 3️⃣ **Conflictos: ✅ TECHNO PRISM PROPERLY ISOLATED**

**Evidence**:
- **File**: `SeleneLux.ts` lines 1594-1750
- **Code Snippet**:
```typescript
const isTechnoVibe = activeVibe.toLowerCase().includes('techno')

if (isTechnoVibe) {
  // 180 lines of Techno-specific logic
  // Cold Dictator, Prism derivation, dynamic floor, etc.
  
  // 6. COMMIT AL SSOT
  this.lastColors.primary = hslToRgb(primaryHue, 100, 50)
  // ... more assignments
  
  if (isSnareExplosion) {
    this.lastColors.accent = { r: 255, g: 255, b: 255 }  // White flash
  }
}
// 🔺 FIN WAVE 133 🔺
// No else block → other genres continue with generic path
```

**Analysis**:
- Techno Prism is **tightly scoped** with `if (isTechnoVibe)` guard
- Only executes when `activeVibe.toLowerCase().includes('techno')`
- **No risk of leakage** to Pop/Rock

**Verification**:
- Pop-Rock vibe ID: `'pop-rock'` (defined in `VibeProfile.ts` line 18)
- Does NOT match `includes('techno')` check ✅

---

### 4️⃣ **Strategy: 📐 USING STRATEGARBITER DEFAULT**

**Evidence**:
- **File**: `SeleneLux.ts` lines 216-245
- **Code Snippet**:
```typescript
private getStrategyLabel(activeVibe?: string, colorStrategy?: string): string {
  const vibe = (activeVibe ?? '').toLowerCase();
  const strategy = (colorStrategy ?? 'analogous').toLowerCase();
  
  // Techno Vibes → PRISM branding
  if (vibe.includes('techno') || vibe.includes('minimal') || vibe.includes('industrial')) {
    return 'TETRADIC PRISM';
  }
  
  // Fiesta/Latin Vibes → TROPICAL branding
  if (vibe.includes('latin') || vibe.includes('fiesta') || vibe.includes('cumbia') || vibe.includes('reggaeton')) {
    return 'TROPICAL BURST';
  }
  
  // Chill Vibes → AMBIENT branding
  if (vibe.includes('chill') || vibe.includes('lounge') || vibe.includes('ambient')) {
    return 'AMBIENT FLOW';
  }
  
  // Fallback: Mostrar la estrategia del StrategyArbiter en formato profesional
  const strategyLabels: Record<string, string> = {
    'analogous': 'ANALOGOUS',
    'triadic': 'TRIADIC',
    'complementary': 'COMPLEMENTARY',
    // ...
  }
  
  return strategyLabels[strategy] || 'ADAPTIVE';
}
```

**Analysis**:
- **Pop-Rock gets FALLBACK strategy**: Uses whatever `StrategyArbiter` decides
- No hardcoded strategy like Techno's `TETRADIC PRISM`
- Strategy depends on:
  - Musical key (major/minor)
  - Energy level
  - Section type (verse/chorus/drop)

**Current Strategy for Pop/Rock**:
- Most likely: `'analogous'` or `'triadic'` (default StrategyArbiter behavior)
- Display label: `'ANALOGOUS'` or `'TRIADIC'` (generic)

---

## 🔬 Code Architecture Analysis

### Color Generation Flow (Non-Techno Genres)

```
Audio Input
   ↓
Trinity Worker (analyzes genre, key, energy)
   ↓
SeleneLux.processVisualsInternal()
   ↓
hasTrinityContext === true
   ↓
SeleneColorEngine.generate() ← Generic for ALL non-Techno
   ↓
ColorInterpolator.update() ← Smoothing
   ↓
lastColors (RGB) → Hardware
```

### Why Pop/Rock Looks Generic

1. **No Vibe-Specific Block**: Only Techno has custom logic
2. **Uses Brain Defaults**: SeleneColorEngine uses energy + key, not genre-aware
3. **No Saturation Boost**: Commercial Pop needs higher saturation, not applied
4. **No Warm Bias**: Rock could use warmer tones (reds/oranges), not enforced

---

## 📋 Missing Code Snippets

### What SHOULD Exist (But Doesn't):

```typescript
// HYPOTHETICAL: Pop/Rock specific logic
const isPopRockVibe = activeVibe.toLowerCase().includes('pop') || 
                      activeVibe.toLowerCase().includes('rock')

if (isPopRockVibe) {
  // Custom logic for Pop/Rock
  const basePalette = this.colorEngine.generate(/* ... */)
  
  // Rock: Warmer tones, higher treble reactivity
  if (activeVibe.includes('rock')) {
    // Shift hue towards warm (reds, oranges, yellows)
    basePalette.primary.h = (basePalette.primary.h + 30) % 360
    
    // Higher saturation for "live energy"
    basePalette.primary.s = Math.min(100, basePalette.primary.s * 1.2)
  }
  
  // Pop: Brighter, more saturated, "radio-friendly"
  if (activeVibe.includes('pop')) {
    // Commercial brightness boost
    basePalette.primary.l = Math.min(70, basePalette.primary.l + 10)
    basePalette.primary.s = Math.min(100, basePalette.primary.s * 1.3)
  }
  
  this.lastColors = paletteToRgb(basePalette)
}
```

**Status**: ❌ **DOES NOT EXIST IN CODEBASE**

---

## 🎯 Diagnostic Summary

| Aspect | Status | Current Behavior | Recommendation |
|--------|--------|------------------|----------------|
| **Color Logic** | ❌ Missing | Generic SeleneColorEngine | Add `if (isPopRockVibe)` block |
| **Reactividad** | ⚠️ Generic | Default energy thresholds | Add genre-specific bass/treble sensitivity |
| **Techno Isolation** | ✅ Good | Properly scoped to `isTechnoVibe` | No action needed |
| **Strategy** | ⚠️ Fallback | Uses StrategyArbiter defaults | Consider hardcoded strategies like Latin/Techno |
| **Saturation** | ⚠️ Default | Global saturation only | Pop needs +20-30% saturation boost |
| **Hue Bias** | ❌ None | No warm/cool bias | Rock could use warm shift (+30°) |

---

## 🚨 Critical Gaps

1. **No Vibe Detection**: 
   - `activeVibe === 'pop-rock'` exists in Trinity data
   - SeleneLux has NO conditional for it
   
2. **Strategy Branding**:
   - Techno: `TETRADIC PRISM` ✅
   - Latin: `TROPICAL BURST` ✅
   - Chill: `AMBIENT FLOW` ✅
   - Pop/Rock: Generic fallback ❌

3. **Genre Personality**:
   - Techno: Cold, geometric, strobe-heavy ✅
   - Pop: Should be bright, saturated, "radio-friendly" ❌
   - Rock: Should be warm, energetic, guitar-driven ❌

---

## 📁 Files Audited

| File | Lines Analyzed | Finding |
|------|----------------|---------|
| `SeleneLux.ts` | 200-240 | getStrategyLabel() has no Pop/Rock case |
| `SeleneLux.ts` | 900-1000 | Generic procedural generation (no genre fork) |
| `SeleneLux.ts` | 1575-1750 | Techno Prism properly isolated |
| `VibeProfile.ts` | 18 | `'pop-rock'` vibe ID exists |
| `SeleneProtocol.ts` | 253, 270, 282 | ROCK_POP genre type exists |

---

## 🔧 Recommended Next Steps

### Option A: Quick Win (Add Pop/Rock Branching)
```typescript
// After line 1750 (after Techno Prism block)
const isPopRockVibe = activeVibe.toLowerCase().includes('pop') || 
                      activeVibe.toLowerCase().includes('rock')

if (isPopRockVibe) {
  // Custom logic here (20-30 lines)
  // Warm hue shift for Rock, saturation boost for Pop
}
```

### Option B: Full Refactor (Genre Strategy System)
- Create `GenreColorStrategies` class
- Define strategies for each genre: Techno, Latin, Pop, Rock, Chill
- Unified API: `strategy.apply(basePalette, activeVibe)`

### Option C: VibeProfile Enhancement
- Move color biases to `VibeProfile.ts`
- Each vibe defines: `hueShift`, `saturationMultiplier`, `lightnessOffset`
- SeleneLux reads from profile instead of hardcoded logic

---

## 🎨 Visual Identity Proposals

### Pop-Commercial
- **Strategy**: Analogous (smooth radio-friendly)
- **Hue Bias**: None (let Brain decide based on key)
- **Saturation**: +30% (commercial brightness)
- **Lightness**: +10% (avoid dark moods)
- **Reactivity**: High energy = higher intensity spikes

### Rock-Live
- **Strategy**: Complementary (dramatic contrast)
- **Hue Bias**: +30° warm shift (red/orange/yellow bias)
- **Saturation**: +15% (energetic but not artificial)
- **Lightness**: Default (allow dark moments)
- **Reactivity**: Higher treble sensitivity (guitars, cymbals)

---

## 🏁 Conclusion

**Current State**: Pop and Rock are **using generic procedural generation** with no genre-specific tuning. They work (colors change with music), but lack the **personality and visual identity** that Techno Prism achieved.

**Impact**: 
- Users may perceive Pop/Rock as "bland" compared to Techno
- No visual differentiation between genres
- Missed opportunity for genre-specific branding

**Risk Level**: 🟡 **MEDIUM**
- System is stable (no crashes)
- Colors are reactive (not broken)
- But lacks **artistic direction** for these genres

**Recommendation**: Add Pop/Rock specific logic in WAVE 135 to match Techno's level of polish.

---

*Audit completed by Opus (Claude) - December 26, 2025*  
*Reference: SeleneLux.ts (lines 1-2229), VibeProfile.ts, SeleneProtocol.ts*
