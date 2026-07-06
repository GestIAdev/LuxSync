# WAVE 5000.V3 — FORENSIC AUDIT
## Genetic Operators Mechanics & L2 Distance Mystery

**Auditor:** Chief Forensic & Genetic Architect  
**Fecha:** 2026-07-05  
**Modo:** READ-ONLY — Sin modificaciones al código  
**Alcance:** `GeneticOperators.ts`, `ColiseumService.ts`, `RarityEngine.ts`, `OrganismMaterializer.ts`

---

## 1. RADIOGRAFÍA DE LOS MUTÁGENOS ACTUALES

### 1.1 `pointMutation()` — Operator 1

**Archivo:** `@/electron-app/src/core/genesis/operators/GeneticOperators.ts:173-241`

#### Campos modificados:
| Campo | Path JSON Patch | Tipo | ¿Siempre se muta? |
|---|---|---|---|
| `keyframe.value` | `/tracks/{T}/curve/keyframes/{K}/value` | `number` | **Sí** (si el keyframe es numérico) |
| `keyframe.bezierHandles[B]` | `/tracks/{T}/curve/keyframes/{K}/bezierHandles/{B}` | `number` | **50% de probabilidad** (solo si `kf.bezierHandles` existe y `rng() < 0.5`) |

#### Fórmulas matemáticas exactas:

**Magnitud de mutación:**
```
magnitude = 0.02 + rng() * 0.06    →  rango [0.02, 0.08)  (2% a 8%)
sign = rng() < 0.5 ? -1 : 1       →  50/50 dirección
```

**Mutación de `value`:**
```
span = curve.range[1] - curve.range[0]
newVal = clamp(oldVal + sign * magnitude * span, range[0], range[1])
```
- La variación absoluta es `magnitude * span`. Para un track de intensidad con `range = [0, 1]`, el delta máximo es **±0.08**. Para pan con `range = [-135, 135]` (span=270), el delta máximo es **±21.6°**.

**Mutación de `bezierHandles`:**
```
handleIdx = floor(rng() * 4)      →  uno de los 4 handles [cx1, cy1, cx2, cy2]
newHandle = clamp(oldHandle + sign * magnitude, -2, 2)
```
- Notar: el delta del handle es `sign * magnitude` (sin multiplicar por `span`). Rango de variación: **±0.08** sobre el handle, clampeado a `[-2, 2]`.

#### Granularidad de la mutación:
- **Exactamente 1 track al azar** (de los tracks con `valueType === 'number'`).
- **Exactamente 1 keyframe al azar** dentro de ese track.
- **1 o 2 operaciones JSON Patch** por llamada (1 para `value`, +1 para `bezierHandle` con 50% de probabilidad).
- Los tracks de color (`valueType === 'color'`) son **completamente ignorados** — se filtran en la línea 184.

#### RNG:
- PRNG determinista LCG: `s = (s * 1664525 + 1013904223) | 0`, output `((s >>> 0) % 1000000) / 1000000`.
- Seed opcional; si no se provee, usa `Date.now()`.

---

### 1.2 `phaseEpigenetics()` — Operator 3

**Archivo:** `@/electron-app/src/core/genesis/operators/GeneticOperators.ts:317-370`

#### Campos modificados:
| Campo | Path JSON Patch | Tipo | ¿Siempre se muta? |
|---|---|---|---|
| `track.phaseConfig.spreadDeg` | `/tracks/{T}/phaseConfig` | `number` (grados) | 1 de 5 params al azar |
| `track.phaseConfig.wings` | `/tracks/{T}/phaseConfig` | `number` (entero) | 1 de 5 params al azar |
| `track.phaseConfig.shuffle` | `/tracks/{T}/phaseConfig` | `number` [0..1] | 1 de 5 params al azar |
| `track.phaseConfig.blocks` | `/tracks/{T}/phaseConfig` | `number` (entero) | 1 de 5 params al azar |
| `track.phaseConfig.direction` | `/tracks/{T}/phaseConfig` | `1 \| -1` | 1 de 5 params al azar |
| `track.phaseConfig.shuffleSeed` | `/tracks/{T}/phaseConfig` | `number` | **Siempre** (línea 354) |

#### Fórmulas matemáticas exactas:

**Por cada track** (itera sobre TODOS los tracks, no solo uno):
```
numMutations = 1 + floor(rng() * 2)   →  1 o 2 parámetros mutados por track
```

**Parámetros (switch aleatorio `param = floor(rng() * 5)`):**
| Case | Param | Fórmula | Rango resultante |
|---|---|---|---|
| 0 | `spreadDeg` | `clamp(existing + (rng()-0.5) * 120, 0, 1440)` | Δ ∈ [-60, +60] |
| 1 | `wings` | `clamp(round(existing ± 1), 1, 8)` | ±1 entero |
| 2 | `shuffle` | `clamp(existing + (rng()-0.5) * 0.3, 0, 1)` | Δ ∈ [-0.15, +0.15] |
| 3 | `blocks` | `clamp(round(existing ± 1), 1, 16)` | ±1 entero |
| 4 | `direction` | `rng() < 0.5 ? 1 : -1` | Flip binario |

**`shuffleSeed`** siempre se reescribe: `floor(rng() * 100000) + 1`

#### Delta JSON Patch:
- Se emite **1 operación `replace`** por track que reemplaza el objeto `phaseConfig` completo (no operaciones granulares por campo).
- Si el clip tiene N tracks, se generan **N operaciones** en el delta.

#### Granularidad:
- **TODOS los tracks** son mutados en cada llamada (bucle `for` línea 325).
- Por cada track, **1-2 parámetros** de fase son alterados (+ `shuffleSeed` siempre).
- Las curvas (keyframes/values) **no se tocan** — es puramente epigenético.

---

### 1.3 `geneDuplication()` — Operator 2 (referencia)

**Archivo:** `@/electron-app/src/core/genesis/operators/GeneticOperators.ts:251-306`

- Clona un track al azar, muta su `phaseConfig` (spreadDeg ±90°, wings ±1-2, shuffle ±0.2, nuevo shuffleSeed), y lo añade al final del array `tracks`.
- Genera 1 operación `add` en `/tracks/-`.
- **Sí añade estructura** (nuevo track completo).

---

## 2. EL MISTERIO DE LA DISTANCIA NULA (`L2 Distance = 0.0000`)

### 2.1 La fórmula exacta de `computeL2Distance()`

**Archivo:** `@/electron-app/src/core/genesis/operators/GeneticOperators.ts:102-149`

```typescript
function computeL2Distance(parent, child): number {
  let sumSq = 0
  let count = 0

  for each track t (max(parentTracks, childTracks)):
    if track missing in one side → sumSq += 1.0, count++
    else:
      for each keyframe k (max(pk.length, ck.length)):
        if kf missing in one side → sumSq += 0.5, count++
        else:
          if both values are number:
            diff = child.value - parent.value
            sumSq += diff * diff
            count++
          if both have bezierHandles:
            for b in 0..3:
              diff = child.bezierHandles[b] - parent.bezierHandles[b]
              sumSq += diff * diff * 0.25  // bezier weighted lower
              count++

  return count > 0 ? Math.sqrt(sumSq / count) : 0
}
```

**Fórmula final:** `L2 = sqrt(Σ(diff²) / count)` — RMSE (Root Mean Square Error) normalizado por número de muestras.

### 2.2 ¿Por qué `point_mutation` reporta sistemáticamente `0.0000`?

**DIAGNÓSTICO: El problema es de magnitud — la variación es tan pequeña que el RMSE se redondea a cero.**

**Análisis cuantitativo:**

Para una `pointMutation` típica sobre un track de intensidad (`range = [0, 1]`):
- Se muta **1 keyframe** de **1 track**.
- El delta máximo es `magnitude * span = 0.08 * 1.0 = 0.08`.
- Supongamos un clip con 2 tracks, cada uno con 4 keyframes, todos con bezierHandles.
- `count` total = 2 tracks × 4 keyframes × (1 value + 4 bezier) = 2 × 4 × 5 = **40 muestras**.
- Solo **1 value** y posiblemente **1 bezierHandle** cambiaron (máximo 2 de 40).
- `sumSq` = `(0.08)² + (0.08)² * 0.25` = `0.0064 + 0.0016` = `0.008` (máximo teórico).
- `L2 = sqrt(0.008 / 40)` = `sqrt(0.0002)` = **`0.014`**.

Para un clip con más tracks/keyframes (ej. 4 tracks × 8 keyframes):
- `count` = 4 × 8 × 5 = **160 muestras**.
- `sumSq` máximo = `0.008` (mismo — solo 1 kf mutado).
- `L2 = sqrt(0.008 / 160)` = `sqrt(0.00005)` = **`0.007`**.

**Conclusión:** Para mutaciones típicas de 2-8% en 1 keyframe de 1 track, el L2 resultante está en el orden de **0.007 a 0.014**. Esto se almacena como `REAL` en SQLite y se muestra en la UI con 4 decimales → **`0.0070` o `0.0140`**, que visualmente se acerca mucho a `0.0000` para mutaciones pequeñas (2%).

**Pero hay un segundo problema más profundo:**

### 2.3 BUG CRÍTICO: `phaseEpigenetics` SIEMPRE reporta L2 = 0

**`computeL2Distance()` solo compara `keyframe.value` y `keyframe.bezierHandles`.** No compara `phaseConfig`.

`phaseEpigenetics()` modifica **exclusivamente** `track.phaseConfig` — no toca ningún keyframe, value, ni bezierHandle. Por lo tanto:

- `parent.tracks[t].curve.keyframes` es **idéntico** a `child.tracks[t].curve.keyframes` para todo track.
- Todas las diferencias `diff = 0`.
- `sumSq = 0`, `count > 0`.
- **`L2 = sqrt(0 / count) = 0.0000`** — siempre, sin excepción.

Esto significa que **todos los organismos nacidos por `phase_epigenetics` tienen `l2_distance_parent = 0`**, lo que los hace automáticamente `COMMON` en el RarityEngine (`sigmaNorm = clamp01(0 / 0.35) = 0`).

### 2.4 Impacto en cascada sobre `RarityEngine`

**Archivo:** `@/electron-app/src/core/genesis/loot/RarityEngine.ts:137-157`

```
ρ = sigmaNorm * 0.50 + novelty * 0.30 + operatorWeight * 0.20
```

- `sigmaNorm = clamp01(l2Distance / 0.35)`
- Para `point_mutation` con L2 = 0.007: `sigmaNorm = 0.02` → contribuye `0.01` al score.
- Para `phase_epigenetics` con L2 = 0: `sigmaNorm = 0` → contribuye `0` al score.
- `novelty` siempre es `1.0` en modo simple (population vacía) → contribuye `0.30`.
- `operatorWeight` = `0.15` para ambos → contribuye `0.03`.

**Score resultante:**
- `point_mutation`: `0.01 + 0.30 + 0.03 = 0.34` → **RARE** (justo sobre el umbral 0.30).
- `phase_epigenetics`: `0.00 + 0.30 + 0.03 = 0.33` → **RARE** (también sobre 0.30).

Pero en modo real (con population signatures), `novelty` bajaría al haber organismos similares, y el score caería a `COMMON`.

---

## 3. CAPACIDAD REAL DE REESCRITURA ESTRUCTURAL

### 3.1 `pointMutation` — NO puede añadir ni eliminar keyframes

**Veredicto: Solo puede modificar el valor `y` (`value`) y opcionalmente un `bezierHandle` de un keyframe existente.**

- No puede crear nuevos keyframes (no hay operación `add` sobre `keyframes[]`).
- No puede eliminar keyframes (no hay operación `remove`).
- No puede cambiar `timeMs` (posición temporal) de ningún keyframe.
- No puede cambiar `interpolation` entre tipos (bezier/linear/step).
- No puede añadir ni eliminar tracks.
- No puede modificar `zones`, `paramId`, `phaseConfig`, `dimmerScale`, `colorOverride`, `blendMode`.
- No puede tocar tracks de color (`valueType === 'color'` son filtrados).

**Resumen:** `pointMutation` es un **micro-tweak** de un único valor numérico. Es genéticamente equivalente a una sustitución puntual sin inserción ni deleción.

### 3.2 `phaseEpigenetics` — NO puede reescribir estructura de curvas

**Veredicto: Solo puede modificar parámetros de fase (`spreadDeg`, `wings`, `shuffle`, `blocks`, `direction`, `shuffleSeed`).**

- No toca keyframes, values, bezierHandles, ni ningún aspecto de la curva.
- No añade ni elimina tracks ni keyframes.
- Cambia **cómo** se ejecuta la animación espacialmente, no **qué** valores produce.

### 3.3 `geneDuplication` — ÚNICO operador con reescritura estructural

**Veredicto: Puede añadir tracks completos (clonados + mutados).**

- Sí añade un track nuevo al array `tracks[]`.
- Pero **no puede eliminar** tracks (no hay operador `gene_deletion` implementado — está declarado en `MutationOperator` type pero no tiene función en `GeneticOperators.ts`).
- No puede añadir/eliminar keyframes individuales dentro de una curva existente.

### 3.4 Operadores declarados pero NO implementados

**Archivo:** `@/electron-app/src/core/genesis/types.ts:17-26`

Los siguientes operadores están declarados en el tipo `MutationOperator` pero **NO tienen implementación** en `GeneticOperators.ts` ni en el dispatcher `applyOperator()`:

| Operador | Estado | Capacidad teórica |
|---|---|---|
| `hue_drift` | **NO implementado** | Deriva de color HSL |
| `gene_deletion` | **NO implementado** | Eliminar tracks |
| `crossover` | **NO implementado** | Recombinación de dos padres |
| `temporal_stretch` | **NO implementado** | Estirar/comprimir timeline |
| `context_drift` | **NO implementado** | Mutar birth_vector/contexto |
| `transposition` | **NO implementado** | Mover keyframes en el tiempo |

El dispatcher `applyOperator()` (línea 377-398) tiene un `default` que retorna un clon sin delta para cualquier operador no reconocido.

### 3.5 `applyDelta()` — Soporte estructural del mecanismo

**Archivo:** `@/electron-app/src/core/genesis/operators/GeneticOperators.ts:52-93`

El motor de aplicación de deltas **sí soporta** operaciones estructurales:
- `add` sobre arrays (push al final con path `/tracks/-` o push a sub-array).
- `remove` sobre arrays (splice por índice numérico).
- `replace` sobre cualquier campo.

**La infraestructura existe, pero ningún operador implementado la usa para añadir/eliminar keyframes.**

---

## RESUMEN EJECUTIVO

| Pregunta | Respuesta |
|---|---|
| **¿Qué campos muta `pointMutation`?** | `keyframe.value` (siempre) + `bezierHandles[B]` (50%). 1 kf de 1 track. |
| **¿Qué campos muta `phaseEpigenetics`?** | `phaseConfig` (1-2 params de 5 + shuffleSeed). Todos los tracks. |
| **¿Magnitud de `pointMutation`?** | 2-8% del span del rango del track. Δ absoluto típico: 0.008-0.08 para intensidad. |
| **¿Magnitud de `phaseEpigenetics`?** | spreadDeg ±60°, wings ±1, shuffle ±0.15, blocks ±1, direction flip. |
| **¿Por qué L2 = 0 en `point_mutation`?** | El RMSE es tan pequeño (0.007-0.014) que se redondea visualmente. NO es un bug de fórmula. |
| **¿Por qué L2 = 0 en `phase_epigenetics`?** | **BUG CRÍTICO:** `computeL2Distance` no compara `phaseConfig`. Solo compara `value` y `bezierHandles`. Como `phaseEpigenetics` no toca esos campos, la distancia es matemáticamente cero. |
| **¿Pueden añadir/eliminar keyframes?** | **NO.** Ningún operador implementado puede añadir o eliminar keyframes. Solo `geneDuplication` puede añadir tracks completos. |
| **¿Pueden modificar `timeMs`?** | **NO.** Ningún operador toca la posición temporal de los keyframes. |
| **¿Operadores faltantes?** | 6 de 9 operadores declarados no están implementados (`hue_drift`, `gene_deletion`, `crossover`, `temporal_stretch`, `context_drift`, `transposition`). |

---

## RECOMENDACIONES DE DISEÑO (para decisión del equipo)

1. **FIX INMEDIATO:** `computeL2Distance` debe incluir `phaseConfig` en la comparación. Sugerencia: normalizar cada campo de fase a [0,1] y sumarlos al RMSE con un peso (ej. 0.5 para `spreadDeg/1440`, `wings/8`, `shuffle`, `blocks/16`, `direction` como 0/1).

2. **ESCALA DE MUTACIÓN:** Considerar aumentar el rango de `pointMutation` de 2-8% a 5-20% para que el L2 sea detectable y el RarityEngine pueda diferenciar COMMON de RARE basado en `sigmaNorm`.

3. **REESCRITURA ESTRUCTURAL:** Implementar operadores que puedan:
   - Añadir keyframes en posiciones temporales intermedias (inserción genética).
   - Eliminar keyframes (deleción genética).
   - Mover `timeMs` de keyframes (transposición temporal).
   - Cambiar `interpolation` entre tipos (mutación epigenética de interpolación).

4. **OPERADORES FALTANTES:** 6 de 9 operadores declarados no existen. El ecosistema genético actual está limitado a 3 operadores, de los cuales solo 1 (`geneDuplication`) tiene capacidad estructural.

5. **DIVERSIDAD GENÉTICA:** Con solo `pointMutation` (micro-tweak) y `phaseEpigenetics` (fase, invisible al L2), la diversidad fenotípica real del ecosistema es muy baja. La mayoría de organismos serán cuasi-clones del ancestro granítico con variaciones minúsculas.
