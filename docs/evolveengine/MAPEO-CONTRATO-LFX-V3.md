# 📜 MAPEO CONTRATO DE DATOS — .LFX V3 (Luxsync.lfx/3.0)

> **WAVE 5000 PREP — Deep Architectural Audit (Part 3/3: .lfx V3 Contract)**
> **Rol:** Chief Data Systems Engineer
> **Proyecto:** LuxSync — Data Contracts & Interfaces
> **Modo:** ESTRICTAMENTE READ-ONLY — Sin modificaciones de código
> **Fecha:** Julio 2026

---

## ÍNDICE

1. [Interfaces TypeScript Exactas](#1-interfaces-typescript-exactas)
2. [El Genoma Cognitivo (`cognitiveDNA`)](#2-el-genoma-cognitivo-cognitivedna)
3. [Mecanismo de Ingesta en Selene](#3-mecanismo-de-ingesta-en-selene)
4. [Límites y Validaciones Estructurales](#4-límites-y-validaciones-estructurales)
5. [Flujo End-to-End: Disco → Selene → Hephaestus](#5-flujo-end-to-end-disco--selene--hephaestus)

---

## 1. Interfaces TypeScript Exactas

### 1.1 Wrapper de Archivo (`LFXFileV3`)

**Fuente:** `src/core/arsenal/lfxTypes.ts:303-307`

```typescript
export interface LFXFileV3 {
  readonly $schema: 'luxsync.lfx/3.0'
  readonly clip: HephAutomationClipV3
  readonly checksum: string  // SHA-256 sobre JSON.stringify(clip) sin pretty-print
}
```

El `$schema` es un literal exacto — el `LfxFileLoader` lo usa como discriminador. Cualquier otro valor es rechazado. El `checksum` es obligatorio para builtin/marketplace, opcional para user effects.

### 1.2 Clip V3 (`HephAutomationClipV3`)

**Fuente:** `src/core/hephaestus/types.ts:433-480`

```typescript
export interface HephAutomationClipV3 {
  // ── Identidad ──
  id: string
  name: string
  author: string
  category: EffectCategory       // 'physical' | 'color' | 'movement' | 'optics' | 'composite'
  tags: string[]
  vibeCompat: string[]           // Vibes compatibles (no vacío)

  // ── Espacial Canónico ──
  spatialZones: readonly ZoneTarget[]   // Unión de zones de tracks[] (auto-recomputado por Loader)

  // ── Ejecución ──
  mixBus: 'global' | 'htp' | 'ambient' | 'accent'  // Inter-clip blend behavior
  priority: number               // Default 70
  durationMs: number             // > 0, obligatorio
  effectType: string

  // ── EL CORAZÓN MULTICELULAR ──
  tracks: HephTrack[]            // Orden canónico: zona ASC → paramId ASC

  // ── Parámetros estáticos ──
  staticParams: Record<string, number | string | boolean>
  // NUNCA dominantColorH/S/L — se derivan de curvas 'color' en runtime

  // ── Cognitivo (opcional — solo clips Selene-visibles) ──
  cognitiveDNA?: CognitiveDNA
  simulationMeta?: SimulationMeta
  safetyDeclaration?: SafetyDeclaration

  // ── Discriminador ──
  schemaVersion: '3.0'           // Literal exacto
}
```

**Alias canónico:** `HephAutomationClip = HephAutomationClipV3` (WAVE 7003 — V2 purged).

### 1.3 Track Multicelular (`HephTrack`)

**Fuente:** `src/core/hephaestus/types.ts:353-417`

```typescript
export interface HephTrack {
  id: string                     // UUID v4 o slug determinista del migrator
  paramId: HephParamId           // Parámetro DMX-semántico que controla
  zones: readonly ZoneTarget[]   // Zonas canónicas (NUNCA vacío)
  curve: HephCurve               // Keyframes para este parámetro
  dimmerScale?: number           // [0..1] Default 1. Solo semántico si paramId === 'intensity'
  colorOverride?: HSL            // Si definido y paramId === 'color' → suplanta la curva
  blendMode?: BlendMode          // Default: 'max' si intensity, 'replace' resto
  cell?: string                  // RESERVADO v3.0 — Runtime no lo consume
  selector?: FixtureSelector     // Filtro fino (intersección AND con zones)
  phaseConfig?: PhaseConfigPro   // Distribución de fase grandMA3-style per-fixture
  phaseOverrides?: PhaseOverrideMap  // Overrides manuales per-fixture
}
```

**Invariantes documentados:**
- `zones.length >= 1` (track sin destino es error de Loader)
- `dimmerScale ∈ [0, 1]`
- Si `paramId === 'color'` y `colorOverride` definido → suplanta la curva
- `cell` es RESERVADO v3.0 — no consumido por Runtime

### 1.4 Curva (`HephCurve`)

**Fuente:** `src/core/hephaestus/types.ts:283-304`

```typescript
export interface HephCurve {
  paramId: HephParamId
  valueType: 'number' | 'color'
  range: [number, number]        // Rango válido para valores numéricos
  defaultValue: number | HSL     // Valor cuando no hay keyframes activos
  keyframes: HephKeyframe[]      // Ordenados por timeMs ascendente
  mode: HephCurveMode            // 'absolute' | 'relative' | 'additive'
}
```

**Invariantes:**
- Keyframes SIEMPRE ordenados por `timeMs` ascendente
- Mínimo 1 keyframe (valor constante)
- Consultas fuera de rango clampean al primer/último valor

### 1.5 Keyframe (`HephKeyframe`)

**Fuente:** `src/core/hephaestus/types.ts:223-264`

```typescript
export interface HephKeyframe {
  timeMs: number                 // Tiempo en ms desde inicio del clip
  value: number | HSL            // number para params, HSL para color
  interpolation: HephInterpolation  // 'hold' | 'linear' | 'bezier'
  bezierHandles?: [number, number, number, number]  // [cx1, cy1, cx2, cy2] — solo si bezier
  audioBinding?: HephAudioBinding  // WAVE 2030.14: modulación por audio en tiempo real
}
```

### 1.6 Audio Binding (`HephAudioBinding`)

**Fuente:** `src/core/hephaestus/types.ts:198-210`

```typescript
export interface HephAudioBinding {
  source: 'energy' | 'bass' | 'mids' | 'highs' | 'none'
  inputRange: [number, number]   // Típicamente [0, 1]
  outputRange: [number, number]  // Rango de salida para el parámetro
  smoothing: number              // 0 = instant, 1 = very slow
}
```

### 1.7 Color Atómico (`HSL`)

**Fuente:** `src/core/hephaestus/types.ts:46-53`

```typescript
export interface HSL {
  h: number    // Hue: 0-360 (grados)
  s: number    // Saturation: 0-100 (%)
  l: number    // Lightness: 0-100 (%)
}
```

### 1.8 Parameter IDs (`HephParamId`)

**Fuente:** `src/core/hephaestus/types.ts:164-186`

```typescript
export type HephParamId =
  | 'intensity'    // dimmerOverride (0-1)
  | 'color'        // colorOverride (HSL)
  | 'white'        // whiteOverride (0-1)
  | 'amber'        // amberOverride (0-1)
  | 'speed'        // param interno (0-1)
  | 'pan'          // movement.pan (0-1 → 16-bit)
  | 'tilt'         // movement.tilt (0-1 → 16-bit)
  | 'zoom'         // zoom (0-1 → 0-255 DMX)
  | 'focus'        // focus (0-1 → 0-255 DMX)
  | 'iris'         // iris (0-1 → 0-255 DMX)
  | 'gobo1'        // gobo wheel 1 (0-1 → 0-255 DMX)
  | 'gobo2'        // gobo wheel 2 (0-1 → 0-255 DMX)
  | 'prism'        // prism rotation (0-1 → 0-255 DMX)
  | 'strobe'       // strobeRate (0=off, 1=18Hz max)
  | 'strobeRate'   // Alias v3 — mismo significado que 'strobe'
  | 'globalComp'   // globalComposition (0-1)
  | 'width'        // beam/chase width (0-1)
  | 'direction'    // sweep direction (0=L→R, 1=R→L)
```

### 1.9 Zone Target

**Fuente:** `src/core/hephaestus/types.ts:329`

```typescript
export type ZoneTarget = CanonicalZone | 'all' | 'all-pars' | 'all-movers'
```

Donde `CanonicalZone` son las 9 zonas canónicas definidas en `ShowFileV2.ts`.

### 1.10 Blend Mode

**Fuente:** `src/core/hephaestus/types.ts:339`

```typescript
export type BlendMode = 'max' | 'replace' | 'add' | 'multiply'
```

### 1.11 Phase Config Pro

**Fuente:** `src/core/hephaestus/phase/PhaseConfigPro.ts`

```typescript
export interface PhaseConfigPro {
  spreadDeg: number              // Spread total en grados de ciclo [0, 1440]
  symmetry: PhaseSymmetryMode    // 'linear' | 'mirror' | 'center-out'
  wings: number                  // Multiplicador de frecuencia espacial (≥1)
  blocks: number                 // Agrupar N fixtures consecutivas (≥1)
  shuffle: number                // Caos controlado [0, 1]
  shuffleSeed: number            // Semilla del shuffle (reproducible)
  direction: 1 | -1              // Forward | Reverse
}
```

### 1.12 Phase Override

**Fuente:** `src/core/hephaestus/phase/PhaseOverride.ts`

```typescript
export interface PhaseOverride {
  offsetMs: number               // Valor del offset en ms
  mode: 'delta' | 'absolute'     // delta = suma al algoritmo, absolute = reemplaza
  pinned: boolean                // Inmune a cambios de spread/shuffle/wings
}

export type PhaseOverrideMap = ReadonlyMap<string, PhaseOverride>  // fixtureId → override
```

### 1.13 Effect Category

**Fuente:** `src/core/effects/types.ts:40-46`

```typescript
export type EffectCategory =
  | 'physical'    // dimmer/strobe (HTP)
  | 'color'       // color/saturación
  | 'movement'    // pan/tilt
  | 'optics'      // zoom/focus/iris/gobo/prism
  | 'composite'   // Multi-parámetro (2+ categorías)
```

---

## 2. El Genoma Cognitivo (`cognitiveDNA`)

### 2.1 Interface Exacta

**Fuente:** `src/core/arsenal/lfxTypes.ts:147-164`

```typescript
export interface CognitiveDNA {
  readonly genome: FrozenGenome
  readonly textureAffinity: TextureAffinity
  readonly compatibleVibes: readonly string[]
  readonly validSections: readonly string[]
  readonly energyZone: EnergyZoneRange
  readonly aggressionRange: Range

  // ── Directiva espacial obligatoria ──
  readonly spatialBehavior: SpatialBehavior
  readonly ikCompatibility?: IKCompatibility

  // ── Dominio de ejecución ──
  readonly executionDomain?: ExecutionDomain    // Default 'vector'
  readonly pixelHints?: PixelExecutionHints     // Solo si pixel/hybrid
}
```

### 2.2 FrozenGenome — La Tríada ACO

**Fuente:** `src/core/arsenal/lfxTypes.ts:74-78`

```typescript
export interface FrozenGenome {
  readonly aggression: number    // [0, 1] — ¿Cuánto "golpea"? (0=suave, 1=brutal)
  readonly chaos: number         // [0, 1] — ¿Ordenado o caótico? (0=predecible, 1=caótico)
  readonly organicity: number    // [0, 1] — ¿Vivo o máquina? (0=sintético, 1=orgánico)
}
```

**Filosofía (documentada en `EffectDNA.ts:62-79`):**
> Selene no busca "belleza" (concepto humano subjetivo).
> Selene busca ADECUACIÓN (concepto matemático objetivo).
> Un IndustrialStrobe NO ES más "bello" que un VoidMist.
> Un IndustrialStrobe ES más ADECUADO para un DROP que un VoidMist.

Los tres genes son **inmutables** (`readonly` + `Object.freeze()`) y viven en el cubo unitario 3D `[0,1]³`. La distancia euclidiana entre el `genome` del efecto y el `targetDNA` de Selene determina la relevancia.

### 2.3 TextureAffinity

**Fuente:** `src/core/arsenal/lfxTypes.ts:34`

```typescript
export type TextureAffinity = 'clean' | 'dirty' | 'universal'
```

- `clean` — Solo compatible con texturas cristalinas (alta claridad)
- `dirty` — Solo compatible con texturas sucias (distorsión, ruido)
- `universal` — Funciona con cualquier textura

### 2.4 EnergyZoneRange

**Fuente:** `src/core/arsenal/lfxTypes.ts:87-90`

```typescript
export interface EnergyZoneRange {
  readonly min: EnergyZone
  readonly max: EnergyZone
}
```

Donde `EnergyZone` (`src/core/protocol/MusicalContext.ts:145-152`):

```typescript
export type EnergyZone =
  | 'silence'   // E < 0.10
  | 'valley'    // E 0.10-0.20
  | 'ambient'   // E 0.20-0.35
  | 'gentle'    // E 0.35-0.50
  | 'active'    // E 0.50-0.70
  | 'intense'   // E 0.70-0.85
  | 'peak'      // E > 0.85
```

### 2.5 Range

**Fuente:** `src/core/arsenal/lfxTypes.ts:81-84`

```typescript
export interface Range {
  readonly min: number
  readonly max: number
}
```

### 2.6 SpatialBehavior

**Fuente:** `src/core/arsenal/lfxTypes.ts:48-52`

```typescript
export type SpatialBehavior =
  | 'static'            // No toca pan/tilt. Solo dimmer/color/optics.
  | 'relative_offset'   // Emite pan_offset/tilt_offset ∈ [-1,+1]. Se SUMA a la base IK.
  | 'absolute'          // Secuestra pan/tilt absolutos. Si hay IK target → silencia pan/tilt.
  | 'spatial'           // Reservado futuro. Trayectoria 3D (x,y,z).
```

### 2.7 IKCompatibility

**Fuente:** `src/core/arsenal/lfxTypes.ts:96-103`

```typescript
export interface IKCompatibility {
  readonly respectsTarget: boolean                          // Si true, respeta target espacial IK
  readonly orbitAmplitude: number                           // [0..1] Solo relative_offset
  readonly fallbackOnNoTarget: 'static' | 'absolute' | 'silence'
}
```

### 2.8 SimulationMeta

**Fuente:** `src/core/arsenal/lfxTypes.ts:167-185`

```typescript
export interface SimulationMeta {
  readonly beautyWeights: {
    readonly base: number              // Peso base de "belleza"
    readonly energyMultiplier: number  // Multiplicador por energía
    readonly vibeBonus: number         // Bonus por vibe matching
  }
  readonly gpuCost: number             // Coste GPU estimado [0, 1]
  readonly fatigueImpact: number       // Impacto en fatiga del sistema [0, 1]
  readonly minDurationMs: number       // Duración mínima de ejecución
  readonly cooldownMs: number          // Cooldown después de ejecución
  readonly isStrobe: boolean           // ¿Es estroboscópico?
  readonly isDivineCandidate: boolean  // ¿Candidato a disparo divino (Z-score alto)?
  readonly isHeavyCandidate: boolean   // ¿Arsenal pesado (bloqueado en buildup)?
  readonly zScoreGuards: {
    readonly requireRising: boolean    // Requiere energía ascendente
    readonly minimumZ: number | null   // Z-score mínimo requerido
    readonly minimumEnergy: number | null  // Energía mínima requerida
  }
}
```

**Defaults** (`src/core/arsenal/lfxTypes.ts:278-292`):

```typescript
const DEFAULT_SIMULATION_META = {
  beautyWeights: { base: 0.50, energyMultiplier: 1.00, vibeBonus: 0.00 },
  gpuCost: 0.30,
  fatigueImpact: 0.06,
  minDurationMs: 1000,
  cooldownMs: 7000,
  isStrobe: false,
  isDivineCandidate: false,
  isHeavyCandidate: false,
  zScoreGuards: { requireRising: false, minimumZ: null, minimumEnergy: null },
}
```

### 2.9 SafetyDeclaration

**Fuente:** `src/core/arsenal/lfxTypes.ts:196-203`

```typescript
export interface SafetyDeclaration {
  readonly maxStrobeFreqHz: number      // Frecuencia máxima declarada (Hz). 0 = no estroboscópico
  readonly containsRapidFlash: boolean  // True si contiene flash >3Hz
  readonly communityTrusted: boolean    // True solo para efectos firmados/builtin
}
```

**Defaults** (`src/core/arsenal/lfxTypes.ts:272-276`):

```typescript
const DEFAULT_SAFETY_DECLARATION = {
  maxStrobeFreqHz: 0,
  containsRapidFlash: false,
  communityTrusted: true,  // builtin trust por defecto; override por path
}
```

### 2.10 ExecutionDomain y PixelExecutionHints

**Fuente:** `src/core/arsenal/lfxTypes.ts:115-141`

```typescript
export type ExecutionDomain = 'vector' | 'pixel' | 'hybrid'

export interface PixelExecutionHints {
  readonly mappingSpace: 'world' | 'local'
  readonly preferredResolution: { readonly w: number; readonly h: number }
  readonly blend: 'replace' | 'multiply' | 'add' | 'screen'
  readonly alphaToDimmer: boolean
  readonly hybridChannels?: readonly string[]
  readonly targetFps?: number            // 15-60. Default = arbiter rate (44 Hz)
  readonly guerrillaPolicy?: 'omit' | 'fallback-zone'
}
```

### 2.11 RegistryEntry — Forma Interna del Registry

**Fuente:** `src/core/arsenal/lfxTypes.ts:216-262`

```typescript
export interface RegistryEntry {
  readonly id: string
  readonly name: string
  readonly author: string
  readonly category: string
  readonly tags: readonly string[]
  readonly durationMs: number
  readonly effectType: string
  readonly filePath: string | null

  // Genoma plano (alias para acceso O(1) en hot path)
  readonly dna: FrozenGenome
  readonly textureAffinity: TextureAffinity
  readonly compatibleVibes: readonly string[]
  readonly validSections: readonly string[]
  readonly energyZone: EnergyZoneRange
  readonly aggressionRange: Range
  readonly spatialBehavior: SpatialBehavior
  readonly ikCompatibility: IKCompatibility | null

  // Bloques anidados
  readonly simMeta: SimulationMeta
  readonly execHints: ExecutionHints
  readonly safetyDecl: SafetyDeclaration

  // Dominio
  readonly executionDomain: ExecutionDomain
  readonly pixelHints: PixelExecutionHints | null

  readonly isBuiltin: boolean
  readonly loadedAt: number
  readonly source: LFXFileV3 | null    // Referencia al clip completo (carga lazy)
}
```

---

## 3. Mecanismo de Ingesta en Selene

### 3.1 Pipeline de Carga: Disco → Registry

```
.lfx en disco
    │
    ▼
LfxFileLoader.loadFile(filePath, source)
    │
    ▼
HephaestusClipIndex.upsert(filePath, loadSource)
    │  Lee JSON, valida estructura mínima, guarda en RAM
    │
    ▼
DynamicEffectRegistry.registerEffectV3(lfxFile, options)
    │  Gates G3 (genome ∈ [0,1]) + G4 (compatibleVibes no vacío)
    │  Si sin cognitiveDNA → return null (clip Hephaestus-only, invisible a Selene)
    │
    ▼
_buildEntryFromV3(clip, options)
    │  Construye RegistryEntry inmutable (Object.freeze)
    │  Aplana genome → dna: {aggression, chaos, organicity}
    │  Aplica defaults: simMeta, execHints, safetyDecl
    │
    ▼
_appendToIndices(entry)
    │  Indexa por vibe (con deduplicación canonical via VIBE_ALIAS_MAP)
    │  Indexa en _divineByVibe si isDivineCandidate
    │  Indexa en _heavyByVibe si isHeavyCandidate
    │
    ▼
RegistryEntry listo para consumo zero-alloc
```

### 3.2 Pipeline de Selección: Selene → Candidato

Selene no selecciona efectos directamente del `.lfx`. El flujo es:

```
MusicalContext + AudioMetrics
    │
    ▼
DNAAnalyzer.deriveTargetDNA(context, audioMetrics)
    │  Calcula TargetDNA {aggression, chaos, organicity, confidence}
    │  EMA smoothing (α=0.30) anti-jitter
    │  SNAP conditions: drop → A≥0.80, O≤0.25 | breakdown → A≤0.25, O≥0.75
    │
    ▼
EffectDreamSimulator (Montecarlo)
    │  Simula escenarios con efectos del Registry
    │  Filtra por vibe (getEffectsForVibe) y energyZone
    │  Calcula beauty score (beautyWeights × energy × vibeBonus)
    │  Aplica fatigue, cooldown, GPU cost
    │
    ▼
DreamEngineIntegrator
    │  Genera EffectCandidate[] (top 5)
    │  Filtra por MoodController blockList
    │  Construye AudienceSafetyContext (vibe, energy, crowd, GPU, zScore, epilepsy)
    │
    ▼
DecisionMaker.decide(inputs)
    │
    ├── PRIORIDAD 0: DNA Brain (la última palabra)
    │   Si dreamIntegration.approved && effect.effect:
    │     ├── BUILDUP RESTRICTION: isEffectAllowedInSection(effect, 'buildup')
    │     │   Lee validSections del .lfx → si sección no permitida → demote (fall through)
    │     ├── DIVINE LEAK FIX: si isDivineCandidate y Z < threshold → bloquear
    │     └── Si pasa todo → return 'strike' (disparar efecto)
    │
    ├── PRIORIDAD 1: Fuzzy Brain
    │   fuzzyDecision.action === 'strike' && confidence ≥ 0.50
    │   Mirror BUILDUP WALL: isEffectAllowedInSection()
    │
    ├── PRIORIDAD 2-N: Hunt, Prediction, Buildup handlers...
    │
    ▼
ConsciousnessOutput { effectDecision: { effectType, intensity, zones, confidence } }
    │
    ▼
SeleneTitanConscious → SeleneHephBridge → HephaestusRuntime.play()
```

### 3.3 Matching Cognitivo — Distancia Euclidiana 3D

**Fuente:** `src/core/intelligence/dna/EffectDNA.ts:346-378`

```typescript
calculateRelevance(effectId: string, targetDNA: TargetDNA): number {
  const entry = getDynamicEffectRegistry().getEntry(effectId)
  
  // Distancia euclidiana 3D en el cubo unitario ACO
  const dA = entry.dna.aggression - targetDNA.aggression
  const dC = entry.dna.chaos - targetDNA.chaos
  const dO = entry.dna.organicity - targetDNA.organicity
  const distance = Math.sqrt(dA * dA + dC * dC + dO * dO)
  
  // Relevancia base (1 = perfecto match, 0 = distancia máxima √3)
  const baseRelevance = 1 - (distance / Math.sqrt(3))
  
  // Ponderar por confidence del análisis musical
  const confidenceWeighted = baseRelevance * targetDNA.confidence + (1 - targetDNA.confidence) * 0.5
  
  // Diversity Factor (anti-repetición)
  const usageCount = this.effectUsageCount.get(effectId) || 0
  const diversityFactor = this.DIVERSITY_FACTORS[Math.min(usageCount, 3)]
  // [1.0, 0.70, 0.35, 0.15] — penalización exponencial por uso repetido
  // Ventana: 120s — pasado ese tiempo, el slate se limpia
  
  return Math.min(1, confidenceWeighted) * diversityFactor
}
```

### 3.4 Filtrado por Vibe y EnergyZone

El `DynamicEffectRegistry` mantiene índices pre-construidos:

| Índice | Tipo | Propósito |
|--------|------|-----------|
| `_byId` | `Map<string, RegistryEntry>` | Lookup O(1) por ID |
| `_byVibe` | `Map<string, RegistryEntry[]>` | Efectos por vibe (con alias canonical) |
| `_divineByVibe` | `Map<string, RegistryEntry[]>` | Arsenal divino por vibe |
| `_heavyByVibe` | `Map<string, RegistryEntry[]>` | Arsenal pesado por vibe |
| `_allEntries` | `readonly RegistryEntry[]` | Snapshot inmutable de todos |

**Deduplicación de vibes (WAVE 4865):** Un efecto puede declarar `['latin', 'fiesta-latina']` — ambos mapean al mismo canonical via `VIBE_ALIAS_MAP`. El Set `seenCanonicalVibes` previene insertar el entry dos veces en el mismo bucket.

### 3.5 validSections — Puente Cognitivo (WAVE 4843)

**Fuente:** `src/core/intelligence/think/DecisionMaker.ts:109-118`

```typescript
function isEffectAllowedInSection(effectId: string, section: string): boolean {
  const entry = getDynamicEffectRegistry().getEntry(effectId)
  if (!entry || entry.validSections.length === 0) return true  // fail-open
  
  // Section aliasing: 'buildup' ↔ 'build', 'chorus' ↔ 'active'
  const normalizedSection = section === 'buildup' ? 'build' : 
                            section === 'chorus' ? 'active' : section
  
  return entry.validSections.includes(section) || entry.validSections.includes(normalizedSection)
}
```

Esto reemplazó el hardcodeado `HEAVY_ARSENAL_EFFECTS` — los propios `.lfx` declaran en qué secciones son admisibles. Un efecto sin `validSections` pasa sin restricción (fail-open).

### 3.6 Divine Candidate — Z-Score Gate

**Fuente:** `src/core/intelligence/SeleneTitanConscious.ts:572-584`

```typescript
const registryEntry = getDynamicEffectRegistry().getEntry(candidate.effect)
if (registryEntry?.simMeta.isDivineCandidate) {
  const vibes = registryEntry.compatibleVibes
  const isTechno = vibes.some(v => v.includes('techno'))
  const isLatino = vibes.some(v => v.includes('latino') || v.includes('latina') || v.includes('dembow'))
  const effectiveThreshold = isTechno ? 2.5 : isLatino ? 2.0 : 3.5
  if (currentZScore < effectiveThreshold) {
    divineAborted = true  // Efecto suprimido, buffer cleared
  }
}
```

Los efectos divinos requieren un Z-score mínimo que varía por vibe: techno (2.5σ), latino (2.0σ), default (3.5σ).

---

## 4. Límites y Validaciones Estructurales

### 4.1 Gates de Carga (`LfxFileLoader._parseAndValidateV3`)

**Fuente:** `src/core/arsenal/LfxFileLoader.ts:200-377`

Estos gates se ejecutan al cargar un `.lfx` desde disco. Política de fallo silencioso: un `.lfx` malformado se loggea y descarta — NO crashea el cargador.

| Gate | Validación | Fallo |
|------|-----------|-------|
| **Struct: id** | `typeof clip.id === 'string' && length > 0` | `return null` |
| **Struct: name** | `typeof clip.name === 'string'` | `return null` |
| **Struct: author** | `typeof clip.author === 'string'` | `return null` |
| **Struct: category** | `typeof clip.category === 'string'` | `return null` |
| **Struct: tags** | `Array.isArray(clip.tags)` | `return null` |
| **Struct: vibeCompat** | `Array.isArray(clip.vibeCompat) && length > 0` | `return null` |
| **Struct: durationMs** | `typeof === 'number' && Number.isFinite && > 0` | `return null` |
| **Struct: effectType** | `typeof === 'string'` | `return null` |
| **G5: tracks** | `Array.isArray && length > 0` | `return null` |
| **G5: track.zones** | Cada track: `Array.isArray && length > 0` | `return null` |
| **G5: track.curve** | Cada track: objeto con `keyframes` no vacío | `return null` |
| **DNA: genome** | `aggression, chaos, organicity ∈ [0, 1]` | `return null` |
| **DNA: compatibleVibes** | `Array.isArray && length > 0` | `return null` |
| **DNA: textureAffinity** | `∈ {'clean', 'dirty', 'universal'}` | `return null` |
| **G6: strobe consistency** | Si `safetyDecl.maxStrobeFreqHz > 0` → debe haber track strobe/intensity. Si `= 0` → no debe haber track strobe. | `return null` |
| **G2: checksum** | Obligatorio para builtin/marketplace. Si declarado: `SHA-256(JSON.stringify(clip))` debe coincidir. | `return null` |

### 4.2 Gates de Registro (`DynamicEffectRegistry.registerEffectV3`)

**Fuente:** `src/core/arsenal/DynamicEffectRegistry.ts:94-120`

| Gate | Validación | Fallo |
|------|-----------|-------|
| **Presencia DNA** | `clip.cognitiveDNA` debe existir | `return null` (clip Hephaestus-only, invisible a Selene) |
| **G3: genome** | `_validateGenomeRanges(dna)`: aggression, chaos, organicity ∈ [0, 1]; aggressionRange.min/max ∈ [0, 1]; min ≤ max | `return null` |
| **G4: vibes** | `dna.compatibleVibes.length > 0` | `return null` |

### 4.3 Gates de Editor (`gateEvaluators.ts`)

**Fuente:** `src/components/views/HephaestusView/safety/gateEvaluators.ts:1-284`

Estos gates se evalúan en tiempo real dentro del editor Hephaestus para dar feedback visual al usuario. Son **pure functions, zero side effects, deterministic**.

| Gate | Label | Validación | Status |
|------|-------|-----------|--------|
| **G1** | SCHEMA | `id.trim().length > 0 && name.trim().length > 0 && durationMs > 0` | pass/fail |
| **G2** | CHECKSUM | N/A en editor (verificado on save) | na |
| **G3** | GENOME | `aggression, chaos, organicity ∈ [0, 1]` | pass/fail (autoFixable: clamp a [0,1]) |
| **G4** | COMPAT | `compatibleVibes.length ≥ 1 && validSections.length ≥ 1` | pass/warn/fail |
| **G4+** | COMPAT | **WAVE 7123: Energy Zone Gate Clamp** — `zoneSpan = hi - lo + 1`. `0` → fail (huérfano). `> 2` → fail (Montecarlo violado). | pass/fail |
| **G5** | CURVES | Al menos 1 track con `keyframes.length ≥ 2` | pass/warn |
| **G6** | STROBE | Si `simMeta.isStrobe` → intensity track con `keyframes.length ≥ 4` | pass/warn/na |
| **G7** | SPATIAL | `spatialBehavior` coherente con presencia de pan/tilt: `static` + pan/tilt = warn; `absolute/relative_offset` sin pan/tilt = warn | pass/warn/na |

### 4.4 Política de Safety para User Effects

**Fuente:** `src/core/arsenal/LfxFileLoader.ts:58-65`

```typescript
const USER_SAFETY_POLICY = Object.freeze({
  MAX_AGGRESSION: 0.95,          // Aggression máxima para clips de comunidad
  MAX_STROBE_HZ: 25,             // Frecuencia strobe máxima (Hz)
  MAX_FILE_SIZE_BYTES: 256 * 1024,  // 256KB máximo
})
```

| Restricción | Valor | Aplicación |
|-------------|-------|------------|
| Aggression máxima (user) | 0.95 | Si `genome.aggression > 0.95` → reject |
| Strobe freq máxima (user) | 25 Hz | Si `declaredHz > 25` → reject |
| Tamaño archivo (user) | 256 KB | No validado en `_parseAndValidateV3` (validado por FS) |

### 4.5 Invariantes Estructurales del Sistema

| Invariante | Fuente | Aplicación |
|------------|--------|------------|
| Keyframes ordenados ASC por `timeMs` | `types.ts:22` | Cursor cache del CurveEvaluator requiere monotonía |
| `tracks` orden canónico: zona ASC → paramId ASC | `types.ts:463` | Migrator garantiza idempotencia de checksums |
| `spatialZones` NO contiene EnergyZoneIds | `types.ts:431` | Loader rechaza EnergyZoneId en spatialZones |
| `cognitiveDNA` ausente → clip invisible a Selene | `DynamicEffectRegistry.ts:96-98` | `registerEffectV3` retorna null |
| `staticParams` NUNCA contiene `dominantColorH/S/L` | `types.ts:469-470` | Se derivan de curvas 'color' en runtime |
| `cell` RESERVADO v3.0 — no consumido | `types.ts:386-388` | Forward-compat para fixtures multicell |
| RegistryEntry es `Object.freeze()` | `lfxTypes.ts:214` | Zero-alloc en hot path |
| `genome` es `readonly` + `Object.freeze()` | `lfxTypes.ts:74-78` | Inmutabilidad del ADN cognitivo |

### 4.6 Validaciones del Registry (DynamicEffectRegistry)

**Fuente:** `src/core/arsenal/DynamicEffectRegistry.ts:274-280`

```typescript
function _validateGenomeRanges(dna: CognitiveDNA): boolean {
  const g = dna.genome
  if (!_in01(g.aggression) || !_in01(g.chaos) || !_in01(g.organicity)) return false
  if (!_in01(dna.aggressionRange.min) || !_in01(dna.aggressionRange.max)) return false
  if (dna.aggressionRange.min > dna.aggressionRange.max) return false
  return true
}

function _in01(n: number): boolean {
  return Number.isFinite(n) && n >= 0 && n <= 1
}
```

### 4.7 Restricciones Energéticas en Runtime

| Restricción | Valor | Fuente |
|-------------|-------|--------|
| `ENERGY_OVERRIDE_THRESHOLD` | 0.75 | `ConsciousnessOutput.ts` — captura drops latinos en 0.75-0.82 |
| Divine threshold (techno) | Z ≥ 2.5σ | `SeleneTitanConscious.ts:577` |
| Divine threshold (latino) | Z ≥ 2.0σ | `SeleneTitanConscious.ts:577` |
| Divine threshold (default) | Z ≥ 3.5σ | `SeleneTitanConscious.ts:577` |
| Cooldown multiplier (BALANCED) | 2.2 | `MoodController.ts` — objetivo 3-4 EPM en latino |
| Diversity window | 120s | `EffectDNA.ts:261` — slate se limpia cada 2 min |
| Diversity factors | [1.0, 0.70, 0.35, 0.15] | `EffectDNA.ts:272` — penalización exponencial |
| EMA smoothing α | 0.30 | `EffectDNA.ts:230` — 70% history, 30% nuevo |

---

## 5. Flujo End-to-End: Disco → Selene → Hephaestus

### 5.1 Diagrama Completo

```
┌─────────────────────────────────────────────────────────────────────┐
│                        DISCO (.lfx v3.0)                            │
│  { $schema: 'luxsync.lfx/3.0', clip: HephAutomationClipV3, checksum }│
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    LfxFileLoader (main process)                      │
│  1. JSON.parse                                                        │
│  2. Struct validation (id, name, author, category, tags, vibeCompat) │
│  3. G5: tracks[] con zones + curve.keyframes no vacíos               │
│  4. DNA validation (genome ∈ [0,1], compatibleVibes, textureAffinity) │
│  5. G6: strobe consistency                                            │
│  6. USER policy: aggression ≤ 0.95, strobe ≤ 25Hz                    │
│  7. G2: checksum SHA-256 (obligatorio builtin, opcional user)        │
│  Política: fallo silencioso — log + discard                           │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│              HephaestusClipIndex.upsert()                             │
│  Lee JSON, valida, guarda clip en RAM (O(1) para futuras cargas)     │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│           DynamicEffectRegistry.registerEffectV3()                    │
│  1. Sin cognitiveDNA → return null (Hephaestus-only, invisible Selene)│
│  2. G3: _validateGenomeRanges (genome + aggressionRange ∈ [0,1])     │
│  3. G4: compatibleVibes no vacío                                      │
│  4. _buildEntryFromV3 → RegistryEntry (Object.freeze)                 │
│  5. _appendToIndices: _byVibe, _divineByVibe, _heavyByVibe           │
│  6. _rebuildAllEntries → snapshot inmutable                           │
│  Zero-alloc en lookups posteriores                                    │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        SELENE (runtime)                               │
│                                                                       │
│  MusicalContext + AudioMetrics                                        │
│         │                                                             │
│         ▼                                                             │
│  DNAAnalyzer.deriveTargetDNA()                                        │
│    → TargetDNA {aggression, chaos, organicity, confidence}            │
│    → EMA smoothing (α=0.30) + SNAP (drop/breakdown)                   │
│         │                                                             │
│         ▼                                                             │
│  EffectDreamSimulator                                                 │
│    → getEffectsForVibe(vibe) → RegistryEntry[]                        │
│    → Filtrar por energyZone (currentZone ∈ [min, max])                │
│    → calculateRelevance: distancia euclidiana 3D + diversity factor   │
│    → Simular escenarios (Montecarlo: beauty, fatigue, GPU, cooldown)  │
│         │                                                             │
│         ▼                                                             │
│  DreamEngineIntegrator                                                │
│    → generateCandidates (top 5, filtrar blockList)                    │
│    → AudienceSafetyContext (vibe, energy, zScore, epilepsy)           │
│         │                                                             │
│         ▼                                                             │
│  DecisionMaker.decide()                                               │
│    → PRIORIDAD 0: DNA Brain                                           │
│      ├── isEffectAllowedInSection (validSections del .lfx)            │
│      ├── Divine Leak Fix (isDivineCandidate + Z threshold)            │
│      └── return 'strike' si aprobado                                  │
│    → PRIORIDAD 1: Fuzzy Brain (mirror BUILDUP WALL)                   │
│    → PRIORIDAD 2+: Hunt, Prediction, Buildup handlers                 │
│         │                                                             │
│         ▼                                                             │
│  ConsciousnessOutput { effectDecision: { effectType, intensity } }    │
└──────────────────────────┬───────────────────────────────────────────┘
                           │
                           ▼
┌──────────────────────────────────────────────────────────────────────┐
│              SeleneHephBridge → HephaestusRuntime.play()              │
│  1. getEffectFilePath(effectId) → path al .lfx                        │
│  2. HephaestusClipIndex.get(path) → HephAutomationClipV3              │
│  3. _buildResolvedTracks(clip) → ResolvedTrack[]                      │
│     ├── Por cada track: CurveEvaluator, fixtureIds, phaseConfig       │
│     └── resolveWithOverrides (PhaseConfigPro + PhaseOverride)         │
│  4. tick(currentTimeMs) → HephFixtureOutput[]                         │
│     ├── tickActive: iterar ResolvedTrack[]                            │
│     ├── _emitTrackSample: CurveEvaluator.getValue / getColorValue     │
│     ├── blendNumeric / blendRgb (HephSharedMath)                      │
│     └── writeOutput → zero-alloc buffer                               │
│  5. HephFixtureOutput[] → HephAetherAdapter → NodeArbiter → DMX       │
└──────────────────────────────────────────────────────────────────────┘
```

### 5.2 Puntos de Comunicación Selene ↔ Hephaestus

| Punto | Dirección | Mecanismo | Datos |
|-------|-----------|-----------|-------|
| `RegistryEntry.dna` | Selene lee | `getDNA(effectId)` | `{aggression, chaos, organicity}` — genoma plano para matching euclidiano |
| `RegistryEntry.simMeta` | Selene lee | `getSimMeta(effectId)` | `isDivineCandidate`, `isHeavyCandidate`, `isStrobe`, `zScoreGuards`, `cooldownMs` |
| `RegistryEntry.validSections` | Selene lee | `getEntry(effectId).validSections` | Secciones admisibles (buildup, drop, peak, etc.) |
| `RegistryEntry.energyZone` | Selene lee | `getEntry(effectId).energyZone` | Rango `[min, max]` de EnergyZone — filtra candidatos por zona actual |
| `RegistryEntry.compatibleVibes` | Selene lee | `getEffectsForVibe(vibe)` | Indexado pre-construido — O(1) lookup |
| `RegistryEntry.filePath` | Bridge lee | `getEffectFilePath(effectId)` | Path al `.lfx` para carga lazy de curvas |
| `ConsciousnessOutput.effectDecision` | Selene → Bridge | `effectType` = effectId | ID del efecto a disparar |
| `HephaestusRuntime.play(clipId)` | Bridge → Runtime | `HephAutomationClipV3` | Clip completo con tracks, curvas, phase |

### 5.3 Default CognitiveDNA

**Fuente:** `src/core/hephaestus/defaults.ts:10-19`

```typescript
const DEFAULT_COGNITIVE_DNA: Readonly<CognitiveDNA> = Object.freeze({
  genome: { aggression: 0.5, chaos: 0.5, organicity: 0.5 },
  textureAffinity: 'universal',
  compatibleVibes: [],
  validSections: [],
  energyZone: { min: 'ambient', max: 'peak' },
  aggressionRange: { min: 0, max: 1 },
  spatialBehavior: 'absolute',
  ikCompatibility: undefined,
})
```

Un clip nuevo en el editor arranca con genoma neutral (0.5, 0.5, 0.5) — centro del cubo unitario. Esto significa que es igualmente relevante para cualquier target DNA, lo cual es correcto para un clip sin configurar.

---

## 6. Observaciones Clave

### 6.1 Separación de Namespaces (WAVE-4847)

- **`spatialZones`** → DÓNDE van los fixtures (CanonicalZone / helpers)
- **`cognitiveDNA`** → CUÁNDO/CÓMO actúa Selene (EnergyZone, ACO, vibes)

El Loader rechaza cualquier `EnergyZoneId` en `spatialZones`. Esto previene que un efecto declare `'peak'` como zona espacial cuando `'peak'` es una zona energética.

### 6.2 Clips Sin cognitiveDNA

Un `.lfx` sin `cognitiveDNA` es perfectamente válido — es un clip Hephaestus puro. El `DynamicEffectRegistry.registerEffectV3()` retorna `null` silenciosamente, y el clip NO aparece en el arsenal de Selene. Solo puede ser disparado manualmente (via KeyForge, MidiLearn, o UI).

### 6.3 Vibe Alias Map

**Fuente:** `src/engine/vibe/profiles/index.ts` (importado en `DynamicEffectRegistry.ts:31`)

El registry normaliza vibes via `VIBE_ALIAS_MAP` antes de indexar. Ejemplo: `'latin'` → `'fiesta-latina'`. Esto previene que un efecto se inserte dos veces en el mismo bucket cuando declara alias sinónimos.

### 6.4 Orden Canónico de Tracks

El migrator ordena `tracks[]` por **zona ASC → paramId ASC**. Esto garantiza:
1. **Idempotencia de checksums** — dos exports del mismo clip producen el mismo SHA-256
2. **Comportamiento determinista de blend modes no conmutativos** — `replace` y `subtract` dependen del orden de iteración

### 6.5 LfxClipInstance.toCognitiveDNA() — Bridge Atómico

**Fuente:** `src/core/arsenal/LfxClipInstance.ts:515-567`

El `LfxClipInstance` (átomo del arsenal) puede proyectar su tríada ACO a un `CognitiveDNA` vía `toCognitiveDNA()`. Esto se usa cuando un átomo se exporta a `.lfx`:
- `genome` ← tríada ACO directa
- `energyZone` ← min/max de `energyZones` ordenados por `ENERGY_ZONES` canónico
- `textureAffinity` ← derivada del arquetipo (`strobe/heavy → dirty`, `ambient/divine → clean`, `utility → universal`)
- `aggressionRange` ← `[aggression, aggression]` (rango cerrado sobre valor actual)
- `compatibleVibes` ← traducidas via `VIBE_BRIDGE`

### 6.6 Energy Zone Gate Clamp (WAVE 7123)

El gate G4 en el editor valida que el `zoneSpan` (número de zonas energéticas seleccionadas) sea 1 o 2:
- `0` → fail ("Efecto huérfano: Selecciona al menos 1 zona energética")
- `> 2` → fail ("Equilibrio Montecarlo violado: N zonas seleccionadas (máximo 2)")

Esto asegura que cada efecto viva en 1-2 zonas energéticas, permitiendo que el Montecarlo del DreamSimulator distribuya efectos uniformemente across el termómetro energético.

---

*Fin del reporte — WAVE 5000 PREP Part 3/3 completada.*
