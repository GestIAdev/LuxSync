# ⚒️ MAPEO ARQUITECTÓNICO — HEPHAESTUS V3 PARAMETRIC ENGINE

> **WAVE 5000 PREP — Deep Architectural Audit (Part 2/3)**
> **Rol:** Chief FX Architect & DSP Engineer
> **Modo:** READ-ONLY — Sin modificaciones de código
> **Fecha:** Julio 2026

---

## ÍNDICE

1. [Evaluador de Curvas (`CurveEvaluator`)](#1-evaluador-de-curvas-curveevaluator)
2. [Motor de Fase (`PhaseConfigPro`)](#2-motor-de-fase-phaseconfigpro)
3. [Núcleo de Evaluación (`HephEvaluationKernel`)](#3-núcleo-de-evaluación-hephevaluationkernel)
4. [Sincronización Preview vs Runtime (WYSIWYG)](#4-sincronización-preview-vs-runtime-wysiwyg)
5. [Inventario de Archivos](#5-inventario-de-archivos)

---

## 1. Evaluador de Curvas (`CurveEvaluator`)

**Archivo:** `src/core/hephaestus/CurveEvaluator.ts` (713 líneas)

### 1.1 Arquitectura General

`CurveEvaluator` es el corazón matemático de Hephaestus. Una instancia se crea por cada curva (en V3: una por `HephTrack`, cada una con un `Map<HephParamId, HephCurve>` de tamaño 1). Mantiene **cursor cache** por curva para lograr **O(1) amortizado** en playback normal y **O(log n)** en seek/scrub.

**Target de performance:** 60 FPS × 12 params × 50 efectos = 36,000 evaluaciones/segundo. Cada evaluación < 10μs → ~2ms/frame (~12% budget).

### 1.2 Búsqueda de Segmento (`findSegment`)

```typescript
private findSegment(paramId: HephParamId, t: number, kfs: HephKeyframe[]): number
```

- **Playback normal (t ≥ lastTime):** Avanza cursor linealmente con `while (cursor < kfs.length - 2 && t >= kfs[cursor + 1].timeMs) cursor++`. En playback monotónico, avanza 0-1 posiciones por frame → **O(1) amortizado**.
- **Seek hacia atrás (t < lastTime):** Binary search para encontrar el mayor índice `i` tal que `kfs[i].timeMs ≤ t` → **O(log n)**.
- **Cache:** `cursors: Map<HephParamId, number>` + `lastTimeMsPerCurve: Map<HephParamId, number>` persisten el estado entre frames.

### 1.3 Interpolación Numérica

```typescript
private interpolateNumber(v0, v1, progress, interpolation, handles): number
```

La interpolación se divide en dos fases:
1. **`applyInterpolation(t, type, handles)`** — Convierte progreso lineal (0-1) en progreso con easing.
2. **Lerp lineal** — `v0 + (v1 - v0) * easedT`.

#### Modos de interpolación:

| Modo | Fórmula | Descripción |
|------|---------|-------------|
| `hold` | `return 0` | Step function: valor constante hasta siguiente keyframe. `v0 + (v1-v0)*0 = v0` |
| `linear` | `return t` | Línea recta. Identidad. |
| `bezier` | `cubicBezierY(t, cx1, cy1, cx2, cy2)` | Cubic bezier con handles de control (estilo After Effects) |

### 1.4 Cubic Bezier — Newton-Raphson Híbrido

```typescript
private cubicBezierY(t: number, cx1: number, cy1: number, cx2: number, cy2: number): number
```

**Modelo matemático:**

La curva bezier cúbica paramétrica tiene 4 puntos de control:
- P0 = (0, 0) — inicio fijo
- P1 = (cx1, cy1) — handle de salida del keyframe izquierdo
- P2 = (cx2, cy2) — handle de entrada del keyframe derecho
- P3 = (1, 1) — fin fijo

**Problema:** La curva es paramétrica sobre `u ∈ [0,1]`. Tenemos `t` (progreso en X) y necesitamos `Y`.

**Solución:** Newton-Raphson con bisección fallback.

1. **Encontrar `u` tal que `BezierX(u) ≈ t`:**

   ```
   BezierX(u) = 3(1-u)²·u·cx1 + 3(1-u)·u²·cx2 + u³
   BezierX'(u) = 3(1-u)²·cx1 + 6(1-u)·u·(cx2-cx1) + 3u²·(1-cx2)
   ```

2. **4 iteraciones de Newton-Raphson** (`NEWTON_ITERATIONS = 4`):
   - Newton step: `u_new = u - (BezierX(u) - t) / BezierX'(u)`
   - Si derivada ≈ 0 (`< NEWTON_EPSILON = 1e-7`): bisección fallback `u = (lo + hi) / 2`
   - Si Newton salta fuera del bracket `[lo, hi]`: bisección fallback
   - Bracket se mantiene actualizado: `if err < 0: lo = u; else hi = u`
   - Early-exit si `|err| < NEWTON_EPSILON`

3. **Calcular `BezierY(u)`:**
   ```
   BezierY(u) = 3(1-u)²·u·cy1 + 3(1-u)·u²·cy2 + u³
   ```

**Monotonía guard:** Si `cx1 > cx2`, se clampea `cx2 = cx1` para garantizar monotonía en X y que Newton converja a la rama correcta.

**Precisión:** 4 iteraciones dan error < 0.001 — imperceptible en animación visual a 60fps. Este es exactamente el algoritmo que usa Chrome para CSS transitions.

**Overshoot intencional:** Los valores `cy` pueden exceder [0,1] (ej: `cy1 = -0.6` o `cy2 = 1.6`), permitiendo curvas elásticas/bounce. El resultado `BezierY(u)` puede salir de [0,1], lo que produce overshoot en el valor interpolado.

#### Presets Bezier disponibles (`BEZIER_PRESETS` en `types.ts`):

| Preset | Handles `[cx1, cy1, cx2, cy2]` |
|--------|----------------------------------|
| `linear` | `[0, 0, 1, 1]` |
| `ease-in` | `[0.42, 0, 1, 1]` |
| `ease-out` | `[0, 0, 0.58, 1]` |
| `ease-in-out` | `[0.42, 0, 0.58, 1]` |
| `overshoot` | `[0.68, -0.6, 0.32, 1.6]` |
| `bounce` | `[0.34, 1.56, 0.64, 1]` |
| `snap` | `[0.9, 0, 0.1, 1]` |
| `smooth` | `[0.25, 0.1, 0.25, 1]` |
| `sharp-in` | `[0.9, 0, 0.7, 1]` |
| `sharp-out` | `[0.3, 0, 0.1, 1]` |

### 1.5 Interpolación de Color (HSL)

```typescript
getColorValue(paramId: HephParamId, timeMs: number): HSL
```

Interpola H, S, L **independientemente**. Los componentes S y L usan lerp lineal estándar. **H usa shortest-path circular**:

```typescript
private lerpHue(h0: number, h1: number, t: number): number {
  let delta = h1 - h0
  if (delta > 180) delta -= 360    // Cruzar por 0° es más corto
  if (delta < -180) delta += 360
  let result = h0 + delta * t
  if (result < 0) result += 360
  if (result >= 360) result -= 360
  return result
}
```

**Ejemplo:** 350° → 10° = 20° (cruzando por 0°), NO 340° (dando la vuelta larga).

El progreso aplicado al color es el mismo `easedProgress` que para valores numéricos (hold, linear, o bezier). Para `hold`, se devuelve directamente el valor del keyframe izquierdo sin interpolación.

### 1.6 Zero-Allocation (WAVE 2400)

El evaluador pre-aloca objetos reutilizables:

- **`_hslResult: HSL`** — Buffer único para `getColorValue()`. Se muta en cada llamada.
- **`_snapshotCache: HephParamSnapshot`** — Pre-alocado en constructor con keys por cada paramId.
- **`_snapshotColorCache: Map<HephParamId, HSL>`** — Un HSL pre-alocado por cada param color, para que `getSnapshot()` no sobreescriba valores mientras itera.

**Contrato:** El caller NO debe retener la referencia entre frames. La próxima llamada sobreescribe el buffer. Si se necesita persistir: `const copy = { ...evaluator.getColorValue(...) }`.

### 1.7 API Pública

| Método | Descripción |
|--------|-------------|
| `getValue(paramId, timeMs): number` | Evalúa curva numérica en tiempo t |
| `getColorValue(paramId, timeMs): HSL` | Evalúa curva de color (ref interna zero-alloc) |
| `getSnapshot(timeMs): HephParamSnapshot` | Evalúa todas las curvas a la vez (ref interna zero-alloc) |
| `reset()` | Resetea cursores (para seek/scrub) |
| `hasCurve(paramId): boolean` | Verifica si tiene curva registrada |
| `getCurveMode(paramId): 'absolute' \| 'relative' \| 'additive'` | Modo de aplicación |

### 1.8 Edge Cases Manejados

- 0 keyframes → devuelve `defaultValue` (numérico: 0, color: `{h:0, s:0, l:50}`)
- 1 keyframe → devuelve ese valor
- `t ≤ kfs[0].timeMs` → primer keyframe
- `t ≥ kfs[last].timeMs` → último keyframe
- `segDuration ≤ 0` → valor del keyframe izquierdo
- Valores no finitos → fallback a 0 (numérico) o safe default (color)
- Validación defensiva HSL (WAVE 2040.22c): `isValidHSL()` checa `Number.isFinite` en h, s, l

---

## 2. Motor de Fase (`PhaseConfigPro`)

**Archivo:** `src/core/hephaestus/phase/PhaseConfigPro.ts` (168 líneas)
**Override manual:** `src/core/hephaestus/phase/PhaseOverride.ts` (140 líneas)

### 2.1 Configuración (`PhaseConfigPro`)

```typescript
interface PhaseConfigPro {
  spreadDeg: number       // Spread total en grados de ciclo [0, 1440]
  symmetry: PhaseSymmetryMode  // 'linear' | 'mirror' | 'center-out'
  wings: number           // Multiplicador de frecuencia espacial (≥1)
  blocks: number          // Agrupar N fixtures consecutivas (≥1)
  shuffle: number         // Caos controlado [0, 1]
  shuffleSeed: number     // Semilla del shuffle (reproducible)
  direction: 1 | -1       // Forward | Reverse
}
```

### 2.2 Cadena de Transformaciones Exacta

La función `computeOffsetPro(index, totalFixtures, config, durationMs)` aplica **7 pasos** en orden estricto:

#### Paso ① — BLOCKING

```typescript
const iBlock = Math.floor(index / blocks)
const nBlock = Math.ceil(totalFixtures / blocks)
```

División entera cuantiza el índice físico al índice de bloque. `blocks=4` → grupos de 4 fixtures comparten la misma fase (efecto "escalera"/columnas). Si `nBlock ≤ 1`, todos en fase → return 0.

#### Paso ② — SHUFFLE

```typescript
const iRandom = hash01(config.shuffleSeed, iBlock) * (nBlock - 1)
const iEff = (1 - shuffle) * iBlock + shuffle * iRandom
```

Mezcla determinista entre orden lineal y orden pseudo-aleatorio. `hash01` usa `sin(k * 127.1 + seed * 311.7) * 43758.5453` con `fract()` — patrón GLSL clásico, sin estado, reproducible.

- `shuffle = 0` → `iEff = iBlock` (orden determinista perfecto)
- `shuffle = 1` → `iEff = iRandom` (permutación pseudo-aleatoria total)
- `shuffle = 0.5` → interpolación lineal entre ambos

#### Paso ③ — NORMALIZE

```typescript
const u = iEff / (nBlock - 1)
```

Normaliza el índice efectivo al rango [0, 1].

#### Paso ④ — SYMMETRY

```typescript
function applySymmetry(u: number, mode: PhaseSymmetryMode): number {
  case 'linear':     return u                           // Identidad
  case 'mirror':     return 1 - Math.abs(2 * u - 1)     // Pico al centro (triángulo)
  case 'center-out': return Math.abs(2 * u - 1)         // Valle al centro (V)
}
```

| Modo | Fórmula | Efecto visual |
|------|---------|---------------|
| `linear` | `u` | Barrido secuencial de extremo a extremo |
| `mirror` | `1 - \|2u - 1\|` | Plegado simétrico desde extremos al centro (pico central) |
| `center-out` | `\|2u - 1\|` | Expansión desde centro hacia extremos (valle central) |

#### Paso ⑤ — WINGS

```typescript
const w = wings === 1 ? s : fract(s * wings)
```

Multiplicador de frecuencia espacial. `wings=2` → la onda recorre el grupo dos veces. Usa `fract()` (parte fraccionaria) para wrap continuo — no es una subdivisión dura, sino un multiplicador de frecuencia que crea múltiples ciclos de la onda a lo largo del array.

#### Paso ⑥ — DIRECTION

```typescript
const d = config.direction === -1 ? 1 - w : w
```

Invierte el mapeo espacial. `direction = -1` → el último fixture arranca primero.

#### Paso ⑦ — SPREAD → TIME

```typescript
return d * (spreadDeg / 360) * durationMs
```

Convierte grados de ciclo a milisegundos. `spreadDeg = 360` → el último fixture arranca exactamente un `durationMs` después del primero. `spreadDeg = 1440` → multi-ciclo (4 ciclos de desfase).

### 2.3 Fórmula del Offset Temporal Real Δt

$$\Delta t = d \cdot \frac{\text{spreadDeg}}{360} \cdot \text{durationMs}$$

Donde `d` es el resultado de los pasos ①-⑥ encadenados:

$$d = \text{direction}(w(\text{symmetry}(u(\text{shuffle}(i_{\text{block}})))))$$

### 2.4 Resolvedor de Arreglo (`resolvePro`)

```typescript
function resolvePro(fixtureIds: string[], config: PhaseConfigPro, durationMs: number): FixturePhase[]
```

Itera sobre todos los fixtureIds, calcula `computeOffsetPro` para cada uno, y **ordena ASC por `phaseOffsetMs`**. Esto garantiza queries temporales monótonas y que el cursor cache del `CurveEvaluator` se mantenga O(1) amortizado cuando se itera en orden de fase.

### 2.5 Phase Override Manual (`PhaseOverride`)

Permite override individual per-fixture sobre el baseline algorítmico:

| Modo | Fórmula |
|------|---------|
| `delta` | `finalOffset = algorithmicOffset + offsetMs` |
| `absolute` | `finalOffset = offsetMs` (ignora algoritmo) |

**Pipeline `resolveWithOverrides()`:**
1. Calcular baseline con `resolvePro()`
2. Aplicar overrides fixture por fixture
3. Re-ordenar ASC por offset

**Operaciones:**
- `bakeOverrides()` — Congela offsets algorítmicos actuales en overrides `absolute`
- `unbakeOverrides()` — Borra todos los overrides (vuelve a algoritmo puro)
- `pinned` — Fixture inmune a cambios de spread/shuffle/wings

### 2.6 Aplicación en Runtime

En `HephaestusRuntime._buildResolvedTrack()`, la fase se calcula al activar el clip:

```typescript
if (phaseConfig && (phaseConfig.spreadDeg > 0 || hasOverrides) && fixtureIds.length > 0) {
  fixturePhases = resolveWithOverrides(fixtureIds, phaseConfig, phaseOverrides, durationMs)
}
```

En el hot-path `tickActive()`, el offset se aplica con **wrap continuo MA3-style**:

```typescript
// Loop mode: wrap continuo — chase infinito sin costuras
fixtureTimeMs = ((baseClipTimeMs + fp.phaseOffsetMs) % durationMs + durationMs) % durationMs

// One-shot: clamp a durationMs
fixtureTimeMs = Math.min(baseClipTimeMs + fp.phaseOffsetMs, durationMs)
```

El doble modulo `(x % d + d) % d` maneja correctamente offsets negativos (que pueden ocurrir con `direction = -1` o overrides delta negativos).

---

## 3. Núcleo de Evaluación (`HephEvaluationKernel`)

**Archivo:** `src/core/hephaestus/HephEvaluationKernel.ts` (206 líneas)
**Math compartida:** `src/core/hephaestus/HephSharedMath.ts` (79 líneas)

### 3.1 Filosofía — Single Source of Truth

`HephEvaluationKernel` es el **único lugar** donde vive la lógica de evaluación de clips. Tanto `useHephPreview` (UI preview) como `HephaestusRuntime` (producción) importan desde aquí — **WYSIWYG por construcción**.

Función pura: sin fs, sin React, sin Arbiter, sin side effects, sin globals.

### 3.2 Función Principal

```typescript
export function evaluateFixtureParams(
  clip: HephAutomationClipV3,
  trackEvaluators: Map<string, CurveEvaluator>,
  applicableTracks: readonly HephTrack[],
  timeMs: number,
  clipIntensity: number = 1.0,
  perTrackTimeMs?: Map<string, number>,
): FixtureEvalResult
```

### 3.3 Arquitectura Multicelular

Cada `HephTrack` es una célula independiente con su propio `CurveEvaluator` (construido por `buildTrackEvaluators()`). Múltiples tracks pueden compartir `paramId` sin colisión de cursor cache — cada uno mantiene el suyo.

**`buildTrackEvaluators()`** (en `HephSharedMath.ts`):
```typescript
for (const t of tracks) {
  const curveMap = new Map<HephParamId, HephCurve>()
  curveMap.set(t.paramId, t.curve)
  map.set(t.id, new CurveEvaluator(curveMap, durationMs))
}
```

### 3.4 Blend Modes

Definidos en `HephSharedMath.ts` — las **mismas funciones** usadas por preview y runtime:

#### Default BlendMode por parámetro:

```typescript
function defaultBlendMode(paramId: HephParamId): BlendMode {
  return paramId === 'intensity' ? 'max' : 'replace'
}
```

- `intensity` → **`max`** (HTP — Highest Takes Precedence, estándar DMX)
- `color`, `pan`, `tilt`, etc. → **`replace`** (LTP — Last Take Precedence)

#### Implementación numérica (`blendNumeric`):

| Modo | Fórmula | Espacio |
|------|---------|---------|
| `max` | `Math.max(existing, incoming)` | [0, 1] normalizado |
| `replace` | `incoming` | LTP — last write wins |
| `add` | `Math.min(1, existing + incoming)` | Aditivo clampeado |
| `multiply` | `existing * incoming` | Multiplicativo |

#### Implementación RGB (`blendRgb`):

| Modo | Fórmula | Espacio |
|------|---------|---------|
| `max` | `[max(r), max(g), max(b)]` | 0-255 |
| `replace` | `[ir, ig, ib]` | LTP |
| `add` | `[min(255, er+ir), ...]` | Aditivo clampeado a 255 |
| `multiply` | `[(er*ir)/255, ...]` | Multiplicativo normalizado |

### 3.5 Pipeline de Evaluación

```
evaluateFixtureParams()
  │
  ├── Iterar applicableTracks en orden de array (clip.tracks)
  │
  ├── Para cada track:
  │   ├── Obtener evaluator del track (trackEvaluators.get(track.id))
  │   ├── Resolver tiempo: perTrackTimeMs?.get(track.id) ?? timeMs
  │   │
  │   ├── Si valueType === 'color':
  │   │   ├── Resolver intensity modulation (cachedIntensityMod)
  │   │   │   ├── Buscar track con paramId === 'intensity'
  │   │   │   ├── Evaluar intensity track en su tiempo
  │   │   │   └── cachedIntensityMod = intensityVal * clipIntensity
  │   │   ├── evaluateColorTrack(): HSL → modulatedL = (l/100) * intensityMod → hslToRgb()
  │   │   ├── Si existe en colorMap: blendRgb(existing, new, blendMode)
  │   │   └── Si no: colorMap.set(paramId, rgb)
  │   │
  │   └── Si valueType === 'number':
  │       ├── raw = evaluator.getValue(paramId, t)
  │       ├── adjusted = raw * clipIntensity
  │       ├── Si existe en numeric map: blendNumeric(existing, adjusted, mode)
  │       └── Si no: numeric.set(paramId, adjusted)
  │
  ├── Resolver color final via LTP (lastColorParam → colorMap.get(lastColorParam))
  │
  └── return { numeric, r, g, b, hasColor }
```

### 3.6 Modulación de Intensidad (Color)

El kernel encuentra el track de `intensity` entre los `applicableTracks` y usa su valor evaluado para modular la luminancia:

```typescript
const modulatedL = (hsl.l / 100) * intensityMod
// donde intensityMod = intensityTrackValue * clipIntensity
```

Esto une lo que el preview hacía independientemente con lo que el runtime hace — **misma matemática, mismo resultado**.

### 3.7 Garantía de Orden (AUDIT R.2)

Los `applicableTracks` se iteran en **orden de array `clip.tracks`**, igualando la iteración `tickActive()` del runtime. Para modos no conmutativos (`replace`, `subtract`), el **último track en orden de array** gana — igual que el `_blendMap` + NodeArbiter LTP del runtime.

Los color tracks se keyan por `paramId` en `colorMap`:
1. Dos color tracks con el **mismo** paramId → blend en orden de array
2. Dos color tracks con **diferente** paramId → se mantienen separados
3. Color final: LTP (last paramId escrito gana), igual que NodeArbiter consolida múltiples color intents

### 3.8 DMX Scaling (en `HephUtils.ts`)

El kernel devuelve valores normalizados [0, 1]. El scaling a DMX ocurre en los consumidores:

| Tipo | Parámetros | Scaling |
|------|-----------|---------|
| 8-bit DMX | intensity, strobe, white, amber, zoom, focus, iris, gobo1, gobo2, prism | `Math.round(val * 255)` |
| 16-bit DMX | pan, tilt | `val16 = Math.round(val * 65535)`, coarse = MSB, fine = LSB |
| Engine-internal | speed, width, direction, globalComp | Passthrough [0, 1] |

### 3.9 Conversión HSL → RGB (`hslToRgb`)

Implementación estándar con segmentación por sextantes (60° cada uno):

```typescript
const c = (1 - Math.abs(2 * l - 1)) * s
const x = c * (1 - Math.abs((hue / 60) % 2 - 1))
const m = l - c / 2
// 6 segmentos: rojo, amarillo, verde, cian, azul, magenta
return { r: Math.round((r1 + m) * 255), g: ..., b: ... }
```

---

## 4. Sincronización Preview vs Runtime (WYSIWYG)

### 4.1 Principio Arquitectónico

El WYSIWYG se garantiza **por construcción**, no por testing. Tres pilares:

### 4.2 Pilar 1 — HephEvaluationKernel (Single Source of Truth)

**Punto de código:** `HephEvaluationKernel.ts:9-12`

```
"This module is the ONE place where clip evaluation logic lives.
 Both useHephPreview (UI preview) and HephaestusRuntime (production
 engine) import from here — guaranteeing WYSIWYG by construction."
```

**Consumidores confirmados:**

| Consumer | Archivo | Cómo consume |
|----------|---------|--------------|
| Preview UI | `useHephPreview.ts:24` | `import { evaluateFixtureParams } from '../../../core/hephaestus/HephEvaluationKernel'` |
| Live Calibration | `useLiveCalibration.ts:186` | `import { evaluateFixtureParams } from '../../../core/hephaestus/HephEvaluationKernel'` |
| Runtime | `HephaestusRuntime.ts:51` | `import { defaultBlendMode, blendNumeric, blendRgb } from '../HephSharedMath'` |

> **Nota:** El runtime NO importa `evaluateFixtureParams` directamente. En su lugar, replica la misma lógica en `_emitTrackSample()` pero **delega las funciones de blend a `HephSharedMath`** — las mismas `blendNumeric`/`blendRgb` que usa el kernel. Esto se debe a que el runtime tiene constraints de zero-allocation que el kernel (diseñado para preview) no tiene. Sin embargo, la **matemática es idéntica** porque las funciones de blend son shared.

### 4.3 Pilar 2 — HephSharedMath (Math Compartida)

**Punto de código:** `HephSharedMath.ts:1-16`

```
"Consolidates the math that was duplicated between useHephPreview (UI)
 and HephaestusRuntime (engine). Both now import from this module."
```

Funciones compartidas:
- `defaultBlendMode(paramId)` — intensity→max, resto→replace
- `blendNumeric(existing, incoming, mode)` — max/replace/add/multiply
- `blendRgb(er, eg, eb, ir, ig, ib, mode)` — max/replace/add/multiply
- `buildTrackEvaluators(tracks, durationMs)` — construye evaluadores per-track idénticos

**Confirmación de uso:**
- `useHephPreview.ts:23`: `import { buildTrackEvaluators } from '../../../core/hephaestus/HephSharedMath'`
- `HephaestusRuntime.ts:51`: `import { defaultBlendMode as _defaultBlendModeFor, blendNumeric, blendRgb } from '../HephSharedMath'`

### 4.4 Pilar 3 — CurveEvaluator Compartido

Ambos paths usan la **misma clase `CurveEvaluator`** con el mismo cursor cache, misma interpolación bezier, mismo lerpHue shortest-path:

- Preview: `useHephPreview.ts:20`: `import { CurveEvaluator } from '../../../core/hephaestus/CurveEvaluator'`
- Runtime: `HephaestusRuntime.ts:50`: `import { CurveEvaluator } from '../CurveEvaluator'`

### 4.5 Pilar 4 — Phase Distribution Idéntica

Ambos paths usan `resolveWithOverrides()` de `PhaseOverride.ts`:

- Preview: `useHephPreview.ts:22`: `import { resolveWithOverrides } from '../../../core/hephaestus/phase/PhaseOverride'`
- Runtime: `HephaestusRuntime.ts:47`: `import { resolveWithOverrides, type PhaseOverrideMap } from '../phase/PhaseOverride'`

Y ambos aplican el mismo wrap continuo MA3-style:
- Preview (`useHephPreview.ts:423-424`):
  ```typescript
  const offsetTime = phaseOffset > 0
    ? ((timeMs + phaseOffset) % c.durationMs + c.durationMs) % c.durationMs
    : timeMs
  ```
- Runtime (`HephaestusRuntime.ts:560`):
  ```typescript
  fixtureTimeMs = ((baseClipTimeMs + fp.phaseOffsetMs) % durationMs + durationMs) % durationMs
  ```

### 4.6 Pilar 5 — Per-Track Zone Resolution (WYSIWYG espacial)

El preview (`useHephPreview.ts:336-359`) resuelve zones per-track con `resolveZoneTags`, igual que el runtime (`HephaestusRuntime.ts:877-887`). Un track targeting `'air'` solo afecta fixtures de `'air'` en ambos paths.

### 4.7 Diferencia Intencional: Zero-Allocation

El runtime usa un **output buffer pre-alocado** con `writeOutput()` in-place (WAVE 2400), mientras que el kernel/preview usa `Map<HephParamId, number>` que se recrea por frame. Esto es intencional:
- El runtime necesita 44Hz sostenido con cero GC pressure
- El preview corre en renderer a 44Hz con React, donde Maps temporales son aceptables
- **La matemática es idéntica** — solo difiere la estrategia de memoria

### 4.8 Diferencia Intencional: clipIntensity

- Preview: `clipIntensity = 1.0` siempre (sin modulación de intensidad de clip)
- Runtime: `clipIntensity = active.intensity` (multiplicador del clip, configurable en play())

Esto es correcto: el preview muestra los valores "puros" de las curvas, mientras que el runtime aplica la intensidad del clip como multiplicador.

### 4.9 Tabla de Verificación WYSIWYG

| Aspecto | Preview | Runtime | Shared? |
|---------|---------|---------|---------|
| Interpolación de curvas | `CurveEvaluator` | `CurveEvaluator` | ✅ Misma clase |
| Blend modes | `blendNumeric`/`blendRgb` | `blendNumeric`/`blendRgb` | ✅ HephSharedMath |
| Default blend mode | `defaultBlendMode()` | `defaultBlendMode()` | ✅ HephSharedMath |
| Evaluación de fixture | `evaluateFixtureParams()` | `_emitTrackSample()` (replica) | ⚠️ Misma lógica, distinto código |
| Phase distribution | `resolveWithOverrides()` | `resolveWithOverrides()` | ✅ Misma función |
| Phase wrap (loop) | `((t + offset) % d + d) % d` | `((t + offset) % d + d) % d` | ✅ Misma fórmula |
| Per-track zone resolution | `resolveZoneTags()` | `resolveZoneTags()` | ✅ Misma función |
| HSL → RGB | `hslToRgb()` | `hslToRgb()` | ✅ HephUtils |
| DMX scaling | `scaleToDMX()` / `scaleToDMX16()` | `scaleToDMX()` / `scaleToDMX16()` | ✅ HephUtils |
| Intensity modulation (color) | `evaluateColorTrack()` | Inline en `_emitTrackSample()` | ⚠️ Misma lógica, distinto código |
| colorOverride | Respetado | Respetado | ✅ Misma semántica |
| Alloc strategy | Maps temporales | Buffer pre-alocado | ❌ Intencionalmente distinto |
| clipIntensity | 1.0 fijo | `active.intensity` | ❌ Intencionalmente distinto |

---

## 5. Inventario de Archivos

### 5.1 Núcleo Matemático

| Archivo | Líneas | Función |
|---------|--------|---------|
| `CurveEvaluator.ts` | 713 | Motor de evaluación de curvas (hold/linear/bezier, HSL shortest-path, zero-alloc) |
| `HephEvaluationKernel.ts` | 206 | Single source of truth para evaluación de fixture (blend modes, intensity mod) |
| `HephSharedMath.ts` | 79 | Math compartida: blendNumeric, blendRgb, defaultBlendMode, buildTrackEvaluators |
| `HephSharedMath.ts` | 79 | Math compartida entre preview y runtime |

### 5.2 Fase

| Archivo | Líneas | Función |
|---------|--------|---------|
| `phase/PhaseConfigPro.ts` | 168 | Motor de distribución de fase (7 pasos: blocks→shuffle→normalize→symmetry→wings→direction→spread) |
| `phase/PhaseOverride.ts` | 140 | Overrides manuales per-fixture (delta/absolute, bake/unbake, pin) |

### 5.3 Runtime

| Archivo | Líneas | Función |
|---------|--------|---------|
| `runtime/HephaestusRuntime.ts` | 1080 | Ejecutor de clips V3 (load, play, tick, zero-alloc output buffer, resolved tracks) |
| `runtime/HephUtils.ts` | 107 | Utilidades puras: hslToRgb, scaleToDMX, scaleToDMX16 (sin dependencias Node) |

### 5.4 Tipos y Datos

| Archivo | Líneas | Función |
|---------|--------|---------|
| `types.ts` | 664 | DNA del sistema: HSL, HephKeyframe, HephCurve, HephTrack, HephAutomationClipV3, BlendMode, BEZIER_PRESETS, serializeHephClip, inferHephCategory |

### 5.5 UI / Preview

| Archivo | Líneas | Función |
|---------|--------|---------|
| `store/useHephaestusEditorStore.ts` | 549 | Store Zustand+Immer con undo/redo por patches, selección efímera, drag batching |
| `useHephPreview.ts` (en views/) | 607 | Hook de preview 44Hz, resolveFixtures con zone mapping real, radar layout |

### 5.6 Soporte

| Archivo | Líneas | Función |
|---------|--------|---------|
| `HephaestusClipIndex.ts` | ~250 | Index de clips cargados |
| `HephFileIO.ts` | ~350 | I/O de archivos .lfx |
| `HephIPCHandlers.ts` | ~260 | Handlers IPC |
| `HephParameterOverlay.ts` | ~315 | Overlay de parámetros |
| `GenomeCalibrator.ts` | ~196 | Calibración del genoma |
| `defaults.ts` | ~37 | Defaults (DEFAULT_COGNITIVE_DNA) |

---

## 6. Observaciones Arquitectónicas Clave

### 6.1 Multicelularidad V3

El cambio fundamental de V2 a V3 fue reemplazar `curves: Map<HephParamId, HephCurve>` por `tracks: HephTrack[]`. Cada track es una célula independiente con:
- Su propio `paramId` (puede repetirse entre tracks)
- Sus propias `zones` (targeting espacial específico)
- Su propio `CurveEvaluator` (cursor cache aislado)
- Su propio `blendMode` (estrategia de fusión declarada)
- Su propio `phaseConfig` (distribución de fase independiente)
- Su propio `colorOverride` (color constante opcional)

### 6.2 Orden Canónico

Los tracks se ordenan por **zona ASC → paramId ASC** en el migrator, garantizando idempotencia de checksums y comportamiento determinista de blend modes no conmutativos.

### 6.3 Separación de Namespaces (WAVE-4847)

- `spatialZones` → DÓNDE van los fixtures (CanonicalZone / helpers)
- `cognitiveDNA` → CUÁNDO/CÓMO actúa Selene (EnergyZone, ACO, vibes)

El Loader rechaza cualquier EnergyZoneId en `spatialZones`.

### 6.4 MixBus Inter-Clip

```typescript
mixBus: 'global' | 'htp' | 'ambient' | 'accent'
```

- `global` = LTP (full takeover)
- `htp`/`ambient`/`accent` = HTP (highest takes precedence)

Esto define el comportamiento cuando múltiples clips se solapan en los mismos fixtures. Es distinto del `blendMode` intra-clip (que opera entre tracks del mismo clip).

### 6.5 Audio Binding (WAVE 2030.14)

Los keyframes pueden declarar `audioBinding` que vincula su valor a datos de análisis de audio en tiempo real:

```typescript
interface HephAudioBinding {
  source: 'energy' | 'bass' | 'mids' | 'highs' | 'none'
  inputRange: [number, number]
  outputRange: [number, number]
  smoothing: number
}
```

Cuando está presente, el valor del keyframe se convierte en BASE y el audio lo modula según el mapeo.

### 6.6 Forward-Compat: `cell`

El campo `cell` en `HephTrack` está **reservado** en v3.0 — el Runtime no lo consume. Se incluye para futura compatibilidad con fixtures multicell.

---

*Fin del reporte.*
