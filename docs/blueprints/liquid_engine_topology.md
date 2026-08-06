# OMNILIQUID ENGINE BLUEPRINT — Topología Completa

**Modo:** READ-ONLY extraction audit. No se modificó código.
**Propósito:** Preparar el terreno para un **Custom Vibe Physics Editor** mapeando
cada variable configurable del motor Liquid (Photon Physics) y cómo los 4 vibes
canónicos se enganchan al sistema.

---

## 1. ARQUITECTURA DE ENRUTAMIENTO

### 1.1 Visión General del Pipeline

```
GodEarFFT (Worker)
    │
    ▼ 7 bandas normalizadas [0,1] + métricas espectrales
SeleneLux.process(audioMetrics)
    │
    ├─► setActiveProfile(vibeKey) ◄── TitanOrchestrator (cambio de vibe)
    │       │
    │       └─► PROFILE_REGISTRY[vibeKey] → ILiquidProfile
    │            │
    │            ├─► liquidEngine41.setProfile(profile)
    │            └─► liquidEngine71.setProfile(profile)
    │
    ├─► setLiquidLayout('4.1' | '7.1') ◄── UI (selector de rig)
    │
    └─► Dispatch al motor activo:
            │
            ├─ isChill? → liquidEngine71 (SIEMPRE 7.1 — osciladores primos)
            ├─ liquidLayout === '7.1' → liquidEngine71
            └─ liquidLayout === '4.1' → liquidEngine41
                    │
                    ▼
            engine.applyBands(LiquidStereoInput)
                    │
                    ├─ 1. MorphFactor calculation
                    ├─ 2. Mode detection (acid/noisy/apocalypse)
                    ├─ 3. Silence / AGC trap
                    ├─ 4. Section analysis (breakdown/buildup)
                    ├─ 5. Kick detection + veto
                    ├─ 6. Envelope processing (6 × LiquidEnvelope)
                    ├─ 7. Apocalypse mode
                    ├─ 8. Strobe
                    ├─ 9. AGC rebound attenuation
                    ├─ 10. 9-zone EMA (floor/ambient/air)
                    └─ routeZones(ProcessedFrame) → LiquidStereoResult
                            │
                            ▼
                    SeleneLux → LightingIntent → Aether → DMX
```

### 1.2 PROFILE_REGISTRY — El Hook de los 4 Vibes Canónicos

<ref_file file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\profiles\index.ts" />

```typescript
export const PROFILE_REGISTRY: Record<string, ILiquidProfile> = {
  // Full vibeIds (llegan desde TitanOrchestrator → SeleneLux)
  'techno-club':    TECHNO_PROFILE,    // id: 'techno-industrial'
  'fiesta-latina':  LATINO_PROFILE,    // id: 'latino-fiesta'
  'pop-rock':       POPROCK_PROFILE,   // id: 'poprock-live'
  'chill-lounge':   CHILL_PROFILE,     // id: 'chill-oceanic'
  // Aliases cortos (legacy, Chronos)
  'techno': TECHNO_PROFILE, 'electro': TECHNO_PROFILE,
  'latino': LATINO_PROFILE, 'reggaeton': LATINO_PROFILE, 'salsa': LATINO_PROFILE,
  'cumbia': LATINO_PROFILE, 'dembow': LATINO_PROFILE,
  'rock': POPROCK_PROFILE, 'pop': POPROCK_PROFILE, 'indie': POPROCK_PROFILE, 'metal': POPROCK_PROFILE,
  'chill': CHILL_PROFILE, 'lounge': CHILL_PROFILE, 'ambient': CHILL_PROFILE, 'jazz': CHILL_PROFILE,
}
```

**Cómo el motor sabe qué vibe está activo:**

1. `TitanOrchestrator` detecta el cambio de vibe (UI o Chronos).
2. Llama a `TitanEngine.setVibe(vibeId)` y propaga a `SeleneLux.setActiveProfile(vibeKey)`.
3. `SeleneLux.setActiveProfile()` normaliza el key, busca en `PROFILE_REGISTRY`,
   y llama a `liquidEngine41.setProfile(profile)` + `liquidEngine71.setProfile(profile)`.
4. El motor activo (seleccionado por `liquidLayout`) usa `this.profile` en el próximo `applyBands()`.

### 1.3 Routing 4.1 vs 7.1

| Layout | Motor | Compactación | Cuándo se usa |
|---|---|---|---|
| `'4.1'` | `LiquidEngine41` | `max()` de zonas: frontPar, backPar | Rigs compactos (4 Pars + 2 Movers) |
| `'7.1'` | `LiquidEngine71` | 7 zonas independientes | Rigs completos (4 Pars + 2 Movers + 1 canal aux) |
| Chill (cualquier layout) | `LiquidEngine71` | Osciladores primos (sin envelopes) | **SIEMPRE** — el 4.1 no tiene osciladores |

**Switch en SeleneLux:**

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\reactivity\SeleneLux.ts" lines="692-694" />

```typescript
const liquidEngine = (this.liquidLayout === '7.1' || isChill)
  ? liquidEngine71
  : liquidEngine41;
```

### 1.4 Bifurcación Espacial en routeZones() — LiquidEngine71

El `routeZones()` de `LiquidEngine71` bifurca por `profile.id`:

| Profile ID | Mover L | Mover R | Notas |
|---|---|---|---|
| `techno-industrial` | envTreble (Melodista) | envVocal (Alma) | Layout simétrico original |
| `latino-fiesta` | envVocal (Galán) | envTreble (Dama) | **Swap físico** — vocal→L, treble→R |
| `chill-oceanic` | envVocal (Voz del Mar) | envTreble (Bioluminiscencia) | Neutralizado — retorna 0.5 neutral |
| `poprock-live` | envTreble (Voice & Riff) | envVocal (Lead & Sizzle) | Sin swap (mismo que techno) |

### 1.5 Bifurcación Espacial en routeZones() — LiquidEngine41

El `routeZones()` de `LiquidEngine41` bifurca por `profile.layout41Strategy`:

| Strategy | frontPar | backPar | Movers |
|---|---|---|---|
| `'default'` | `max(subBass, kick)` + smoothing 0.88 | `max(snare, highMid)` | Directos |
| `'strict-split'` | `envKick` solo (Metrónomo) | `max(snare, highMid)` | Directos (sin smoothing) |

**Asignación por vibe:**
- Techno: `strict-split` (Metrónomo/Lienzo)
- Latino: `strict-split` (dembow percutivo)
- Pop/Rock: `strict-split` (pulso seco anti-melaza)
- Chill: `default` (subBass domina, cuerpo continuo)

### 1.6 Profile Fusion (4.1 overrides)

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\LiquidEngineBase.ts" lines="109-146" />

Cuando `layout === '4.1'` y el perfil tiene `overrides41`, `fuseProfileFor41()` fusiona
**una sola vez** en `setProfile()` (no en el hot-path). Los overrides permiten ajustar
parámetros específicos para compensar la compactación `max()` del 4.1.

---

## 2. PARÁMETROS EXPUESTOS — The Physics Sandbox

### 2.1 LiquidEnvelopeConfig — 6 Envelopes × ~15 parámetros c/u

Cada perfil define **6 envelopes** independientes. Cada envelope tiene los siguientes
parámetros configurables:

| # | Parámetro | Tipo | Rango Teórico | Descripción |
|---|---|---|---|---|
| 1 | `gateOn` | number | 0.0 – 1.0 | Umbral de activación del gate. Señal debe superarlo para disparar. |
| 2 | `boost` | number | 0.0 – 20.0 | Multiplicador de ganancia post-gate. |
| 3 | `crushExponent` | number | 0.1 – 5.0 | Compresión base. >1 = selectivo (solo picos), <1 = expansivo (infla valores bajos). |
| 4 | `decayBase` | number | 0.0 – 1.0 | Factor de decay por frame en morph=0. Más alto = decay más lento. |
| 5 | `decayRange` | number | 0.0 – 1.0 | Rango de modulación de decay por morphFactor. |
| 6 | `maxIntensity` | number | 0.0 – 1.0 | Cap de intensidad máxima de salida. |
| 7 | `squelchBase` | number | 0.0 – 1.0 | Umbral de ignition squelch en morph=0 (anti-pad-ghost). |
| 8 | `squelchSlope` | number | 0.0 – 1.0 | Pendiente de squelch — cuánto baja con morphFactor. |
| 9 | `ghostCap` | number | 0.0 – 1.0 | Cap de ghostPower en morph=1 (soft knee subliminal glow). |
| 10 | `gateMargin` | number | 0.0 – 0.5 | Margen fijo añadido sobre gate adaptativo. |
| 11 | `attackSlopeMin` | number? | -0.1 – 0.5 | Pendiente mínima de ataque para permitir disparo. 0 = sin filtro. |
| 12 | `riseRate` | number? | 0.0 – 1.0 | Velocidad máxima de subida de output por frame. 1.0 = instantáneo. |
| 13 | `sustainedSquelchStartFrames` | number? | 0 – 9999 | Frames consecutivos de señal plana antes de endurecer squelch (anti-autotune). |
| 14 | `sustainedSquelchRisePerFrame` | number? | 0.0 – 0.1 | Incremento de squelch por frame tras superar startFrames. |
| 15 | `sustainedSquelchMaxBoost` | number? | 0.0 – 1.0 | Techo de endurecimiento acumulado de squelch. |
| 16 | `sustainedFlatVelocityMax` | number? | 0.0 – 1.0 | Umbral de velocidad considerada "plana" (nota sostenida). |
| 17 | `adaptiveNoiseAlpha` | number? | 0.0 – 1.0 | Alpha extra para que avgSignal persiga señal sostenida más rápido. |

**Los 6 envelopes por perfil:**

| Envelope | Rol | Bandas que procesa |
|---|---|---|
| `envelopeSubBass` | Front L — Océano/TÚN/Pulso del Abismo | subBass (20-60Hz) |
| `envelopeKick` | Front R — Francotirador/Bombo | bass (60-250Hz) via kick detection |
| `envelopeVocal` | Mover R/L — Coro/Galán/Voz del Mar | mid limpio (bass subtractor) |
| `envelopeSnare` | Back R — Látigo/TAcka/Destello | trebleDelta (transient shaper) |
| `envelopeHighMid` | Back L — Sintes/Tumbao/Algas | lowMid + mid cross-filter |
| `envelopeTreble` | Mover L/R — Melodista/Dama/Bioluminiscencia | highMid + treble cross-filter |

### 2.2 Parámetros Globales del Perfil (ILiquidProfile)

#### 2.2.1 Transient Shaper (Back R — Schwarzenegger)

| Parámetro | Tipo | Rango | Descripción |
|---|---|---|---|
| `percMidSubtract` | number | 0.0 – 5.0 | Penalización de mid en aislamiento de treble. rawRight = max(0, treble - mid × percMidSubtract) |
| `percGate` | number | 0.0 – 0.5 | Gate duro: umbral que rawRight debe superar. |
| `percBoost` | number | 0.0 – 10.0 | Multiplicador post-gate+exponent. |
| `percExponent` | number | 0.1 – 3.0 | Exponente de curva post-gate. 1.0=lineal, >1=convexa, <1=cóncava. |

#### 2.2.2 Mover R (Voces) — Bass Subtractor Adaptativo

| Parámetro | Tipo | Rango | Descripción |
|---|---|---|---|
| `bassSubtractBase` | number | 0.0 – 1.0 | Factor base de resta de bass (morph=0). |
| `bassSubtractRange` | number | 0.0 – 1.0 | Rango de modulación por morph. subtractFactor = base - morph × range. |
| `moverRTrebleSub` | number | -1.0 – 1.0 | Factor de resta/inyección de treble. Negativo = inyecta treble. |

#### 2.2.3 Back L (Mid Synths) — Cross-Filter

| Parámetro | Tipo | Rango | Descripción |
|---|---|---|---|
| `backLLowMidWeight` | number | 0.0 – 2.0 | Peso de lowMid en la mezcla. |
| `backLMidWeight` | number | 0.0 – 2.0 | Peso de mid en la mezcla. |
| `backLTrebleSub` | number | -1.0 – 1.0 | Factor de resta/inyección de treble. Negativo = inyecta. |
| `backLBassSub` | number | 0.0 – 1.0 | Factor de resta de bass. |

#### 2.2.4 Mover L (Melodías) — Cross-Filter + Tonal Gate

| Parámetro | Tipo | Rango | Descripción |
|---|---|---|---|
| `moverLHighMidWeight` | number | 0.0 – 3.0 | Peso de highMid en la mezcla. |
| `moverLTrebleWeight` | number | 0.0 – 2.0 | Peso de treble en la mezcla. |
| `moverLMidWeight` | number | 0.0 – 2.0 | Peso de mid en la mezcla. |
| `moverLTonalThreshold` | number | 0.0 – 1.0 | Umbral de flatness para gate tonal. < threshold = tonal = pasa. |

#### 2.2.5 Sidechain Guillotine

| Parámetro | Tipo | Rango | Descripción |
|---|---|---|---|
| `sidechainThreshold` | number | 0.0 – 999.0 | Umbral de frontMax para activar ducking. 999 = imposible (chill). |
| `sidechainDepth` | number | 0.0 – 1.0 | Profundidad del ducking. 0 = nada, 1 = kill total. |
| `snareSidechainDepth` | number | 0.0 – 1.0 | Profundidad del sidechain del snare sobre Mover R. |
| `frontKickSidechainThreshold` | number | 0.0 – 1.0 | Guillotina 4.1: umbral de kick para guillotinar subBass. 0 = off. |
| `auraCapBase` | number | 0.0 – 1.0 | Cap morfológico del subBass. 0 = off. |
| `auraCapExponent` | number | 0.0 – 5.0 | Exponente del auraCap. auraCap = base × pow(morph, exponent). |

#### 2.2.6 Strobe

| Parámetro | Tipo | Rango | Descripción |
|---|---|---|---|
| `strobeThreshold` | number | 0.0 – 999.0 | Umbral base de treble para trigger. 999 = imposible (chill). |
| `strobeDuration` | number | 1 – 1000 | Duración del strobe en ms. |
| `strobeNoiseDiscount` | number | 0.0 – 1.0 | Multiplicador de descuento en noiseMode. 0.80 = 20% menos threshold. |

#### 2.2.7 Modes — Acid / Noise / Apocalypse

| Parámetro | Tipo | Rango | Descripción |
|---|---|---|---|
| `harshnessAcidThreshold` | number | 0.0 – 1.0 | Umbral de harshness para activar Acid Mode. |
| `flatnessNoiseThreshold` | number | 0.0 – 1.0 | Umbral de flatness para activar Noise Mode. |
| `apocalypseHarshness` | number | 0.0 – 1.0 | Harshness mínimo para Apocalypse Mode. |
| `apocalypseFlatness` | number | 0.0 – 1.0 | Flatness mínimo para Apocalypse Mode. |

#### 2.2.8 MorphFactor (Morphology Unchained)

| Parámetro | Tipo | Rango | Descripción |
|---|---|---|---|
| `morphFloor` | number | 0.0 – 1.0 | Umbral inferior de avgMid para morphFactor=0 (modo percusión pura). |
| `morphCeiling` | number | 0.0 – 1.0 | Umbral superior de avgMid para morphFactor=1 (modo melodía pura). |

**Fórmula:** `morphFactor = clamp((avgMid - morphFloor) / (morphCeiling - morphFloor), 0, 1)`

#### 2.2.9 Kick Detection

| Parámetro | Tipo | Rango | Descripción |
|---|---|---|---|
| `kickEdgeMinInterval` | number | 1 – 999999 | Intervalo mínimo (ms) entre kicks para considerar edge. |
| `kickVetoFrames` | number | 0 – 20 | Frames de veto post-kick (input kill en Mover R). |

#### 2.2.10 Ambient Viscosity (EMA time constants)

| Parámetro | Tipo | Rango | Descripción |
|---|---|---|---|
| `ambientAttackMs` | number? | 1 – 10000 | Attack time constant para ambient EMA (ms). Lower = faster rise. |
| `ambientReleaseMs` | number? | 1 – 60000 | Release/decay time constant para ambient EMA (ms). Higher = slower fall. |
| `ambientMidWeight` | number? | 0.0 – 2.0 | Peso de la banda mid en la mezcla del ambient EMA. 0 = solo subBass. |
| `ambientGain` | number? | 0.0 – 5.0 | Ganancia global post-crush del ambient. Default 1.35. |

#### 2.2.11 Routing & Modes Especiales

| Parámetro | Tipo | Rango | Descripción |
|---|---|---|---|
| `layout41Strategy` | 'default' \| 'strict-split' | enum | Estrategia de enrutamiento 4.1. |
| `isPureAmbient` | boolean? | true/false | Modo Ambient Puro: ignora audio, usa osciladores temporales. |

#### 2.2.12 Overrides 4.1 (sub-objeto `overrides41`)

Todos los parámetros anteriores pueden ser overrideados individualmente para layout 4.1.
Los campos ausentes se heredan del perfil base. Incluye overrides parciales para cada
envelope (`Partial<LiquidEnvelopeConfig>`).

### 2.3 Resumen de Variables Exponibles al UI

**Total de parámetros configurables por perfil:**

| Categoría | Parámetros | × Envelopes | Subtotal |
|---|---|---|---|
| LiquidEnvelopeConfig | 17 | 6 | 102 |
| Transient Shaper | 4 | 1 | 4 |
| Mover R Bass Subtractor | 3 | 1 | 3 |
| Back L Cross-Filter | 4 | 1 | 4 |
| Mover L Cross-Filter | 4 | 1 | 4 |
| Sidechain Guillotine | 6 | 1 | 6 |
| Strobe | 3 | 1 | 3 |
| Modes (Acid/Noise/Apocalypse) | 4 | 1 | 4 |
| MorphFactor | 2 | 1 | 2 |
| Kick Detection | 2 | 1 | 2 |
| Ambient Viscosity | 4 | 1 | 4 |
| Routing & Special | 2 | 1 | 2 |
| **Total base** | | | **~140** |
| Overrides 4.1 (sub-objeto) | ~40 (parciales) | 1 | ~40 |
| **TOTAL EXPOSABLE** | | | **~180** |

---

## 3. INTERACCIÓN CON EL CORE

### 3.1 Ingestión de Audio Telemetry

**Fuente:** `GodEarFFT` (Web Worker) → produce `GodEarBands` (7 bandas 0-1) + métricas.

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\workers\GodEarFFT.ts" lines="28-43" />

```typescript
export interface GodEarBands {
  subBass: number;   // 20-60Hz   — Presión de aire pura (kicks sísmicos, 808 rumble)
  bass: number;      // 60-250Hz  — Cuerpo rítmico (bajos, kick body, toms)
  lowMid: number;    // 250-500Hz — Calor/Mud zone
  mid: number;       // 500-2000Hz — Voces/Snare/Lead (corazón musical)
  highMid: number;   // 2000-6000Hz — Crunch/Ataque/Presencia
  treble: number;    // 6000-16000Hz — Brillo/Hi-Hats/Aire
  ultraAir: number;  // 16000-22000Hz — Armónicos superiores (sizzle digital)
}
```

**Input al motor:** `LiquidStereoInput`

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\LiquidStereoPhysics.ts" lines="35-70" />

```typescript
export interface LiquidStereoInput {
  bands: GodEarBands              // 7 bandas post-AGC
  sectionType?: string            // 'drop' | 'breakdown' | 'buildup' | 'intro'
  isRealSilence: boolean          // avgNormEnergy < 0.01
  isAGCTrap: boolean              // AGC en modo trampa
  harshness?: number              // highMid energy proxy
  flatness?: number               // 0-1, Wiener entropy
  isKick?: boolean                // GodEarFFT transients
  spectralCentroid?: number       // Hz — brillo tonal
  morphFactorOverride?: number    // chill inyecta profundidad oceánica
  snare_energy?: number           // RhythmicPercussionTracker
  hh_energy?: number              // RhythmicPercussionTracker
  photon?: GodEarPhoton           // Bloque fotónico (strobe, saturation, hue)
}
```

### 3.2 Pipeline Interno (applyBands — 10 etapas)

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\LiquidEngineBase.ts" lines="304-816" />

| Etapa | Función | Input | Output |
|---|---|---|---|
| 1 | MorphFactor | bands.mid + morphFloor/Ceiling | morphFactor [0,1] |
| 2 | Mode Detection | harshness, flatness | acidMode, noiseMode |
| 3 | Silence/AGC | isRealSilence, isAGCTrap | silence result o recoveryFactor |
| 4 | Section Analysis | sectionType | isBreakdown |
| 5 | Kick Detection | pureBassEnergy, delta, cooldown | isKick, isKickEdge, kickVeto |
| 6 | Envelope Processing | 6 × (signal, morph, now, isBreakdown) | 6 intensidades [0, maxI] |
| 7 | Apocalypse | harshness, flatness, bands | chaosEnergy override |
| 8 | Strobe | treble, ultraAir, noiseMode | strobeActive, strobeIntensity |
| 9 | AGC Rebound | recoveryFactor | atenuación de todas las señales |
| 10 | 9-Zone EMA | bands, morphFactor | floor, ambient, air intensities |

### 3.3 Output — LiquidStereoResult

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\LiquidStereoPhysics.ts" lines="72-121" />

```typescript
export interface LiquidStereoResult {
  // 7 zonas independientes
  frontLeftIntensity: number      // SubBass → envSubBass
  frontRightIntensity: number     // Kick → envKick
  backLeftIntensity: number       // Mid Synths → envHighMid
  backRightIntensity: number      // Snare → envSnare (transient shaper)
  moverLeftIntensity: number      // Melody → envTreble (o envVocal si latino/chill)
  moverRightIntensity: number     // Vocal → envVocal (o envTreble si latino/chill)
  strobeActive: boolean
  strobeIntensity: number

  // 9-zone expansion
  floorIntensity: number          // (subBass × 0.65 + lowMid × 0.35) × recovery
  ambientIntensity: number        // EMA lento de subBass (+ mid × ambientMidWeight)
  airIntensity: number            // EMA suavizado de (treble × 0.6 + highMid × 0.4)

  // Legacy compat
  frontParIntensity: number       // max(frontL, frontR) o frontPar compactado
  backParIntensity: number        // max(backL, backR) o backPar compactado
  moverIntensityL: number
  moverIntensityR: number
  moverIntensity: number          // max(moverL, moverR)
  moverActive: boolean
  physicsApplied: 'liquid-stereo'
  acidMode: boolean
  noiseMode: boolean
}
```

### 3.4 De LiquidStereoResult a DMX

```
LiquidStereoResult
    │
    ▼
SeleneLux → LightingIntent (zonas → intensidades 0-1)
    │
    ▼
TickEngine → Aether Bus (LiquidAetherAdapter L0)
    │
    ▼
Aether Graph → NodeResolver → fixture states (DMX 0-255)
    │
    ▼
HAL → FixtureMapper → ArtNet/sACN → DMX físico
```

### 3.5 ChillAmbientEngine — Path Especial para Chill

El perfil `chill-oceanic` tiene `isPureAmbient: true`. Cuando el motor detecta esto:

1. `LiquidEngineBase.applyBands()` cortocircuita el pipeline audio-reactivo.
2. Llama a `applyAmbientGenerative(morphFactor, now)` — osciladores de números primos.
3. `LiquidEngine71.routeZones()` retorna valores neutrales (0.5).
4. `ChillAmbientEngine` (motor externo) toma control total:
   - Zonas: `liquidStereoOverrides` en SeleneLux
   - Movers: `deepFieldMechanics` → `buildMechanicsBypassIntent`
   - Master: `dimmerOverride` → TitanEngine

**Osciladores primos del ambient generativo:**

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\hal\physics\LiquidEngineBase.ts" lines="856-863" />

```typescript
const frontLeft  = 0.10 + ((Math.sin(now / 4003 + 0.000) + 1) / 2) * 0.50  // El Pulso del Abismo
const frontRight = 0.10 + ((Math.sin(now / 3109 + 1.047) + 1) / 2) * 0.50  // La Corriente
const backLeft   = 0.10 + ((Math.sin(now / 5303 + 0.628) + 1) / 2) * 0.50  // Las Algas
const backRight  = 0.10 + ((Math.sin(now / 1901 + 1.571) + 1) / 2) * 0.20  // El Destello
const moverLeft  = 0.05 + ((Math.sin(now / 9109  + 2.094) + 1) / 2) * 0.55  // La Voz del Mar
const moverRight = 0.05 + ((Math.sin(now / 10303 + 3.926) + 1) / 2) * 0.55  // La Bioluminiscencia
```

Períodos primos (4003, 3109, 5303, 1901, 9109, 10303 ms) garantizan que NUNCA
coincidan en fase → sin periodicidad perceptible.

---

## 4. VALORES DE REFERENCIA — Los 4 Vibes Canónicos

### 4.1 Tabla Comparativa de Envelopes (valores base 7.1)

| Parámetro | Techno | Latino | Pop/Rock | Chill |
|---|---|---|---|---|
| **envelopeSubBass.gateOn** | 0.08 | 0.15 | 0.15 | 0.02 |
| **envelopeSubBass.decayBase** | 0.2218 | 0.50 | 0.25 | 0.97 |
| **envelopeSubBass.maxIntensity** | 0.5291 | 0.80 | 0.82 | 0.85 |
| **envelopeSubBass.ghostCap** | 0.0357 | 0.00 | 0.04 | 0.20 |
| **envelopeKick.gateOn** | 0.28 | 0.18 | 0.12 | 0.05 |
| **envelopeKick.decayBase** | 0.08 | 0.60 | 0.04 | 0.90 |
| **envelopeKick.maxIntensity** | 0.80 | 0.80 | 0.82 | 0.75 |
| **envelopeSnare.gateOn** | 0.28 | 0.40 | 0.10 | 0.15 |
| **envelopeSnare.decayBase** | 0.30 | 0.72 | 0.35 | 0.80 |
| **envelopeVocal.gateOn** | 0.25 | 0.02 | 0.10 | 0.03 |
| **envelopeVocal.decayBase** | 0.70 | 0.72 | 0.45 | 0.94 |
| **envelopeHighMid.gateOn** | 0.15 | 0.20 | 0.03 | 0.02 |
| **envelopeHighMid.decayBase** | 0.62 | 0.14 | 0.35 | 0.95 |
| **envelopeTreble.gateOn** | 0.25 | 0.02 | 0.08 | 0.08 |
| **envelopeTreble.decayBase** | 0.78 | 0.72 | 0.55 | 0.88 |
| **envelopeTreble.boost** | 4.0 | 12.0 | 3.0 | 3.0 |

### 4.2 Tabla Comparativa de Parámetros Globales

| Parámetro | Techno | Latino | Pop/Rock | Chill |
|---|---|---|---|---|
| **morphFloor** | 0.30 | 0.45 | 0.20 | 0.05 |
| **morphCeiling** | 0.70 | 0.65 | 0.60 | 0.35 |
| **strobeThreshold** | 0.80 | 0.85 | 0.88 | 999.0 |
| **strobeDuration** | 30 | 25 | 20 | 10 |
| **sidechainDepth** | 0.00 | 0.00 | 0.00 | 0.0 |
| **snareSidechainDepth** | 0.15 | 0.05 | 0.03 | 0.0 |
| **percMidSubtract** | 1.0 | 2.0 | 0.5 | 0.80 |
| **percGate** | 0.04 | 0.065 | 0.04 | 0.015 |
| **percBoost** | 5.0 | 4.0 | 4.5 | 3.0 |
| **kickEdgeMinInterval** | 180 | 60 | 50 | 999999 |
| **kickVetoFrames** | 0 | 0 | 0 | 0 |
| **ambientAttackMs** | 30 | 65 | 80 | 400 |
| **ambientReleaseMs** | 120 | 135 | 300 | 1200 |
| **ambientMidWeight** | (default 0) | (default 0) | 0.50 | (default 0) |
| **ambientGain** | (default 1.35) | (default 1.35) | 2.0 | (default 1.35) |
| **layout41Strategy** | strict-split | strict-split | strict-split | default |
| **isPureAmbient** | false | false | false | true |
| **harshnessAcidThreshold** | 0.60 | 0.75 | 0.80 | 0.999 |
| **flatnessNoiseThreshold** | 0.70 | 0.80 | 0.60 | 0.999 |
| **apocalypseHarshness** | 0.55 | 0.70 | 0.65 | 0.999 |

---

## 5. ARQUITECTURA DE CLASES

```
LiquidEngineBase (abstract)
├── profile: ILiquidProfile
├── layout: '4.1' | '7.1'
├── 6 × LiquidEnvelope (envSubBass, envKick, envVocal, envSnare, envHighMid, envTreble)
├── applyBands(input) → LiquidStereoResult  [10 etapas]
├── setProfile(profile)  [hot-swap con fuseProfileFor41]
├── reset()
├── getEnvelopeProbes()  [telemetría]
└── abstract routeZones(frame) → LiquidStereoResult
    │
    ├── LiquidEngine41
    │   ├── routeZones: max() compactación + layout41Strategy
    │   ├── _frontParSmooth (smoothing 0.88 para 'default')
    │   └── singleton: liquidEngine41
    │
    └── LiquidEngine71
        ├── routeZones: 7 zonas independientes + bifurcación por profile.id
        ├── isChill → neutral 0.5 (ChillAmbientEngine toma control)
        ├── isLatino → swap vocal/treble en movers
        └── singleton: liquidEngine71

LiquidEnvelope
├── config: LiquidEnvelopeConfig (17 parámetros)
├── state: LiquidEnvelopeState (intensidad, EMA, peak, etc.)
├── process(signal, morphFactor, now, isBreakdown) → number [10 etapas]
├── setConfig(config)  [hot-swap preserva estado]
├── reset()
└── probe: LiquidEnvelopeProbe  [telemetría read-only]
```

---

## 6. RECOMENDACIONES PARA EL CUSTOM VIBE PHYSICS EDITOR

### 6.1 Parámetros Seguros para UI (low-risk, alta impacto visual)

| Parámetro | Impacto | Riesgo | Recomendación UI |
|---|---|---|---|
| `decayBase` (todos) | Alto — controla velocidad de caída | Bajo | Slider 0.0-1.0 por envelope |
| `gateOn` (todos) | Alto — sensibilidad | Medio | Slider 0.0-0.5 con tooltip |
| `boost` (todos) | Alto — brillo/presencia | Medio | Slider 0.0-10.0 |
| `maxIntensity` (todos) | Alto — cap de brillo | Bajo | Slider 0.0-1.0 |
| `ghostCap` (todos) | Medio — glow residual | Bajo | Slider 0.0-0.5 |
| `morphFloor` / `morphCeiling` | Alto — personalidad del vibe | Medio | Dual-slider 0.0-1.0 |
| `ambientAttackMs` / `ambientReleaseMs` | Medio — viscosidad ambiental | Bajo | Slider 1-10000 ms |
| `strobeThreshold` | Medio — frecuencia de flash | Bajo | Slider 0.5-1.0 |
| `percGate` / `percBoost` | Medio — punch del snare | Medio | Slider con preview |

### 6.2 Parámetros Avanzados (requieren conocimiento técnico)

| Parámetro | Razón |
|---|---|
| `crushExponent` | Curva no intuitiva — >1 selectivo, <1 expansivo |
| `squelchBase` / `squelchSlope` | Anti-ghosting — valores incorrectos causan parpadeo |
| `bassSubtractBase` / `bassSubtractRange` | Cross-filter — afecta separación vocal/bass |
| `backL*Weight` / `moverL*Weight` | Cross-filter — afecta separación de bandas |
| `sustainedSquelch*` | Anti-autotune — valores incorrectos matan notas legítimas |
| `layout41Strategy` | Cambia comportamiento fundamental del routing |
| `isPureAmbient` | Desactiva toda reactividad musical |

### 6.3 Parámetros No Exponibles (internos del motor)

| Parámetro | Razón |
|---|---|
| EMA alphas (0.98/0.02, 0.88/0.12) | Hardcodeados en LiquidEnvelope — afectan tracking |
| Peak decay (0.993/0.985/0.95) | Hardcodeado — afecta adaptive gate |
| `RECOVERY_DURATION = 250` | Constante de hardware invariante |
| `KICK_COOLDOWN_MS = 150` | Constante de hardware |
| `STALE_PEAK_THRESHOLD = 15` | Hardcodeado |
| `fadeZone = 0.08` | Hardcodeado — anti-guillotine |

### 6.4 Arquitectura Sugerida para el Editor

```
Custom Vibe Editor (UI)
    │
    ├─ Template Selection (clone from existing profile)
    │
    ├─ Envelope Editors (6 panels, one per envelope)
    │   ├─ Gate/Boost/Crush section
    │   ├─ Decay section (base + range)
    │   ├─ Squelch section (base + slope)
    │   ├─ Ghost/Gate margin section
    │   └─ Advanced (anti-sustain, riseRate, attackSlopeMin)
    │
    ├─ Global Parameters Panel
    │   ├─ MorphFactor (floor/ceiling dual-slider)
    │   ├─ Transient Shaper (percGate/Boost/Exponent/MidSubtract)
    │   ├─ Cross-Filters (Back L, Mover L, Mover R)
    │   ├─ Sidechain Guillotine
    │   ├─ Strobe
    │   ├─ Modes (Acid/Noise/Apocalypse thresholds)
    │   ├─ Kick Detection
    │   └─ Ambient Viscosity
    │
    ├─ 4.1 Overrides Panel (optional, collapsible)
    │
    ├─ Live Preview (real-time LiquidStereoResult visualization)
    │
    └─ Export → ILiquidProfile JSON → PROFILE_REGISTRY
```

---

## 7. ARCHIVOS CLAVE

| Archivo | Rol |
|---|---|
| `profiles/ILiquidProfile.ts` | Contrato del perfil — TODA la parametría |
| `profiles/techno.ts` | Perfil Techno Industrial (default) |
| `profiles/latino.ts` | Perfil Latino Fiesta |
| `profiles/poprock.ts` | Perfil Pop/Rock Live |
| `profiles/chilllounge.ts` | Perfil Chill Lounge Oceánico |
| `profiles/index.ts` | PROFILE_REGISTRY — hook de vibes → perfiles |
| `LiquidEnvelope.ts` | Envelope universal — 17 parámetros por banda |
| `LiquidEngineBase.ts` | Motor base — 10 etapas de procesamiento |
| `LiquidEngine41.ts` | Motor 4.1 — compactación max() |
| `LiquidEngine71.ts` | Motor 7.1 — 7 zonas + bifurcación por profile.id |
| `LiquidStereoPhysics.ts` | Tipos input/output |
| `SeleneLux.ts` | Dispatcher — routing layout + profile hot-swap |
