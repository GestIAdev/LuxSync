# 🎵 WAVE 97: RHYTHMIC CROSSOVER & BREATHING AURORA

**Date:** 2025-12-24  
**Status:** ✅ COMPLETE  
**Type:** ARCHITECTURAL DIRECTIVE  
**Impact:** CRITICAL - Zone-based frequency separation + Anti-blackout floor

---

## 🎯 EXECUTIVE SUMMARY

**TWO MAJOR IMPROVEMENTS IMPLEMENTED:**

### 1. RHYTHMIC CROSSOVER (Zone Separation)
- **FRONT_PARS** → KICK/BOMBO (Bass only, cúbica)
- **BACK_PARS** → HATS/SNARE (Treble only, cuadrática)
- **Result:** Stage has RHYTHM TEXTURE, not uniform mass

### 2. BREATHING AURORA (Anti-Blackout)
- **MOVERS** → MELODY/PADS (Mid only, 12% floor)
- **Result:** Breakdowns have soft glow, never total darkness

---

## 📊 PROBLEM ANALYSIS

### Issue 1: Monotonous PAR Response
**Before (WAVE 94.2):**
```
FRONT_PARS: Bass → Cúbica (KICK)
BACK_PARS:  Bass → Cúbica (KICK también)  ❌ MISMO RITMO
```
Both zones responded to the same frequency band, creating a "wall of light" effect with no texture.

### Issue 2: Breakdown Blackouts
**Before (WAVE 94.2):**
```
MOVERS: (Mid+Treble)/2 → Gate 30% → Cuadrática
        Piano solo (mid=0.2) → BLACKOUT  ❌
        Pad breakdown (mid=0.15) → BLACKOUT  ❌
```
Movers went completely dark during quiet melodic sections.

---

## 🔧 SOLUTION ARCHITECTURE

### Zone-to-Frequency Mapping

```
┌─────────────────────────────────────────────────────────────┐
│                    STAGE FREQUENCY MAP                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   FRONT_PARS (KICK)          BACK_PARS (HATS)              │
│   ┌───────────────┐          ┌───────────────┐             │
│   │ Source: BASS  │          │ Source: TREBLE│             │
│   │ Gate: 60%×avg │          │ Gate: 30%×avg │             │
│   │ Curve: pow(3) │          │ Curve: pow(2) │             │
│   │ Effect: THUMP │          │ Effect: TSS   │             │
│   └───────────────┘          └───────────────┘             │
│           │                          │                      │
│           ▼                          ▼                      │
│   ░░░░░░░░░░░░░░░            ▒▒▒▒▒▒▒▒▒▒▒▒▒▒                │
│   Golpes FUERTES             Respuesta RÁPIDA               │
│   Decays SECOS               Decays NATURALES               │
│                                                             │
│   ═══════════════════════════════════════════════════════   │
│                                                             │
│   MOVERS (BREATHING AURORA)                                 │
│   ┌─────────────────────────────────────────────────────┐   │
│   │ Source: MID (melody, vocals, pads)                  │   │
│   │ Floor: 12% (anti-blackout)                          │   │
│   │ Ceiling: 100% (drops)                               │   │
│   │ Curve: pow(1.5) (organic breathing)                 │   │
│   │ Effect: Soft glow in breakdowns, full power in drops│   │
│   └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📐 MATHEMATICAL FORMULAS

### FRONT_PARS (Kick)
```typescript
// Source: Pure bass (kick drum, sub-bass)
const bassEnergy = normBass;

// Relative gate (adapts to song's average energy)
const relativeGate = avgNormEnergy * 0.6;

// Cubic curve (sharp attack, fast decay)
if (bassEnergy < relativeGate) {
  intensity = 0;
} else {
  const normalized = (bassEnergy - relativeGate) / (1 - relativeGate);
  intensity = Math.pow(normalized, 3);  // CUBIC
}
```

### BACK_PARS (Hats) - **NEW**
```typescript
// Source: Pure treble (hi-hats, snare sizzle, crashes)
const trebleEnergy = normTreble;

// Lower gate (captures fast transients)
const relativeGate = Math.max(0.15, avgNormEnergy * 0.3);

// Quadratic curve (faster than cubic, matches hat speed)
if (trebleEnergy < relativeGate) {
  intensity = 0;
} else {
  const normalized = (trebleEnergy - relativeGate) / (1 - relativeGate);
  intensity = Math.pow(normalized, 2);  // QUADRATIC
}
```

### MOVERS (Breathing Aurora) - **NEW**
```typescript
// Source: Pure mid (melody, vocals, pads, piano)
const midSignal = normMid;
const silenceThreshold = 0.05;

if (midSignal < silenceThreshold) {
  intensity = 0;  // Real silence = darkness
} else {
  // 1. Normalize [0.05 → 1.0] → [0 → 1]
  const rawInput = (midSignal - silenceThreshold) / (1 - silenceThreshold);
  
  // 2. Organic curve (pow 1.5) - smoother than quadratic
  const curvedInput = Math.pow(rawInput, 1.5);
  
  // 3. Re-scale to [0.12 → 1.0] (12% floor)
  const minFloor = 0.12;
  intensity = minFloor + (curvedInput * (1 - minFloor));
}
```

---

## 📈 EXPECTED BEHAVIOR

### Scenario: Boris Brejcha - Minimal Techno

| Song Section | FRONT_PARS | BACK_PARS | MOVERS |
|--------------|------------|-----------|--------|
| **Intro (soft pads)** | OFF | OFF | 12-20% ✨ |
| **Build-up (kick enters)** | 30-60% 💥 | 10-30% | 25-40% |
| **Drop (full energy)** | 80-100% 💥💥 | 60-80% | 70-100% |
| **Breakdown (piano)** | OFF | OFF | 12-25% ✨ |
| **Hi-hat section** | 20-40% | 70-100% 🔥 | 30-50% |

### Scenario: Cumbia/Reggaeton

| Song Section | FRONT_PARS | BACK_PARS | MOVERS |
|--------------|------------|-----------|--------|
| **Verse (vocals)** | 20-40% | 30-50% | 40-60% |
| **Pre-chorus** | 40-60% | 40-60% | 50-70% |
| **Chorus (BOMBO)** | 80-100% 💥 | 50-70% | 70-90% |
| **Break (acapella)** | OFF | OFF | 12-30% ✨ |
| **Dembow pattern** | 60-80% 💥 | 70-90% 🔥 | 60-80% |

---

## 🔄 CODE CHANGES

### File: `electron-app/electron/main.ts`

#### Change 1: BACK_PARS (Lines ~673-698)
```diff
- case 'BACK_PARS': {
-   // 💥 WAVE 94.2: BACK_PARS también usan EL LÁTIGO 2.0
-   const bassEnergy = normBass;
-   const relativeGate = avgNormEnergy * 0.6;
-   intensity = Math.pow(normalized, 3);  // Cúbica
- }

+ case 'BACK_PARS': {
+   // 🥁 WAVE 97: RHYTHMIC CROSSOVER - Hats & Snare (Treble)
+   const trebleEnergy = normTreble;
+   const relativeGate = Math.max(0.15, avgNormEnergy * 0.3);
+   intensity = Math.pow(normalized, 2);  // Cuadrática
+ }
```

#### Change 2: MOVING_LEFT (Lines ~702-740)
```diff
- case 'MOVING_LEFT': {
-   // WAVE 94.2: EL CORO 2.0 - Relative Gate + Cuadrática
-   const melodyEnergy = (normMid + normTreble) / 2;
-   const relativeGate = avgNormEnergy * 0.3;
-   if (melodyEnergy < relativeGate) intensity = 0;
- }

+ case 'MOVING_LEFT': {
+   // 🌬️ WAVE 97: BREATHING AURORA - Melody & Pads (Mid)
+   const midSignal = normMid;
+   const silenceThreshold = 0.05;
+   const minFloor = 0.12;  // Anti-blackout floor
+   intensity = minFloor + (curved * (1 - minFloor));
+ }
```

#### Change 3: MOVING_RIGHT (Lines ~744-775)
Same logic as MOVING_LEFT, with AMBIENT color for stereo depth.

---

## ✅ VERIFICATION CHECKLIST

- [x] BACK_PARS switched from bass → treble
- [x] BACK_PARS gate lowered (0.6x → 0.3x avg)
- [x] BACK_PARS curve changed (cubic → quadratic)
- [x] MOVERS use mid-only (no treble mix)
- [x] MOVERS have 12% floor (anti-blackout)
- [x] MOVERS use organic curve (pow 1.5)
- [x] Stereo mirror maintained (LEFT=Secondary, RIGHT=Ambient)
- [x] Smoothing preserved (fast up, slow decay)
- [ ] **Production testing with various genres** (pending)

---

## 🎭 VISUAL CONCEPT

```
BEFORE (WAVE 94):                AFTER (WAVE 97):
                                 
┌────────────────────┐          ┌────────────────────┐
│ FRONT ████████████ │          │ FRONT ████████     │  ← KICK only
│ BACK  ████████████ │  SAME    │ BACK     ▒▒▒▒▒▒▒▒ │  ← HATS only
│ MOVERS    ░░░░     │  OFF!    │ MOVERS ░░░░░░░░░░ │  ← 12% floor
└────────────────────┘          └────────────────────┘

 "Wall of identical light"       "Textured rhythm stage"
```

---

## 🔗 RELATED WAVES

- **WAVE 86:** Stereo color mapping (LEFT=Secondary, RIGHT=Ambient)
- **WAVE 91:** Dynamic noise gate (silence = blackout)
- **WAVE 94.2:** Relative gates + AGC normalization
- **WAVE 97:** Rhythmic crossover + Breathing aurora

---

## 📝 LESSONS LEARNED

### Why Frequency Separation Matters
- **Bass** (20-250 Hz): Kick drum, sub-bass → **PHYSICAL IMPACT**
- **Mid** (250-4000 Hz): Vocals, melody, pads → **EMOTIONAL CONTENT**
- **Treble** (4000+ Hz): Hi-hats, crashes, air → **RHYTHMIC DETAIL**

Mixing them creates mud. Separating them creates **DEPTH**.

### Why 12% Floor Matters
- Human perception: <10% appears "off" in most environments
- 12% is visible but subtle → **"Breathing" effect**
- Breakdowns feel **intimate**, not **dead**

---

**END OF REPORT**

*"The stage now has rhythm texture, not a wall of light.  
 Front THUMPS. Back SIZZLES. Movers BREATHE."*

🔊 **FREQUENCY SEPARATION = VISUAL DEPTH** 🔊
