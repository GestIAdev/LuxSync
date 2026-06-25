# CONTEXTO HEPHAESTUS

> Documento de extracción de contexto para rediseño arquitectónico.  
> Contiene los bloques de código fuente exactos relevantes de Hephaestus V3, el store temporal obsoleto y el motor de fase actual.

---

## 1. Tipos V3 (`core/hephaestus/types.ts` + `core/stage/ShowFileV2.ts`)

### `HephAutomationClipV3`

```typescript
// core/hephaestus/types.ts:532-574
export interface HephAutomationClipV3 {
  // ── Identidad ──
  id: string
  name: string
  author: string
  category: EffectCategory
  tags: string[]
  vibeCompat: string[]

  // ── ESPACIAL CANÓNICO (resumen) ──
  spatialZones: readonly ZoneTarget[]

  // ── Ejecución ──
  mixBus: 'global' | 'htp' | 'ambient' | 'accent'
  priority: number
  durationMs: number
  effectType: string

  tracks: HephTrack[]

  staticParams: Record<string, number | string | boolean>

  cognitiveDNA?: import('../arsenal/lfxTypes').CognitiveDNA
  simulationMeta?: import('../arsenal/lfxTypes').SimulationMeta

  schemaVersion: '3.0'
}
```

### `HephTrack`

```typescript
// core/hephaestus/types.ts:461-516
export interface HephTrack {
  id: string
  paramId: HephParamId
  zones: readonly ZoneTarget[]
  curve: HephCurve

  dimmerScale?: number
  colorOverride?: HSL
  blendMode?: BlendMode
  cell?: string

  selector?: import('../stage/ShowFileV2').FixtureSelector

  phaseConfig?: PhaseConfig
}
```

### `ZoneTarget`

```typescript
// core/hephaestus/types.ts:437
export type ZoneTarget = CanonicalZone | 'all' | 'all-pars' | 'all-movers'
```

### `FixtureSelector`

```typescript
// core/stage/ShowFileV2.ts:456-516
export interface FixtureSelector {
  target: CanonicalZone | string

  parity?: 'all' | 'even' | 'odd'

  indexRange?: string

  stereoSide?: 'left' | 'right'

  phaseSpread?: number  // 0-1

  phase?: import('../hephaestus/types').PhaseConfig
}
```

### `PhaseConfig`

```typescript
// core/hephaestus/types.ts:110-122
export interface PhaseConfig {
  spread: number   // 0-1
  symmetry: PhaseSymmetryMode
  wings: number    // 1-N, default 1
  direction: PhaseDirection  // default 1
}
```

### `HephCurve`

```typescript
// core/hephaestus/types.ts:297-318
export interface HephCurve {
  paramId: HephParamId
  valueType: 'number' | 'color'
  range: [number, number]
  defaultValue: number | HSL
  keyframes: HephKeyframe[]
  mode: HephCurveMode
}
```

---

## 2. Store Temporal Obsoleto (`components/views/HephaestusView/useTemporalStore.ts`)

### `TemporalState`

```typescript
// components/views/HephaestusView/useTemporalStore.ts:46-72
export interface ViewportState {
  zoom: number
  scrollX: number
}

export interface TemporalState {
  clip: HephAutomationClip
  canUndo: boolean
  canRedo: boolean
  undoDepth: number
  redoDepth: number
  viewport: ViewportState
}
```

### Declaración del hook

```typescript
// components/views/HephaestusView/useTemporalStore.ts:74-120
export interface TemporalActions {
  setClip: React.Dispatch<React.SetStateAction<HephAutomationClip>>
  snapshot: () => void
  undo: () => void
  redo: () => void
  clearHistory: () => void
  resetWithClip: (clip: HephAutomationClip) => void
  setViewport: (viewport: Partial<ViewportState>) => void
}

export function useTemporalStore(
  initialClip: HephAutomationClip | (() => HephAutomationClip)
): { state: TemporalState; actions: TemporalActions }
```

---

## 3. Motor de Fase Actual (`core/hephaestus/runtime/PhaseDistributor.ts`)

### `resolve` — cálculo de offsets por fixture

```typescript
// core/hephaestus/runtime/PhaseDistributor.ts:68-121
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

  const spreadMs = durationMs * Math.max(0, Math.min(1, config.spread))
  const wings = Math.max(1, Math.min(config.wings, N))
  const wingSize = Math.ceil(N / wings)

  const results: FixturePhase[] = new Array(N)

  for (let i = 0; i < N; i++) {
    const wingIndex = Math.floor(i / wingSize)
    const localIndex = i - wingIndex * wingSize
    const localN = Math.min(wingSize, N - wingIndex * wingSize)

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

  results.sort((a, b) => a.phaseOffsetMs - b.phaseOffsetMs)

  return results
}
```

### `computeOffset` — matemática de simetría por wing

```typescript
// core/hephaestus/runtime/PhaseDistributor.ts:134-187
private static computeOffset(
  localIndex: number,
  localN: number,
  spreadMs: number,
  symmetry: PhaseSymmetryMode,
  direction: PhaseDirection
): number {
  if (localN <= 1) return 0

  let offset: number

  switch (symmetry) {
    case 'linear': {
      const stepMs = spreadMs / (localN - 1)
      offset = localIndex * stepMs
      break
    }

    case 'mirror': {
      const halfN = Math.ceil(localN / 2)
      const mirrorIdx = localIndex < halfN
        ? localIndex
        : localN - 1 - localIndex
      const mirrorStep = spreadMs / Math.max(1, halfN - 1)
      offset = mirrorIdx * mirrorStep
      break
    }

    case 'center-out': {
      const center = (localN - 1) / 2
      const dist = Math.abs(localIndex - center)
      const maxDist = center || 1
      offset = (dist / maxDist) * spreadMs
      break
    }

    default:
      offset = localIndex * (spreadMs / (localN - 1))
  }

  if (direction === -1) {
    offset = spreadMs - offset
  }

  return offset
}
```
