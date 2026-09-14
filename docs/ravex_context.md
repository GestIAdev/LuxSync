# RAVEX_CONTEXT.MD — Blueprint Físico del Motor LuxSync

> Documento técnico ultracondensado para diseño de coeficientes de la vibe **RaveX**
> (dientes de sierra, transiciones instantáneas, cero latencia).
> Objetivo: que Opus diseñe los coeficientes **sin romper las calibraciones acústicas recientes**.

---

## 1. Topologías de Ruteo (4.1 vs 7.1)

El motor es **agnóstico al layout** — toda la matemática vive en `LiquidEngineBase.ts`.
El layout solo decide el mapeo espacial final en `routeZones()`.

### 1.1 Ingesta Canónica (común a ambos layouts)

Cada frame produce **7 zonas independientes** + 3 zonas láser (Floor/Ambient/Air):

```ts
frontLeft  = envSubBass.process(bands.subBass)              // El Océano — subgraves continuos
frontRight = envKick.process(kickSignal)                    // El Francotirador — kick edge
backRight  = envSnare.process(hybridSnare)                  // El Látigo — snare/percusión
backLeft   = envHighMid.process(hhBlendInput) × backLeftGain // El Coro — mid synths
moverLeft  = envTreble.process(moverLInput)                 // El Galán — melodías tonales
moverRight = envVocal.process(moverRInput)                  // La Dama — voces/brillo
floorIntensity   = envFloor.process(bassDelta×2 + subBass×floorSubWeight)
ambientIntensity = pow(min(1, pow(ambientEMA, crushExp) × gain), outputExp) × breather
airIntensity     = envAir.process(treble×airTrebleW + highMid×airHighMidW)
```

### 1.2 Canal LEFT (Melódico / Sintetizadores / Groove)

**Mover L** — cross-filter tonal gate:
```ts
moverLRaw  = max(0, highMid×moverLHighMidWeight + treble×moverLTrebleWeight + mid×moverLMidWeight)
isTonal    = flatness < moverLTonalThreshold ? 1.0 : 0.0
moverLInput = moverLRaw × isTonal
moverLeft  = envTreble.process(moverLInput)
```

**Back L** — mid synths con DMZ acústica (sustracción de bombo):
```ts
cleanMidL     = max(0, bands.mid - bands.bass × dmzFactor)   // dmzFactor: techno=0.55, resto=0.30
midSynthInput = max(0, lowMid×backLLowMidWeight + cleanMidL×backLMidWeight×(1-vocalPenalty×0.8)
                      - treble×backLTrebleSub - bass×backLBassSub)
hhBlendInput  = max(midSynthInput, hhImpulse × hhBlendGain)  // hi-hat adapter opcional
backLeft      = min(1.0, envHighMid.process(hhBlendInput) × backLeftGain)
```

> **LEFT depende 100% de las bandas FFT (mid, highMid, lowMid).**
> No tiene detector de transitorios propio. Si el AGC aplasta esas bandas, LEFT muere.

### 1.3 Canal RIGHT (Percusión / Transitorios)

**Back R** — detector de snare independiente (NO usa bandas FFT directas):
```ts
// Pipeline: snare_energy EMA → raw_snare_delta → MACD momentum → bypass/density rescue
// hybridSnare = impulso binario con decay (snareImpulseDecay)
backRight = envSnare.process(hybridSnare)
```

**Mover R** — cleanMid con bass subtractor adaptativo:
```ts
subtractFactor = bassSubtractBase - morphFactor × bassSubtractRange
cleanMid       = max(0, bands.mid - bands.bass × subtractFactor)
moverRInput    = max(0, cleanMid - bands.treble × moverRTrebleSub)
moverRight     = envVocal.process(moverRInput)
// Kick veto + snare sidechain aplicados post-envelope
```

> **RIGHT sobrevive al AGC tilt** porque `backRight` se alimenta del detector de snare
> (pipeline independiente), no de las bandas FFT directas.

### 1.4 Layout 4.1 (`LiquidEngine41.routeZones`)

```ts
// strict-split (techno/rave):
frontPar = frontRight                          // Solo kick (Metrónomo)
backPar  = backRight                           // Solo snare (Látigo)
// default (latino/pop):
frontPar = max(frontLeft, frontRight)          // subBass + kick
backPar  = max(backLeft, backRight)            // synths + snare
// Ambos modos:
moverL, moverR = passthrough directo
```

### 1.5 Layout 7.1 (`LiquidEngine71.routeZones`)

Las 7 zonas pasan directas a 7 canales físicos independientes (sin compactación).

---

## 2. Parámetros de Envolventes (`LiquidEnvelopeConfig`)

Cada zona tiene su propio `LiquidEnvelope` con esta config (**las perillas que Opus puede girar**):

```ts
interface LiquidEnvelopeConfig {
  name: string
  gateOn: number              // Umbral de activación (0-1). Más bajo = más sensible.
  boost: number               // Multiplicador post-gate. Más alto = más ganancia.
  crushExponent: number       // >1 = selectivo (convexo), <1 = expansivo. 1.0 = lineal.
  decayBase: number           // Factor de decay por frame en morph=0 (0-1). Más alto = más lento.
  decayRange: number          // Modulación de decay por morphFactor.
  maxIntensity: number        // Cap de salida (0-1). Techo absoluto.
  squelchBase: number         // Umbral de ignition squelch en morph=0 (anti-pad-ghost).
  squelchSlope: number        // Cuánto baja el squelch con morphFactor.
  ghostCap: number            // Cap de ghostPower (soft knee subliminal). 0.0 = negro absoluto.
  gateMargin: number          // Margen fijo sobre el gate adaptativo.
  attackSlopeMin?: number     // Pendiente mínima de ataque para disparar (anti-flicker).
  riseRate?: number           // Velocidad máx de SUBIDA por frame (1.0=instantáneo, 0.15=anti-tembleque).
  // Anti-sustain (anti-autotune):
  sustainedSquelchStartFrames?: number   // Frames planos antes de activar choke.
  sustainedSquelchRisePerFrame?: number  // Incremento de squelch por frame tras el umbral.
  sustainedSquelchMaxBoost?: number      // Techo del choke acumulado (0=off, 0.5=dima a mitad).
  sustainedFlatVelocityMax?: number      // |velocity| considerado "plano".
  adaptiveNoiseAlpha?: number            // Velocidad de catch-up del gate adaptativo.
}
```

### 2.1 Perfiles de Envelope (Techno — referencia para RaveX)

| Envelope | gateOn | boost | decayBase | decayRange | maxI | squelchBase | squelchSlope | riseRate |
|----------|--------|-------|-----------|------------|------|-------------|--------------|----------|
| SubBass (FL) | 0.08 | 2.71 | 0.22 | 0.166 | 0.53 | 0.08 | 0.58 | — |
| Kick (FR) | 0.28 | 3.30 | 0.06 | 0.033 | 0.80 | 0.04 | 0.00 | — |
| Vocal (MR) | 0.25 | 1.50 | 0.70 | 0.05 | 0.80 | 0.15 | 0.10 | — |
| Snare (BR) | 0.28 | 2.50 | 0.32 | 0.40 | 1.00 | 0.20 | 0.10 | — |
| HighMid (BL) | 0.15 | 1.50 | 0.75 | 0.10 | 0.85 | 0.28 | 0.10 | — |
| Treble (ML) | 0.25 | 4.00 | 0.78 | 0.03 | 1.00 | 0.15 | 0.10 | — |

### 2.2 Perillas para erradicar inercia y forzar diente de sierra

Para **RaveX** (transiciones instantáneas, cero latencia), las perillas clave son:

- **`decayBase`** → bajar a 0.05–0.15 para corte brutal entre frames (diente de sierra).
- **`decayRange`** → reducir a 0.01–0.03 para comportamiento uniforme (sin modulación morfológica).
- **`riseRate`** → subir a 1.0 (instantáneo) o 0.5 (casi instantáneo) para ataque cero-latencia.
- **`gateOn`** → bajar para máxima sensibilidad (dispara en cualquier transitorio).
- **`squelchBase`** → subir a 0.30+ para matar colchones/sustain y forzar corte seco.
- **`sustainedSquelchMaxBoost`** → subir a 0.60+ para asfixiar notas sostenidas rápido.
- **`maxIntensity`** → 1.0 para pico absoluto sin headroom.
- **`crushExponent`** → 1.0 (lineal) para respuesta 1:1, o <1.0 para expansión agresiva.

### 2.3 Overrides 4.1 (Techno)

```ts
overrides41: {
  envelopeHighMid: { maxIntensity: 0.60, decayBase: 0.45 },  // Back L cede al snare
  envelopeSnare:   { gateOn: 0.22 },                          // Más sensible en compactación
  envelopeKick:    { decayRange: 0.02 },                      // Uniforme (smoothing neutralizado)
  layout41Strategy: 'strict-split',
}
```

### 2.4 Parámetros Escalares del Perfil (no-envelope)

```ts
// BACK R — Schwarzenegger
percMidSubtract: number     // Penalización de mid en aislamiento de treble (techno: 1.0)
percGate: number            // Gate duro de rawRight (techno: 0.04)
percBoost: number           // Boost post-gate (techno: 5.0)
percExponent: number        // Curva post-gate (techno: 0.5 = raíz cuadrada)

// MOVER R — Bass subtractor adaptativo
bassSubtractBase: number    // Factor base (morph=0) — techno: 0.65
bassSubtractRange: number   // Rango de modulación por morph — techno: 0.45
moverRTrebleSub: number     // Resta de treble (sibilantes) — techno: 0.3

// BACK L — Cross-filter
backLLowMidWeight: number   // Peso lowMid — techno: 0.0
backLMidWeight: number      // Peso mid limpio — techno: 0.85
backLTrebleSub: number       // Resta/inyección treble — techno: -0.3 (inyecta 30%)
backLBassSub: number         // Resta bass — techno: 0.0
hhBlendGain?: number         // Gain hi-hat adapter — techno: 0.8

// MOVER L — Cross-filter + tonal gate
moverLHighMidWeight: number // techno: 1.0
moverLTrebleWeight: number  // techno: 0.0
moverLMidWeight: number     // techno: 0.4
moverLTonalThreshold: number // techno: 0.40

// SIDECHAIN
sidechainThreshold: number  // techno: 0.1
sidechainDepth: number      // techno: 0.00 (exterminado)
snareSidechainDepth: number // techno: 0.15

// KICK DETECTION
kickEdgeMinInterval: number // ms — techno: 180
kickVetoFrames: number      // techno: 0

// MORPHOLOGY
morphFloor: number          // avgMid mínimo para morph=0 — techno: 0.30
morphCeiling: number        // avgMid máximo para morph=1 — techno: 0.70

// MODES
harshnessAcidThreshold: number    // techno: 0.60
flatnessNoiseThreshold: number    // techno: 0.70
apocalypseHarshness: number       // techno: 0.55
apocalypseFlatness: number        // techno: 0.55

// STROBE
strobeThreshold: number     // techno: 0.80
strobeDuration: number      // ms — techno: 30
strobeNoiseDiscount: number // techno: 0.80

// AMBIENT
ambientAttackMs?: number          // techno: 30
ambientReleaseMs?: number         // techno: 120
ambientMidWeight?: number         // default: 0
ambientGain?: number              // default: 1.35
ambientCrushExponent?: number     // techno: 1.2
ambientOutputExponent?: number    // default: 1.3

// FLOOR & AIR (láseres)
floorSubWeight?: number           // techno: 0.5
airTrebleWeight?: number          // techno: 1.0
airHighMidWeight?: number         // techno: 0.0

// SNARE DETECTOR (MACD momentum)
snareMomentumThreshold?: number   // techno: 0.01
snareMomentumAlphaFast?: number   // techno: 1.00 (zero-lag)
snareMomentumAlphaSlow?: number   // techno: 0.05
snareMomentumResetThreshold?: number // techno: 0.15
snareMomentumResetRatio?: number  // techno: 0.70
snareMomentumFloor?: number       // techno: 0.040 ← SAGRADO
snareMomentumFloorMin?: number    // techno: 0.002

// SNARE VETO (multi-eje)
snareVetoFlatnessFloor?: number   // techno 4.1: 0.10
snareVetoFlatnessKnee?: number    // techno 4.1: 0.10
snareVetoWnsFloor?: number        // techno 4.1: 0.10
snareVetoWnsKnee?: number         // techno 4.1: 0.25
snareVetoFluxFloor?: number       // techno 4.1: 0.02
snareVetoFluxKnee?: number        // techno 4.1: 0.15

// SUSTAIN CHOKE
snareChokeFrames?: number         // techno 4.1: 15
snareChokeRate?: number           // techno 4.1: 0.85
snareImpulseDecay?: number        // techno: 0.30

// PATH 1 ANTI-HIHAT
snarePath1BassDeltaFloor?: number // techno: 0.005
```

---

## 3. Calibraciones Intocables (El Muro Acústico)

> **Opus NO debe sobrescribir estos valores.** Son el resultado de telemetría
> post-FFT calibrada con Monte Carlo y logs de producción real (Commits
> `e30d70bd`, `a93a2d4f`, `4c6c4d7f`).

### 3.1 AGC_CONFIG (`GodEarFFT.ts`)

```ts
const AGC_CONFIG = {
  subBass: { attackMs: 15, releaseMs: 80,  targetRMS: 0.45, maxGain: 2.0 },
  bass:    { attackMs: 15, releaseMs: 80,  targetRMS: 0.45, maxGain: 2.0 },
  lowMid:  { attackMs: 15, releaseMs: 100, targetRMS: 0.38, maxGain: 1.8 },
  mid:     { attackMs: 15, releaseMs: 120, targetRMS: 0.32, maxGain: 1.8 },
  highMid: { attackMs: 15, releaseMs: 150, targetRMS: 0.25, maxGain: 1.5 },
  treble:  { attackMs: 15, releaseMs: 150, targetRMS: 0.10, maxGain: 1.5 },  // ← VETADO
  ultraAir:{ attackMs: 15, releaseMs: 180, targetRMS: 0.05, maxGain: 2.0 },  // ← VETADO
}
```

> **VETO ABSOLUTO:** `treble.targetRMS = 0.10` y `ultraAir.targetRMS = 0.05`
> no pueden subirse. Resucitarían la sensibilidad a hi-hats → estroboscopia.

### 3.2 Density Mode (`LiquidEngineBase.ts:1505`)

```ts
if (
  !rawOnset &&
  this._fluxBaseline > 0.09 &&
  gateHealth < 0.05 &&
  ungatedSnare > 0.40 &&          // ← SAGRADO (era 0.45, bajado a 0.40)
  snareDrive >= snareFloor
) {
  rawOnset = true
  this._snareRefractoryFrames = 1  // ← SAGRADO (era 2, bajado a 1 en density path)
  this._ghostRefractoryFrames = LiquidEngineBase.GHOST_REFRACTORY_FRAMES
}
```

### 3.3 Bypass Rescue (`LiquidEngineBase.ts:1474`)

```ts
const bypassFluxTh = gateHealth < 0.1 ? 0.08 : 0.20
if (
  !rawOnset &&
  ungatedSnare > 0.15 &&           // ← SAGRADO (era 0.40)
  residual > 0.10 &&               // ← SAGRADO (era 0.30)
  rawSnareDelta > 0.10 &&          // ← SAGRADO (era 0.20)
  spectralFlux > bypassFluxTh &&
  !(snareEnergy < 0.2 && hhEnergy > 0.5)  // exclusión hi-hat
) {
  rawOnset = true
}
```

### 3.4 WNS Soft Gate Exemption (`LiquidEngineBase.ts:1269`)

```ts
if (gateHealth > 0.1 && wns < 0.05 && spectralFlux < 0.25 && residual < 0.12) {
  //                                         ← SAGRADO: residual < 0.12 añadido
  crackDrive *= 0.3
}
```

### 3.5 Snare Momentum Floor

```ts
snareMomentumFloor: 0.040      // ← SAGRADO — no bajar, no subir
snareMomentumFloorMin: 0.002   // relajación dinámica en density zone
```

### 3.6 Refractory Frames Globales

```ts
SNARE_REFRACTORY_FRAMES = 4    // global — NO tocar
GHOST_REFRACTORY_FRAMES = 6    // global — NO tocar
// Excepción: density path usa _snareRefractoryFrames = 1 (local al bloque)
```

---

## 4. Zonas Canónicas (El Lienzo 3D)

### 4.1 Las 7 Zonas Base (`LiquidStereoResult`)

| Zona | Campo | Fuente espectral | Rol musical |
|------|-------|------------------|-------------|
| Front L | `frontLeftIntensity` | subBass (20-60Hz) | El Océano — subgraves continuos |
| Front R | `frontRightIntensity` | bass (60-250Hz) | El Francotirador — kick edge |
| Back L | `backLeftIntensity` | mid (500-2kHz) | El Coro — synths/voces/groove |
| Back R | `backRightIntensity` | highMid+snare (2-6kHz) | El Látigo — percusión/transitorios |
| Mover L | `moverLeftIntensity` | highMid+treble (2-16kHz) | El Galán — melodías tonales |
| Mover R | `moverRightIntensity` | mid+vocal (500Hz-6kHz) | La Dama — voces/brillo |
| Strobe | `strobeActive` / `strobeIntensity` | treble+ultraAir (6-22kHz) | Flash binario |

### 4.2 Las 3 Zonas Láser (WAVE 4520.2 — 9-zone expansion)

| Zona | Campo | Fuente | Comportamiento |
|------|-------|--------|----------------|
| Floor | `floorIntensity` | bassDelta×2 + subBass×floorSubWeight | Láser suelo — onset-driven, zero-attack, decay 0.12 |
| Ambient | `ambientIntensity` | EMA lento de subBass (+mid×weight) | Lavabo respirante — attack ~5f, release ~33f |
| Air | `airIntensity` | treble×airTrebleW + highMid×airHighMidW | Láser aéreo — zero-attack, decay 0.08, gate 0.35 |

### 4.3 Compacted 4.1 Output

```ts
frontParIntensity  = frontPar   // strict: kick | default: max(subBass, kick)
backParIntensity   = backPar    // strict: snare | default: max(synth, snare)
moverIntensityL    = moverLeft
moverIntensityR    = moverRight
moverIntensity     = max(moverL, moverR)
moverActive        = moverL > 0.1 || moverR > 0.1
```

### 4.4 Modes Especiales

- **Acid Mode:** `harshness > harshnessAcidThreshold` — activa comportamiento ácido.
- **Noise Mode:** `flatness > flatnessNoiseThreshold` — descuento de strobe threshold.
- **Apocalypse Mode:** `harshness > apocalypseHarshness && flatness > apocalypseFlatness`
  - Inyecta `chaosEnergy = max(mid, treble)` en backRight, moverLeft, moverRight.
  - **Útil para RaveX:** ya existe un path de "violencia máxima" que Opus puede aprovechar.

---

## 5. Notas para Opus

- **RaveX es un clon de techno/club** actualmente. Hereda `TECHNO_PROFILE`.
- Para crear RaveX, definir un nuevo `RAVEX_PROFILE: ILiquidProfile` en
  `electron-app/src/hal/physics/profiles/rave.ts` (ya existe como clon).

