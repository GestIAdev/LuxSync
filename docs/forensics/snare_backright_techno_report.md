# SNARE BACK RIGHT (Techno) — Reporte Forense del Algoritmo

> **Perfil:** `TECHNO_PROFILE` (`techno.ts`)
> **Motor:** `LiquidEngineBase` → `LiquidEngine41.routeZones()` (strict-split)
> **Envelope:** `envSnare` (LiquidEnvelope)
> **Fecha:** 2026-09-11
> **Estado:** READ-ONLY (extracción para recalibración)

---

## 1. Arquitectura General

El snare Back Right en Techno es el canal más complejo del motor Liquid. No es un simple envelope — es un **pipeline de detección de onsets de 5 etapas** que alimenta un `LiquidEnvelope` final.

```
GodEarFFT (señales crudas)
    │
    ├─ snare_energy (EMA gateada, body×crack)
    ├─ snare_energy_ungated (crack raw 2-5kHz)
    ├─ raw_snare_delta (transient edge pre-EMA)
    ├─ snare_crack_flux (flux localizado 2-5kHz)
    ├─ snare_body_factor (body/bodyEMA continuo)
    ├─ raw_hh_delta (transient edge hi-hats 5-15kHz)
    ├─ hh_energy (EMA 5-15kHz)
    ├─ spectralFlux (flux global)
    ├─ whiteNoiseScore (WNS — broadband HF)
    ├─ flatness (Wiener entropy)
    ├─ agcGainFactor (compresión AGC)
    ├─ beatPhase / pllLocked / beatCount (PLL beat grid)
    └─ sectionType (drop/verse/breakdown)
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  DETECCIÓN DE ONSET (LiquidEngineBase:807-1656)     │
│                                                     │
│  Techno usa: EMA MOMENTUM DETECTOR (MACD-style)     │
│  (snareMomentumThreshold definido → bypass 5-path)  │
│                                                     │
│  snareDrive = max(crackDrive, trebleGhost)          │
│  momentum = emaFast - emaSlow                       │
│  rawOnset = crossover(momentum > dynTh)             │
│  + bypass rescue (UnG/Res/RawΔ/Flux)                │
│  + density path (white noise buildup)                │
│                                                     │
│  → hybridSnare = snareImpulse (1.0 → decay)          │
└─────────────────────────────────────────────────────┘
    │
    ├─ SUSTAIN CHOKE (1668-1694)
    ├─ TONALITY VETO (1714-1788)
    ├─ CENTROID SHIELD (1801-1808)
    │
    ▼
┌─────────────────────────────────────────────────────┐
│  envSnare.process(hybridSnare, morphFactor, now)    │
│  (LiquidEnvelope estándar — gate/decay/crush)       │
└─────────────────────────────────────────────────────┘
    │
    ▼
  backRight → routeZones() → backPar (strict-split: SOLO snare)
```

### Routing en 4.1 (strict-split)

```ts
// LiquidEngine41.ts:87
const backPar = isStrict ? backRight : Math.max(backLeft, backRight)
```

En Techno 4.1, el Back PAR recibe **SOLO** el snare. No compite con el colchón de mid synths (envHighMid). El colchón va a los Movers.

---

## 2. Envelope Actual: `envelopeSnare` (Techno base)

```ts
// techno.ts:100-112
envelopeSnare: {
  name: 'Back R (Percussion Slap)',
  gateOn: 0.28,        // BACK-PAR TUNE: 0.35→0.28 — re-disparar más fácil
  boost: 2.5,          // WAVE 8009.3: 1.0→2.5 — igualar ganancia Latino
  crushExponent: 1.0,  // Lineal — sin compresión de transitorio
  decayBase: 0.32,     // WAVE 7749.21: 0.40→0.32 — snap industrial brutal
                       // Cae a negro en ~90ms (4 frames @ 44Hz)
  decayRange: 0.40,    // WAVE 2451: morph modula el decay
                       // decay efectivo = 0.32 + 0.40×morph
                       // morph=0 (industrial): 0.32 (seco)
                       // morph=1 (melódico): 0.72 (flotante)
  maxIntensity: 1.0,   // Sin cap
  squelchBase: 0.20,    // WAVE 6066: 0.52→0.20 — limpieza pre-envelope
  squelchSlope: 0.10,
  ghostCap: 0.00,      // Negro absoluto entre golpes
  gateMargin: 0.01,
}
```

### Override 4.1

```ts
// techno.ts:371-373 (overrides41)
envelopeSnare: {
  gateOn: 0.22,         // WAVE 2520: 0.28→0.22 — más sensible en compactación
}
```

### Curva de decay por morphFactor

| morphFactor | decay efectivo | Half-life (frames) | Half-life (ms) | Carácter |
|---|---|---|---|---|
| 0.0 (industrial puro) | 0.32 | ~2 | ~45ms | Snap brutal, seco |
| 0.3 (techno duro) | 0.44 | ~2.5 | ~57ms | Percutivo |
| 0.5 (techno medio) | 0.52 | ~3 | ~68ms | Pulso ágil |
| 0.8 (Anyma/melódico) | 0.64 | ~4.5 | ~102ms | Flotante, relleno |
| 1.0 (melódico puro) | 0.72 | ~6.5 | ~148ms | Cola suave |

---

## 3. Detector de Onsets: EMA Momentum (MACD-style)

Techno **no usa** el cascade de 5 paths (WNS/Flux/Energy/Pending/Path4). Define `snareMomentumThreshold: 0.01` → activa el **EMA Momentum Detector**, que reemplaza todo el cascade con matemática pura.

### 3.1 Construcción de `snareDrive`

El drive es la señal que alimenta las EMAs. Se construye como `max(crackDrive, trebleGhost)`:

#### Término A: Crack Drive (acoustic snare path)

```ts
// LiquidEngineBase.ts:984-1027

// 1. DESCORRELACIÓN DE GRAVES (NLMS asimétrico)
//    El kick bleed en la banda crack (2-5kHz) es predecible desde bassE.
//    Un snare = la parte de crack que el bass NO puede explicar.
const crack = input.snare_energy_ungated ?? snareEnergy
const bleedErr = crack - this._crackBleedK * bassE
// NLMS asimétrico:
//   error > 0 (snare real): adapta lento (μ=0.015) → no aprende a cancelar snares
//   error < 0 (kick bleed): adapta rápido (μ=0.05) → converge al floor de coupling
this._crackBleedK += bleedMu * bleedErr * bassE / (BLEED_EPS + bassE * bassE)
const residual = bleedErr > 0 ? bleedErr : 0  // solo energía positiva = snare

// 2. CRACK-BAND FLUX (transitorio localizado 2-5kHz)
//    Un snare inyecta ruido broadband EN 2-5kHz → crackFlux spiking
//    Un hi-hat a 10kHz NO mueve 2-5kHz → crackFlux stays low
const crackFlux = input.snare_crack_flux ?? spectralFlux

// 3. BODY FACTOR (resonancia de parche 150-250Hz)
//    Snare real: body > EMA → factor > 1 (boost)
//    Clap/rimshot: crack pero no body → factor ≈ 0.5 (penalty)
const bodyFactor = input.snare_body_factor ?? 1.0

// 4. SMART sEF (SnareEnergy Factor — gate AND continuo)
//    Reemplaza el hard SnareE gate con multiplicador continuo [0.05, 1.0]
//    Real snare: SnareE ≈ 0.56 → sEF = 1.0 (transparente)
//    FP clean:   SnareE ≈ 0.01 → sEF = 0.05 (aplastado)
const smartSef = Math.max(relaxedMinSef, Math.min(1.0, sefInput * 2.0))

// WAVE 7749.102: WNS SOFT GATE — si gate vivo + WNS<0.05 + Flux<0.25:
//   synth bass stab → reduce crackDrive 70%
if (gateHealth > 0.1 && wns < 0.05 && spectralFlux < 0.25) {
  crackDrive *= 0.3
}

const crackDrive = residual * crackFlux * bodyFactor * smartSef
```

#### Término B: Treble Ghost (synthetic snare rescue)

```ts
// LiquidEngineBase.ts:1145-1274

// Para snares sintéticos (Tiesto, Anyma) sin body resonance ni crack transient:
//   el reverbtail vive en 5-15kHz (hh band) → raw_hh_delta spiking
const rawHhDelta = input.raw_hh_delta ?? 0
const ghostWeight = 1.0 - spectralDensity  // solo en tracks limpios

// RHYTHM GATE (WAVE 7749.86) — ghost solo en backbeats (2 & 4) cuando gate dead
//   gateHealth=1 (alive): rhythmMult=1.0 (no filter)
//   gateHealth=0 (dead):  rhythmMult=backbeat(1.0)/onbeat(0.30)/offbeat(0.10)
const rhythmMult = gateHealth * 1.0 + (1.0 - gateHealth) * rhythmMultRaw

// GATEHEALTH GATE (WAVE 7749.97) — ghost solo cuando gate está muerto
const ghostGateFactor = 1.0 - gateHealth

// RES GATE (WAVE 7749.99) — soft-gate por residual
//   Real snare (Res>0.20): gate=1.0 → full ghost
//   Synth stab (Res=0.05): gate=0.3 → ghost reduced 70%
const ghostResGate = 0.3 + 0.7 * Math.max(0, Math.min(1, (residual - 0.05) / 0.15))

// GHOST REFRACTORY (WAVE 7749.87) — 7 frames de supresión post-onset
//   mata re-fires del reverb tail (hhDlt elevado 6-8 frames post-snare)
const trebleGhost = ghostRefractoryActive ? 0
  : rawHhDelta * smartSef * ghostWeight * rhythmMult * ghostGateFactor * ghostResGate

const snareDrive = Math.max(crackDrive, trebleGhost)
```

### 3.2 MACD Crossover

```ts
// LiquidEngineBase.ts:1279-1287

// Dual-EMA crossover (MACD-style)
this._snareEmaFast += aF * (snareDrive - this._snareEmaFast)  // αF = 1.00 (zero lag)
this._snareEmaSlow += aS * (snareDrive - this._snareEmaSlow)  // αS = 0.05 (τ ≈ 450ms)
let momentum = this._snareEmaFast - this._snareEmaSlow

// Cruce topológico: momentum solo puede cruzar θ upward una vez por rise
const isCrossover = momentum > dynamicMomoTh && this._snarePrevMomentum <= dynamicMomoTh
```

### 3.3 Threshold Dinámico (macro-awareness)

```ts
// LiquidEngineBase.ts:1032-1065

// spectralDensity = 0.25×harshness + 0.15×flatness + 0.60×hh_energy
const spectralDensity = clamp(0.25 * harsh + 0.15 * flat + 0.60 * hhEnergy, 0, 1)

// Threshold respira con la densidad espectral
let dynamicMomoTh = 0.008 + (0.030 * spectralDensity)

// Section bonus: drops/chorus suben el threshold 20% (errores más visibles)
if (sectionType === 'drop' || sectionType === 'chorus') {
  dynamicMomoTh *= 1.2
}
```

| Track | hh_energy | spectralDensity | dynTh (verse) | dynTh (drop) |
|---|---|---|---|---|
| Brejcha (denso) | 0.401 | ~0.31 | 0.017 | 0.021 |
| Tiesto (limpio) | 0.241 | ~0.20 | 0.014 | 0.017 |
| Minimal (saturado) | 0.15 | ~0.15 | 0.013 | 0.015 |

### 3.4 Dynamic Floor (anti-hi-hat + buildup rescue)

```ts
// LiquidEngineBase.ts:1290-1325

const snareFloorBase = p.snareMomentumFloor ?? 0        // techno: 0.07
const snareFloorMin = p.snareMomentumFloorMin ?? 0     // techno: 0.005

// Floor respira con fBL (fluxBaseline EMA) × (1 - gateHealth)
//   gate vivo (Minimal): relaxation=0 → floor estricto 0.07
//   gate muerto (Opus):  relaxation activa → floor baja a 0.005
const floorRelaxation = Math.max(0, this._fluxBaseline - 0.04) * 4.0 * (1.0 - gateHealth)
const rawFloor = Math.max(snareFloorMin, snareFloorBase - floorRelaxation)

// EMA smoothing (α=0.15, τ~150ms) — glides en vez de jitter
this._snareFloorEma = this._snareFloorEma * 0.85 + rawFloor * 0.15
const snareFloor = this._snareFloorEma
```

| Escenario | fBL | gateHealth | rawFloor | snareFloor (EMA) | Efecto |
|---|---|---|---|---|---|
| Minimal normal | 0.04 | 1.0 | 0.07 | 0.07 | Estricto — hi-hats bloqueados |
| Brejcha hi-hats | 0.03 | 0.8 | 0.07 | 0.07 | Estricto |
| Opus buildup | 0.06 | 0.0 | 0.03 | ~0.04 | Relajado |
| Opus peak | 0.085 | 0.0 | 0.005 | ~0.01 | Máxima relajación |

### 3.5 Onset + Refractory

```ts
// LiquidEngineBase.ts:1337-1427

if (this._snareRefractoryFrames > 0) {
  this._snareRefractoryFrames--
  rawOnset = false   // anti-double (4 frames ~91ms)
} else {
  rawOnset = isCrossover && snareDrive >= snareFloor

  // BYPASS RESCUE — snares que el MACD no detecta pero tienen firma inequívoca
  if (!rawOnset && ungatedSnare > 0.4 && residual > 0.3
      && rawSnareDelta > 0.2 && spectralFlux > bypassFluxTh
      && !(snareEnergy < 0.2 && hhEnergy > 0.5)) {
    rawOnset = true
  }

  // DENSITY PATH — white noise buildup rescue (ver sección 5)
  if (!rawOnset && this._fluxBaseline > 0.09 && gateHealth < 0.05
      && ungatedSnare > 0.45 && snareDrive >= snareFloor) {
    rawOnset = true
    this._snareRefractoryFrames = 2  // 2 frames (no 4) — denso
  } else if (rawOnset) {
    this._snareRefractoryFrames = 4  // estándar
  }
  // Ghost refractory siempre se setea
  this._ghostRefractoryFrames = 7
}
```

### 3.6 Hybrid Reset + Silence Reset

```ts
// LiquidEngineBase.ts:1444-1483

// HYBRID RESET — snare fuerte (>0.15 momentum) resetea emaSlow hacia emaFast
//   permite re-fire en bursts densos (snareperfecto: 32→40 onsets)
if (rawOnset) {
  if (momentum > 0.15) {  // snareMomentumResetThreshold
    this._snareEmaSlow += 0.70 * (this._snareEmaFast - this._snareEmaSlow)
    momentum = this._snareEmaFast - this._snareEmaSlow
  }
}

// SILENCE RESET — 8 frames (~182ms) de Drive<0.01 → reset EMAs a 0
//   evita que el detector se quede stuck tras un break/drop
if (this._snareEmaSlow > 0.10 && snareDrive < 0.01) {
  this._snareSilenceFrames++
  if (this._snareSilenceFrames >= 8) {
    this._snareEmaFast = 0
    this._snareEmaSlow = 0
    this._snarePrevMomentum = 0
  }
} else {
  this._snareSilenceFrames = 0
}
```

---

## 4. Post-Onset: Impulse Decay

```ts
// LiquidEngineBase.ts:1637-1655

if (rawOnset) {
  this._snareImpulse = 1.0
}
const snareImpulseThisFrame = this._snareImpulse
this._snareImpulse *= (p.snareImpulseDecay ?? 0.65)  // techno: 0.65
// → 1.0 → 0.65 → 0.42 → 0.27 → 0.18 → 0.12 → ...
//   ~200ms para decaer de 1.0 a 0.01

hybridSnare = snareImpulseThisFrame  // output = impulse pre-decay
```

| Frame | ms | Impulse | Carácter |
|---|---|---|---|
| 0 (onset) | 0 | 1.000 | Pico |
| 1 | 23 | 0.650 | Golpe |
| 2 | 45 | 0.423 | Cuerpo |
| 3 | 68 | 0.275 | Cola |
| 4 | 91 | 0.179 | Fade |
| 5 | 114 | 0.116 | Tenue |
| 8 | 182 | 0.032 | Casi negro |

---

## 5. Modo Denso: White Noise Buildup Rescue (DENSITY PATH)

```ts
// LiquidEngineBase.ts:1388-1419
```

Este es el "modo denso" para builds masivas de ruido blanco (Eric Prydz "Opus").

### Problema

En builds densas de white noise:
- `snare_energy` (gateada) = 0 → el gate del GodEarFFT asfixia el RhythmicPercussionTracker
- `raw_snare_delta` ≈ 0 → no hay transient edge (el ruido es continuo)
- `WNS` < 0.3 → no hay broadband confirmation
- `spectralFlux` < 0.20 → no hay flux spike
- El MACD no genera crossovers porque el drive es continuo, no transitorio

**El snare roll queda enterrado en el ruido. El MACD no lo ve.**

### Solución: DENSITY PATH

```ts
if (
  !rawOnset &&
  this._fluxBaseline > 0.09 &&    // solo en builds densas (silencio < 0.04)
  gateHealth < 0.05 &&              // gate muerto (no hay actividad percusiva = no synth FPs)
  ungatedSnare > 0.45 &&           // energía raw presente (el ruido tiene sustancia)
  snareDrive >= snareFloor          // pasa el floor dinámico
) {
  rawOnset = true
  this._snareRefractoryFrames = 2   // 2 frames (no 4) — disparo más denso
  this._ghostRefractoryFrames = 7
}
```

### Filosofía

> *"La manera de luchar contra el ruido blanco es pintar luz."*

Cuando el ruido blanco ES la señal (fBL > 0.09, gate muerto), cualquier frame con energía ungated > 0.45 se considera un frame de snare-roll que debe pintar luz.

### Diferencias con el path estándar

| Propiedad | Path estándar (MACD) | Density Path |
|---|---|---|
| Refractory | 4 frames (~91ms) | **2 frames (~45ms)** |
| Densidad de disparo | ~11 onsets/s | ~22 onsets/s |
| Condición | Crossover topológico | fBL > 0.09 + gate dead + UnG > 0.45 |
| Targets | Snares transitorios | Snares enterrados en white noise |

### Telemetría del density path

```
opusbuild20 dark zone: fBL 0.103-0.125, UnG 0.52, Drive 0.007
→ 34 missed frames would fire, filling the 66-frame gap
calib19 silence: fBL < 0.04 → blocked (no false fire)
missedsnare real: fBL ~0.05 → blocked (usa MACD/bypass en su lugar)
```

---

## 6. Sustain Choke

```ts
// LiquidEngineBase.ts:1658-1694

// Un snare explota y decae en <100ms. Una vocal sostiene.
// Si snare_energy stays elevated sin nuevos onsets → choke.

if (snareOnsetThisFrame) {
  this._snareSustainFrames = 0
  this._snareChokeFactor = 1.0      // release instantáneo
} else {
  this._snareSustainFrames++
  const chokeThreshold = p.snareChokeFrames ?? 2   // techno 4.1: 15
  if (this._snareSustainFrames > chokeThreshold && rawSnareEnergy < 0.15) {
    this._snareChokeFactor *= (p.snareChokeRate ?? 0.70)  // techno 4.1: 0.85
  } else if (rawSnareEnergy >= 0.15) {
    // Percusión activa (techno denso) → NO chokear
    this._snareChokeFactor = 1.0
  }
}
hybridSnare *= this._snareChokeFactor
```

### Valores Techno (overrides41)

| Parámetro | Valor | Efecto |
|---|---|---|
| `snareChokeFrames` | 15 (~340ms) | Espera 15 frames antes de chokear (anti-blackout en 4/4) |
| `snareChokeRate` | 0.85 | Decay suave (no 0.70 brutal) |

**High-energy guard:** Si `snareEnergy >= 0.15`, el choke se libera (percusión activa, no tail).

---

## 7. Tonality Veto (3 ejes ortogonales)

```ts
// LiquidEngineBase.ts:1697-1788

// AND-gate multiplicativo (promedio, no producto):
//   vetoFactor = (flatnessGate + wnsGate + fluxGate) / 3.0
//   hybridSnare *= (vetoFactor > 0.15 ? 1.0 : vetoFactor / 0.15)
```

### Ejes

| Eje | Floor | Knee | Qué mide |
|---|---|---|---|
| **Flatness** (Wiener entropy) | 0.04 | 0.10 | Tonal vs noise |
| **WNS** (whiteNoiseScore) | 0.04 | 0.20 | Broadband HF vs vocal/synth |
| **SpectralFlux** | 0.05 | 0.20 | Impulso vs sustain |

### Valores Techno (overrides41)

```ts
snareVetoFlatnessFloor: 0.04,
snareVetoFlatnessKnee:  0.10,
snareVetoWnsFloor:      0.04,
snareVetoWnsKnee:       0.20,
snareVetoFluxFloor:     0.05,
snareVetoFluxKnee:      0.20,
```

### Soft-knee

```ts
// Si vetoFactor > 0.15 → pasa sin penalización (×1.0)
// Si vetoFactor ≤ 0.15 → ramp lineal (vetoFactor / 0.15)
//   Vocal consonant: flat=0.02, wns=0, flux=0.05 → avg=0.02 → ×0.13 (suppressed)
//   Techno snare:   flat=0.34, wns=0, flux=0.97 → avg=0.44 → ×1.0 (PASSES)
```

---

## 8. Centroid Shield (anti-kick-bleed)

```ts
// LiquidEngineBase.ts:1790-1808

if (isKick) {
  const centroidFloor = 900 * (1.0 - morphFactor)
  // morph=0.1 (industrial): floor=810Hz → bloquea body del kick
  // morph=0.8 (melódico):   floor=180Hz → puerta abierta (Anyma)
  const currentCentroid = input.spectralCentroid ?? 0
  const DUBSTEP_SNARE_MIN_HARSHNESS = 0.024
  if (currentCentroid < centroidFloor && harshness < 0.024) {
    hybridSnare = 0.0   // kill total — es bombo, no snare
  }
}
```

---

## 9. Gate Health (meta-detección)

```ts
// LiquidEngineBase.ts:370-393

private static readonly GATE_HEALTH_ALPHA = 0.01      // EMA lenta (~2.3s @ 44Hz)
private static readonly GATE_HEALTH_THRESHOLD = 0.15

// gateHealth = min(1.0, snareEnergyEma / 0.15)
//   Minimal/TechHouse: SnareE EMA 0.15-0.45 → gH ≈ 1.0 (gate vivo)
//   Brejcha/Tiesto:    SnareE EMA < 0.05    → gH ≈ 0.0 (gate muerto)
```

### Qué controla gateHealth

| Sistema | gH=1 (vivo) | gH=0 (muerto) |
|---|---|---|
| Floor relaxation | 0 (estricto) | Activada (rescue) |
| Smart sEF relaxation | 0.05 (trust SnareE) | Full relaxation (rescue via UnG) |
| Treble ghost | 0 (suprimido) | Full (rescue sintéticos) |
| Rhythm gate | 1.0 (no filter) | Backbeat/onbeat/offbeat filter |

### Instant Gate Dead (WAVE 7749.96)

```ts
// gH es EMA lenta → no ve gate blindness transitorio
// Fix: detección instantánea
const instantGateDead = (snareEnergy < 0.05 && ungatedSnare > 0.3) ? 1.0 : 0.0

// Partial blindness (WAVE 7749.98)
const gateBlindnessRatio = snareEnergy > 0.02 ? ungatedSnare / snareEnergy : ...
const partialGateBlind = (gateBlindnessRatio > 3.0 && ungatedSnare > 0.3) ? 1.0 : 0.0

const effectiveGateDead = Math.max(1.0 - gateHealth, instantGateDead, partialGateBlind)
```

---

## 10. Constantes del Motor (hardcoded)

```ts
// LiquidEngineBase.ts

// Refractory
SNARE_REFRACTORY_FRAMES = 4       // ~91ms anti-double
GHOST_REFRACTORY_FRAMES = 7       // ~159ms anti-reverb-tail

// Gate Health
GATE_HEALTH_ALPHA = 0.01         // EMA τ ~2.3s
GATE_HEALTH_THRESHOLD = 0.15

// Rhythm Gate
RHYTHM_WINDOW_FRAMES = 3          // ~68ms window
RHYTHM_BACKBEAT_MULT = 1.0        // beats 2 & 4
RHYTHM_ONBEAT_MULT = 0.30         // beats 1 & 3
RHYTHM_OFFBEAT_MULT = 0.10        // corcheas intermedias

// Silence Reset
SILENCE_RESET_FRAMES = 8          // ~182ms

// NLMS Bleed Decorrelation
BLEED_MU_UP = 0.015               // adaptación lenta (snare real)
BLEED_MU_DOWN = 0.05              // adaptación rápida (kick bleed)
BLEED_EPS = 1e-3                  // regularización
BLEED_K_MAX = 3.0                 // clamp del coeficiente

// Dynamic Threshold
fluxBaseline EMA: α=0.02          // τ ~500ms
snareFloorEma: α=0.15             // τ ~150ms
```

---

## 11. Parámetros del Perfil Techno (snare)

### Base profile

| Parámetro | Valor | Descripción |
|---|---|---|
| `snareMomentumThreshold` | 0.01 | Activa MACD detector (bypass 5-path) |
| `snareMomentumAlphaFast` | 1.00 | EMA fast = zero lag (emaFast = SnareE) |
| `snareMomentumAlphaSlow` | 0.05 | EMA slow τ ≈ 450ms |
| `snareMomentumResetThreshold` | 0.15 | Hybrid reset en snares fuertes |
| `snareMomentumResetRatio` | 0.70 | Ratio de reset emaSlow→emaFast |
| `snareMomentumFloor` | 0.07 | Floor base del drive |
| `snareMomentumFloorMin` | 0.005 | Floor mínimo (Opus peak rescue) |
| `snarePath1BassDeltaFloor` | 0.005 | Anti-hi-hat surfer (bass debe estar rising) |
| `snareImpulseDecay` | 0.65 | Decay del impulse (1.0→0.01 en ~200ms) |

### overrides41

| Parámetro | Valor | Descripción |
|---|---|---|
| `envelopeSnare.gateOn` | 0.22 | Más sensible en compactación 4.1 |
| `snareVetoFlatnessFloor` | 0.04 | Veto flatness |
| `snareVetoFlatnessKnee` | 0.10 | |
| `snareVetoWnsFloor` | 0.04 | Veto WNS |
| `snareVetoWnsKnee` | 0.20 | |
| `snareVetoFluxFloor` | 0.05 | Veto flux |
| `snareVetoFluxKnee` | 0.20 | |
| `snareChokeFrames` | 15 | ~340ms antes de chokear |
| `snareChokeRate` | 0.85 | Decay suave del choke |
| `snareImpulseDecay` | 0.65 | Tail cohesivo (no 3-frame stutter) |

---

## 12. Telemetría FINESSE_AUDIT

### Activación

```ts
// LiquidEngineBase.ts:170-171
const FINESSE_AUDIT_ENABLED =
  (typeof process !== 'undefined' && process.env && process.env.LUX_FINESSE_AUDIT === '1')
```

**Default OFF.** Activar con `LUX_FINESSE_AUDIT=1` en el entorno.

### Condición de log

```ts
// LiquidEngineBase.ts:1836
if (FINESSE_AUDIT_ENABLED && (this._diagSnareOnset || this._diagIsKick || hybridSnare > 0.1))
```

Solo loguea frames con onset de snare, actividad de kick, o snare output significativo. ~40fps en techno.

### Campos del log

```
[FINESSE_AUDIT] SnareE:0.560 UnG:0.620 RawΔ:0.218 Flux:0.258 WNS:0.045 fBL:0.052
Gate:0.098 Veto:0.443 BassE:0.420 BassΔ:0.012
k:0.234 Res:0.365 cFx:0.180 bFct:1.200 sEF:1.000 Drive:0.079
fFloor:0.070 dynTh:0.015 sd:0.310 hE:0.292 hhDlt:0.0450 ghst:0.0230
gH:0.026 rGate:1.00 gRefr:0
OutSnare:0.650 OutKick:0.420 [ONSET]
```

| Campo | Variable | Descripción |
|---|---|---|
| `SnareE` | `_diagSnareEnergy` | snare_energy gateada (crack×body AND-gate) |
| `UnG` | `_diagSnareEnergyUngated` | snare_energy_ungated (crack raw 2-5kHz) |
| `RawΔ` | `_diagRawSnareDelta` | raw_snare_delta (transient edge pre-EMA) |
| `Flux` | `_diagFlux` | spectralFlux global |
| `WNS` | `_diagWns` | whiteNoiseScore (broadband HF) |
| `fBL` | `_fluxBaseline` | EMA de spectralFlux (density tracker, τ~500ms) |
| `Gate` | `_diagFinalThreshold` | finalSnareThreshold (dinámico por fBL) |
| `Veto` | `_diagVetoFactor` | Tonality veto factor (0=blocked, >0.15=pasa) |
| `BassE` | `_diagBassEnergy` | pureBassEnergy (kick band) |
| `BassΔ` | `_diagBassDelta` | bassDelta (kick transient edge) |
| `k` | `_diagCrackBleedK` | Coeficiente NLMS aprendido (kick→crack coupling) |
| `Res` | `_diagSnareResidual` | Residual tras descorrelación (snare real) |
| `cFx` | `_diagCrackFlux` | crack-band spectral flux (2-5kHz localizado) |
| `bFct` | `_diagBodyFactor` | Body factor [0.1, 2.0] (body/bodyEMA continuo) |
| `sEF` | `_diagSnareEnergyFactor` | Smart sEF [0.05, 1.0] (gate AND continuo) |
| `Drive` | `_diagSnareDrive` | max(crackDrive, trebleGhost) — lo que el MACD come |
| `fFloor` | `_diagFinalFloor` | Floor dinámico suavizado (EMA) |
| `dynTh` | `_diagDynamicMomoTh` | Threshold dinámico del MACD (breathing) |
| `sd` | `_diagSpectralDensity` | Densidad espectral (0.25h+0.15f+0.60hh) |
| `hE` | `_diagHhEnergy` | hh_energy (5-15kHz EMA) |
| `hhDlt` | `_diagRawHhDelta` | raw_hh_delta (transient edge hi-hats) |
| `ghst` | `_diagTrebleGhost` | Treble ghost drive (synthetic snare rescue) |
| `gH` | `_diagGateHealth` | Gate health [0, 1] (EMA ~2.3s) |
| `rGate` | `_diagRhythmMult` | Rhythm gate multiplier (backbeat/onbeat/offbeat) |
| `gRefr` | `_diagGhostRefractory` | Ghost refractory frames restantes |
| `OutSnare` | `backRight` | Output final tras envSnare.process() |
| `OutKick` | `frontRight` | Output final tras envKick.process() |
| `[ONSET]` | `_diagSnareOnset` | Flag de onset este frame |
| `[KICK]` | `_diagIsKick` | Flag de kick este frame |

### Performance note

> **WAVE GARBAGE-ZERO:** El audit fue deshabilitado por defecto (WAVE 7754) porque generaba ~46 strings efímeros por log a ~40fps → presión de GC → freezes del Event Loop → trips del watchdog DMX. Solo activar para debugging.

---

## 13. Interacción con Morphología (morphFactor)

El `morphFactor` afecta al snare en **4 puntos**:

### 13.1 Envelope decay (directo)

```ts
// LiquidEnvelope.ts:316
const decay = c.decayBase + c.decayRange * morphFactor
// techno: decay = 0.32 + 0.40 × morph
```

| morph | decay | Carácter |
|---|---|---|
| 0.0 | 0.32 | Industrial seco |
| 0.5 | 0.52 | Pulso ágil |
| 0.8 | 0.64 | Anyma flotante |

### 13.2 Centroid Shield

```ts
const centroidFloor = 900 * (1.0 - morphFactor)
// morph bajo → floor alto → bloquea body del kick
// morph alto → floor bajo → permite coexistencia kick+synth (Anyma)
```

### 13.3 Crush exponent (envelope)

```ts
// LiquidEnvelope.ts:335
const crushExp = c.crushExponent + 0.3 * (1.0 - morphFactor)
// techno: crush = 1.0 + 0.3×(1-morph)
// morph=0: crush=1.3 (más selectivo)
// morph=1: crush=1.0 (lineal)
```

### 13.4 Hit boost (envelope)

```ts
// LiquidEnvelope.ts:357
const hit = Math.min(c.maxIntensity, kickPower * (1.2 + 0.8 * morphFactor) * c.boost)
// morph=0: hit × (1.2 + 0) × 2.5 = ×3.0
// morph=1: hit × (1.2 + 0.8) × 2.5 = ×5.0 (más punch en melódico)
```

### Cálculo del morphFactor

```ts
// techno.ts:242-243
morphFloor: 0.30,      // avgMid mínimo para morph=0
morphCeiling: 0.70,    // avgMid máximo para morph=1

// LiquidEngineBase: avgMidProfiler EMA → morphFactor = clamp((avgMid - 0.30) / 0.40, 0, 1)
```

---

## 14. Diagrama de Flujo Completo (resumen)

```
INPUT (GodEarFFT)
  │
  ├─ ¿snareMomentumThreshold definido? (techno: SÍ → 0.01)
  │
  ├── SÍ → EMA MOMENTUM DETECTOR
  │   │
  │   ├─ crack = snare_energy_ungated
  │   ├─ NLMS decorrelation: residual = crack - k×bassE (k aprende online)
  │   ├─ crackDrive = residual × crackFlux × bodyFactor × smartSef
  │   │   └─ WNS soft gate: si gH>0.1 && WNS<0.05 && Flux<0.25 → ×0.3
  │   ├─ trebleGhost = rawHhDelta × smartSef × (1-sd) × rhythmMult × (1-gH) × resGate
  │   │   └─ Ghost refractory: 7 frames post-onset
  │   ├─ snareDrive = max(crackDrive, trebleGhost)
  │   │
  │   ├─ MACD: emaFast(α=1.0) - emaSlow(α=0.05) = momentum
  │   ├─ dynTh = 0.008 + 0.030×spectralDensity (×1.2 en drop)
  │   ├─ isCrossover = momentum > dynTh && prevMomentum ≤ dynTh
  │   │
  │   ├─ snareFloor = EMA(max(0.005, 0.07 - fBL_relaxation×(1-gH)))
  │   │
  │   ├─ rawOnset = isCrossover && snareDrive >= snareFloor
  │   │   ├─ Bypass rescue: UnG>0.4 && Res>0.3 && RawΔ>0.2 && Flux>bypassTh
  │   │   └─ Density path: fBL>0.09 && gH<0.05 && UnG>0.45 && Drive>=floor
  │   │       └─ Refractory: 2 frames (denso)
  │   │
  │   ├─ Refractory: 4 frames (estándar)
  │   ├─ Hybrid reset: momentum>0.15 → emaSlow += 0.70×(emaFast-emaSlow)
  │   └─ Silence reset: 8 frames Drive<0.01 → EMAs=0
  │
  ├── NO → 5-PATH CASCADE (latino, chill, etc.)
  │   └─ Path 1 (WNS) / Path 2 (Flux) / Path 3 (Energy) / Pending / Path 4 (hybrid)
  │
  ▼
hybridSnare = snareImpulse (1.0 → ×0.65/frame)
  │
  ├─ Sustain Choke: 15 frames sin onset + SnareE<0.15 → ×0.85/frame
  ├─ Tonality Veto: (flatGate + wnsGate + fluxGate)/3 → ×(veto/0.15) si <0.15
  ├─ Centroid Shield: isKick && centroid<floor && harshness<0.024 → kill
  │
  ▼
envSnare.process(hybridSnare, morphFactor, now, false)
  │
  ├─ Velocity Gate (attack-only + Undertow grace)
  ├─ Asymmetric EMA (attack 0.98/0.02, decay 0.88/0.12)
  ├─ Peak Memory + Tidal Gate (0.993 normal, 0.985 dry spell)
  ├─ Dynamic Gate (avgEffective + gateMargin 0.01)
  ├─ Anti-sustain squelch (sustainedSquelchStartFrames — no definido en techno)
  ├─ Decay: intensity *= 0.32 + 0.40×morph
  ├─ Main Gate: crush = 1.0 + 0.3×(1-morph), hit × (1.2+0.8×morph) × 2.5
  ├─ Ignition Squelch: 0.20 - 0.10×morph
  ├─ Smooth Fade: quadratic below 0.08
  └─ Blackout Gate: <0.005 → 0
  │
  ▼
backRight → routeZones() → backPar (strict-split: SOLO snare)
```

---

## 15. Puntos de Calibración Pendientes

Áreas identificadas para futura recalibración:

1. **DENSITY PATH threshold** — `fBL > 0.09` puede ser demasiado alto para builds moderadas. Considerar escalar con spectralDensity en vez de threshold fijo.

2. **Ghost refractory** — 7 frames (~159ms) puede ser largo para redobles de 16th notes a 130 BPM (125ms = 5.5 frames). Ya se redujo de 10→7, pero podría necesitar 5-6.

3. **Smart sEF relaxed floor** — La interacción entre `treblePresence`, `densityGate`, `gateHealth` y `deadGateRescue` es compleja. Considerar simplificar a un solo multiplicador.

4. **Rhythm gate** — Solo afecta al trebleGhost, no al crackDrive. En tracks donde el ghost es la única path activa, los off-beats se suprimen al 10%. Considerar si esto es deseable para claps de Brejcha.

5. **MACD αF=1.0** — Zero lag significa emaFast = snareDrive exacto. El momentum = snareDrive - emaSlow. Si emaSlow está alto (buildup denso), el momentum puede ser negativo incluso con snares reales. El hybrid reset (0.70 ratio) mitiga esto, pero podría necesitar tuning.

6. **Envelope decayRange 0.40** — Es el más alto del motor. En morph=1 (melódico), decay=0.72 da una cola de ~150ms que puede solaparse con el siguiente beat a 130 BPM. Considerar reducir a 0.30-0.35.

---

## Archivos Referenciados

- `electron-app/src/hal/physics/LiquidEngineBase.ts` — Motor base, detección de onsets, veto, choke, telemetría
- `electron-app/src/hal/physics/LiquidEnvelope.ts` — Envelope universal (gate/decay/crush/fade)
- `electron-app/src/hal/physics/LiquidEngine41.ts` — Routing 4.1 (strict-split)
- `electron-app/src/hal/physics/LiquidStereoPhysics.ts` — Definición de `LiquidStereoInput` (campos GodEarFFT)
- `electron-app/src/hal/physics/profiles/techno.ts` — Perfil Techno (envelopeSnare + snare params + overrides41)
- `electron-app/src/hal/physics/profiles/ILiquidProfile.ts` — Contrato de perfil (todos los campos snare)

---

*Generado por Devin — 2026-09-11*
