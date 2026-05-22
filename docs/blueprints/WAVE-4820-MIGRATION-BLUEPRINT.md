# WAVE-4820-MIGRATION-BLUEPRINT.md
## THE GENESIS MIGRATOR — Legacy → .lfx v2.1 Conversion Architecture

> **Status:** Blueprint definitivo para `migrateLegacyToLfx.ts`
> **Inputs:** `LEGACY-PHYSICS-MAPPING.md` (47 efectos), `EffectRegistry.ts`, `inferArchetypeFromACO()`
> **Output:** 47 archivos `.lfx` v2.1 con curvas Bézier, CognitiveDNA, y SimulationMeta
> **Restricción de Oro:** LIBERTAD ABSOLUTA — absolute, relative_offset, y static son todos válidos.

---

## §1. ESTRATEGIA DE MAPEO ESPACIAL (spatialBehavior)

### 1.1 La Regla de Decisión

El script determina `spatialBehavior` mediante una **heurística de 3 niveles** basada en los datos forenses extraídos:

```
NIVEL 1 — ¿El efecto legacy toca pan/tilt EN ABSOLUTO?
  NO  → spatialBehavior = 'static'
  SÍ  → NIVEL 2

NIVEL 2 — ¿El efecto usa isAbsolute:true O fija pan/tilt a constantes hardcodeadas?
  SÍ  → spatialBehavior = 'absolute'
  NO  → NIVEL 3

NIVEL 3 — ¿El movimiento es un LFO/oscilador que se SUMA a la posición base?
  SÍ  → spatialBehavior = 'relative_offset'
  NO  → spatialBehavior = 'absolute' (default seguro para override determinista)
```

### 1.2 Clasificación Forense de los 47 Efectos

| Categoría | spatialBehavior | Criterio | Efectos Ejemplo |
|-----------|----------------|----------|-----------------|
| **Blinders / Strobes puros** | `static` | No tocan pan/tilt. Solo dimmer/color/strobe. | IndustrialStrobe, CoreMeltdown, SolarFlare, TropicalPulse |
| **Overrides Espaciales Estrictos** | `absolute` | Fijan pan/tilt a valores constantes (ej. tilt=0.7, pan=0). El efecto NECESITA que el mover esté en ESA posición. | ThunderStruck (tilt=0.7 down), NeonBlinder (pan=0, tilt=0), FeedbackStorm (chaotic abs) |
| **Sweep/Chase Volumétricos** | `absolute` | Barren zonas linealmente. El movimiento ES el efecto. | AcidSweep (sweepPhase), CyberDualism (left↔right alternation) |
| **LFO Orbitales** | `relative_offset` | Sinusoides/osciladores que añaden movimiento periódico al patrón base sin reemplazarlo. | VoidMist (breathing sine), Golden Dozen patterns del VMM |
| **Congelados Explícitos** | `static` | Comentarios "movement PURGED" en el código fuente. | VoidMist (movers frozen), ThunderStruck (movement PURGED) |

### 1.3 Decisión Semántica Final (tabla de lookup)

```typescript
const SPATIAL_DECISION_TABLE: Record<string, SpatialBehavior> = {
  // ─── STATIC (no tocan pan/tilt) ────────────────────────────────
  'industrial_strobe':    'static',
  'core_meltdown':        'static',
  'solar_flare':          'static',
  'tropical_pulse':       'static',
  'void_mist':            'static',   // explícitamente "movers frozen"
  'thunder_struck':       'static',   // "movement PURGED" - tilt fijo = color latch only
  
  // ─── ABSOLUTE (secuestran posición completa) ───────────────────
  'neon_blinder':         'absolute', // pan=0, tilt=0 → facing front
  'feedback_storm':       'absolute', // seeded chaotic pan/tilt
  'acid_sweep':           'absolute', // sweep volumétrico lineal
  'cyber_dualism':        'absolute', // ping-pong L↔R estricto
  
  // ─── RELATIVE_OFFSET (LFO orbital sobre base IK) ──────────────
  // Golden Dozen patterns migrados como clips relativos
  'scan_x':              'relative_offset',
  'figure8':             'relative_offset',
  'circle':              'relative_offset',
  'ballyhoo':            'relative_offset',
  'diamond':             'relative_offset',
  'wave_y':              'relative_offset',
  'square':              'relative_offset',
  'botstep':             'relative_offset',
  'chase':               'relative_offset',
  'cross':               'relative_offset',
  'star':                'relative_offset',
  'random_walk':         'relative_offset',
}
```

### 1.4 Heurística Computacional (cuando no hay tabla explícita)

```typescript
function inferSpatialBehavior(effectMeta: LegacyEffectMeta): SpatialBehavior {
  // Regla 1: No pan/tilt curves → static
  if (!effectMeta.touchesPan && !effectMeta.touchesTilt) return 'static'
  
  // Regla 2: Valores constantes o bloqueo explícito → absolute
  if (effectMeta.panIsConstant || effectMeta.tiltIsConstant) return 'absolute'
  if (effectMeta.movementPurged) return 'static'
  
  // Regla 3: MixBus global + pan/tilt → probablemente un override dictatorial
  if (effectMeta.mixBus === 'global' && effectMeta.touchesPan) return 'absolute'
  
  // Regla 4: Oscilador sinusoidal puro sin anclaje → orbital
  if (effectMeta.movementIsOscillator && effectMeta.mixBus === 'htp') return 'relative_offset'
  
  // Default seguro: absolute (no perder información)
  return 'absolute'
}
```

---

## §2. TRADUCTOR MATEMÁTICO (Legacy Oscillators → Bézier Keyframes)

### 2.1 Estrategia de Conversión

Los osciladores legacy son **funciones continuas del tiempo**. Las curvas Hephaestus son **secuencias discretas de keyframes** con interpolación Bézier entre ellos.

**Principio:** Samplear un ciclo completo del oscilador a resolución suficiente, luego colocar keyframes en puntos críticos (crestas, valles, cruces por cero) con handles Bézier que reproduzcan la forma.

### 2.2 Diccionario de Conversión

#### SINE PULSE → Bézier (1 ciclo = 4 keyframes)

```typescript
function sineToKeyframes(durationMs: number, amplitude: number = 1): HephKeyframe[] {
  // Sin(x): 0→peak→0→valley→0 en un ciclo
  // Solo necesita 5 puntos (inicio, pico, cruce, valle, fin) con handles correctos
  const peak = amplitude
  const mid = durationMs / 2
  const quarter = durationMs / 4
  
  return [
    { timeMs: 0,           value: 0.5,         interpolation: 'bezier', bezierHandles: [0.33, 0, 0.67, 1] },
    { timeMs: quarter,     value: 0.5 + peak/2, interpolation: 'bezier', bezierHandles: [0.33, 1, 0.67, 0] },
    { timeMs: mid,         value: 0.5,         interpolation: 'bezier', bezierHandles: [0.33, 0, 0.67, 1] },
    { timeMs: mid+quarter, value: 0.5 - peak/2, interpolation: 'bezier', bezierHandles: [0.33, 1, 0.67, 0] },
    { timeMs: durationMs,  value: 0.5,         interpolation: 'hold' },
  ]
}
```

**Handle semántico:** `[0.33, 0, 0.67, 1]` = "smooth" — curva que imita sin(x) entre dos puntos.

#### LINEAR RAMP → Bézier (2 keyframes)

```typescript
function linearRampToKeyframes(durationMs: number, from: number, to: number): HephKeyframe[] {
  return [
    { timeMs: 0,          value: from, interpolation: 'linear' },
    { timeMs: durationMs, value: to,   interpolation: 'hold' },
  ]
}
```

#### EXPONENTIAL DECAY → Bézier (2 keyframes + ease-in handle)

```typescript
function expDecayToKeyframes(durationMs: number, curve: number = 1.7): HephKeyframe[] {
  // pow(1 - progress, curve) → empieza rápido, termina lento
  // Bezier approximation: ease-out = [0, 0, 0.58, 1]
  // Para curve > 1: más agresivo → [0, 0, 0.35, 1]
  const cx2 = Math.max(0.1, 0.58 - (curve - 1) * 0.15)
  return [
    { timeMs: 0,          value: 1.0, interpolation: 'bezier', bezierHandles: [0, 0, cx2, 1] },
    { timeMs: durationMs, value: 0.0, interpolation: 'hold' },
  ]
}
```

#### POWER ATTACK → Bézier (2 keyframes + ease-in handle)

```typescript
function powerAttackToKeyframes(durationMs: number, exponent: number = 0.3): HephKeyframe[] {
  // pow(progress, exponent) donde exponent < 1 = explosivo
  // ease-in: [0.42, 0, 1, 1] → para exponent ≈ 0.3: [0.9, 0, 0.1, 1] (snap)
  const cx1 = Math.min(0.95, 0.42 + (1 - exponent) * 0.7)
  return [
    { timeMs: 0,          value: 0.0, interpolation: 'bezier', bezierHandles: [cx1, 0, 0.1, 1] },
    { timeMs: durationMs, value: 1.0, interpolation: 'hold' },
  ]
}
```

#### SQUARE WAVE / STROBE → Hold (N keyframes)

```typescript
function strobeToKeyframes(durationMs: number, freqHz: number): HephKeyframe[] {
  const halfPeriod = 500 / freqHz  // ms
  const keyframes: HephKeyframe[] = []
  let t = 0
  let state = true
  
  while (t < durationMs) {
    keyframes.push({ timeMs: t, value: state ? 1.0 : 0.0, interpolation: 'hold' })
    t += halfPeriod
    state = !state
  }
  keyframes.push({ timeMs: durationMs, value: 0.0, interpolation: 'hold' })
  return keyframes
}
```

#### BPM PULSE → Parametric (1 cycle at normalized duration)

```typescript
function bpmPulseToKeyframes(beatsPerCycle: number, bpmRef: number = 128): HephKeyframe[] {
  // El clip se exporta con durationMs = (60000/bpmRef) * beatsPerCycle
  // En runtime, Hephaestus escalará al BPM real via timeStretch
  const durationMs = (60000 / bpmRef) * beatsPerCycle
  return sineToKeyframes(durationMs, 1.0)
}
```

### 2.3 Tabla Maestra de Handles Bézier (presets semánticos)

| Forma Legacy | Bezier Handles | Interpolation | Descripción |
|---|---|---|---|
| Sine Pulse (rise) | `[0.33, 0, 0.67, 1]` | bezier | Smooth — imita sin(x) |
| Sine Pulse (fall) | `[0.33, 1, 0.67, 0]` | bezier | Smooth inverso |
| Linear Ramp | — | linear | Línea recta |
| Exp Decay (1.7) | `[0, 0, 0.35, 1]` | bezier | ease-out agresivo |
| Exp Decay (3.0) | `[0, 0, 0.15, 1]` | bezier | ease-out muy agresivo (NeonBlinder melt) |
| Power Attack (0.3) | `[0.9, 0, 0.1, 1]` | bezier | snap — casi instantáneo |
| Power Attack (2.4) | `[0.42, 0, 1, 1]` | bezier | ease-in lento (SolarFlare build) |
| Square/Strobe | — | hold | Step function |
| Overshoot | `[0.68, -0.6, 0.32, 1.6]` | bezier | Sobre-pasa y vuelve |
| Bounce | `[0.34, 1.56, 0.64, 1]` | bezier | Impacto con rebote |

### 2.4 Envelopes Compuestos (ADSR multi-segment)

Efectos con múltiples fases (ThunderStruck, SolarFlare, TropicalPulse) se convierten en un **array de keyframes concatenados**:

```typescript
function envelopeToKeyframes(phases: EnvelopePhase[]): HephKeyframe[] {
  const keyframes: HephKeyframe[] = []
  let currentTime = 0
  
  for (const phase of phases) {
    keyframes.push({
      timeMs: currentTime,
      value: phase.startValue,
      interpolation: phase.interpolation,
      bezierHandles: phase.handles,
    })
    currentTime += phase.durationMs
  }
  
  // Final keyframe
  const lastPhase = phases[phases.length - 1]
  keyframes.push({
    timeMs: currentTime,
    value: lastPhase.endValue,
    interpolation: 'hold',
  })
  
  return keyframes
}
```

### 2.5 Color Keyframes (HSL space)

```typescript
function colorTransitionToKeyframes(
  colors: Array<{ timeMs: number; h: number; s: number; l: number }>,
  interpolation: HephInterpolation = 'bezier'
): HephKeyframe[] {
  return colors.map((c, i) => ({
    timeMs: c.timeMs,
    value: { h: c.h, s: c.s, l: c.l },
    interpolation: i < colors.length - 1 ? interpolation : 'hold',
    bezierHandles: interpolation === 'bezier' ? [0.42, 0, 0.58, 1] as [number,number,number,number] : undefined,
  }))
}
```

---

## §3. INFERENCIA SEMÁNTICA (Archetype Stamping)

### 3.1 Pipeline de Inferencia

```
EffectRegistry[effectId].metadata
        ↓
   extractACOFromDNA()
        ↓
   inferArchetypeFromACO(aco, zones)
        ↓
   UserArchetype: 'strobe' | 'ambient' | 'heavy' | 'divine' | 'utility'
```

### 3.2 Mapeo ACO desde EffectDNA Legacy

```typescript
function extractACOFromLegacyEffect(meta: LegacyEffectMeta): AcoTriad {
  return {
    // AGGRESSION: energía destructiva. Strobes/blinders = alto.
    aggression: calculateAggression(meta),
    // CHAOS: impredecibilidad temporal. Random/seeded = alto, sinusoide = bajo.
    chaos: calculateChaos(meta),
    // ORGANICITY: fluidez biológica. Sine/breathing = alto, hold/square = bajo.
    organicity: calculateOrganicity(meta),
  }
}

function calculateAggression(meta: LegacyEffectMeta): number {
  let a = 0.5
  if (meta.isStrobe) a += 0.25
  if (meta.mixBus === 'global') a += 0.15
  if (meta.maxStrobeFreqHz >= 10) a += 0.10
  if (meta.isOneShot) a += 0.05
  if (meta.hasDimmerOverrideZero) a += 0.10  // machine gun blackout
  if (meta.suggestedDuration < 2000) a += 0.05  // short = punch
  return Math.min(1, a)
}

function calculateChaos(meta: LegacyEffectMeta): number {
  let c = 0.3
  if (meta.usesSeededRandom) c += 0.35
  if (meta.hasIrregularGaps) c += 0.15
  if (meta.strobeFreqVariable) c += 0.20
  if (meta.hasMultipleFlashPhases) c += 0.10
  if (meta.movementIsSinusoidal) c -= 0.15  // predictable = low chaos
  return Math.max(0, Math.min(1, c))
}

function calculateOrganicity(meta: LegacyEffectMeta): number {
  let o = 0.5
  if (meta.usesSineWave) o += 0.20
  if (meta.hasBreathing) o += 0.15
  if (meta.usesExpDecay) o += 0.10
  if (meta.interpolation === 'hold') o -= 0.25  // binary = machine
  if (meta.isStrobe && meta.freqHz >= 10) o -= 0.30  // machine gun
  if (meta.colorIsOrganic) o += 0.10  // slow hue shifts
  return Math.max(0, Math.min(1, o))
}
```

### 3.3 Cross-Validation con EffectRegistry Tags

```typescript
function crossValidateArchetype(
  inferred: UserArchetype,
  registryEntry: EffectRegistryEntry
): UserArchetype {
  const tags = registryEntry.tags
  
  // Hard overrides desde el registry (verdad canónica)
  if (tags.includes('strobe') && registryEntry.strobe) return 'strobe'
  if (tags.includes('divine') || registryEntry.isDivineCandidate) return 'divine'
  if (tags.includes('heavy') || registryEntry.isHeavyCandidate) return 'heavy'
  if (tags.includes('ambient') || tags.includes('mist')) return 'ambient'
  
  // Si no hay override → confiar en la inferencia ACO
  return inferred
}
```

### 3.4 Resultado por Efecto (47 ficheros)

| Effect ID | Inferred ACO (A/C/O) | Archetype | Justification |
|---|---|---|---|
| `industrial_strobe` | 0.90 / 0.55 / 0.10 | **strobe** | 15Hz, irregular gaps, machine |
| `core_meltdown` | 0.95 / 0.50 / 0.05 | **strobe** | Nuclear, global, one-shot |
| `acid_sweep` | 0.70 / 0.40 / 0.45 | **heavy** | Volumetric sweep, htp additive |
| `cyber_dualism` | 0.85 / 0.45 / 0.15 | **strobe** | Ping-pong strobe, global |
| `void_mist` | 0.20 / 0.20 / 0.80 | **ambient** | Breathing sine, UV, frozen |
| `neon_blinder` | 0.92 / 0.35 / 0.10 | **divine** | One-shot explosive, global |
| `solar_flare` | 0.95 / 0.30 / 0.20 | **divine** | Peak zone, build+flash, one-shot |
| `tropical_pulse` | 0.80 / 0.55 / 0.25 | **heavy** | Multi-flash percussive |
| `thunder_struck` | 0.88 / 0.40 / 0.20 | **divine** | Stadium blinder, BPM-synced |
| `feedback_storm` | 0.85 / 0.80 / 0.15 | **strobe** | Seeded random, chaotic |

---

## §4. ARQUITECTURA DEL SCRIPT DE MIGRACIÓN

### 4.1 Diagrama de Pipeline

```
┌─────────────────────────────────────────────────────────────────────────┐
│                     migrateLegacyToLfx.ts                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  PASO 1: LECTURA                                                        │
│  ├─ Parsear EffectRegistry.ts → effectId, metadata, tags, zones         │
│  ├─ Parsear LEGACY-PHYSICS-MAPPING.md → timing, waveforms, params       │
│  └─ Cargar EFFECT_DNA_REGISTRY si existe → DNA values legacy            │
│                                                                         │
│  PASO 2: PER-EFFECT TRANSLATION                                         │
│  ├─ Resolver spatialBehavior (§1 heurística)                            │
│  ├─ Resolver archetype (§3 inferencia ACO)                              │
│  ├─ Generar curvas Bézier por parámetro (§2 traductor)                  │
│  │   ├─ intensity curve   (dimmer envelope)                             │
│  │   ├─ color curve       (HSL transitions)                             │
│  │   ├─ strobe curve      (if applicable)                               │
│  │   ├─ pan/tilt curves   (if spatialBehavior !== 'static')             │
│  │   ├─ white/amber       (if effect uses RGBWA)                        │
│  │   └─ zoom/focus        (if applicable)                               │
│  └─ Ensamblar HephAutomationClipSerialized                              │
│                                                                         │
│  PASO 3: INSTANCIACIÓN LfxClipInstance                                  │
│  ├─ new LfxClipInstance({ id, title, archetype, spatialBehavior, ... }) │
│  ├─ setAcoTriad(computed ACO)                                           │
│  ├─ setEnergyZones(from registry energyZone)                            │
│  ├─ setCompatibleVibes(from registry vibes)                             │
│  └─ bakeCognitiveDNA() (automático en constructor)                      │
│                                                                         │
│  PASO 4: VALIDACIÓN                                                     │
│  ├─ validateClip(instance) → LinterResult                               │
│  ├─ Si !canSave → log warning, intentar auto-fix                        │
│  └─ Si canSave → continuar                                              │
│                                                                         │
│  PASO 5: SERIALIZACIÓN                                                  │
│  ├─ Componer LfxClipV2 { $schema, version, clip, checksum }            │
│  ├─ JSON.stringify (pretty-print)                                       │
│  ├─ Generar checksum (SHA-256 del clip block)                           │
│  └─ Escribir a /builtin-effects/{category}/{effectId}.lfx              │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Estructura del Output (.lfx v2.1)

```json
{
  "$schema": "hephaestus/v2.1",
  "version": "2.1.0",
  "clip": {
    "id": "industrial_strobe",
    "name": "Industrial Strobe",
    "author": "LuxSync Genesis Migrator",
    "category": "physical",
    "tags": ["strobe", "techno", "15hz", "global"],
    "vibeCompat": ["techno-club"],
    "zones": ["front", "back", "all-movers", "all-pars"],
    "mixBus": "global",
    "priority": 80,
    "durationMs": 3000,
    "effectType": "heph_custom",
    "curves": {
      "intensity": {
        "paramId": "intensity",
        "valueType": "number",
        "range": [0, 1],
        "defaultValue": 0,
        "keyframes": [ /* ... strobe pattern ... */ ],
        "mode": "absolute"
      },
      "color": {
        "paramId": "color",
        "valueType": "color",
        "range": [0, 1],
        "defaultValue": { "h": 0, "s": 0, "l": 100 },
        "keyframes": [ /* ... spectral mode colors ... */ ],
        "mode": "absolute"
      }
    },
    "staticParams": {},
    "cognitiveDNA": {
      "genome": { "aggression": 0.90, "chaos": 0.55, "organicity": 0.10 },
      "textureAffinity": "dirty",
      "compatibleVibes": ["techno-club"],
      "validSections": ["drop", "buildup"],
      "energyZone": { "min": "intense", "max": "peak" },
      "aggressionRange": { "min": 0.90, "max": 0.90 },
      "spatialBehavior": "static"
    },
    "simulationMeta": {
      "beautyWeights": { "base": 0.40, "energyMultiplier": 1.20, "vibeBonus": 0.10 },
      "gpuCost": 0.20,
      "fatigueImpact": 0.12,
      "minDurationMs": 2000,
      "cooldownMs": 5000,
      "isStrobe": true,
      "isDivineCandidate": false,
      "isHeavyCandidate": false,
      "zScoreGuards": { "requireRising": true, "minimumZ": 1.2, "minimumEnergy": 0.7 }
    },
    "executionHints": {
      "overlayMode": "absolute",
      "phaseConfig": { "spread": 0, "symmetry": "linear", "wings": 1, "direction": 1 },
      "intensityScaling": "fixed",
      "fixtureTargeting": "all"
    },
    "safetyDeclaration": {
      "maxStrobeFreqHz": 15,
      "containsRapidFlash": true,
      "communityTrusted": true
    }
  },
  "checksum": "sha256:..."
}
```

### 4.3 Directorios de Salida

```
electron-app/
└── builtin-effects/
    ├── techno/
    │   ├── industrial_strobe.lfx
    │   ├── core_meltdown.lfx
    │   ├── acid_sweep.lfx
    │   ├── cyber_dualism.lfx
    │   ├── void_mist.lfx
    │   └── neon_blinder.lfx
    ├── fiestalatina/
    │   ├── solar_flare.lfx
    │   └── tropical_pulse.lfx
    ├── poprock/
    │   ├── thunder_struck.lfx
    │   └── feedback_storm.lfx
    └── movement/
        ├── scan_x.lfx
        ├── figure8.lfx
        ├── circle.lfx
        └── ... (Golden Dozen)
```

---

## §5. EL PROBLEMA DEL MOVIMIENTO: L0 vs L3 (THE SNAP PROBLEM)

### 5.1 Diagnóstico

**Estado actual:**
- L0 (KineticAdapter + VMM) genera `pan_offset`/`tilt_offset` continuamente basado en VibeMovementManager.
- L2 (AetherKineticEngine) escribe `pan_base`/`tilt_base` como ancla.
- WAVE 4914 fusiona: `pan_final = clamp01(pan_base + pan_offset * amp)`.
- L3 (effects/hephaestus) actualmente **NO escribe pan/tilt** — está desactivado vía el arbiter.

**El problema:**
Cuando un .lfx L3 con `spatialBehavior: 'absolute'` quiere dictar `pan=0.2, tilt=0.7`:
1. L0 está en medio de un ciclo de `scan_x` → el mover está en pan=0.8
2. L3 inyecta pan=0.2 de golpe → **SNAP de 0.6 unidades** (≈ 162° en pan 270°)
3. El mover intenta cumplir → "clack" mecánico audible, sacudida visual fea.

**Las consolas grandes (grandMA3, Hog4) no tienen este problema porque:**
- No hay "L0 automático" independiente. Todo es programado manualmente.
- Los efectos de movimiento SON el pattern del programador — no hay conflicto entre capas.
- Las transiciones entre cues se hacen con fade times explícitos en el cuelist.

### 5.2 Soluciones Propuestas

#### SOLUCIÓN A: "SOFT TAKEOVER" (Crossfade Temporal) ⭐ RECOMENDADA

**Concepto:** Cuando L3 empieza a escribir pan/tilt, no inyecta el valor de golpe. En su lugar, el arbiter interpola desde la posición actual hasta el target L3 durante un `transitionMs` configurable.

```typescript
// En NodeArbiter._applyIntent(), cuando layer === 'effect' || 'hephaestus':
if (channel === 'pan' || channel === 'tilt') {
  const currentPos = record[channel] ?? 0.5
  const targetPos = incoming
  const elapsed = now - l3TakeoverStartMs[nodeId]?.[channel]
  const transitionMs = intent.transitionMs ?? 500  // default 500ms fade
  
  if (elapsed < transitionMs) {
    // Crossfade ease-out desde posición actual a target L3
    const t = elapsed / transitionMs
    const eased = t * t * (3 - 2 * t)  // smoothstep
    record[channel] = currentPos + (targetPos - currentPos) * eased
  } else {
    // Transition completa → L3 tiene control absoluto
    record[channel] = targetPos
  }
}
```

**Ventajas:**
- Zero snap — transición siempre suave.
- El `transitionMs` se declara EN EL .lfx → cada clip decide su agresividad.
- Un strobe puede usar `transitionMs: 0` (snap instantáneo si lo quiere).
- Un sweep puede usar `transitionMs: 800` (entrada suave).

**Implementación en el .lfx v2.1:**
```json
"executionHints": {
  "movementTransitionMs": 500,
  ...
}
```

---

#### SOLUCIÓN B: "L0 FADE-OUT" (Supresión Gradual del VMM)

**Concepto:** Cuando L3 reclama pan/tilt, en lugar de que L3 haga crossfade, es **L0 quien se retira gradualmente**. El offset orbital del VMM se atenúa a 0 durante `fadeOutMs`, dejando solo la base IK. Luego L3 toma control sobre la base.

```typescript
// En _applyRelativeOffsetFusion():
if (l3DominatesMovement(nodeId)) {
  const fadeProgress = getL0MovementFadeProgress(nodeId)  // 0→1 over fadeMs
  const attenuatedAmp = amp * (1 - fadeProgress)
  // L0 offset se reduce progresivamente
  final = basePan + panOffset * attenuatedAmp * distScale
  
  // Cuando fadeProgress === 1.0:
  // L0 offset = 0, solo queda base. L3 ya controla base directamente.
}
```

**Ventajas:**
- L0 deja de contribuir orgánicamente — no hay conflicto.
- El mover converge naturalmente a su posición base antes de que L3 lo secuestre.

**Desventaja:**
- Requiere coordinación temporal: L3 debe esperar a que L0 termine de retirarse.
- Latencia = fadeOutMs antes de que L3 tenga control real.

---

#### SOLUCIÓN C: "POSITION INHERITANCE" (L3 arranca desde donde estés)

**Concepto:** El primer keyframe de pan/tilt del .lfx NO es un valor absoluto — es un placeholder `'inherit'`. En runtime, Hephaestus lee la posición actual del mover (del arbitrated result del frame anterior) y usa eso como punto de partida. El segundo keyframe es el target real.

```typescript
// En HephaestusRuntime al evaluar una curva con inherit:
if (keyframe[0].value === INHERIT_MARKER) {
  keyframe[0].value = lastArbitratedPosition[nodeId][channel]
  // La curva ya tiene el punto de partida correcto
}
```

**Formato .lfx:**
```json
"pan": {
  "keyframes": [
    { "timeMs": 0, "value": -1, "interpolation": "bezier", "bezierHandles": [0.42,0,0.58,1] },
    { "timeMs": 500, "value": 0.2, "interpolation": "hold" }
  ]
}
// value: -1 es el INHERIT_MARKER
```

**Ventajas:**
- El mover SIEMPRE transiciona desde donde está. Zero snap por definición.
- El usuario define la curva de transición con Bézier handles (ease-in, ease-out, snap, bounce).
- Funciona idénticamente sin importar qué hacía L0 antes.

**Desventaja:**
- El primer segmento siempre es una transición (no puede ser un step instantáneo al inicio).
- Solución: si el usuario QUIERE snap, usa `interpolation: 'hold'` con `transitionMs: 0`.

---

#### SOLUCIÓN D: "DUAL CHANNEL" (pan vs pan_absolute)

**Concepto:** Introducir nuevos canales `pan_absolute` / `tilt_absolute` en el arbiter. Cuando L3 escribe en `pan_absolute`, el arbiter ignora completamente `pan` (fusion de L0+L2) y usa el valor absoluto directamente. Cuando L3 escribe en `pan` (normal), se suma aditivamente como offset.

```typescript
// En arbitrate(), DESPUÉS de fusion:
for (const [nodeId, record] of this._result) {
  if ('pan_absolute' in record) {
    record['pan'] = record['pan_absolute']  // Override total
    delete record['pan_absolute']
  }
}
```

**Ventajas:**
- Clara separación semántica: offset vs takeover.
- No hay ambigüedad — el .lfx declara explícitamente qué tipo de control quiere.

**Desventaja:**
- Snap sigue existiendo (el valor absoluto reemplaza de golpe). Se necesita combinar con Solución A o C.

---

### 5.3 RECOMENDACIÓN FINAL: Solución A + C Combinada

```
┌────────────────────────────────────────────────────────────┐
│                    MOVEMENT TAKEOVER PROTOCOL               │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  1. El .lfx declara:                                       │
│     - spatialBehavior: 'absolute' | 'relative_offset'      │
│     - movementTransitionMs: number (default 500)           │
│                                                            │
│  2. Al disparar el efecto:                                 │
│     IF spatialBehavior === 'relative_offset':              │
│       → El offset se SUMA a la fusión existente (L0+L2)   │
│       → L0 sigue vivo, no hay conflicto                   │
│       → El .lfx modula la amplitud orbital                 │
│                                                            │
│     IF spatialBehavior === 'absolute':                     │
│       → Frame 0: leer posición actual del mover            │
│       → Frames 0..transitionMs: crossfade smoothstep       │
│         desde posición actual → primer target del .lfx     │
│       → Frames post-transition: L3 tiene control total     │
│       → L0 offset suprimido (amp=0 para ese nodeId)        │
│       → Al terminar el efecto: reverse crossfade de        │
│         vuelta, L0 offset restaurado progresivamente       │
│                                                            │
│  3. Invariante de seguridad:                               │
│     La velocidad máxima de movimiento durante transición   │
│     está limitada a MAX_MOVEMENT_SPEED_DEG_PER_SEC         │
│     (configurable, default: 300°/s).                       │
│     Si el crossfade requiere más velocidad, se extiende    │
│     el transitionMs automáticamente.                       │
│                                                            │
│  4. L2 MANUAL HARD LOCK sigue siendo supremo:             │
│     Si el operador tiene hold manual → L3 movement = NOP   │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

### 5.4 Impacto en el .lfx v2.1 (campo nuevo)

```typescript
// En ExecutionHints (lfxTypes.ts):
export interface ExecutionHints {
  readonly overlayMode: OverlayMode
  readonly phaseConfig: PhaseConfig
  readonly intensityScaling: IntensityScaling
  readonly fixtureTargeting: FixtureTargeting
  // ── WAVE 4820: Movement Takeover Protocol ──
  readonly movementTransitionMs: number    // default 500
  readonly movementReleaseMs: number       // default 800 (vuelta a L0)
  readonly maxMovementSpeedDegPerSec: number  // safety cap, default 300
}
```

### 5.5 Decisión del Migrador por Efecto

| Effect | spatialBehavior | transitionMs | Razón |
|--------|----------------|--------------|-------|
| NeonBlinder | absolute | 200 | Flash rápido, mover al frente, snap aceptable |
| FeedbackStorm | absolute | 100 | Chaotic — snap ES el efecto |
| AcidSweep | absolute | 600 | Sweep suave, necesita entrada orgánica |
| CyberDualism | absolute | 300 | Ping-pong rápido pero no instantáneo |
| VoidMist | static | — | No toca movers |
| scan_x (Golden Dozen) | relative_offset | — | Orbital puro, no hay snap |
| figure8 | relative_offset | — | Orbital puro |

---

## §6. DEFINICIONES DE TIPOS NECESARIOS PARA EL SCRIPT

### 6.1 Input Manifest (lo que el script lee)

```typescript
interface LegacyEffectMeta {
  id: string
  displayName: string
  category: string
  genre: string
  tags: string[]
  zones: string[]
  mixBus: 'global' | 'htp'
  isStrobe: boolean
  isDynamic: boolean
  isOneShot: boolean
  suggestedDurationMs: number
  cooldownMs: number
  maxStrobeFreqHz: number
  
  // Derived from LEGACY-PHYSICS-MAPPING.md
  touchesPan: boolean
  touchesTilt: boolean
  panIsConstant: boolean
  tiltIsConstant: boolean
  movementPurged: boolean
  movementIsOscillator: boolean
  
  usesSeededRandom: boolean
  hasIrregularGaps: boolean
  strobeFreqVariable: boolean
  hasMultipleFlashPhases: boolean
  usesSineWave: boolean
  hasBreathing: boolean
  usesExpDecay: boolean
  hasDimmerOverrideZero: boolean
  colorIsOrganic: boolean
  
  // Envelope data
  phases: Array<{
    name: string
    durationMs: number
    oscillator: 'sine' | 'linear' | 'exp_decay' | 'power' | 'square' | 'hold' | 'seeded_random'
    exponent?: number
    freqHz?: number
    startValue: number
    endValue: number
  }>
  
  // Color data
  colors: Array<{
    condition: string  // e.g. "acid_mode", "noise_mode", "default"
    h: number; s: number; l: number
  }>
}
```

### 6.2 Módulos del Script

```typescript
// migrateLegacyToLfx.ts — main orchestrator
import { buildEffectManifest } from './steps/1-read-manifest'
import { translateToCurves } from './steps/2-translate-bezier'
import { inferSemantics } from './steps/3-infer-semantics'
import { assembleLfxClip } from './steps/4-assemble-clip'
import { validateAndFix } from './steps/5-validate'
import { writeToDisk } from './steps/6-write-disk'

async function main() {
  const manifest = buildEffectManifest()         // PASO 1
  
  for (const effect of manifest) {
    const curves = translateToCurves(effect)      // PASO 2
    const semantics = inferSemantics(effect)      // PASO 3
    const clip = assembleLfxClip(effect, curves, semantics)  // PASO 4
    const result = validateAndFix(clip)           // PASO 5
    
    if (result.canSave) {
      await writeToDisk(result.clip, effect.genre) // PASO 6
      console.log(`✅ ${effect.id} → ${effect.genre}/${effect.id}.lfx`)
    } else {
      console.error(`❌ ${effect.id} FAILED: ${result.warnings.map(w => w.message).join(', ')}`)
    }
  }
}
```

---

## §7. DECISIONES ARQUITECTÓNICAS CLAVE

| # | Decisión | Razón |
|---|----------|-------|
| 1 | `effectType: 'heph_custom'` para todos los migrados | Los clips migrados viven en L3 puro sin clases Effect legacy |
| 2 | `mode: 'absolute'` en curvas de intensity/color | Los efectos legacy dictan el output, no modulan otro efecto |
| 3 | `mode: 'additive'` en curvas pan/tilt cuando `relative_offset` | Se suma a la posición IK base |
| 4 | BPM reference = 128 en duraciones | El runtime escala al BPM real; 128 es el universal techno |
| 5 | Phase distribution via `PhaseConfig` en vez de hardcoded | El spread/fan se configura per-clip, no per-fixture |
| 6 | `checksum` obligatorio | Detecta tampering post-export |
| 7 | `communityTrusted: true` para builtin | Los migrados son de confianza (son nuestros) |
| 8 | Safety: `maxMovementSpeedDegPerSec: 300` | Protección anti-snap para hardware real |

---

## §8. NOTAS PARA EL IMPLEMENTADOR (Sonnet)

1. **El script es offline** — se ejecuta una vez con `npx ts-node migrateLegacyToLfx.ts`. No es hot-path.
2. **No importar dependencias de Electron** — solo Node.js puro + los tipos TS del proyecto.
3. **El manifest de los 47 efectos debe ser un JSON literal** hardcodeado en el script, derivado de `LEGACY-PHYSICS-MAPPING.md` y `EffectRegistry.ts`.
4. **Validación post-export:** tras generar todos los .lfx, ejecutar `tsc --noEmit` para confirmar que los tipos son correctos si se importan.
5. **El Movement Takeover Protocol (§5) es un cambio en NodeArbiter.ts** que debe implementarse ANTES de habilitar pan/tilt en L3. El script de migración solo declara los campos; la runtime hace el crossfade.

---

*Blueprint sellado. WAVE 4820 — THE GENESIS MIGRATOR.*
*Siguiente paso: Implementación del script `migrateLegacyToLfx.ts` en una sola pasada.*
