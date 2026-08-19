Voy a hacer un análisis forense completo de los 7 operadores. Lectura profunda del archivo:

Tengo el código completo de los 7 operadores + crossover. Veo los tipos y la roulette:

Tengo el código completo de los 7 operadores + crossover + los 3 operadores fantasma. Aquí está el informe forense completo:

---

# GENESIS V3 — OPERADOR FORENSE COMPLETO
**WAVE 7529 · Auditor: Lead Genesis Architect · Base: commit post-7528**

---

## 0. MAPA MAESTRO

| # | Operador | Tipo | Roulette | OpWeight | L2 típico | Tier típico (post-7528) |
|---|----------|------|----------|----------|-----------|--------------------------|
| 1 | `focal_mutation` | Valor | 0.20 | 0.15 | 0.07-0.10 | COMMON |
| 2 | `gene_augmentation` | Estructural | 0.18 | 0.50 | 0.05-0.15 | COMMON-RARE |
| 3 | `spatial_resonance` | Fase | 0.15 | 0.20 | 0.10-0.25 | COMMON-RARE |
| 4 | `proportional_stretch` | Temporal | 0.15 | 0.35 | 0.15-0.30 | RARE-EPIC |
| 5 | `macro_splice` | Macro-bloque | 0.15 | 0.60 | 0.10-0.20 | COMMON-RARE |
| 6 | `adaptive_pruning` | Poda | 0.05 | 0.55 | 0.02-0.10 | COMMON |
| 7 | `curve_adaptation` | Interpolación | 0.12 | 0.25 | 0.01-0.05 | COMMON |
| 8 | `crossover` | Sexual | — | 0.85 | 0.10-0.30 | RARE-EPIC |
| 👻 | `hue_drift` | **FANTASMA** | 0 | 0.15 | — | — |
| 👻 | `context_drift` | **FANTASMA** | 0 | 0.65 | — | — |
| 👻 | `transposition` | **FANTASMA** | 0 | 0.85 | — | — |

**Operadores fantasmas:** `hue_drift`, `context_drift`, y `transposition` están definidos en el tipo `MutationOperator` (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\genesis\types.ts" lines="17-28" />) y tienen peso en la tabla de rareza (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\genesis\loot\RarityEngine.ts" lines="31-42" />), pero **no están implementados** en el dispatcher (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\genesis\operators\GeneticOperators.ts" lines="1690-1727" />) ni en la roulette (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\genesis\ColiseumService.ts" lines="47-55" />). Son pesos muertos — nunca se seleccionan, nunca se ejecutan.

---

## 1. FOCAL MUTATION — El microscopio

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\genesis\operators\GeneticOperators.ts" lines="343-444" />

### Cómo opera
1. **Selección de target por DNA:** Si `aggression > 0.5` → targets `['intensity', 'strobe']`. Si `organicity > 0.5` → `['color', 'zoom', 'pan', 'tilt']`. Si ninguno → cualquier track numérico.
2. **Pick uniforme:** Un track aleatorio de los candidatos, un keyframe aleatorio dentro de ese track.
3. **Shift perceptible:** `shiftMagnitude = 0.20 + rng() * 0.20` (uniforme [0.20, 0.40)). Signo aleatorio. Aplicado como `oldVal + sign * shiftMagnitude * span`, clampeado a `range`.
4. **DNA drift:** `aggression +0.020`, `chaos +0.020`. Organicity sin cambio.

### L2 producido
- `D_curve`: Un keyframe desplazado 0.30·span en un track de N keyframes → `D_curve ≈ 0.30 / √N`. Para 5 keyframes: 0.134.
- `D_phase = 0` (no mueve tiempo).
- `D_structural = 0` (no cambia estructura).
- **L2 = 0.55 × 0.134 = 0.074** → **COMMON** (forzado por threshold 0.12).

### Por qué es conservador
- **Solo 1 keyframe por invocación.** No hay mutación multipunto.
- **Magnitud uniforme [0.20, 0.40).** Sin cola pesada — nunca hay un salto grande accidental.
- **No muta tiempo.** Solo valores.
- **DNA drift minúscula:** +0.020 por generación. Se necesitan 25 generaciones para ir de 0.5 a 1.0 en aggression.

### Cómo hacerlo operar de verdad
1. **Mutación multipunto:** Con probabilidad `chaos`, mutar 2-3 keyframes en lugar de 1. El número de puntos mutados debería escalar con `chaos`.
2. **Cauchy en magnitud:** Reemplazar `shiftMagnitude = 0.20 + rng() * 0.20` con `shiftMagnitude = fatRng.sampleCauchy(0.15, 0.80)`. La mayoría de mutaciones seguirán siendo ~0.15, pero ocasionalmente una de 0.60-0.80 cruzará el valle de aptitud.
3. **DNA drift escalado:** `+0.020 * (1 + chaos)` — a mayor chaos, mayor drift genómico.

---

## 2. GENE AUGMENTATION — El arquitecto lamarckiano

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\genesis\operators\GeneticOperators.ts" lines="476-705" />

### Cómo opera
1. **Inventario:** Lista todos los `(paramId, zones)` existentes.
2. **Path A (param faltante):** Si hay un `paramId` de `AUGMENTABLE_PARAMS` no presente, lo inyecta con una zona complementaria no usada.
3. **Path B (multicelular):** Si todos los params existen, busca combinaciones `(paramId, zone)` no cubiertas e inyecta un duplicado en zona complementaria.
4. **Generación de curva:** 2-3 keyframes con forma dictada por `aggression`:
   - `strobe` agresivo → valores altos (0.7-1.0), `hold`
   - `strobe` suave → valores bajos (0.2-0.5), `linear`
   - `color` → spread lineal del hue
   - `pan`/`tilt` agresivo → saltos posicionales, `hold`
   - `pan`/`tilt` suave → sweep, `bezier`
   - `zoom` agresivo → 0.8-1.0; suave → 0.3-0.7
   - `intensity` → 0.4-0.9
5. **DNA drift lamarckiano:** El operador **escribe el genoma** según lo que inyectó:
   - `strobe` → `aggression +0.150, chaos +0.050, pressureMin +0.100`
   - `color` → `organicity +0.120`
   - `pan`/`tilt` → `chaos +0.120`
   - `zoom` → `aggression +0.080`
   - `intensity` → `organicity +0.060`

### L2 producido
- `D_structural`: Track count diff = 1/N. Para 6 tracks: 0.167. Zone divergence bonus.
- `D_curve`: Los keyframes del nuevo track no tienen correspondiente en el padre → `sumSq += 0.5` por cada kf.
- `D_phase`: El nuevo track tiene `phaseConfig` default → diff contra default = 0.
- **L2 = 0.55 × D_curve + 0.40 × 0 + 0.05 × D_structural**
- Con 6 tracks y 3 keyframes nuevos: `D_curve ≈ √(0.5×3 / (6+3)) ≈ 0.408`, `D_structural ≈ 0.45×0.167 + 0.15×zoneDiv ≈ 0.10`
- **L2 ≈ 0.55×0.408 + 0.05×0.10 = 0.229** → **EPIC** (post-7528)

### Por qué es conservador
- **Solo 2-3 keyframes.** Un track nuevo con 2 keyframes es una línea recta — aburrido.
- **Valores en bandas seguras:** `intensity` siempre 0.4-0.9, `zoom` siempre 0.3-1.0. Nunca extremos.
- **Peso D_structural = 0.05.** Añadir un track entero contribuye solo 5% al L2. El sistema de rareza no recompensa la innovación estructural proporcionalmente.
- **No genera phaseConfig para el nuevo track.** Usa default — el nuevo track no tiene identidad espacial.

### Cómo hacerlo operar de verdad
1. **Más keyframes con estructura musical:** Generar 4-8 keyframes alineados al compás (si `durationMs` es conocido, colocar keyframes en beats/medios beats).
2. **PhaseConfig heredado o novel:** Asignar un `phaseConfig` archetype del mismo menú que `spatial_resonance` (harmony/chaos/aggression) según el DNA.
3. **Valores extremos ocasionales:** Usar `samplePareto(0.5, 3.0)` para occasionalmente generar un track con valores en los extremos (0.0-0.1 o 0.9-1.0).
4. **Aumentar peso D_structural a 0.10:** Un track nuevo es un evento evolutivo mayor — debería contribuir más al L2.

---

## 3. SPATIAL RESONANCE — El geomante

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\genesis\operators\GeneticOperators.ts" lines="718-859" />

### Cómo opera
1. **Target democrático:** Excluye `color` (crea barro visual). Pick uniforme entre el resto.
2. **Archetype por DNA:**
   - `organicity > 0.5` → **Harmony**: `spreadDeg=360`, `wings` par (2 o 4), `shuffle=0`, `blocks=1`, `symmetry='mirror'`
   - `chaos > 0.6` → **Chaos**: `spreadDeg` random(90,270), `wings` impar (1 o 3), `shuffle` random(0.3,0.8), `blocks` random(2,4), `symmetry='linear'`
   - `aggression > 0.6` → **Aggression**: `spreadDeg` 180 o 360, `wings=1`, `shuffle=0`, `blocks=1`, `symmetry='linear'`
   - Fallback → RNG 33/33/33
3. **Reemplaza `phaseConfig`** del track entero.
4. **DNA drift:** Harmony → `organicity +0.030, chaos -0.040`. Chaos → `chaos +0.050`. Aggression → `aggression +0.040`.

### L2 producido
- `D_phase`: Depende del delta entre el phaseConfig viejo y el nuevo.
  - Harmony: `spreadDeg` pasa a 360 (normalizado 360/1440 = 0.25), `symmetry` cambia a `mirror` (1.0), `wings` cambia (diff/8).
  - Caos: `spreadDeg` random, `shuffle` 0.3-0.8, `wings` impar, `blocks` 2-4, `symmetry` linear.
  - Pesos: `[0.30, 0.25, 0.15, 0.15, 0.10, 0.05]` para `[spread, wings, shuffle, blocks, direction, symmetry]`
- **L2 = 0.40 × D_phase** (D_curve = 0, D_structural = 0)
- Harmony desde default: `D_phase ≈ √(0.30×0.25² + 0.10×1² + 0.05×1²) ≈ √(0.019 + 0.10 + 0.05) ≈ 0.42`
- **L2 ≈ 0.40 × 0.42 = 0.168** → **COMMON** (post-7528, score < 0.18)

### Por qué es conservador
- **Solo 1 track por invocación.** Un clip de 6 tracks tiene 1/6 de su espacio espacial mutado.
- **Archetypes son presets fijos.** Harmony siempre es 360°/mirror. No hay grados intermedios.
- **No genera `shuffleSeed` evolutivo.** El seed es random — no hereda del padre ni deriva.

### Cómo hacerlo operar de verdad
1. **Multi-track phase mutation:** Con probabilidad `chaos`, aplicar el mismo archetype a 2-3 tracks simultáneamente — coherencia espacial.
2. **Archetype híbrido:** Mezclar 2 archetypes (ej: 70% harmony + 30% chaos) en lugar de presets binarios.
3. **Derivar `shuffleSeed` del padre:** `newSeed = parentSeed + Math.floor(rng() * 1000)` — evolución incremental en lugar de reseteo.

---

## 4. PROPORTIONAL STRETCH — El crononauta

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\genesis\operators\GeneticOperators.ts" lines="870-979" />

### Cómo opera
1. **Multiplicador por DNA:**
   - `aggression > 0.6 || chaos > 0.5` → **Frenzy**: 0.5 (20% chance de 0.25)
   - `organicity > 0.6` → **Lethargy**: 2.0
   - `chaos > 0.4` → **Syncopation**: 1.5
   - Fallback → uniforme [0.5, 1.5, 2.0]
2. **Aplicación global:** `durationMs *= multiplier`. Todos los `timeMs` de todos los keyframes escalados.
3. **DNA drift:** Faster → `aggression +0.050, chaos +0.030`. Slower → `organicity +0.060, aggression -0.040`.

### L2 producido
- `D_phase`: Los keyframes no se mueven en fase (la proporción interna se preserva), pero `durationMs` cambia. Sin embargo, `computeDPhase` **no mide `durationMs`** — mide `spreadDeg`, `wings`, `shuffle`, `blocks`, `direction`, `symmetry` del `phaseConfig`. **D_phase = 0.**
- `D_curve`: Los valores no cambian. **D_curve = 0.**
- `D_structural`: Track count y kf count no cambian. **D_structural = 0.**
- **L2 = 0** ← **BUG CRÍTICO**

### ⚠️ BUG: L2 = 0 para proportional_stretch
`computeL2DistanceV2` no mide `durationMs`. Un clip que pasa de 1000ms a 2000ms (o a 250ms) produce **L2 = 0** — el sistema de rareza lo clasifica como COMMON con score 0, sin importar la magnitud del stretch.

El operador **hace un cambio musical masivo** (doble tiempo, mitad de tiempo) pero el sistema de rareza **no lo ve**. Esto significa:
- `proportional_stretch` nunca produce RARE+ aunque tenga `operatorWeight = 0.35`
- El operador es invisible al pipeline evolutivo

### Cómo hacerlo operar de verdad
1. **FIX CRÍTICO:** Añadir `D_temporal` a `computeL2DistanceV2`:
   ```
   D_temporal = |log(child.durationMs / parent.durationMs)| / log(4)
   ```
   Normalizado por log(4) porque el stretch máximo es 4× (de 0.25 a 1.0). Clampeado a [0,1].
2. **Rebalancear pesos:** `L2 = 0.45·D_curve + 0.30·D_phase + 0.15·D_temporal + 0.10·D_structural`
3. **Stretch no uniforme:** En lugar de escalar todo por el mismo factor, permitir que algunos tracks se estiren más que otros — asincronía rítmica.

---

## 5. MACRO SPLICE — El cirujano de bloques

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\genesis\operators\GeneticOperators.ts" lines="995-1209" />

### Cómo opera
1. **Busca gaps > 300ms** en tracks numéricos con ≥2 keyframes.
2. **Archetype por DNA:**
   - `chaos > 0.6` → **Stutter**: 80-120ms, drop a `range[0]`, `hold`
   - `aggression > 0.5` → **Peak**: 150-200ms, `valA + 0.40·span`, `linear` o `hold`
   - `organicity > 0.5` → **Breath**: 300-500ms, `valA - 0.30·span`, `bezier`
   - Fallback → RNG 33/33/33
3. **Inserta 2 keyframes** (inicio y fin del bloque) en el gap. El keyframe final restaura el valor interpolado original.
4. **DNA drift:** Stutter → `chaos +0.050, organicity -0.020`. Peak → `aggression +0.060`. Breath → `organicity +0.050, aggression -0.030`.

### L2 producido
- `D_curve`: 2 keyframes nuevos con valores diferentes al interpolado → contribución moderada.
- `D_phase`: Los keyframes adyacentes no se mueven, pero los nuevos están en posiciones intermedias → `D_phase` mide `phaseConfig`, no posiciones temporales. **D_phase = 0.**
- `D_structural`: kf count cambia en +2 → `avgKfDiff = 2/N`. Para 5 kfs: 0.40. Zone divergence = 0.
- **L2 = 0.55 × D_curve + 0.05 × D_structural**
- D_curve: 2 kfs nuevos con diff ~0.30·span → `sumSq += 2×(0.30)² = 0.18`, count += 2 + existing. Para 5 kfs originales: `√(0.18/7) ≈ 0.16`
- **L2 ≈ 0.55×0.16 + 0.05×0.10 = 0.093** → **COMMON** (forzado por threshold 0.12)

### Por qué es conservador
- **Restricción gap > 300ms.** Solo inserta donde hay espacio vacío. Si el clip denso (gaps < 300ms), el operador retorna L2=0 sin hacer nada.
- **Bloques cortos y moderados.** Stutter 80-120ms es un corte breve. Peak +0.40·span es un spike moderado. Breath -0.30·span es una depresión suave.
- **Restauración al valor interpolado.** El bloque es un "paréntesis" — vuelve al valor original. No reescribe la curva.
- **Solo 1 gap por invocación.** No hay multi-splice.

### Cómo hacerlo operar de verdad
1. **Reducir threshold a 150ms.** Permitir inserción en gaps más pequeños — más oportunidades.
2. **Multi-splice con `chaos`:** Con probabilidad `chaos`, insertar 2-3 bloques en gaps diferentes simultáneamente.
3. **Bloques extremos con Pareto:** `blockValue = fatRng.samplePareto(0.3, 2.0)` — occasionalmente un bloque con valor extremo (0.0 o 1.0).
4. **No restaurar al interpolado:** Con probabilidad `chaos`, el keyframe final restaura a un valor *diferente* del interpolado — el bloque deja huella permanente.

---

## 6. ADAPTIVE PRUNING — El conserje

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\genesis\operators\GeneticOperators.ts" lines="1220-1358" />

### Cómo opera
1. **Busca tracks muertos:** `max - min < 0.05` en valores de keyframes. Tracks protegidos (`intensity`, `color`, `pan`, `tilt`) requieren `variance = 0.00` exacto.
2. **Protección de zona (WAVE 7165):** No poda si es el único track cubriendo un `(paramId, zone)`.
3. **Si hay tracks muertos:** Elimina uno. DNA drift: `chaos -0.040, organicity +0.030`.
4. **Si no hay tracks muertos:** Busca keyframes redundantes (3 consecutivos con `variance < 0.05`). Elimina uno.
5. **Si no hay nada que podar:** L2 = 0, no hace nada.

### L2 producido
- Track deletion: `D_structural` = `0.45 × (1/N)`. Para 6 tracks: 0.075. Zone divergence = 0.
- `D_curve`: Track eliminado → `sumSq += 1.0` por kf perdido.
- **L2 = 0.55 × D_curve + 0.05 × D_structural**
- Para 6 tracks, eliminar 1 con 3 kfs: `D_curve ≈ √(1.0×3 / (6+3)) ≈ 0.577`, `D_structural ≈ 0.075`
- **L2 ≈ 0.55×0.577 + 0.05×0.075 = 0.321** → **LEGENDARY** (post-7528)

### Por qué es conservador (a pesar del L2 alto)
- **Solo poda si el track está muerto.** Un track con `variance = 0.06` (casi plano) no se poda. El threshold 0.05 es muy estricto.
- **Solo poda 1 elemento por invocación.**
- **Roulette weight = 0.05.** Es el operador menos seleccionado — 5% de las mutaciones.

### Veredicto
Adaptive pruning es el operador **menos conservador en L2** (porque eliminar tracks produce D_curve alto) pero el **más raro en selección**. Es un conserje eficiente pero subutilizado.

### Cómo hacerlo operar de verdad
1. **Aumentar roulette weight a 0.10.** La poda es esencial para evitar acumulación de tracks muertos.
2. **Threshold adaptativo:** `threshold = 0.05 + 0.10 × chaos` — a mayor chaos, más agresivo el umbral de poda.
3. **Poda multi-elemento con `chaos`:** Con probabilidad `chaos`, eliminar 2-3 tracks muertos en una invocación.

---

## 7. CURVE ADAPTATION — El interpolador

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\genesis\operators\GeneticOperators.ts" lines="1369-1472" />

### Cómo opera
1. **Pick track con ≥2 keyframes.** Excluye último kf (interp define transición al siguiente).
2. **DNA-driven target:**
   - `organicity > 0.5` → `bezier`
   - `aggression > 0.5 || chaos > 0.5` → `hold`
   - Fallback → `linear`
3. **Si el target es igual al actual:** L2 = 0, no hace nada.
4. **Si cambia a bezier:** Asigna handles de un preset aleatorio.
5. **Si sale de bezier:** Elimina handles.
6. **DNA drift:** bezier → `organicity +0.040`. hold → `chaos +0.030, aggression +0.020`.

### L2 producido
- `D_curve`: Cambiar interpolación no cambia valores → **D_curve = 0** (excepto handles bezier, que solo cuentan si ambos los tienen).
- `D_phase = 0` (no toca phaseConfig).
- `D_structural`: `interpRatio = 1/comparedTracks`. Para 6 tracks: 0.167. `D_structural = 0.10 × 0.167 = 0.017`.
- **L2 = 0.05 × 0.017 = 0.0008** → **COMMON** (score ≈ 0)

### ⚠️ PROBLEMA: L2 prácticamente 0
Cambiar interpolación es un cambio **visualmente significativo** (linear → hold cambia completamente el carácter del movimiento), pero el L2 lo mide como **casi cero**. El peso D_structural = 0.05 con solo `interpRatio` como contribución hace que este operador sea invisible al sistema evolutivo.

### Cómo hacerlo operar de verdad
1. **FIX:** Añadir `D_interp` a `computeL2DistanceV2`:
   ```
   D_interp = (interpChanges / comparedTracks) × bezierHandleDelta
   ```
   Donde `bezierHandleDelta` mide la diferencia en handles si se añaden/cambian.
2. **Perturbar handles bezier:** Cuando el target es `bezier` y ya era `bezier`, no retornar L2=0 — perturbar los handles con `sampleCauchy(0.05, 0.20)`.
3. **Aumentar peso D_structural a 0.10** o crear `D_interp` con peso 0.10.

---

## 8. CROSSOVER — La reproducción sexual

<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\genesis\operators\GeneticOperators.ts" lines="1611-1681" />

### Cómo opera
1. **Dominancia por fitness:** El padre con mayor fitness es el dominante.
2. **Merge de tracks:** Todos los tracks del dominante se heredan. Los tracks del sumiso se añaden solo si su `(paramId, zones)` no está ya presente.
3. **`durationMs`:** Promedio de ambos padres.
4. **`spatialZones`:** Unión de ambos.
5. **`cognitiveDNA`:** `blendCognitiveDNA()` — genome 70/30 dominante/sumiso, listas unionadas, rangos promediados (anti-inflación).
6. **L2 = min(dist to A, dist to B)** — regla conservadora.

### L2 producido
- Depende de cuántos tracks del sumiso se añadan y cuánto difieran los padres.
- Si los padres son de especies diferentes (tracks muy distintos): L2 puede ser 0.20-0.40.
- Si son de la misma especie: L2 ≈ 0.05-0.15.
- **L2 = min()** significa que si el hijo se parece más a un padre, la distancia al otro no cuenta.

### Por qué es el mejor operador
- **Es el único que combina material genético de dos fuentes.** Todos los demás son mutaciones de un solo padre.
- **`blendCognitiveDNA` es anti-inflación:** Los rangos se promedian, no se outer-envelopean.
- **G4 pre-screening:** Si la unión de energyZone span > 2, colapsa al dominante — evita organismos sin coherencia energética.
- **`operatorWeight = 0.85`** — el más alto en la tabla de rareza.

### Limitaciones
- **Merge es todo-o-nada por track.** No hay recombina a nivel de keyframe — no puedes tomar la primera mitad de un track del padre A y la segunda del padre B.
- **L2 = min() es demasiado conservador.** Un hijo que hereda 3 tracks nuevos del sumiso pero se parece al dominante en el resto tiene L2 bajo, aunque sea genéticamente novel.

### Cómo hacerlo operar de verdad
1. **Recombina a nivel de keyframe:** Para tracks con el mismo `paramId` en ambos padres, hacer crossover de keyframes — tomar los primeros K del dominante y los últimos N-K del sumiso.
2. **L2 = max() en lugar de min():** O `L2 = (l2A + l2B) / 2` — el hijo es novel respecto a ambos padres.
3. **Más invocaciones:** El crossover está fuera de la roulette — solo se llama vía `spawnHybrid()`. Integrarlo en la roulette con peso 0.10 permitiría reproducción sexual automática.

---

## ANÁLISIS TRANSVERSAL: LOS 3 PROBLEMAS ESTRUCTURALES

### Problema A: `computeL2DistanceV2` no mide tiempo ni interpolación

La fórmula actual:
```
L2 = 0.55·D_curve + 0.40·D_phase + 0.05·D_structural
```

| Espacio | Qué mide | Qué NO mide |
|---------|----------|-------------|
| D_curve (55%) | Valores de keyframes normalizados | — |
| D_phase (40%) | `phaseConfig` (spread, wings, shuffle, blocks, direction, symmetry) | — |
| D_structural (5%) | Track count, kf count, interp changes, zone divergence | — |
| **AUSENTE** | — | **`durationMs`** — cambios temporales globales |
| **AUSENTE** | — | **Posiciones temporales de keyframes** — desplazamientos no uniformes |
| **AUSENTE** | — | **Handles bezier** — solo se miden si ambos kfs los tienen |

**Consecuencia:** `proportional_stretch` produce L2=0. `curve_adaptation` produce L2≈0. El sistema evolutivo es ciego a dos dimensiones enteras de variación.

**Fix propuesto:**
```
L2 = 0.40·D_curve + 0.25·D_phase + 0.15·D_temporal + 0.10·D_interp + 0.10·D_structural
```

Donde:
- `D_temporal = |log(child.durationMs / parent.durationMs)| / log(4)` + RMSE de desplazamientos temporales de keyframes
- `D_interp = (interpChanges / comparedTracks)` + delta de handles bezier

### Problema B: Magnitudes uniformes, sin cola pesada

Todos los operadores usan `rng()` uniforme para magnitudes:

| Operador | Magnitud | Distribución |
|----------|----------|--------------|
| focal_mutation | shift 0.20-0.40·span | Uniforme |
| macro_splice | block 80-500ms | Uniforme |
| gene_augmentation | values 0.2-0.9·span | Uniforme |
| spatial_resonance | spreadDeg 90-360 | Uniforme |

**Sin cola pesada = sin equilibrio puntuado.** La teoría de Eldredge & Gould dice que la evolución procede por saltos raros separados por estasis. Con distribución uniforme, todas las mutaciones son moderadas — nunca hay saltos grandes.

**Fix:** `makeFatTailedRng` ya existe (<ref_snippet file="C:\Users\Raulacate\Desktop\Proyectos programacion\LuxSync\electron-app\src\core\genesis\operators\GeneticOperators.ts" lines="318-332" />) pero no se usa. Conectarla:

```typescript
const rng = makeRng(seed)
const fatRng = makeFatTailedRng(rng)

// En focal_mutation:
const shiftMagnitude = Math.abs(fatRng.sampleCauchy(0.15, 0.80))
// 90% de las veces: ~0.15 (perceptible, conservador)
// 9% de las veces: 0.30-0.50 (moderado)
// 1% de las veces: 0.60-0.80 (salto grande — cruzar valle de aptitud)
```

### Problema C: DNA drift acumula demasiado lentamente

| Operador | Drift máximo por invocación |
|----------|----------------------------|
| focal_mutation | +0.020 aggression, +0.020 chaos |
| spatial_resonance | +0.050 chaos, -0.040 chaos |
| macro_splice | +0.060 aggression |
| gene_augmentation | +0.150 aggression (strobe) |
| proportional_stretch | +0.060 organicity |
| curve_adaptation | +0.040 organicity |
| adaptive_pruning | -0.040 chaos |

Para que el genoma pase de `aggression=0.5` a `aggression=0.8` con `focal_mutation` solitario: **15 generaciones**. El genoma es inerte en horizontes cortos.

**Fix:** Escalar drift con `chaos`:
```typescript
const driftScale = 1 + 2 * chaos  // chaos=0.5 → ×2, chaos=1.0 → ×3
newAggression = clamp3(genome.aggression + 0.020 * driftScale, 0, 1)
```

---

## RESUMEN: CÓMO HACER QUE OPEREN DE VERDAD

### Quick wins (bajo coste, alto impacto)

1. **FIX D_temporal en L2** — `proportional_stretch` deja de ser invisible. Coste: 20 líneas en `computeL2DistanceV2`.
2. **Activar `makeFatTailedRng` en `focal_mutation`** — saltos raros ocasionales. Coste: 3 líneas.
3. **Reducir gap threshold de `macro_splice` a 150ms** — más oportunidades de inserción. Coste: 1 línea.
4. **Aumentar roulette weight de `adaptive_pruning` a 0.10** — más limpieza. Coste: 1 línea.

### Medium wins (coste medio, impacto estructural)

5. **FIX D_interp en L2** — `curve_adaptation` deja de ser invisible. Coste: 15 líneas.
6. **Rebalancear pesos L2** a `0.40/0.25/0.15/0.10/0.10`. Coste: 1 línea + 2 funciones.
7. **Mutación multipunto en `focal_mutation`** — escalar con `chaos`. Coste: 10 líneas.
8. **DNA drift escalado con `chaos`** — evolución genómica más rápida. Coste: 5 líneas por operador.
9. **Implementar los 3 operadores fantasma** (`hue_drift`, `context_drift`, `transposition`) o eliminarlos del tipo. Coste: 50-100 líneas cada uno, o 5 líneas para eliminar.

### Big wins (coste alto, impacto transformacional)

10. **Recombina a nivel de keyframe en `crossover`** — mezcla real de material genético. Coste: 30 líneas.
11. **`macro_splice` multi-bloque con `chaos`** — inserciones múltiples simultáneas. Coste: 20 líneas.
12. **`gene_augmentation` con keyframes alineados al compás** — estructura musical real. Coste: 30 líneas + acceso a BPM.
13. **Cauchy en todos los operadores de magnitud** — equilibrio puntuado global. Coste: 5 líneas por operador.

---

**Veredicto final:** Los operadores están bien diseñados arquitectónicamente — son puros, deterministas, reproducibles, y el drift lamarckiano es conceptualmente correcto. Pero están **amordazados** por tres cadenas: (1) L2 ciego a tiempo e interpolación, (2) magnitudes uniformes sin cola pesada, (3) DNA drift glacial. Quítalas y el motor evolutivo se enciende.