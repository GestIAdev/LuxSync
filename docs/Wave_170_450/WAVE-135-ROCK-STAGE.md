# 🎸 WAVE 135: THE ROCK STAGE - PORTNOY PROTOCOL
## Genre-Specific Color Logic for Pop/Rock

**Date**: December 26, 2025  
**Status**: ✅ IMPLEMENTED  
**Reference**: POP-ROCK-AUDIT.md findings

---

## 🎯 Objective

Implement dedicated color logic for Pop/Rock genres following the success of the Techno Prism. The "Portnoy Protocol" (named after Mike Portnoy's precise drumming) uses acoustic-instrument-based rhythm detection and a "Stage Lighting" color palette inspired by classic PAR64 fixtures.

---

## 🏗️ Architecture

### Isolation Principle
```typescript
// Exclusive execution - never both
const isTechnoVibe = activeVibe.toLowerCase().includes('techno')
const isPopRockVibe = activeVibe.toLowerCase().includes('pop') || 
                      activeVibe.toLowerCase().includes('rock')

if (isTechnoVibe) {
  // Techno Prism (WAVE 127-133)
}

if (isPopRockVibe && !isTechnoVibe) {
  // Rock Stage (WAVE 135) - Double guard for safety
}
```

---

## 🎨 Color Philosophy: "Stage Lighting"

### The Problem
Generic procedural colors include weird intermediates (Lime Green, Dirty Purple) that don't match the rock aesthetic. Real stage lighting uses:
- **Reds** (blood, passion, aggression)
- **Ambers** (warm, golden, sunset)
- **Blues** (cool, night, moody)
- **Whites** (stadium blinders, punch)

### The Solution: Hue Filtering
```typescript
// Force colors to PAR64 classic palette
const normalizedHue = (baseHue + 360) % 360

if (normalizedHue > 80 && normalizedHue < 160) {
  baseHue = 0   // Green → Blood Red
} 
else if (normalizedHue > 260 && normalizedHue < 300) {
  baseHue = 40  // Dirty Purple → Amber/Gold
}
```

### Visual Mapping
| Brain Hue Range | Filtered Output | Reason |
|-----------------|-----------------|--------|
| 80° - 160° (Lime→Green) | 0° (Blood Red) | Rock doesn't do green |
| 260° - 300° (Purple→Magenta) | 40° (Amber/Gold) | Warm stage aesthetic |
| 0° - 80° (Red→Orange) | Unchanged | Classic rock palette |
| 160° - 260° (Cyan→Blue→Purple) | Unchanged | Cool stage mood |
| 300° - 360° (Magenta→Red) | Unchanged | Aggressive rock tone |

---

## 🥁 Rhythm Detection: "Portnoy Protocol"

### Philosophy
Unlike Techno (which uses treble for hi-hats), Rock uses:
- **MIDS** for **Snare** (the crack/pop lives in 1-4kHz)
- **BASS** for **Kick** (the thump lives in 60-100Hz)

### Implementation
```typescript
// Normalized audio from AGC
const normalizedMid = agcRock?.normalizedMid ?? 0.0
const normalizedBass = agcRock?.normalizedBass ?? 0.0

// Pulse detection (above average noise floor)
const avgMid = agcRock?.avgNormEnergy ? agcRock.avgNormEnergy * 0.8 : 0.4
const avgBass = agcRock?.avgNormEnergy ? agcRock.avgNormEnergy * 0.9 : 0.4

const midsPulse = Math.max(0, normalizedMid - avgMid)
const bassPulse = Math.max(0, normalizedBass - avgBass)

// Thresholds for rock mixes (less compressed than EDM)
const SNARE_THRESHOLD = 0.20
const KICK_THRESHOLD = 0.25

const isSnareHit = (midsPulse > SNARE_THRESHOLD)
const isKickHit = (bassPulse > KICK_THRESHOLD)
```

### Why Different Thresholds?
| Parameter | Techno | Rock | Reason |
|-----------|--------|------|--------|
| Frequency Band | Treble | Mids | Snare clarity |
| Threshold | 0.25 | 0.20 | Less compression |
| Context Energy | Bass > 0.80 | None required | Acoustic dynamics |

---

## 💡 Accent Logic: Stadium Blinders

### Snare Hit → Tungsten Flash
```typescript
if (isSnareHit) {
  // 🥁 CAJA: FLASH TUNGSTENO (Blanco Cálido)
  // Hue 40 (Orange), Sat 20 (Almost white), Light 100
  accentHue = 40
  accentSat = 20
  accentLight = 100
}
```

**Rationale**: Real stadium blinders are warm white (tungsten), not cold LED white. This creates a "punchy" feel without the clinical EDM strobe.

### Kick Hit → Complementary Punch
```typescript
else if (isKickHit) {
  // 🦶 BOMBO: GOLPE DE CONTRASTE
  // Complementary color (+180°) for dramatic impact
  accentHue = (primaryHue + 180) % 360
  accentSat = 100
  accentLight = 60
}
```

**Rationale**: The kick drum drives the song. Marking it with complementary color creates a "push-pull" visual tension that matches the energy.

---

## 🎯 UI Branding

### Strategy Label
```typescript
// In getStrategyLabel()
if (vibe.includes('pop') || vibe.includes('rock')) {
  return 'ROCK DYNAMICS';
}
```

**UI Display**: The Chroma Core panel will now show:
- **TETRADIC PRISM** for Techno
- **ROCK DYNAMICS** for Pop/Rock
- **TROPICAL BURST** for Latin
- **AMBIENT FLOW** for Chill

---

## 📁 Code Changes

### Files Modified
| File | Change |
|------|--------|
| `SeleneLux.ts` lines 217-221 | Added Pop/Rock case to getStrategyLabel() |
| `SeleneLux.ts` lines 1739-1855 | Added complete Pop/Rock block after Techno |

### Block Structure (lines 1739-1855)
```
1739: // 🔺 FIN WAVE 133 🔺 (Techno ends)
1741: // ═══════════════════════════════════════════════════════════════
1742: // 🎸 WAVE 135: THE ROCK STAGE - PORTNOY PROTOCOL
1743: // ═══════════════════════════════════════════════════════════════
...
1753: if (isPopRockVibe && !isTechnoVibe) {
      ...
      // 1. Color Base Capture
      // 2. Stage Lighting Filter
      // 3. Portnoy Rhythm Detection
      // 4. Accent Logic
      // 5. Commit to SSOT
      ...
1852: }
1853: // 🔺 FIN WAVE 135 🔺
```

---

## 🧪 Testing

### Expected Behavior
1. **Play Iron Maiden "Wasted Years"**:
   - Primary: Red or Amber (no green/purple)
   - Snare hits: Warm white flash
   - Kick drum: Complementary punch

2. **Play AC/DC "Back in Black"**:
   - Primary: Blood red
   - Aggressive dynamics following drums
   - Stadium blinder feel

3. **Play Bon Jovi "Livin' on a Prayer"**:
   - Brighter palette (still filtered)
   - Commercial pop energy
   - Warm punch on snare hits

### Debug Log
```
[WAVE135] 🎸 ROCK STAGE | Base:0° | Mid:0.65 | Bass:0.72 | Snare:true | Kick:false
```

---

## 🔄 Comparison: Techno vs Rock

| Aspect | Techno Prism | Rock Stage |
|--------|--------------|------------|
| **Detection Band** | Treble (hi-hats) | Mids (snare) |
| **Color Filter** | Cold Dictator (anti-warm) | Stage Lighting (anti-green) |
| **Flash Type** | White LED Strobe | Tungsten Blinder |
| **Geometry** | Tetradic (+90° steps) | Analogous (+30° offset) |
| **Strategy Label** | TETRADIC PRISM | ROCK DYNAMICS |
| **Mood** | Clinical/Industrial | Aggressive/Warm |

---

## 🎓 Lessons Applied

1. **Acoustic Detection**: Rock needs mid-frequency focus, not treble
2. **Color Filtering**: Genre-specific palette restrictions work
3. **Warm Flash**: Tungsten (40°/20%/100%) feels more "rock" than cold white
4. **Kick Marking**: Complementary color creates visual dynamics

---

## 🚀 Next Steps

1. **Test with real tracks**: Iron Maiden, AC/DC, Dream Theater
2. **Tune thresholds**: May need adjustment for compressed vs dynamic masters
3. **Consider Pop split**: Pop-Commercial might want different saturation than Rock-Live
4. **Add Latin block**: WAVE 136 could implement Tropical Burst properly

---

*WAVE 135: THE ROCK STAGE - Implemented by Opus (Claude)*  
*The Portnoy Protocol - Precision Rhythm Detection*  
*December 26, 2025*
