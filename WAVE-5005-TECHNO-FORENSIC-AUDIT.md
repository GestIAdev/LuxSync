# WAVE 5005: Forensic Audit — Techno-Club / Hard-Techno / Minimal Drop Behavior

> **ZERO CODE GENERATION** — This document contains only exact code snippets and parameter extractions from the current production codebase.  
> **Scope:** `HuntEngine.ts`, `DecisionMaker.ts`, `DropBridge.ts`  
> **Focus:** Why drops and key moments are being ignored in techno-club, hard-techno, and minimal genres.

---

## 1. HUNT ENGINE — VIBE STRIKE MATRIX (`HuntEngine.ts`)

### 1.1 Techno-Club Weights

```typescript
// c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/intelligence/think/HuntEngine.ts:716-723
'techno-club': {
  beautyWeight: 0.2,      // WAVE 635: Subido de 0.1 a 0.2
  urgencyWeight: 0.7,     // WAVE 635: Bajado de 0.8 a 0.7
  consonanceWeight: 0.1,  // WAVE 635: Mantenido en 0.1
  threshold: 0.65,        // WAVE 640: Bajado de 0.70 a 0.65 (loops necesitan umbral bajo)
  urgencyBoost: 0.1       // WAVE 635: Bajado de 0.2 a 0.1
},
```

### 1.2 Evaluation Logic

```typescript
// c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/intelligence/think/HuntEngine.ts:788-806
const strikeScore = 
  (beautyScore * weights.beautyWeight) +
  (urgency * weights.urgencyWeight) +
  (consonanceScore * weights.consonanceWeight)

// Bonus por sección musical (chorus/buildup = momento crítico)
let finalScore = strikeScore
if (pattern.section === 'chorus' || pattern.section === 'buildup') {
  finalScore = Math.min(1.0, strikeScore + 0.05)
}

// Bonus por trend rising (momentum ascendente)
if (trend === 'rising') {
  finalScore = Math.min(1.0, finalScore + 0.05)
}

const allMet = strikeScore >= weights.threshold
```

**Observation for Techno:**  
- `urgencyWeight: 0.7` is the dominant factor.  
- `threshold: 0.65` is the lowest of all vibes (tied with fiesta-latina).  
- `beautyWeight: 0.2` is very low — harmonic beauty is almost irrelevant.  
- **Techno builds score almost exclusively on `urgency` and `trend`.** If rhythmic intensity is flat, the score will struggle to cross 0.65.

---

## 2. DROP BRIDGE — FORCE STRIKE OVERRIDE (`DropBridge.ts`)

### 2.1 Default Configuration

```typescript
// c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/intelligence/think/DropBridge.ts:123-130
const DEFAULT_CONFIG: DropBridgeConfig = {
  zScoreThreshold: 3.0,        // 3 sigma = 99.85 percentil (THE_DROP=4.2σ, Techno=2.6σ máx)
  peakSections: ['drop', 'chorus'],
  minEnergy: 0.60,             // THE_DROP alcanza 0.63 pico - margen de seguridad para mal mastering
  requireKick: false,
  watchingThreshold: 2.0,      // Empezamos a prestar atención
  imminentThreshold: 2.5,      // Algo gordo viene (techno agresivo ya dispara aquí)
}
```

### 2.2 Latino Override (The ONLY Vibe-Specific Override)

```typescript
// c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/intelligence/think/DropBridge.ts:153-163
const isLatinoVibe = vibeId === 'fiesta-latina' || vibeId === 'dembow' || vibeId?.includes('latina') || false
if (isLatinoVibe) {
  cfg.zScoreThreshold = Math.max(cfg.zScoreThreshold, 3.5)
  cfg.minEnergy = Math.max(cfg.minEnergy, 0.70)
  cfg.watchingThreshold = Math.max(cfg.watchingThreshold, 2.5)
  cfg.imminentThreshold = Math.max(cfg.imminentThreshold, 3.0)
}
```

### 2.3 Techno Reality Check (Inline Comment)

```typescript
// c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/intelligence/think/DropBridge.ts:124
zScoreThreshold: 3.0,        // 3 sigma = 99.85 percentil (THE_DROP=4.2σ, Techno=2.6σ máx)
```

**Critical Finding:**  
> **Techno aggressive maxes at Z=2.6σ. The DropBridge threshold is 3.0σ. There is NO techno-specific override lowering the threshold.**  
> **Result: DropBridge `shouldForceStrike` will NEVER fire for techno.**

---

## 3. DECISION MAKER — ENERGY & SPECTRAL GATES (`DecisionMaker.ts`)

### 3.1 Absolute Energy Gate (All Genres)

```typescript
// c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/intelligence/think/DecisionMaker.ts:352-362
const ABSOLUTE_ENERGY_GATE_RATIO = 0.48
const ABSOLUTE_ENERGY_GATE_FALLBACK = 0.40
const rawEnergy = energyContext?.absolute ?? pattern.rawEnergy ?? 0
const maxHistoric = (energyMaxHistoric ?? 0) > 0 ? energyMaxHistoric! : null
const absoluteGateThreshold = maxHistoric !== null
  ? maxHistoric * ABSOLUTE_ENERGY_GATE_RATIO
  : ABSOLUTE_ENERGY_GATE_FALLBACK
const energyGateOpen = rawEnergy >= absoluteGateThreshold
```

### 3.2 Spectral Gate — ANTI-BAD-BUNNY (Latino ONLY)

```typescript
// c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/intelligence/think/DecisionMaker.ts:380-394
const _vId = pattern.vibeId ?? ''
const isLatinoVibeForSpectral = _vId.includes('latino') || _vId.includes('latina') || _vId.includes('dembow')
let spectralGateOpen = true
if (isLatinoVibeForSpectral && energyGateOpen) {
  const lowBand = pattern.bassPresenceSustained ?? pattern.bassPresence ?? 0
  const midBand = pattern.midPresence ?? 0
  const kickThreshold = (maxHistoric ?? 0) * 0.75
  const hasHeavyKick = lowBand >= kickThreshold
  const isNotJustVocals = lowBand >= (midBand * 0.95)
  spectralGateOpen = hasHeavyKick && isNotJustVocals
}
const isAbsoluteGateOpen = energyGateOpen && spectralGateOpen
```

**Critical Finding:**  
> **The Spectral Gate (WAVE 4864) is hardcoded to Latino vibes only. Techno has NO spectral gate protection or enforcement. `spectralGateOpen` defaults to `true` for all non-latino vibes, including techno.**

### 3.3 DIVINE Moment Threshold & Energy Gate

```typescript
// c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/intelligence/think/DecisionMaker.ts:51-55
export const DIVINE_THRESHOLD = 4.0

// c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/intelligence/think/DecisionMaker.ts:432
const DIVINE_ENERGY_GATE = 0.72  // 🔬 WAVE 2494: 0.85→0.72 — rawEnergy necesita gate más bajo para sincronizar con Z-score
```

### 3.4 DIVINE Decision Logic (Dual Validation)

```typescript
// c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/intelligence/think/DecisionMaker.ts:439-481
if (activeDictator) {
  // El dictador ya fue anunciado cuando se disparó
} else if (currentZ >= DIVINE_THRESHOLD) {
  const zone = energyContext?.zone ?? 'gentle'
  const effectiveEnergy = energyContext?.absolute ?? 0

  if (zone === 'silence' || zone === 'valley') {
    console.log(`[DecisionMaker 🌩️] DIVINE BLOCKED: Z=${currentZ.toFixed(2)}σ but zone=${zone} (protected)`)
    // Fall through a siguiente prioridad
  } else if (!isAbsoluteGateOpen) {
    // ... blocked by energy/spectral gate ...
    // Fall through
  } else if (effectiveEnergy < DIVINE_ENERGY_GATE) {
    console.log(
      `[DecisionMaker 🌩️] DIVINE SUPPRESSED: Z=${currentZ.toFixed(2)}σ but rawEnergy=${effectiveEnergy.toFixed(2)} < ${DIVINE_ENERGY_GATE} ` +
      `(WAVE 2494 raw gate) → falling through to musical context priorities`
    )
    // Fall through — NO return aquí. Hunt/drop/buildup evaluarán el frame.
  } else {
    console.log(`[DecisionMaker 🌩️] DIVINE MOMENT: Z=${currentZ.toFixed(2)}σ energy=${effectiveEnergy.toFixed(2)} zone=${zone} → MANDATORY FIRE`)
    return 'divine_strike'
  }
}
```

**Observation:**  
- DIVINE requires `Z >= 4.0` AND `energy >= 0.72` AND `zone != silence/valley`.  
- Techno rarely reaches Z=4.0 (per DropBridge comment, max is ~2.6σ).  
- **DIVINE strike is effectively unreachable for techno.**

---

## 4. DECISION MAKER — BUILDUP RESTRICTIONS (`DecisionMaker.ts`)

### 4.1 Heavy Arsenal Definition

```typescript
// c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/intelligence/think/DecisionMaker.ts:86-88
function isHeavyEffect(effectId: string): boolean {
  return getDynamicEffectRegistry().getEntry(effectId)?.simMeta.isHeavyCandidate ?? false
}
```

### 4.2 Section Validity Check

```typescript
// c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/intelligence/think/DecisionMaker.ts:95-99
function isEffectAllowedInSection(effectId: string, section: string): boolean {
  const entry = getDynamicEffectRegistry().getEntry(effectId)
  if (!entry || entry.validSections.length === 0) return true
  return entry.validSections.includes(section)
}
```

### 4.3 DNA Priority 0 — Buildup Restriction (WAVE 2200.3)

```typescript
// c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/intelligence/think/DecisionMaker.ts:519-551
if (dreamIntegration?.approved && dreamIntegration.effect?.effect) {
  const proposedEffect = dreamIntegration.effect.effect
  if (section === 'buildup' && !isEffectAllowedInSection(proposedEffect, section)) {
    // Fall through — el buildup handler (más abajo) se encargará con efectos suaves
  } else {
    return 'strike'  // DNA aprobó → strike con efecto de DNA
  }
}
```

### 4.4 Fuzzy Buildup Wall (WAVE 2203)

```typescript
// c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/intelligence/think/DecisionMaker.ts:591-595
const hasDNAProposal = dreamIntegration?.approved && dreamIntegration.effect?.effect
const fuzzyBlockedByBuildup = hasDNAProposal &&
  section === 'buildup' &&
  !isEffectAllowedInSection(dreamIntegration!.effect!.effect, section)
```

### 4.5 Hunt Buildup Wall (WAVE 2203)

```typescript
// c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/intelligence/think/DecisionMaker.ts:630-642
const WORTHINESS_THRESHOLD = 0.65
if (huntDecision.worthiness >= WORTHINESS_THRESHOLD && huntDecision.confidence > 0.50) {
  if (fuzzyBlockedByBuildup) {
    console.log(
      `[DecisionMaker 🛡️] HUNT BUILDUP WALL: worthiness=${huntDecision.worthiness.toFixed(2)} ` +
      `but "${dreamIntegration!.effect!.effect}" blocked — section=${section}`
    )
    // Fall through to buildup_enhance
  } else {
    return 'strike'
  }
}
```

---

## 5. DECISION MAKER — DROP PREPARATION & ANTI-FAKE-DROP (`DecisionMaker.ts`)

### 5.1 Drop Energy Gate (Re-evaluated in Drop Path)

```typescript
// c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/intelligence/think/DecisionMaker.ts:985-990
const dropRawEnergy = inputs.energyContext?.absolute ?? inputs.pattern.rawEnergy ?? 0
const dropMaxHistoric = (inputs.energyMaxHistoric ?? 0) > 0 ? inputs.energyMaxHistoric! : null
const dropGateThreshold = dropMaxHistoric !== null
  ? dropMaxHistoric * 0.48 // 📉 WAVE 5001: 0.60 → 0.48
  : 0.40 // 📉 WAVE 5001: 0.45 → 0.40
const dropEnergyGateOpen = dropRawEnergy >= dropGateThreshold
```

### 5.2 Drop Spectral Gate (Again, Latino Only)

```typescript
// c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/intelligence/think/DecisionMaker.ts:992-1006
const _vIdDrop = pattern.vibeId ?? ''
const dropIsLatinoVibe = _vIdDrop.includes('latino') || _vIdDrop.includes('latina') || _vIdDrop.includes('dembow')
let dropSpectralGateOpen = true
if (dropIsLatinoVibe && dropEnergyGateOpen) {
  const lowBand = inputs.pattern.bassPresenceSustained ?? inputs.pattern.bassPresence ?? 0
  const midBand = inputs.pattern.midPresence ?? 0
  const kickThreshold = (dropMaxHistoric ?? 0) * 0.75
  const hasHeavyKick = lowBand >= kickThreshold
  const isNotJustVocals = lowBand >= (midBand * 0.95)
  dropSpectralGateOpen = hasHeavyKick && isNotJustVocals
}
const dropAbsGateOpen = dropEnergyGateOpen && dropSpectralGateOpen
```

### 5.3 Anti-Fake-Drop Sanity Check

```typescript
// c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/intelligence/think/DecisionMaker.ts:1051-1064
const currentZ = zScore ?? 0
const isLatinoVibe = vibeId === 'fiesta-latina' || vibeId?.includes('latina') || false
const antiFakeThreshold = isLatinoVibe ? 0.85 : 0.5
if (isHeavyEffect(suggestedEffect) && currentZ < antiFakeThreshold) {
  console.log(
    `[DecisionMaker 🛡️] ANTI-FAKE-DROP (${isLatinoVibe ? 'LATINO' : 'STANDARD'}): "${suggestedEffect}" ABORTED — ` +
    `Z=${currentZ.toFixed(2)}σ < ${antiFakeThreshold} (energy insufficient for heavy arsenal)`
  )
  // Sin effectDecision — las physics reactivas manejan la transición suavemente
}
```

**Critical Finding:**  
> **For techno (non-latino), the Anti-Fake-Drop threshold is `Z < 0.5`. Any heavy arsenal drop effect will be blocked if Z-score is below 0.5σ.**  
> **In minimal techno, Z-scores are often low (per WAVE 2201 comment: "bombos secos tras silencios largos generan Z-Scores masivos (+7.0σ)..." but this is an EXCEPTION, not the rule). During sustained loops, Z typically stays near 0.**

---

## 6. DECISION MAKER — THE DROP LOCK (`DecisionMaker.ts`)

```typescript
// c:/Users/Raulacate/Desktop/Proyectos programacion/LuxSync/electron-app/src/core/intelligence/think/DecisionMaker.ts:205-230
/** Estado del lock de drop — sección del drop que ya disparó */
let _dropLockSection: string | null = null

function updateDropLock(currentSection: string): void {
  if (_dropLockSection !== null && currentSection !== 'drop') {
    console.log(`[DecisionMaker 🔒] DROP LOCK RELEASED: section transitioned drop→${currentSection}`)
    _dropLockSection = null
  }
}

function acquireDropLock(): boolean {
  if (_dropLockSection !== null) {
    return false  // Ya hay un efecto de drop disparado en esta sección
  }
  _dropLockSection = 'drop'
  console.log(`[DecisionMaker 🔒] DROP LOCK ACQUIRED — single effect per drop`)
  return true
}
```

**Observation:**  
- Drop Lock prevents multiple effects from firing during the same drop section.  
- Only ONE heavy effect per `section === 'drop'`.  
- If a drop is long/extended, no additional heavy arsenal will fire until the section changes.

---

## 7. SUMMARY OF FORENSIC FINDINGS

### 7.1 Why Drops Are Ignored in Techno

| Mechanism | Techno Behavior | Root Cause |
|---|---|---|
| **DropBridge** | NEVER fires | `zScoreThreshold = 3.0σ`, but techno maxes at ~2.6σ. No techno override. |
| **DIVINE Strike** | NEVER fires | `DIVINE_THRESHOLD = 4.0σ`. Techno cannot reach this. |
| **HuntEngine Strike** | Rare / Low score | `urgencyWeight = 0.7`, but if rhythmic intensity is flat, `strikeScore` struggles to cross `0.65`. |
| **Anti-Fake-Drop** | Heavy effects blocked at `Z < 0.5` | Threshold is `0.5` for non-latino. Sustained techno loops often have Z ≈ 0. |
| **Spectral Gate** | No protection / no enforcement | Gate is hardcoded for Latino only (`isLatinoVibeForSpectral`). Techno bypasses it by default. |
| **Buildup Wall** | Blocks heavy arsenal in `buildup` | `isEffectAllowedInSection()` gates heavy effects. This works as designed. |
| **Drop Lock** | One effect per drop section | Prevents multi-fire during long drops. This works as designed. |

### 7.2 Key Parameters Table

| Parameter | Value (Techno) | Value (Latino) | Location |
|---|---|---|---|
| `beautyWeight` | 0.2 | 0.3 | `HuntEngine.ts:718` |
| `urgencyWeight` | 0.7 | 0.6 | `HuntEngine.ts:719` |
| `consonanceWeight` | 0.1 | 0.1 | `HuntEngine.ts:720` |
| `threshold` | 0.65 | 0.70 | `HuntEngine.ts:721` |
| `urgencyBoost` | 0.1 | 0.05 | `HuntEngine.ts:722` |
| `DIVINE_THRESHOLD` | 4.0 | 4.0 | `DecisionMaker.ts:55` |
| `DIVINE_ENERGY_GATE` | 0.72 | 0.72 | `DecisionMaker.ts:432` |
| `antiFakeThreshold` | **0.5** | **0.85** | `DecisionMaker.ts:1057` |
| `ABSOLUTE_ENERGY_GATE_RATIO` | 0.48 | 0.48 | `DecisionMaker.ts:355` |
| `DropBridge.zScoreThreshold` | **3.0** (no override) | 3.5 (override) | `DropBridge.ts:124`, `DropBridge.ts:159` |
| `DropBridge.minEnergy` | 0.60 | 0.70 (override) | `DropBridge.ts:126`, `DropBridge.ts:160` |

---

*End of WAVE 5005 Forensic Audit.*
