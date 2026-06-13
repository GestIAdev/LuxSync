# WAVE-6050: Volcado Forense del Omni-Líquido

> **Rol:** Ingeniero Core — Calibración de Back Pars & Movers en Latino  
> **Origen:** `LiquidEngineBase.ts`, `LiquidEnvelope.ts`, `profiles/latino.ts`  
> **Propósito:** Transferencia estructurada de las matemáticas clave al equipo de arquitectura tras bloqueo de red.

---

## 1. La Ecuación Morfológica (`LiquidEngineBase.ts:300-324`)

Calcula `morphFactor` como promedio lineal de `bands.mid`. El profiler usa EMA asimétrico (85% / 98%) — ataque rápido, caída muy lenta. `morphFactor` es **histórico**, no de frame.

```typescript
let morphFactor: number
if (input.morphFactorOverride !== undefined) {
  morphFactor = Math.min(1.0, Math.max(0.0, input.morphFactorOverride))
  if (bands.mid > this.avgMidProfiler) {
    this.avgMidProfiler = this.avgMidProfiler * 0.85 + bands.mid * 0.15
  } else {
    this.avgMidProfiler = this.avgMidProfiler * 0.98 + bands.mid * 0.02
  }
} else {
  if (bands.mid > this.avgMidProfiler) {
    this.avgMidProfiler = this.avgMidProfiler * 0.85 + bands.mid * 0.15
  } else {
    this.avgMidProfiler = this.avgMidProfiler * 0.98 + bands.mid * 0.02
  }
  morphFactor = Math.min(1.0, Math.max(0.0,
    (this.avgMidProfiler - p.morphFloor) / (p.morphCeiling - p.morphFloor)
  ))
}
```

**Parámetros Latino:** `morphFloor = 0.45`, `morphCeiling = 0.65`. Rango efectivo típico: **0.30–0.80**.

---

## 2. El Filtro Anti-Voces de los Back Pars (`LiquidEngineBase.ts`)

### 2A. HARMONIC REJECTION GATE (pre-filtro, líneas 261-298)

Ratio `transientTop / harmonicBase`. Bajo ratio = zona tonal/voz = `tonalSquelch = 0`.

```typescript
const harmonicBase = bands.mid
const transientTop = bands.highMid + bands.treble + (bands.ultraAir * 0.5)

let tonalSquelch = 1.0
let percussiveRatio = 0

if (harmonicBase > 0.05) {
  percussiveRatio = transientTop / (harmonicBase || 0.01)

  // WAVE 4948 — LATINO VOCAL KILL HARDENING
  if (percussiveRatio < 0.88) {
    tonalSquelch = 0.0 // muerte absoluta
  } else if (percussiveRatio < 1.12) {
    tonalSquelch = 0.22 // zona mixta castigada
  }
}

if (transientTop < 0.15 && harmonicBase < 0.3) {
  tonalSquelch = 0.0 // WAVE 4945: cero puro en apagones
}

const rawSnare = bands.highMid * tonalSquelch
const rawHat = bands.treble * tonalSquelch
```

### 2B. TRANSIENT SHAPER — Back R (El Látigo, líneas 433-512)

Construye `hybridSnare` con `vocalPenalty` y **Morphologic Centroid Shield**.

```typescript
const currentTreble  = rawHat
const currentHighMid = rawSnare
const currentMid     = bands.mid
const trebleDelta    = Math.max(0, currentTreble  - this.lastTreble)
const highMidDelta   = Math.max(0, currentHighMid - this.lastHighMid)
const midDelta       = Math.max(0, currentMid     - this.lastMid)
this.lastTreble  = currentTreble
this.lastHighMid = currentHighMid
this.lastMid     = currentMid

// WAVE 4812 M3: ANTI-VOCAL GATE en midDelta
const MIN_DELTA = 0.020
const midCentWeight = Math.min(1.0, (input.spectralCentroid ?? 0) / 1500)
const vocalPenalty = Math.min(0.75,
  this._vocalSustainEMA * Math.max(0, 1.0 - midDelta / Math.max(0.001, this._vocalSustainEMA))
)
const midDeltaGated = midDelta * (1.0 - vocalPenalty)
const impactDelta = trebleDelta + (highMidDelta * 1.5)
  + (midDeltaGated * (0.8 + 0.7 * midCentWeight))
const cleanDelta = Math.max(0, impactDelta - MIN_DELTA)
const baseSnare = cleanDelta * 2.0
const clapBonus = baseSnare * harshness * 2.0
let hybridSnare = baseSnare + clapBonus

// WAVE 4826.3 — ANTI-VOCAL GATE en hybridSnare
if (trebleDelta < vocalPenalty * 0.35 && hybridSnare < 0.6) {
  hybridSnare *= 0.15
}

// THE MORPHOLOGIC CENTROID SHIELD (WAVE 2449)
if (isKick) {
  const centroidFloor = 900 * (1.0 - morphFactor)
  const currentCentroid = input.spectralCentroid ?? 0
  const DUBSTEP_SNARE_MIN_HARSHNESS = 0.024
  if (currentCentroid < centroidFloor && harshness < DUBSTEP_SNARE_MIN_HARSHNESS) {
    hybridSnare = 0.0
  }
}

const snareAttack = hybridSnare
let backRight = this.envSnare.process(hybridSnare, morphFactor, now, false)
```

### 2C. BACK L (El Coro, líneas 605-613)

`mid` atenúado por `vocalPenalty × 0.80`. Resta treble y bass.

```typescript
const midSynthInput = Math.max(0,
  bands.lowMid * p.backLLowMidWeight
  + bands.mid * p.backLMidWeight * (1.0 - vocalPenalty * 0.80)
  - bands.treble * p.backLTrebleSub
  - bands.bass * p.backLBassSub
)
let backLeft = this.envHighMid.process(midSynthInput, morphFactor, now, isBreakdown)
```

**Parámetros clave Latino (Back):**
- `percMidSubtract = 2.0` (base) / `3.0` (override 4.1)
- `backLTrebleSub = 0.28`
- `envelopeHighMid.gateOn = 0.35`
- `envelopeHighMid.squelchBase = 0.38`
- override 4.1 `sustainedSquelchMaxBoost = 0.60`

---

## 3. El "Punch" de los Movers (`LiquidEngineBase.ts:579-639`)

### 3A. MOVER L — El Galán (Cross-filter + Envelope)

Mezcla `highMid + treble + mid` con pesos de perfil. Gate tonal (`flatness < threshold`). Entra a `envTreble`.

```typescript
const moverLRaw = Math.max(0,
  bands.highMid * p.moverLHighMidWeight +
  bands.treble  * p.moverLTrebleWeight  +
  bands.mid     * p.moverLMidWeight
)
const isTonal = flatness < p.moverLTonalThreshold ? 1.0 : 0.0
const moverLInput = moverLRaw * isTonal
moverLeft = this.envTreble.process(moverLInput, morphFactor, now, isBreakdown)
```

### 3B. MOVER R — La Dama (CleanMid + Bass Subtractor)

```typescript
const subtractFactor = p.bassSubtractBase - morphFactor * p.bassSubtractRange
const cleanMid = Math.max(0, bands.mid - bands.bass * subtractFactor)
const moverRInput = Math.max(0, cleanMid - bands.treble * p.moverRTrebleSub)
moverRight = this.envVocal.process(moverRInput, morphFactor, now, isBreakdown)
```

### 3C. SIDECHAIN / APOCALYPSE (líneas 625-639)

Latino: `sidechainDepth = 0.00` (exterminado). Apocalypse Mode eleva movers en caos real.

```typescript
const frontMax = Math.max(frontLeft, frontRight)

if (p.layout41Strategy !== 'strict-split' && frontMax > p.sidechainThreshold) {
  const ducking = 1.0 - frontMax * p.sidechainDepth
  moverLeft *= ducking
  moverRight *= ducking
} else if (p.layout41Strategy !== 'strict-split') {
  const isApocalypse = harshness > p.apocalypseHarshness && flatness > p.apocalypseFlatness
  if (isApocalypse) {
    const chaosEnergy = Math.max(bands.mid, bands.treble)
    backRight = Math.max(backRight, chaosEnergy)
    moverLeft = Math.max(moverLeft, chaosEnergy)
    moverRight = Math.max(moverRight, chaosEnergy)
  }
}
```

**Parámetros clave Latino (Movers):**
- `moverLHighMidWeight = 0.50`, `moverLTrebleWeight = 0.20`, `moverLMidWeight = 0.40`
- `moverLTonalThreshold = 0.99` (desactivado en 4.1)
- `bassSubtractBase = 0.45`, `moverRTrebleSub = 0.45`
- `sidechainDepth = 0.00`
- `envelopeTreble.gateOn = 0.18`, `boost = 4.2`, `crushExponent = 1.8`, `decayBase = 0.72`
- `envelopeVocal.gateOn = 0.15`, `boost = 4.0`, `crushExponent = 1.5`, `decayBase = 0.72`

---

## 4. El Corazón del Fluido — `LiquidEnvelope.process()`

> **Ubicación:** `src/hal/physics/LiquidEnvelope.ts:169-343`  
> **Pipeline:** 10 etapas deterministas. Cero `Math.random()`.

```typescript
process(signal: number, morphFactor: number, now: number, isBreakdown: boolean): number {
  const c = this.config
  const s = this.state

  // ═══════════════════════════════════════════════════════════════════
  // 1. VELOCITY GATE — attack-only trigger + Undertow grace frame
  // ═══════════════════════════════════════════════════════════════════
  const velocity = signal - s.lastSignal
  s.lastSignal = signal

  const isRisingAttack = velocity >= -0.005
  const isGraceFrame = s.wasAttacking && velocity >= -0.03
  const isAttacking = isRisingAttack || isGraceFrame
  s.wasAttacking = isRisingAttack && velocity > 0.01

  // ═══════════════════════════════════════════════════════════════════
  // 2. ASYMMETRIC EMA — attack slow (0.98/0.02), decay fast (0.88/0.12)
  // ═══════════════════════════════════════════════════════════════════
  if (signal > s.avgSignal) {
    s.avgSignal = s.avgSignal * 0.98 + signal * 0.02
  } else {
    s.avgSignal = s.avgSignal * 0.88 + signal * 0.12
  }

  // ═══════════════════════════════════════════════════════════════════
  // 3. PEAK MEMORY + TIDAL GATE — adaptive peak decay
  // ═══════════════════════════════════════════════════════════════════
  const timeSinceLastFire = s.lastFireTime > 0 ? now - s.lastFireTime : 0
  const isDrySpell = timeSinceLastFire > 2000
  const peakDecay = isDrySpell ? 0.985 : 0.993
  if (s.avgSignal > s.avgSignalPeak) {
    s.avgSignalPeak = s.avgSignal
  } else {
    s.avgSignalPeak = s.avgSignalPeak * peakDecay + s.avgSignal * (1 - peakDecay)
  }

  // ═══════════════════════════════════════════════════════════════════
  // 4. ADAPTIVE FLOOR — Tidal Gate floor degradation
  // ═══════════════════════════════════════════════════════════════════
  const drySpellFloorDecay = timeSinceLastFire > 3000
    ? Math.min(1.0, (timeSinceLastFire - 3000) / 3000)
    : 0
  const adaptiveFloor = c.gateOn - (0.12 * drySpellFloorDecay)
  const avgEffective = Math.max(s.avgSignal, s.avgSignalPeak * 0.55, adaptiveFloor)

  // ═══════════════════════════════════════════════════════════════════
  // 5. DYNAMIC GATE — gate adaptativo con margen fijo
  // ═══════════════════════════════════════════════════════════════════
  const dynamicGate = avgEffective + c.gateMargin

  // ═══════════════════════════════════════════════════════════════════
  // 6. ANTI-SUSTAIN TRACKER — WAVE 4780: mata notas planas (autotune)
  // ═══════════════════════════════════════════════════════════════════
  const sustainStart = c.sustainedSquelchStartFrames ?? 0
  const sustainRise = c.sustainedSquelchRisePerFrame ?? 0
  const sustainMaxBoost = Math.max(0, c.sustainedSquelchMaxBoost ?? 0)
  const flatVelocityMax = c.sustainedFlatVelocityMax ?? 0.006
  const isSustainCandidate = signal > dynamicGate && Math.abs(velocity) <= flatVelocityMax

  if (sustainStart > 0 && sustainRise > 0 && isSustainCandidate && !isBreakdown) {
    s.sustainedFrames += 1
    if (s.sustainedFrames > sustainStart) {
      s.sustainedSquelchBoost = Math.min(
        sustainMaxBoost,
        s.sustainedSquelchBoost + sustainRise,
      )
    }
    if (c.adaptiveNoiseAlpha !== undefined) {
      const adaptive = Math.max(0, Math.min(1, c.adaptiveNoiseAlpha))
      s.avgSignal = s.avgSignal * (1 - adaptive) + signal * adaptive
      s.avgSignalPeak = Math.max(
        s.avgSignal,
        s.avgSignalPeak * (1 - adaptive * 0.5) + s.avgSignal * (adaptive * 0.5),
      )
    }
  } else {
    s.sustainedFrames = 0
    s.sustainedSquelchBoost *= 0.45
  }

  // ═══════════════════════════════════════════════════════════════════
  // 7. DECAY — Morfología líquida (decayBase + decayRange * morphFactor)
  // ═══════════════════════════════════════════════════════════════════
  const decay = c.decayBase + c.decayRange * morphFactor
  s.intensity *= decay

  // ═══════════════════════════════════════════════════════════════════
  // 8. MAIN GATE — Crush exponent + breakdown penalty
  // ═══════════════════════════════════════════════════════════════════
  const breakdownPenalty = isBreakdown ? 0.06 : 0
  const attackSlopeMin = c.attackSlopeMin ?? 0
  let kickPower = 0
  let ghostPower = 0

  if (signal > dynamicGate && isAttacking && signal > 0.15 && velocity >= attackSlopeMin) {
    const requiredJump = 0.14 - 0.07 * morphFactor + breakdownPenalty
    let rawPower = (signal - dynamicGate) / requiredJump
    rawPower = Math.min(1.0, Math.max(0, rawPower))
    const crushExp = c.crushExponent + 0.3 * (1.0 - morphFactor)
    kickPower = Math.pow(rawPower, crushExp)
  } else if (signal > avgEffective && signal > 0.15 && !isBreakdown) {
    const ghostCapDynamic = c.ghostCap * morphFactor
    const proximity = (signal - avgEffective) / 0.02
    ghostPower = Math.max(ghostCapDynamic, Math.min(ghostCapDynamic, proximity * ghostCapDynamic))
  }

  // ═══════════════════════════════════════════════════════════════════
  // 9. IGNITION SQUELCH — Anti-pad-ghost + anti-sustain dinámico
  // ═══════════════════════════════════════════════════════════════════
  const squelchBase = Math.max(0.02, c.squelchBase - c.squelchSlope * morphFactor)
  const squelch = Math.min(0.98, squelchBase + s.sustainedSquelchBoost)

  if (kickPower > squelch) {
    s.lastFireTime = now
    const hit = Math.min(
      c.maxIntensity,
      kickPower * (1.2 + 0.8 * morphFactor) * c.boost
    )
    if (c.riseRate !== undefined && c.riseRate < 1.0) {
      const ceiling = Math.max(s.intensity, hit)
      s.intensity = Math.min(ceiling, s.intensity + c.riseRate)
    } else {
      s.intensity = Math.max(s.intensity, hit)
    }
  } else if (ghostPower > 0) {
    s.intensity = Math.max(s.intensity, ghostPower)
  }

  // ═══════════════════════════════════════════════════════════════════
  // 10. SMOOTH FADE — Anti-guillotine low-end filter (quadratic below 0.08)
  // ═══════════════════════════════════════════════════════════════════
  const fadeZone = 0.08
  const fadeFactor = s.intensity >= fadeZone
    ? 1.0
    : Math.pow(s.intensity / fadeZone, 2)

  const faded = Math.min(c.maxIntensity, s.intensity * fadeFactor)
  return faded
}
```

---

## Resumen de Constantes Invariantes

| Constante | Valor | Significado |
|---|---|---|
| `RECOVERY_DURATION` | `2000` ms | Rebound post-silencio/AGC |
| `peakDecay.normal` | `0.993` | Half-life ~4.7s del pico |
| `peakDecay.drySpell` | `0.985` | Half-life ~1.5s si >2s sin disparo |
| `adaptiveFloor.degradation` | `0.12` | Cuánto baja el floor en dry spell |
| `avgEffective.minRatio` | `0.55` | `avgSignalPeak × 0.55` como piso |
| `fadeZone` | `0.08` | Zona cuadrática de fade anti-guillotine |
| `requiredJump.base` | `0.14` | Salto mínimo para trigger MAIN GATE |
| `requiredJump.morphDiscount` | `0.07` | Descuento por morphFactor |
| `crushExp.morphBonus` | `0.3` | Extra compresión en morph bajo |
| `hitGain.base` | `1.2` | Ganancia base post-squelch |
| `hitGain.morphBonus` | `0.8` | Extra ganancia por morphFactor |
