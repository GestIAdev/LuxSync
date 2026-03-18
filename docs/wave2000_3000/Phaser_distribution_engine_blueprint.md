# ⚒️ WAVE 2400: THE PHASER REVOLUTION & ZERO-ALLOC

## ARCHITECTURAL BLUEPRINT

> **Author:** PunkOpus — Lead DSP & Architecture Engineer  
> **Date:** 2025-03-11  
> **Status:** 📐 BLUEPRINT — Pre-Implementation  
> **Prerequisite:** HEPHAESTUS-PIONEER-DUE-DILIGENCE.md (Score 85.2/100)  
> **Target:** Cerrar P1.1 (Phase Distribution), P1.2 (Symmetry) y P2.1-P2.3 (Zero-Alloc)

---

## 📋 ÍNDICE

1. [Contexto y Motivación](#1-contexto-y-motivación)
2. [Phase Distribution Engine](#2-phase-distribution-engine)
3. [Zero-Allocation Architecture](#3-zero-allocation-architecture)
4. [Roadmap de Ejecución — 3 Golpes Quirúrgicos](#4-roadmap-de-ejecución--3-golpes-quirúrgicos)
5. [Riesgos y Mitigaciones](#5-riesgos-y-mitigaciones)
6. [Apéndice: Referencia Matemática](#6-apéndice-referencia-matemática)

---

## 1. Contexto y Motivación

### El Gap: MA3 Phaser Parity = 68/100

La auditoría Pioneer Due Diligence de Hephaestus reveló que el **Eje 3 (MA3 Phaser Parity)** es el punto más débil del sistema. El runtime actual ejecuta TODAS las fixtures al **mismo tiempo de clip** — no hay concepto de phase offset, symmetry, ni wings.

```
ESTADO ACTUAL (HephaestusRuntime.tick()):

  tick(currentTimeMs) {
    for (clip of activeClips) {
      clipTimeMs = elapsed                    ← MISMO para TODAS las fixtures
      for (curve of clip.curves) {
        value = evaluator.getValue(param, clipTimeMs)   ← UNA evaluación
        for (zone of zones) {
          outputs.push({ zone, value })       ← MISMO valor, TODAS las zonas
        }
      }
    }
  }

  Resultado: 12 PARs, todos hacen lo MISMO al MISMO tiempo.
  Boring. No es lighting profesional.
```

### El Objetivo: MA3-Class Phase Distribution

```
ESTADO OBJETIVO (post-WAVE 2400):

  tick(currentTimeMs) {
    for (clip of activeClips) {
      fixturePhases = PhaseDistributor.resolve(clip.selector)
      for ({ fixtureId, phaseOffsetMs } of fixturePhases) {
        offsetTime = clipTimeMs + phaseOffsetMs     ← DIFERENTE por fixture
        value = evaluator.getValue(param, offsetTime)
        outputs[cursor++] = { fixtureId, value }     ← Pre-allocated
      }
    }
  }

  Resultado: 12 PARs, cada uno a un momento diferente de la curva.
  Wave chase. Rainbow sweep. Center-out pulse. 🔥
```

### Los P2: Death by Allocation

Además del gap funcional, hay 3 puntos de allocación en el hot path:

| P2 | Línea | Problema | Impacto @60fps×50clips |
|----|-------|----------|------------------------|
| P2.1 | `getSnapshot()` | `const snapshot: HephParamSnapshot = {}` | 3,000 objetos/seg |
| P2.2 | `tick()` | `const outputs: HephFixtureOutput[] = []` + `.push()` | 3,000 arrays/seg |
| P2.3 | `getColorValue()` | `return { h:..., s:..., l:... }` | 3,000 HSLs/seg |

GC pause risk en sets largos. Resolvemos con pre-allocated pools.

---

## 2. Phase Distribution Engine

### 2.1 Conceptos Fundamentales

Tres conceptos ortogonales que se componen:

```
┌──────────────────────────────────────────────────────────────────┐
│                    PHASE DISTRIBUTION PIPELINE                    │
│                                                                    │
│  FixtureSelector          PhaseConfig          PhaseDistributor    │
│  ┌──────────┐     ┌────────────────┐     ┌─────────────────┐      │
│  │ target   │────▸│ spread: 0-1    │────▸│ resolve()       │      │
│  │ parity   │     │ symmetry: mode │     │ → FixturePhase[]│      │
│  │ indexRng │     │ wings: 1-N     │     │ (sorted by      │      │
│  │ stereoSd │     │ direction: ±1  │     │  offset ASC)    │      │
│  └──────────┘     └────────────────┘     └─────────────────┘      │
│                                                                    │
│  Ya existe en         NUEVO: Extiende       NUEVO: Clase pura     │
│  ShowFileV2.ts        FixtureSelector       stateless, testeable  │
└──────────────────────────────────────────────────────────────────┘
```

| Concepto | Qué hace | Ejemplo visual (8 fixtures) |
|----------|----------|-----------------------------|
| **Phase Spread** | Offset lineal acumulativo entre fixtures | `[0°, 45°, 90°, 135°, 180°, 225°, 270°, 315°]` |
| **Symmetry** | Pliega la distribución de fase | Mirror: `[0°, 90°, 180°, 270°, 270°, 180°, 90°, 0°]` |
| **Wings** | Divide en sub-grupos, cada uno reinicia fase | 2 wings: `[0°,90°,180°,270°] [0°,90°,180°,270°]` |

### 2.2 Nuevos Tipos

```typescript
// ═══════════════════════════════════════════════════════════════════
// FILE: types.ts — ADDITIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Modo de distribución de fase entre fixtures.
 *
 * 'linear'     → Offset crece linealmente: fixture[i] = i * stepMs
 * 'mirror'     → Fold simétrico: se pliega desde los extremos al centro
 * 'center-out' → Expansión desde el centro hacia afuera
 */
export type PhaseSymmetryMode = 'linear' | 'mirror' | 'center-out'

/**
 * Dirección de propagación de la fase.
 *
 * 1  → Forward:  fixture 0 primero, fixture N último
 * -1 → Reverse:  fixture N primero, fixture 0 último
 */
export type PhaseDirection = 1 | -1

/**
 * Configuración completa de distribución de fase para un clip.
 *
 * Se almacena como extensión de FixtureSelector o directamente
 * en el HephAutomationClip.
 *
 * INVARIANTES:
 * - spread ∈ [0, 1]  (0 = sin offset, 1 = spread completo de durationMs)
 * - wings ∈ [1, N]   (1 = sin división, N = N sub-grupos)
 * - wings ≤ fixtureCount (se clampea en runtime)
 */
export interface PhaseConfig {
  /** Spread total: fracción de durationMs que separa al primero del último */
  spread: number   // 0-1

  /** Modo de simetría */
  symmetry: PhaseSymmetryMode

  /** Cantidad de wings (sub-grupos con fase independiente) */
  wings: number    // 1-N, default 1

  /** Dirección de propagación */
  direction: PhaseDirection  // default 1
}

/**
 * Resultado pre-calculado de fase para UNA fixture.
 * Array de estos = lo que PhaseDistributor.resolve() retorna.
 */
export interface FixturePhase {
  /** ID de la fixture (resolved desde FixtureSelector) */
  fixtureId: string

  /** Offset de fase en ms (se SUMA a clipTimeMs) */
  phaseOffsetMs: number

  /** Índice normalizado 0-1 dentro de su wing (para UI) */
  normalizedIndex: number
}

/**
 * Default PhaseConfig — sin distribución de fase.
 */
export const DEFAULT_PHASE_CONFIG: PhaseConfig = {
  spread: 0,
  symmetry: 'linear',
  wings: 1,
  direction: 1,
} as const
```

### 2.3 Extensión de FixtureSelector

```typescript
// ═══════════════════════════════════════════════════════════════════
// FILE: ShowFileV2.ts — FixtureSelector EXTENSION
// ═══════════════════════════════════════════════════════════════════

export interface FixtureSelector {
  target: CanonicalZone | string
  parity?: 'all' | 'even' | 'odd'
  indexRange?: string
  stereoSide?: 'left' | 'right'

  // ── WAVE 2400: Phase Distribution ─────────────────────────────
  /** 
   * Simple phase spread (legacy/shorthand).
   * Si phase está presente, phase.spread toma precedencia.
   */
  phaseSpread?: number  // 0-1 — YA EXISTÍA

  /** 
   * WAVE 2400: Full phase configuration.
   * Si está presente, phaseSpread se ignora.
   */
  phase?: PhaseConfig
}
```

### 2.4 PhaseDistributor — La Clase Core

```
UBICACIÓN: src/core/hephaestus/runtime/PhaseDistributor.ts
```

```typescript
// ═══════════════════════════════════════════════════════════════════
// PHASE DISTRIBUTOR — Pure Math, Zero State, Fully Testable
// ═══════════════════════════════════════════════════════════════════

/**
 * ⚒️ WAVE 2400: PhaseDistributor
 *
 * Clase STATELESS que calcula el phase offset por fixture
 * basándose en PhaseConfig + la lista de fixture IDs resuelta.
 *
 * DESIGN AXIOMS:
 * 1. Pure function: mismos inputs → mismos outputs. SIEMPRE.
 * 2. Pre-calculable: resolve() se llama UNA VEZ cuando el clip
 *    se activa (play/playFromClip). NO en cada tick.
 * 3. Sorted output: FixturePhase[] ordenado por phaseOffsetMs ASC.
 *    Esto permite que el CurveEvaluator cursor cache funcione
 *    en O(1) amortizado incluso con phase offsets.
 *
 * FÓRMULAS CENTRALES:
 *
 *   spreadMs = durationMs × config.spread
 *
 *   Linear:
 *     stepMs = spreadMs / max(1, N - 1)
 *     offset[i] = i × stepMs × direction
 *
 *   Mirror:
 *     half = ceil(N / 2)
 *     linearOffset[i] = min(i, N - 1 - i) × stepMs
 *     (se pliega: [0, step, 2step, ..., 2step, step, 0])
 *
 *   Center-Out:
 *     center = (N - 1) / 2
 *     dist[i] = abs(i - center)
 *     offset[i] = dist[i] × stepMs
 *     (expande desde el centro: [max, ..., 0, ..., max])
 *
 *   Wings:
 *     wingSize = ceil(N / wings)
 *     localIndex = i % wingSize
 *     → Aplica la fórmula de symmetry con localIndex y wingSize
 */
export class PhaseDistributor {

  /**
   * Resuelve la distribución de fase para una lista de fixtures.
   *
   * @param fixtureIds — IDs resueltos por resolveFixtureSelector()
   * @param config — Configuración de fase
   * @param durationMs — Duración del clip (para calcular spreadMs)
   * @returns FixturePhase[] ordenado por phaseOffsetMs ASC
   */
  static resolve(
    fixtureIds: string[],
    config: PhaseConfig,
    durationMs: number
  ): FixturePhase[] {
    const N = fixtureIds.length
    if (N === 0) return []
    if (N === 1 || config.spread === 0) {
      return fixtureIds.map(id => ({
        fixtureId: id,
        phaseOffsetMs: 0,
        normalizedIndex: 0,
      }))
    }

    const spreadMs = durationMs * config.spread
    const wings = Math.max(1, Math.min(config.wings, N))
    const wingSize = Math.ceil(N / wings)

    const results: FixturePhase[] = new Array(N)

    for (let i = 0; i < N; i++) {
      const localIndex = i % wingSize
      const localN = Math.min(wingSize, N - Math.floor(i / wingSize) * wingSize)

      const offset = PhaseDistributor.computeOffset(
        localIndex,
        localN,
        spreadMs,
        config.symmetry,
        config.direction
      )

      results[i] = {
        fixtureId: fixtureIds[i],
        phaseOffsetMs: offset,
        normalizedIndex: localN > 1 ? localIndex / (localN - 1) : 0,
      }
    }

    // Sort by phaseOffsetMs ASC — critical for CurveEvaluator cursor optimization
    results.sort((a, b) => a.phaseOffsetMs - b.phaseOffsetMs)

    return results
  }

  /**
   * Calcula el offset de UNA fixture dentro de su wing.
   * Pure math — sin side effects.
   */
  private static computeOffset(
    localIndex: number,
    localN: number,
    spreadMs: number,
    symmetry: PhaseSymmetryMode,
    direction: PhaseDirection
  ): number {
    if (localN <= 1) return 0

    const stepMs = spreadMs / (localN - 1)
    let offset: number

    switch (symmetry) {
      case 'linear':
        offset = localIndex * stepMs
        break

      case 'mirror': {
        // Fold: [0, step, 2step, 2step, step, 0]
        const halfN = Math.ceil(localN / 2)
        const mirrorIdx = localIndex < halfN
          ? localIndex
          : localN - 1 - localIndex
        offset = mirrorIdx * (spreadMs / Math.max(1, halfN - 1))
        break
      }

      case 'center-out': {
        // Expand from center: largest offset at edges
        const center = (localN - 1) / 2
        const dist = Math.abs(localIndex - center)
        const maxDist = center || 1
        offset = (dist / maxDist) * spreadMs
        break
      }

      default:
        offset = localIndex * stepMs
    }

    // Apply direction
    if (direction === -1) {
      offset = spreadMs - offset
    }

    return offset
  }
}
```

### 2.5 Visualización Matemática

#### Linear (spread=0.5, duration=2000ms, 8 fixtures)

```
spreadMs = 2000 × 0.5 = 1000ms
stepMs = 1000 / 7 ≈ 142.8ms

Fixture:  F0     F1     F2     F3     F4     F5     F6     F7
Offset:   0ms    143ms  286ms  429ms  571ms  714ms  857ms  1000ms

Timeline: ════════════════════════════════════════════════►
  F0:     ╔══════════════════════════════════╗
  F1:       ╔══════════════════════════════════╗
  F2:         ╔══════════════════════════════════╗
  F3:           ╔══════════════════════════════════╗
  ...                    ← wave chase effect →
```

#### Mirror (spread=0.5, duration=2000ms, 8 fixtures)

```
halfN = 4, mirrorStepMs = 1000 / 3 ≈ 333ms

Fixture:  F0     F1     F2     F3     F4     F5     F6     F7
Offset:   0ms    333ms  667ms  1000ms 1000ms 667ms  333ms  0ms

              ↗ ↗ ↗ ↗               ↖ ↖ ↖ ↖
          [ramp up]  [peak]  [peak]  [ramp down]
              Simétrico — efecto de respiración
```

#### Center-Out (spread=0.5, duration=2000ms, 8 fixtures)

```
center = 3.5, maxDist = 3.5

Fixture:  F0     F1     F2     F3     F4     F5     F6     F7
Dist:     3.5    2.5    1.5    0.5    0.5    1.5    2.5    3.5
Offset:   1000ms 714ms  429ms  143ms  143ms  429ms  714ms  1000ms

              ↘ ↘ ↘ ↘ epicenter ↗ ↗ ↗ ↗
          [edges last]  [center first]  [edges last]
              Pulse que nace del centro
```

#### Wings (wings=2, symmetry=linear, 8 fixtures)

```
wingSize = 4

Wing A (F0-F3):  0ms    333ms   667ms   1000ms
Wing B (F4-F7):  0ms    333ms   667ms   1000ms

  F0 F1 F2 F3 | F4 F5 F6 F7
  ↗  ↗  ↗  ↗  | ↗  ↗  ↗  ↗
  [wave→]       [wave→]        ← Dos chases paralelos
```

### 2.6 Integración en HephaestusRuntime.tick()

#### Cambios Estructurales en `ActiveHephClip`:

```typescript
interface ActiveHephClip {
  instanceId: string
  filePath: string
  clip: HephAutomationClip
  evaluator: CurveEvaluator
  startTimeMs: number
  durationMs: number
  intensity: number
  loop: boolean

  // ── WAVE 2400: Phase Distribution ──────────────────────────
  /**
   * Pre-calculated fixture phases. Resolved ONCE at play() time.
   * Sorted by phaseOffsetMs ASC for cursor cache optimization.
   * null = legacy mode (zones without phase, backward compat)
   */
  fixturePhases: FixturePhase[] | null

  /**
   * Phase config used to generate fixturePhases.
   * Stored for runtime introspection/debug UI.
   */
  phaseConfig: PhaseConfig | null
}
```

#### Nuevo tick() — El Hot Path Refactored:

```typescript
tick(currentTimeMs: number): HephFixtureOutput[] {
  this.lastTickMs = currentTimeMs
  this.outputCursor = 0  // ← Zero-alloc: reuse buffer
  const expiredClips: string[] = []

  for (const [instanceId, active] of this.activeClips) {
    const elapsedMs = currentTimeMs - active.startTimeMs
    let baseClipTimeMs = elapsedMs

    // Handle looping
    if (active.loop && elapsedMs >= active.durationMs) {
      baseClipTimeMs = elapsedMs % active.durationMs
    }

    // Check expiration
    if (!active.loop && elapsedMs >= active.durationMs) {
      expiredClips.push(instanceId)
      continue
    }

    // ── BRANCHING: Phase-aware vs Legacy ────────────────────
    if (active.fixturePhases && active.fixturePhases.length > 0) {
      // 🔥 WAVE 2400: PER-FIXTURE PHASE EVALUATION
      this.tickWithPhase(active, baseClipTimeMs)
    } else {
      // Legacy: zone-based, same time for all
      this.tickLegacy(active, baseClipTimeMs)
    }
  }

  // Cleanup expired
  for (const id of expiredClips) {
    this.activeClips.delete(id)
  }

  // Return view of pre-allocated buffer (0..outputCursor)
  return this.getOutputSlice()
}

/**
 * ⚒️ WAVE 2400: Phase-aware evaluation path.
 *
 * fixturePhases is SORTED by phaseOffsetMs ASC.
 * This means CurveEvaluator queries go in monotonically
 * increasing time order → cursor cache stays O(1).
 */
private tickWithPhase(active: ActiveHephClip, baseClipTimeMs: number): void {
  for (const fp of active.fixturePhases!) {
    // ── Calculate fixture-specific time ──────────────────
    let fixtureTimeMs = baseClipTimeMs + fp.phaseOffsetMs

    // Wrap if looping (phase offset can push beyond duration)
    if (active.loop) {
      fixtureTimeMs = ((fixtureTimeMs % active.durationMs) + active.durationMs) % active.durationMs
    } else {
      fixtureTimeMs = Math.min(fixtureTimeMs, active.durationMs)
    }

    // ── Evaluate each curve at fixture-specific time ─────
    for (const [paramName, curve] of active.clip.curves) {
      if (curve.valueType === 'color') {
        const hsl = active.evaluator.getColorValue(paramName, fixtureTimeMs)
        const modulatedL = (hsl.l / 100) * active.intensity
        const rgb = hslToRgb(hsl.h, hsl.s / 100, modulatedL)

        this.writeOutput(fp.fixtureId, 'all', paramName, 0, rgb)
      } else {
        const rawValue = active.evaluator.getValue(paramName, fixtureTimeMs)
        const withIntensity = rawValue * active.intensity
        const scaledValue = scaleToDMX(paramName, withIntensity)
        const fine = (paramName === 'pan' || paramName === 'tilt')
          ? scaleToDMX16(withIntensity).fine
          : undefined

        this.writeOutput(fp.fixtureId, 'all', paramName, scaledValue, undefined, fine)
      }
    }
  }
}

/**
 * Legacy path: sin phase distribution.
 * Mantiene backward compatibility 1:1 con el tick() actual.
 */
private tickLegacy(active: ActiveHephClip, clipTimeMs: number): void {
  const zones: Array<EffectZone | 'all'> = active.clip.zones.length > 0
    ? active.clip.zones
    : ['all']

  for (const [paramName, curve] of active.clip.curves) {
    if (curve.valueType === 'color') {
      const hsl = active.evaluator.getColorValue(paramName, clipTimeMs)
      const modulatedL = (hsl.l / 100) * active.intensity
      const rgb = hslToRgb(hsl.h, hsl.s / 100, modulatedL)

      for (const zone of zones) {
        this.writeOutput(`zone:${zone}`, zone, paramName, 0, rgb)
      }
    } else {
      const rawValue = active.evaluator.getValue(paramName, clipTimeMs)
      const withIntensity = rawValue * active.intensity
      const scaledValue = scaleToDMX(paramName, withIntensity)
      const fine = (paramName === 'pan' || paramName === 'tilt')
        ? scaleToDMX16(withIntensity).fine
        : undefined

      for (const zone of zones) {
        this.writeOutput(`zone:${zone}`, zone, paramName, scaledValue, undefined, fine)
      }
    }
  }
}
```

### 2.7 CurveEvaluator & Cursor Cache — Decisión Arquitectónica

**Problema:** Con phase offsets, el tick() ya no consulta UN solo `clipTimeMs` sino N tiempos diferentes (uno por fixture). Si los offsets no son monotónicos, el cursor cache pierde su O(1).

**Solución:** `PhaseDistributor.resolve()` retorna `FixturePhase[]` **sorted by phaseOffsetMs ASC**. Cuando `tickWithPhase()` itera este array, las consultas al CurveEvaluator van en orden creciente de tiempo:

```
baseClipTimeMs = 500ms

fixturePhases (sorted):
  F3: 500 + 0   = 500ms  → cursor avanza a segmento para 500ms
  F0: 500 + 143 = 643ms  → cursor avanza 1-2 posiciones (O(1))
  F5: 500 + 286 = 786ms  → cursor avanza 1-2 posiciones (O(1))
  F1: 500 + 429 = 929ms  → cursor avanza 1-2 posiciones (O(1))
  ...

Todas las consultas son MONÓTONAMENTE CRECIENTES → cursor cache = O(1) amortizado ✅
```

**Excepción:** Cuando `looping=true` y `fixtureTimeMs` wrappea (`% durationMs`), puede haber un reset de tiempo (1999ms → 0ms). En ese caso el cursor detecta dirección invertida y hace binary search O(log n) — EXACTAMENTE como ya funciona en `findSegment()`. No requiere cambios en CurveEvaluator.

**Decisión: UN CurveEvaluator por clip (compartido entre fixtures).**  
- ✅ Memoria: 1 instancia vs N instancias
- ✅ Cache: funciona porque fixturePhases está sorted
- ✅ Zero changes en CurveEvaluator para phase support

---

## 3. Zero-Allocation Architecture

### 3.1 Filosofía

```
REGLA: En el hot path (tick()), NINGUNA operación debe hacer `new` o crear
       literales de objeto `{}` o arrays `[]`.

EXCEPCIÓN: Creación del pool al inicio (play()) o al resize.
           Eso está fuera del hot path.

CONTRATO: Los consumidores de tick() NO DEBEN retener referencias
          a los objetos del output buffer entre frames.
          Si necesitan persistir datos, deben copiarlos.
```

### 3.2 P2.2 — Pre-Allocated Output Buffer (`tick()`)

**Antes:**
```typescript
tick(): HephFixtureOutput[] {
  const outputs: HephFixtureOutput[] = []     // ← new array cada frame
  // ...
  outputs.push({ ... })                       // ← new object cada output
  return outputs
}
```

**Después:**
```typescript
// ═══════════════════════════════════════════════════════════════════
// En HephaestusRuntime:
// ═══════════════════════════════════════════════════════════════════

/** Pre-allocated output buffer */
private outputBuffer: HephFixtureOutput[] = []

/** Current write position in outputBuffer */
private outputCursor: number = 0

/** Maximum capacity — grows if needed (amortized) */
private outputCapacity: number = 0

/**
 * Ensure output buffer has enough capacity.
 * Called when clips are added/removed (NOT in tick).
 */
private ensureOutputCapacity(needed: number): void {
  if (needed <= this.outputCapacity) return

  // Grow by 2x or to needed, whichever is larger
  const newCapacity = Math.max(needed, this.outputCapacity * 2, 256)

  // Extend buffer with pre-allocated empty objects
  for (let i = this.outputCapacity; i < newCapacity; i++) {
    this.outputBuffer[i] = {
      fixtureId: '',
      zone: 'all',
      parameter: '',
      value: 0,
      rgb: undefined,
      fine: undefined,
      source: 'hephaestus-runtime',
    }
  }
  this.outputCapacity = newCapacity
}

/**
 * Write one output to the pre-allocated buffer.
 * Mutates in-place — zero allocation.
 */
private writeOutput(
  fixtureId: string,
  zone: EffectZone | 'all',
  parameter: string,
  value: number,
  rgb?: { r: number; g: number; b: number },
  fine?: number
): void {
  // Auto-grow if needed (rare — only if capacity estimate was wrong)
  if (this.outputCursor >= this.outputCapacity) {
    this.ensureOutputCapacity(this.outputCursor + 64)
  }

  const out = this.outputBuffer[this.outputCursor++]
  out.fixtureId = fixtureId
  out.zone = zone
  out.parameter = parameter
  out.value = value
  out.rgb = rgb
  out.fine = fine
  // out.source is always 'hephaestus-runtime' — set once at creation
}

/**
 * Return a slice view of the output buffer (0..cursor).
 * The consumer MUST NOT retain references beyond the current frame.
 *
 * NOTA: No usamos Array.slice() (crearía una copia).
 * Retornamos el buffer completo + un length indicator.
 * El consumidor (TitanOrchestrator) itera [0, outputCount).
 */
private getOutputSlice(): HephFixtureOutput[] {
  // Option A: slice (creates new array, but small overhead vs new objects)
  // Option B: return buffer + outputCount property
  //
  // DECISION: Usamos slice() por simplicidad de API.
  // El costo es UNA array allocation por frame (sin object allocations).
  // El array contiene REFERENCES a los objetos del buffer (no copias).
  // Total GC pressure: ~1 array header per frame vs ~hundreds of objects.
  return this.outputBuffer.slice(0, this.outputCursor)
}
```

**Cálculo de capacidad en play():**

```typescript
play(filePath, options): string | null {
  const clip = this.loadClip(filePath)
  if (!clip) return null

  // ... create ActiveHephClip ...

  // ── WAVE 2400: Calculate capacity needed ──────────────
  const fixtureCount = activeClip.fixturePhases?.length ?? clip.zones.length || 1
  const curveCount = clip.curves.size
  const neededForThisClip = fixtureCount * curveCount

  // Ensure buffer can hold ALL active clips' outputs
  const totalNeeded = this.estimateTotalOutputs() + neededForThisClip
  this.ensureOutputCapacity(totalNeeded)

  // ...
}
```

### 3.3 P2.3 — Pre-Allocated HSL in `getColorValue()`

**Antes:**
```typescript
getColorValue(paramId, timeMs): HSL {
  // ...
  return {                    // ← new object cada call
    h: this.lerpHue(...),
    s: c0.s + (c1.s - c0.s) * easedProgress,
    l: c0.l + (c1.l - c0.l) * easedProgress,
  }
}
```

**Después:**
```typescript
// ═══════════════════════════════════════════════════════════════════
// En CurveEvaluator:
// ═══════════════════════════════════════════════════════════════════

/** Pre-allocated HSL result object. Reused across calls. */
private readonly _hslResult: HSL = { h: 0, s: 0, l: 0 }

/**
 * Evalúa color de curva. Retorna referencia al buffer interno.
 *
 * ⚠️ CONTRATO: El caller NO debe retener la referencia.
 *    La próxima llamada a getColorValue() SOBREESCRIBIRÁ el resultado.
 *    Si necesitas persistir: `const copy = { ...evaluator.getColorValue(...) }`
 */
getColorValue(paramId: HephParamId, timeMs: number): HSL {
  // ... all existing logic ...

  // En lugar de `return { h:..., s:..., l:... }`:
  this._hslResult.h = this.lerpHue(c0.h, c1.h, easedProgress)
  this._hslResult.s = c0.s + (c1.s - c0.s) * easedProgress
  this._hslResult.l = c0.l + (c1.l - c0.l) * easedProgress
  return this._hslResult
}
```

**Impacto en consumidores:** El `tick()` de HephaestusRuntime lee `hsl.h`, `hsl.s`, `hsl.l` inmediatamente y los pasa a `hslToRgb()`. No retiene la referencia. ✅ Compatible.

**Impacto en `hslToRgb()`:** Esta función lee los 3 floats y produce `{r,g,b}`. Actualmente crea un nuevo objeto también. Podemos aplicar la misma técnica:

```typescript
// Pre-allocated RGB result (en scope de HephaestusRuntime)
private readonly _rgbResult = { r: 0, g: 0, b: 0 }

// hslToRgb muta _rgbResult en lugar de crear nuevo objeto
```

### 3.4 P2.1 — Pre-Allocated Snapshot (`getSnapshot()`)

**Antes:**
```typescript
getSnapshot(timeMs): HephParamSnapshot {
  const snapshot: HephParamSnapshot = {}   // ← new object cada call
  for (const [paramId, curve] of this.curves) {
    snapshot[paramId] = this.getValue(...)  // ← or getColorValue()
  }
  return snapshot
}
```

**Después:**
```typescript
// ═══════════════════════════════════════════════════════════════════
// En CurveEvaluator:
// ═══════════════════════════════════════════════════════════════════

/** Pre-allocated snapshot object. Keys created in constructor. */
private readonly _snapshotCache: HephParamSnapshot = {}

/** Pre-allocated HSL objects for color params in snapshot */
private readonly _snapshotColorCache: Map<HephParamId, HSL> = new Map()

constructor(curves, durationMs) {
  // ... existing init ...

  // Pre-allocate snapshot structure
  for (const [paramId, curve] of curves) {
    if (curve.valueType === 'color') {
      const colorObj: HSL = { h: 0, s: 0, l: 0 }
      this._snapshotColorCache.set(paramId, colorObj)
      this._snapshotCache[paramId] = colorObj
    } else {
      this._snapshotCache[paramId] = 0
    }
  }
}

/**
 * Snapshot zero-alloc: muta objetos pre-alocados en el constructor.
 *
 * ⚠️ CONTRATO: NO retener referencia al snapshot ni a sus HSL internos.
 *    Se sobreescriben en la siguiente llamada.
 */
getSnapshot(timeMs: number): HephParamSnapshot {
  for (const [paramId, curve] of this.curves) {
    if (curve.valueType === 'color') {
      const hsl = this.getColorValue(paramId, timeMs)
      // getColorValue ya escribió en _hslResult, copiamos a snapshot cache
      const cached = this._snapshotColorCache.get(paramId)!
      cached.h = hsl.h
      cached.s = hsl.s
      cached.l = hsl.l
      // _snapshotCache[paramId] ya apunta a cached (set in constructor)
    } else {
      this._snapshotCache[paramId] = this.getValue(paramId, timeMs)
    }
  }
  return this._snapshotCache
}
```

### 3.5 Resumen Zero-Alloc

| Target | Antes (per-frame) | Después (per-frame) | Allocation savings |
|--------|-------------------|--------------------|--------------------|
| `tick()` outputs | N×`new Object` + `new Array` | 0 objects, 1 `slice()` | ~99% |
| `getColorValue()` | 1×`new HSL` per call | 0 | 100% |
| `getSnapshot()` | 1×`new Object` + N×`new HSL` | 0 | 100% |
| `hslToRgb()` | 1×`new {r,g,b}` per call | 0 (optional Phase 2) | 100% |

**GC Pressure reducido:** De ~9,000 objetos/seg (50 clips × 60fps × 3 allocations) a ~60 arrays/seg (1 slice per frame).

---

## 4. Roadmap de Ejecución — 3 Golpes Quirúrgicos

### Fase 1: TYPES & MATHEMATICS (WAVE 2401)
**Scope:** Nuevos tipos + PhaseDistributor + Tests  
**Duración estimada:** 1 sesión  
**Riesgo:** BAJO — código nuevo sin tocar el hot path

#### Archivos NUEVOS:
| Archivo | Contenido |
|---------|-----------|
| `runtime/PhaseDistributor.ts` | Clase PhaseDistributor (resolve + computeOffset) |
| `__tests__/PhaseDistributor.test.ts` | Tests exhaustivos de las 3 simetrías + wings + direction |

#### Archivos MODIFICADOS:
| Archivo | Cambio |
|---------|--------|
| `types.ts` | Add PhaseSymmetryMode, PhaseConfig, FixturePhase, DEFAULT_PHASE_CONFIG |
| `ShowFileV2.ts` | Add `phase?: PhaseConfig` a FixtureSelector |

#### Tests requeridos:
```
PhaseDistributor.resolve()
  ├── Empty input → []
  ├── Single fixture → [{offset: 0}]
  ├── spread=0 → all offsets = 0
  ├── Linear 8 fixtures, spread=0.5 → monotonic offsets
  ├── Mirror 8 fixtures → symmetric fold
  ├── Center-out 8 fixtures → center has min offset
  ├── Wings=2, linear → two independent groups
  ├── Wings=3, mirror → three mirrored sub-groups
  ├── Direction=-1 → reversed offsets
  ├── Edge: N < wings → clamp wings to N
  └── Output is sorted by phaseOffsetMs ASC
```

#### Criterio de cierre:
- [ ] PhaseDistributor.resolve() pasa 11+ tests
- [ ] Todos los tipos compilan sin error
- [ ] FixtureSelector backward-compatible (phase? es optional)

---

### Fase 2: RUNTIME & ZERO-ALLOC (WAVE 2402)
**Scope:** Reescritura de tick(), zero-alloc pools, integración  
**Duración estimada:** 1-2 sesiones  
**Riesgo:** MEDIO — toca el hot path. Requiere tests E2E exhaustivos.

#### Archivos MODIFICADOS:
| Archivo | Cambio |
|---------|--------|
| `HephaestusRuntime.ts` | outputBuffer, writeOutput, tickWithPhase, tickLegacy, capacity management |
| `CurveEvaluator.ts` | _hslResult, _snapshotCache, _snapshotColorCache, zero-alloc getColorValue/getSnapshot |

#### Archivos MODIFICADOS (activación de phase):
| Archivo | Cambio |
|---------|--------|
| `HephaestusRuntime.ts` | play() y playFromClip() resuelven PhaseDistributor |
| `ActiveHephClip` interface | Add fixturePhases, phaseConfig |

#### Secuencia de implementación:
```
1. Zero-alloc CurveEvaluator (getColorValue, getSnapshot)
   → Run CurveEvaluator.test.ts — MUST PASS 100%
   
2. Zero-alloc outputBuffer + writeOutput en HephaestusRuntime
   → Run HephaestusE2E.test.ts — MUST PASS 100%
   
3. ActiveHephClip extension + phase resolution en play()/playFromClip()
   → Verify fixturePhases populated when selector.phase exists
   
4. tickWithPhase() implementation
   → New tests: phase-aware tick with known offsets
   
5. Backward compat: tickLegacy() for clips without phase config
   → Run ALL existing tests — MUST PASS 100%
```

#### Criterio de cierre:
- [ ] `CurveEvaluator.test.ts` — 100% pass (zero-alloc no cambia outputs)
- [ ] `HephaestusE2E.test.ts` — 100% pass (legacy path unchanged)
- [ ] New test: tickWithPhase produces correct per-fixture offsets
- [ ] Benchmark: 0 GC collections in 10-second sustained tick loop

---

### Fase 3: UI/PREVIEW INTEGRATION (WAVE 2403)
**Scope:** Controles de phase en CurveEditor + preview con PhaseDistributor  
**Duración estimada:** 1 sesión  
**Riesgo:** BAJO — UI changes, no hot path

#### Archivos MODIFICADOS:
| Archivo | Cambio |
|---------|--------|
| `useHephPreview.ts` | Replace hardcoded `i * 50` with PhaseDistributor.resolve() |
| `CurveEditor.tsx` | Add phase controls panel (spread slider, symmetry dropdown, wings number) |
| `HephIPCHandlers.ts` | Expose phase config in IPC serialization |

#### UI Design (datos estructurados para frontend):

```typescript
// PhaseConfig es el modelo de datos que el UI manipula directamente.
// Cada control mapea 1:1 a un campo de PhaseConfig:

interface PhaseControlsProps {
  config: PhaseConfig     // ← Model
  onChange: (c: PhaseConfig) => void  // ← Two-way binding

  // Preview context:
  fixtureCount: number    // Para render del diagrama de fases
  durationMs: number      // Para calcular offsets reales en ms
}

// Control mapping:
//   Slider   "Spread"    → config.spread (0-1, step 0.01)
//   Dropdown "Symmetry"  → config.symmetry ('linear'|'mirror'|'center-out')
//   Number   "Wings"     → config.wings (1-N, step 1)
//   Toggle   "Direction" → config.direction (1|-1)
```

#### Preview fix (`useHephPreview.ts`):

```typescript
// ANTES:
const phaseOffset = i * 50  // ← hardcoded 50ms

// DESPUÉS:
const phases = PhaseDistributor.resolve(
  fixtureIds,
  clip.selector?.phase ?? DEFAULT_PHASE_CONFIG,
  clip.durationMs
)
// En el loop de fixtures:
const offsetTime = Math.max(0, timeMs + phases[i].phaseOffsetMs)
```

#### Criterio de cierre:
- [ ] Preview respeta PhaseConfig del clip (no más hardcoded 50ms)
- [ ] CurveEditor muestra controles de phase (spread, symmetry, wings)
- [ ] Cambios en controles actualizan preview en real-time
- [ ] Phase diagram muestra distribución visual de offsets

---

## 5. Riesgos y Mitigaciones

| # | Riesgo | Impacto | Probabilidad | Mitigación |
|---|--------|---------|-------------|------------|
| R1 | Zero-alloc getColorValue() rompe consumidores que retienen referencia | 🔴 High | Baja | Auditar TODOS los call sites antes de Fase 2. Solo tick() y getSnapshot() la usan. |
| R2 | Sorted fixturePhases invalida cursor en looping con wrap-around | 🟡 Medium | Media | CurveEvaluator ya maneja backward seek con binary search. Test explícito. |
| R3 | outputBuffer.slice() sigue creando array | 🟢 Low | 100% | Acepted trade-off. 1 array header vs N objects. Si critical: exponer outputCount getter. |
| R4 | PhaseConfig no serializable en IPC | 🟡 Medium | Baja | PhaseConfig es POJO plano (no Map, no Set). JSON-safe by design. |
| R5 | UI performance con 50+ fixtures en preview | 🟡 Medium | Media | Throttle preview a 30fps cuando fixtureCount > 20. |
| R6 | Wings con N no divisible por wingCount | 🟢 Low | Media | Última wing tiene menos fixtures. Fórmula ceil(N/wings) lo maneja. |

---

## 6. Apéndice: Referencia Matemática

### A. Fórmulas de Phase Offset

```
Dados:
  N          = número de fixtures resueltas
  D          = durationMs del clip
  s          = config.spread ∈ [0, 1]
  W          = config.wings (clamped a [1, N])
  d          = config.direction ∈ {1, -1}
  wingSize   = ⌈N / W⌉
  spreadMs   = D × s

Para fixture global index i:
  wingIndex    = ⌊i / wingSize⌋
  localIndex   = i mod wingSize
  localN       = min(wingSize, N - wingIndex × wingSize)

Linear:
  stepMs = spreadMs / max(1, localN - 1)
  offset = localIndex × stepMs

Mirror:
  halfN = ⌈localN / 2⌉
  mirrorIdx = min(localIndex, localN - 1 - localIndex)
  mirrorStep = spreadMs / max(1, halfN - 1)
  offset = mirrorIdx × mirrorStep

Center-Out:
  center = (localN - 1) / 2
  dist = |localIndex - center|
  maxDist = center ∨ 1
  offset = (dist / maxDist) × spreadMs

Direction:
  if d = -1: offset = spreadMs - offset
```

### B. Ejemplo Numérico Completo

```
Input: N=6, D=3000ms, s=0.5, symmetry=mirror, wings=2, direction=1

spreadMs = 3000 × 0.5 = 1500ms
wingSize = ⌈6/2⌉ = 3

Wing 0 (F0, F1, F2):
  localN = 3
  halfN = 2
  mirrorStep = 1500 / 1 = 1500ms
  F0: mirrorIdx = min(0, 2) = 0 → offset = 0ms
  F1: mirrorIdx = min(1, 1) = 1 → offset = 1500ms
  F2: mirrorIdx = min(2, 0) = 0 → offset = 0ms

Wing 1 (F3, F4, F5):
  localN = 3
  halfN = 2
  F3: mirrorIdx = 0 → offset = 0ms
  F4: mirrorIdx = 1 → offset = 1500ms
  F5: mirrorIdx = 0 → offset = 0ms

Result (sorted by offset):
  F0: 0ms, F2: 0ms, F3: 0ms, F5: 0ms, F1: 1500ms, F4: 1500ms

Visual:
  F0 ████████────────     F3 ████████────────
  F1 ────────████████     F4 ────────████████
  F2 ████████────────     F5 ████████────────
       Wing 0                  Wing 1
```

### C. Diagrama de Flujo — play() → tick()

```
play(filePath, options)
  │
  ├─ loadClip() → HephAutomationClip
  │
  ├─ clip.selector?.phase exists?
  │   │
  │   ├─ YES: phaseConfig = clip.selector.phase
  │   │   ├─ fixtureIds = resolveFixtureSelector(clip.selector, fixtures, groups)
  │   │   └─ fixturePhases = PhaseDistributor.resolve(fixtureIds, phaseConfig, clip.durationMs)
  │   │
  │   ├─ clip.selector?.phaseSpread exists? (legacy shorthand)
  │   │   ├─ phaseConfig = { spread: phaseSpread, symmetry: 'linear', wings: 1, direction: 1 }
  │   │   └─ (same resolution as above)
  │   │
  │   └─ NO: fixturePhases = null (legacy zone mode)
  │
  ├─ ensureOutputCapacity()
  │
  └─ activeClips.set(instanceId, { ..., fixturePhases, phaseConfig })
  
  
tick(currentTimeMs)
  │
  ├─ outputCursor = 0
  │
  ├─ for each activeClip:
  │   │
  │   ├─ fixturePhases != null?
  │   │   └─ tickWithPhase(active, baseClipTimeMs)
  │   │       └─ for fp of fixturePhases (sorted ASC):
  │   │           fixtureTimeMs = baseClipTimeMs + fp.phaseOffsetMs
  │   │           evaluate curves at fixtureTimeMs → writeOutput()
  │   │
  │   └─ fixturePhases == null?
  │       └─ tickLegacy(active, baseClipTimeMs)
  │           └─ evaluate curves at baseClipTimeMs → writeOutput()
  │
  └─ return getOutputSlice()
```

---

## 📊 MÉTRICAS DE ÉXITO POST-WAVE 2400

| Métrica | Antes | Objetivo |
|---------|-------|----------|
| MA3 Phaser Parity (Eje 3) | 68/100 | ≥ 88/100 |
| Phase Spread functional | ❌ phaseSpread no consumido | ✅ PhaseDistributor |
| Symmetry modes | ❌ 0 modos | ✅ 3 modos (linear, mirror, center-out) |
| Wings support | ❌ Ninguno | ✅ N-way wings |
| GC allocations in tick() | ~9,000 obj/seg | ~60 array/seg |
| Preview hardcoded offset | ❌ `i * 50` | ✅ PhaseDistributor driven |
| Pioneer Score (projected) | 85.2/100 | ≥ 91/100 |

---

> *"Phase distribution is to lighting what orchestration is to music.  
> Without it, you have unison. With it, you have a symphony."*  
> — PunkOpus, WAVE 2400
