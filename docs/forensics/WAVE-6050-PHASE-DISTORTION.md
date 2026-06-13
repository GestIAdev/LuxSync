# WAVE-6050: DECONSTRUCCIÓN — MOTOR DE DISTORSIÓN DE FASE (Hephaestus)

**Rol:** Ingeniero Core (Deconstrucción Hephaestus)  
**Objetivo:** Extraer el motor matemático real que distribuye fase en clips `.lfx`, su esquema de datos, y el ruteo a canales Pan/Tilt.  
**Archivos involucrados:** `PhaseDistributor.ts`, `HephaestusRuntime.ts`, `HephUtils.ts`, `types.ts`, `solar_caustics.lfx`, `cyber_scanner.lfx`

---

## ⚠️ NOTA FORENSE CRÍTICA

**El Hephaestus actual NO implementa distorsión de fase basada en coordenadas físicas (X, Y) del fixture.**

El `PhaseDistributor` opera exclusivamente sobre el **índice ordinal** del fixture dentro de su wing (`localIndex`, `localN`). No tiene acceso a la posición espacial del foco en el rig. Si el objetivo de Operación Océano es que la ola respete la posición física real del PAR en la sala, este motor debe ser **extendido** o **secuestrado** con inyección de coordenadas `fixture.x` / `fixture.y` en el cálculo de `phaseOffsetMs`.

---

## 1. EL NÚCLEO MATEMÁTICO — PhaseDistributor

`@/electron-app/src/core/hephaestus/runtime/PhaseDistributor.ts:68-187`

```typescript
export class PhaseDistributor {
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

    // spreadMs = duraciónTotal × spread (0..1)
    const spreadMs = durationMs * Math.max(0, Math.min(1, config.spread))
    const wings = Math.max(1, Math.min(config.wings, N))
    const wingSize = Math.ceil(N / wings)

    const results: FixturePhase[] = new Array(N)

    for (let i = 0; i < N; i++) {
      const wingIndex = Math.floor(i / wingSize)
      const localIndex = i - wingIndex * wingSize
      const localN = Math.min(wingSize, N - wingIndex * wingSize)

      const offset = PhaseDistributor.computeOffset(
        localIndex, localN, spreadMs,
        config.symmetry, config.direction
      )

      results[i] = {
        fixtureId: fixtureIds[i],
        phaseOffsetMs: offset,
        normalizedIndex: localN > 1 ? localIndex / (localN - 1) : 0,
      }
    }

    // CRÍTICO: orden ASC por phaseOffsetMs para cursor cache O(1)
    results.sort((a, b) => a.phaseOffsetMs - b.phaseOffsetMs)
    return results
  }

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
        // [0, step, 2·step, ..., spreadMs]
        const stepMs = spreadMs / (localN - 1)
        offset = localIndex * stepMs
        break
      }
      case 'mirror': {
        // [0, step, 2step, ..., 2step, step, 0]
        const halfN = Math.ceil(localN / 2)
        const mirrorIdx = localIndex < halfN
          ? localIndex
          : localN - 1 - localIndex
        const mirrorStep = spreadMs / Math.max(1, halfN - 1)
        offset = mirrorIdx * mirrorStep
        break
      }
      case 'center-out': {
        // [max, ..., 0, ..., max]
        const center = (localN - 1) / 2
        const dist = Math.abs(localIndex - center)
        const maxDist = center || 1
        offset = (dist / maxDist) * spreadMs
        break
      }
      default:
        offset = localIndex * (spreadMs / (localN - 1))
    }

    if (direction === -1) offset = spreadMs - offset
    return offset
  }
}
```

**Fórmula subyacente:**
- `spreadMs = durationMs × clamp(spread, 0, 1)`
- `offset[i] = f_symmetry(localIndex, localN) × spreadMs`
- Dirección invertida vía `offset' = spreadMs − offset`

**Observación:** `localIndex` es puramente ordinal. No hay término espacial `fixture.x` ni `fixture.y`.

---

## 2. EL ESQUEMA DE DATOS EN .lfx

### 2.1 Declaración V3 (track-level)

`@/electron-app/src/core/arsenal/builtins/techno/cyber_scanner.lfx:71-76`

```json
{
  "id": "scanner-intensity-kitt",
  "paramId": "intensity",
  "zones": ["all-movers"],
  "blendMode": "replace",
  "phaseConfig": {
    "spread": 0.22,
    "symmetry": "linear",
    "wings": 1,
    "direction": 1
  },
  "curve": { ... }
}
```

### 2.2 Declaración V2 (clip-level, legacy)

`@/electron-app/src/core/arsenal/builtins/chill/solar_caustics.lfx:242-247`

```json
"executionHints": {
  "overlayMode": "absolute",
  "phaseConfig": {
    "spread": 0.5,
    "symmetry": "linear",
    "wings": 1,
    "direction": 1
  }
}
```

### 2.3 Tipos Internos (TypeScript)

`@/electron-app/src/core/hephaestus/types.ts:89-137`

```typescript
export type PhaseSymmetryMode = 'linear' | 'mirror' | 'center-out'
export type PhaseDirection = 1 | -1

export interface PhaseConfig {
  spread: number     // 0-1: fracción de durationMs
  symmetry: PhaseSymmetryMode
  wings: number      // 1-N subgrupos independientes
  direction?: PhaseDirection  // 1=forward, -1=reverse
}

export interface FixturePhase {
  fixtureId: string
  phaseOffsetMs: number       // se RESTA al clipTime (modelo MA3)
  normalizedIndex: number     // 0-1 dentro de su wing
}
```

---

## 3. RUTEO ESPACIAL — De la curva al canal Pan/Tilt

### 3.1 Emisión de muestra (hot-path del Runtime)

`@/electron-app/src/core/hephaestus/runtime/HephaestusRuntime.ts:744-772`

```typescript
private _emitTrackSample(
  track: ResolvedTrack,
  fixtureId: string,
  timeMs: number,
  evaluator: CurveEvaluator,
  paramName: HephParamId,
  intensity: number,
  isCustomThisClip: boolean,
  clipId: string,
): void {
  if (track.valueType === 'color') {
    const hsl = evaluator.getColorValue(paramName, timeMs)
    const modulatedL = (hsl.l / 100) * intensity
    const rgb = hslToRgb(hsl.h, hsl.s / 100, modulatedL)
    this._normRgbBuf.r = rgb.r / 255
    this._normRgbBuf.g = rgb.g / 255
    this._normRgbBuf.b = rgb.b / 255
    this.writeOutput(fixtureId, 'all', paramName, 0, rgb, undefined, 0, this._normRgbBuf, ...)
  } else {
    const rawValue = evaluator.getValue(paramName, timeMs)
    const withIntensity = rawValue * intensity
    const scaledValue = scaleToDMX(paramName, withIntensity)
    const fine = (paramName === 'pan' || paramName === 'tilt')
      ? scaleToDMX16(withIntensity).fine
      : undefined
    this.writeOutput(fixtureId, 'all', paramName, scaledValue, undefined, fine, withIntensity, ...)
  }
}
```

### 3.2 Escalado a DMX (16-bit para Pan/Tilt)

`@/electron-app/src/core/hephaestus/runtime/HephUtils.ts:70-103`

```typescript
const DMX_SCALED_PARAMS = new Set([
  'intensity', 'strobe', 'white', 'amber',
  'zoom', 'focus', 'iris', 'gobo1', 'gobo2', 'prism',
])
const DMX_16BIT_PARAMS = new Set(['pan', 'tilt'])
const FLOAT_PASSTHROUGH_PARAMS = new Set([
  'speed', 'width', 'direction', 'globalComp',
])

export function scaleToDMX(paramId: string, rawValue: number): number {
  const clamped = Math.max(0, Math.min(1, rawValue))

  if (DMX_16BIT_PARAMS.has(paramId)) {
    const val16 = Math.round(clamped * 65535)
    return (val16 >> 8) & 0xFF   // coarse byte
  }
  if (DMX_SCALED_PARAMS.has(paramId)) {
    return Math.round(clamped * 255)
  }
  return clamped
}

export function scaleToDMX16(rawValue: number): { coarse: number; fine: number } {
  const clamped = Math.max(0, Math.min(1, rawValue))
  const val16 = Math.round(clamped * 65535)
  return {
    coarse: (val16 >> 8) & 0xFF,
    fine: val16 & 0xFF,
  }
}
```

**Pipeline numérico para Pan/Tilt:**
1. `CurveEvaluator.getValue('pan', timeMs)` → valor en rango de la curva (ej. `[-1, 1]`)
2. `rawValue × intensity` → modulación por intensidad del clip
3. `scaleToDMX('pan', withIntensity)` → `clamped * 65535 >> 8` (coarse 0-255)
4. `scaleToDMX16(withIntensity).fine` → LSB 0-255
5. `writeOutput` → emite a NodeArbiter como L3 (effect layer)

**Nota:** Si la curva declara `range: [-1, 1]` (como en `solar_caustics`), el evaluador retorna valores que pueden ser negativos. Sin embargo, `scaleToDMX` los **clampa a [0, 1]** (`Math.max(0, ...)`). Para trayectorias bipolares (figuras en 8), la curva debe declarar `range: [0, 1]` con un offset interno, o el modo debe ser `additive` para que el valor negativo actúe como desviación desde el centro.

---

## 4. CASO FORENSE: solar_caustics.lfx (Trayectoria en 8 vía keyframes)

`@/electron-app/src/core/arsenal/builtins/chill/solar_caustics.lfx:63-184`

Este es el único clip builtin de Chill que declara `pan` + `tilt` como curvas de Hephaestus (v2.1). Genera una figura en 8 (Lissajous-like) mediante keyframes Bezier explícitos:

```json
"pan": {
  "paramId": "pan",
  "valueType": "number",
  "range": [-1, 1],
  "defaultValue": 0,
  "keyframes": [
    { "timeMs": 0,    "value": 0,    "interpolation": "bezier", "bezierHandles": [0.33, 0,  0.67, 1] },
    { "timeMs": 2500, "value": 0.4,  "interpolation": "bezier", "bezierHandles": [0.33, 1,  0.67, 0] },
    { "timeMs": 5000, "value": 0,    "interpolation": "bezier", "bezierHandles": [0.33, 0,  0.67, -1] },
    { "timeMs": 7500, "value": -0.4, "interpolation": "bezier", "bezierHandles": [0.33, -1, 0.67, 0] },
    { "timeMs": 10000,"value": 0,    "interpolation": "hold" }
  ],
  "mode": "additive"
},
"tilt": {
  "paramId": "tilt",
  "valueType": "number",
  "range": [-1, 1],
  "defaultValue": 0,
  "keyframes": [
    { "timeMs": 0,    "value": 0,    "interpolation": "bezier", "bezierHandles": [0.33, 0,  0.67, 1] },
    { "timeMs": 2500, "value": 0.25, "interpolation": "bezier", "bezierHandles": [0.33, 1,  0.67, 0] },
    { "timeMs": 5000, "value": 0,    "interpolation": "bezier", "bezierHandles": [0.33, 0,  0.67, -1] },
    { "timeMs": 7500, "value": -0.25,"interpolation": "bezier", "bezierHandles": [0.33, -1, 0.67, 0] },
    { "timeMs": 10000,"value": 0,    "interpolation": "hold" }
  ],
  "mode": "additive"
}
```

Matemática subyacente de la trayectoria:
- **Pan:** oscilación coseno con amplitud 0.4 (dominante, 1 ciclo en 10s)
- **Tilt:** oscilación seno con amplitud 0.25 (subordinada, 1 ciclo en 10s)
- **Resultado:** Figura en 8 (Lissajous 1:1) con ratio de amplitud 0.4:0.25
- `mode: "additive"` + `range: [-1, 1]` permite que el valor negativo desplace el haz hacia la izquierda/abajo respecto al centro.

**PhaseConfig aplicada:** `spread: 0.5` → los movers desfazan su ciclo hasta 5 segundos (50% de 10s), creando un "efecto ola" escalonado en el tiempo.

---

## 5. ANÁLISIS: ¿Dónde inyectar la posición física (X, Y)?

Si el objetivo es que `phaseOffsetMs` dependa de la posición real del fixture en la sala (ej. `fixture.x` en metros), el punto de inyección es:

`PhaseDistributor.computeOffset()` → actualmente recibe:
- `localIndex` (ordinal)
- `localN` (count)
- `spreadMs`
- `symmetry`
- `direction`

**Propuesta de secuestro (Operación Océano):**

1. Extender `PhaseConfig` con `spatialField?: 'x' | 'y' | 'distance'`
2. Pasar un `fixturePosition: { x: number; y: number }[]` a `PhaseDistributor.resolve()`
3. Reemplazar `localIndex` por una función de posición:
   ```typescript
   const spatialProgress = (fixture.x - minX) / (maxX - minX)
   offset = spatialProgress * spreadMs
   ```
4. En el runtime, hidratar las posiciones desde el ShowFile/FixtureRegistry antes de llamar a `PhaseDistributor.resolve()`.

**Nota:** El `PhaseDistributor` es stateless y puro. Es ideal para este secuestro — no tiene side effects ni dependencias de backend.

---

*Fin de la deconstrucción. Motor documentado. Punto de inyección identificado.*
