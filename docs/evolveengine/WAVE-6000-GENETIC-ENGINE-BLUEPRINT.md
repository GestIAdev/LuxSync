# WAVE 6000 — BLUEPRINT ARQUITECTÓNICO
## Refactor del Motor Genético Selene: Varianza Salvaje, Reescritura Estructural y Reproducción Sexual

**Rol:** Chief AI Researcher & Evolutionary Algorithms Architect
**Proyecto:** LuxSync — Genesis Selene Matrix (GSM)
**Documento de referencia:** `@/docs/evolveengine/WAVE-5000V3-FORENSIC-AUDIT.md`
**Estado:** DISEÑO — pseudo-código y fórmulas, no implementación final.

---

## 0. DIAGNÓSTICO HEREDADO (resumen del audit WAVE 5000.V3)

1. `computeL2Distance` es ciega a `phaseConfig` → `phase_epigenetics` reporta `L2 = 0.0000` siempre.
2. `pointMutation` solo puede tocar `value` (siempre) y 1 `bezierHandle` (50%) de **1 keyframe de 1 track**. Magnitud fija 2-8% uniforme.
3. No existe reescritura estructural real: no se pueden insertar/eliminar keyframes, no se puede mover `timeMs`, no se puede cambiar `interpolation`.
4. 6 de 9 operadores declarados (`hue_drift`, `gene_deletion`, `crossover`, `temporal_stretch`, `context_drift`, `transposition`) no tienen implementación.
5. El RNG es un LCG plano — sin colas pesadas, sin eventos raros de innovación radical.

Este blueprint ataca los 3 pilares pedidos, ordenados en **fases de ejecución** para que el equipo GLM pueda implementar de forma incremental sin romper el pipeline vivo (`ColiseumService.spawnOrganism`).

---

# PILAR 1 — EL FIX SENSORIAL: `computeL2Distance` V2

## 1.1 Problema de fondo

La distancia actual solo mide el espacio **fenotípico-temporal** (curvas). Ignora el espacio **fenotípico-espacial** (`phaseConfig`) y el espacio **estructural** (conteo de tracks/keyframes). Un organismo puede ser radicalmente distinto en cómo se despliega en el rig físico (choreography) y aun así reportar distancia cero.

## 1.2 Rediseño: Distancia Compuesta Multi-Espacio

Se propone descomponer la distancia total en **3 sub-métricas independientes**, cada una normalizada a `[0, 1]`, combinadas con pesos configurables:

```
L2_total = w_curve · D_curve + w_phase · D_phase + w_structural · D_structural

donde:  w_curve + w_phase + w_structural = 1.0
        pesos sugeridos: w_curve = 0.45, w_phase = 0.35, w_structural = 0.20
```

### 1.2.1 `D_curve` (heredada, sin cambios en su núcleo)

Mantiene la fórmula RMSE actual sobre `value` y `bezierHandles`, pero se normaliza dividiendo por el span del rango en vez de usar el valor crudo:

```
Para cada keyframe comparado:
  diffNorm = (child.value - parent.value) / (range[1] - range[0])
  sumSq += diffNorm²

D_curve = sqrt(sumSq / count)   →  ya está en escala relativa [0, ~1]
```
**Cambio clave respecto a hoy:** normalizar por `span` para que un track de pan (span=270) y uno de intensidad (span=1) contribuyan comparablemente. Hoy `diff` es absoluto → un track de pan domina artificialmente el score.

### 1.2.2 `D_phase` — NUEVO: distancia epigenética espacial

Compara `PhaseConfigPro` campo por campo, cada uno normalizado a su rango canónico:

```typescript
function phaseFieldDistance(parent: PhaseConfigPro, child: PhaseConfigPro): number {
  const dSpread    = Math.abs(child.spreadDeg - parent.spreadDeg) / 1440        // rango [0,1440]
  const dWings     = Math.abs(child.wings - parent.wings) / 8                   // rango [1,8]
  const dShuffle   = Math.abs(child.shuffle - parent.shuffle)                   // ya [0,1]
  const dBlocks    = Math.abs(child.blocks - parent.blocks) / 16                // rango [1,16]
  const dDirection = child.direction !== parent.direction ? 1 : 0               // binario
  const dSymmetry  = child.symmetry !== parent.symmetry ? 1 : 0                 // categórico

  // RMS ponderado — spreadDeg y wings pesan más (impacto visual mayor)
  const weights = [0.30, 0.25, 0.15, 0.15, 0.10, 0.05]
  const diffs   = [dSpread, dWings, dShuffle, dBlocks, dDirection, dSymmetry]

  return Math.sqrt(
    diffs.reduce((sum, d, i) => sum + weights[i] * d * d, 0)
  )
}
```

Luego, para el clip completo:

```
D_phase = mean( phaseFieldDistance(parentTrack[t].phaseConfig ?? DEFAULT, childTrack[t].phaseConfig ?? DEFAULT) )
          para todo t en tracks comunes
```

Si un track no tiene `phaseConfig` en ninguno de los dos lados, se usa `DEFAULT_PHASE_CONFIG_PRO` como base — así una mutación que **crea** `phaseConfig` desde cero también cuenta como divergencia real.

### 1.2.3 `D_structural` — NUEVO: distancia de topología

Mide cambios de **forma** del genoma, no de valores:

```typescript
function structuralDistance(parent: HephAutomationClipV3, child: HephAutomationClipV3): number {
  const trackCountDiff = Math.abs(child.tracks.length - parent.tracks.length) / Math.max(parent.tracks.length, 1)

  let keyframeCountDiffSum = 0
  let interpolationChanges = 0
  let comparedTracks = 0

  const maxT = Math.max(parent.tracks.length, child.tracks.length)
  for (let t = 0; t < maxT; t++) {
    const pt = parent.tracks[t]
    const ct = child.tracks[t]
    if (!pt || !ct) continue  // ya contado en trackCountDiff
    comparedTracks++

    const kfDiff = Math.abs(ct.curve.keyframes.length - pt.curve.keyframes.length)
    keyframeCountDiffSum += kfDiff / Math.max(pt.curve.keyframes.length, 1)

    const minKf = Math.min(pt.curve.keyframes.length, ct.curve.keyframes.length)
    for (let k = 0; k < minKf; k++) {
      if (pt.curve.keyframes[k].interpolation !== ct.curve.keyframes[k].interpolation) {
        interpolationChanges++
      }
    }
  }

  const avgKfDiff = comparedTracks > 0 ? keyframeCountDiffSum / comparedTracks : 0
  const interpRatio = comparedTracks > 0 ? interpolationChanges / comparedTracks : 0

  return clamp01(0.5 * trackCountDiff + 0.35 * avgKfDiff + 0.15 * interpRatio)
}
```

## 1.3 Impacto esperado en `RarityEngine`

Con este fix:
- `phase_epigenetics` deja de reportar `L2 = 0` — ahora `D_phase` captura su divergencia real, típicamente en el rango `[0.05, 0.25]`.
- `gene_splice`/`gene_deletion` (Pilar 2) activan `D_structural`, dándoles rareza intrínseca alta incluso con `D_curve` bajo.
- El `sigmaNorm = clamp01(L2 / DRIFT_MAX)` seguirá funcionando igual, pero `DRIFT_MAX` (hoy 0.35) debe recalibrarse empíricamente tras el cambio — sugerido: correr un Monte Carlo de 1000 mutaciones sintéticas y fijar `DRIFT_MAX` en el percentil 90 observado.

## 1.4 Migración de datos existentes

Los organismos ya nacidos con `l2_distance_parent = 0.0000` bajo la fórmula vieja **no deben re-taggearse retroactivamente** (romperían el histórico de fitness/trials). Se sugiere:
- Añadir columna `l2_distance_schema_version INTEGER DEFAULT 1` a `lfx_organisms`.
- Nuevos organismos usan `computeL2Distance` V2 → `schema_version = 2`.
- El `RarityEngine` y la UI pueden mostrar un badge "⚠️ legacy metric" en organismos `schema_version = 1`.

---

# PILAR 2 — REDISEÑO DE MUTÁGENOS: VARIANZA SALVAJE

## 2.1 De RNG plano a distribución de colas pesadas

**Problema actual:** `magnitude = 0.02 + rng() * 0.06` es una distribución **uniforme acotada**. Nunca hay sorpresas: el máximo posible es 8%, siempre.

**Propuesta:** Sustituir el muestreo de magnitud por una **distribución de Cauchy truncada** (o alternativamente Pareto), que produce:
- Mayoría de eventos **pequeños** (más pequeños que el uniforme actual, ej. 0.5-3%).
- Una **cola larga** de eventos raros pero posibles de magnitud extrema (30%, 80%, incluso saturación total).

### 2.1.1 Fórmula: Cauchy truncada

La distribución de Cauchy estándar tiene función de cuantil (inversa de CDF):

```
Cauchy_inverse(p, x0, γ) = x0 + γ · tan(π · (p − 0.5))

donde:
  p   = rng() ∈ (0, 1)          — muestra uniforme
  x0  = 0                       — centrado en cero (mutación puede ir en cualquier dirección)
  γ   = SCALE_PARAM              — controla la "anchura" del cuerpo central
```

Pseudo-código de generación de magnitud:

```typescript
function sampleFatTailedMagnitude(rng: () => number, scale: number, maxAbs: number): number {
  const p = rng()
  // Evitar p exactamente 0 o 1 (tan(±π/2) = ±Infinity)
  const pClamped = clamp(p, 1e-6, 1 - 1e-6)
  const raw = scale * Math.tan(Math.PI * (pClamped - 0.5))
  // Truncar colas infinitas a un máximo absoluto razonable
  return clamp(raw, -maxAbs, maxAbs)
}
```

**Parámetros sugeridos para `pointMutation`:**
```
scale  = 0.02   (γ pequeño → cuerpo central concentrado en ±2-4%)
maxAbs = 0.60   (permite hasta 60% de salto en eventos de cola — "latigazo mutacional")
```

Esto produce empíricamente (simulación mental):
- ~68% de las mutaciones caen en `|magnitude| < 0.03` (más conservador que el 2-8% actual).
- ~5% caen en `|magnitude| > 0.15` (imposible hoy).
- ~0.5% caen en `|magnitude| > 0.40` — **eventos de innovación radical** ("Black Swan mutations").

### 2.1.2 Alternativa: Pareto (para eventos estrictamente positivos, ej. `spreadDeg`, `wings`)

Para campos donde la magnitud del cambio no tiene signo natural (ej. cuánto crece `spreadDeg`), usar Pareto:

```
Pareto_inverse(p, x_m, α) = x_m / (1 − p)^(1/α)

donde:
  x_m = valor mínimo (escala base, ej. 1.0)
  α   = índice de cola (menor α = cola MÁS pesada). Sugerido α = 1.5-2.5
```

```typescript
function samplePareto(rng: () => number, xm: number, alpha: number): number {
  const p = clamp(rng(), 0, 1 - 1e-9)
  return xm / Math.pow(1 - p, 1 / alpha)
}
```

### 2.1.3 Clasificación de eventos por magnitud (para logging/telemetría)

```
|magnitude| < 0.05         → "MICRO"     (deriva genética silenciosa)
0.05 ≤ |magnitude| < 0.15  → "STANDARD"  (mutación típica, equivalente al sistema actual)
0.15 ≤ |magnitude| < 0.40  → "MAJOR"     (salto notable, candidato a RARE/EPIC)
|magnitude| ≥ 0.40         → "CATACLYSMIC" (innovación radical, candidato a LEGENDARY/MYTHIC)
```

Esta clasificación puede loguearse en `bezier_signature`/telemetría y alimentar directamente el `operatorWeight` del RarityEngine (un operador que produjo un evento CATACLYSMIC debería boostear su score de rareza independientemente del L2 puro).

## 2.2 Nuevos Operadores Estructurales (JSON Patch)

Todos siguen la firma pura existente: `(parent: HephAutomationClipV3, seed?: number) → OperatorResult`.

### 2.2.1 `temporal_stretch` — Expansión/Compresión Temporal

**Objetivo:** Estirar o comprimir el eje `timeMs` de todos los keyframes de una curva (o del clip completo), preservando el orden relativo y el valor `y`.

**Algoritmo:**
```
1. factor = sampleFatTailedMagnitude(rng, scale=0.15, maxAbs=0.90) + 1.0
   → factor típico ∈ [0.7, 1.3], eventos raros hasta [0.1, 1.9]
   → factor < 1.0 = compresión (efecto se acelera)
   → factor > 1.0 = expansión (efecto se ralentiza)

2. Elegir target: track individual (70% prob) o clip completo (30% prob, afecta durationMs)

3. Para cada keyframe k en el track/clip objetivo:
     newTimeMs = clamp(round(kf.timeMs * factor), 0, durationMs_efectivo)

4. Re-ordenar keyframes por timeMs ascendente si el factor invirtió algún orden
   (edge case: factor negativo no permitido, factor ∈ (0, ∞) siempre)

5. Si target == clip completo: child.durationMs = round(parent.durationMs * factor)
```

**Delta JSON Patch:**
```json
[
  { "op": "replace", "path": "/tracks/2/curve/keyframes/0/timeMs", "value": 0 },
  { "op": "replace", "path": "/tracks/2/curve/keyframes/1/timeMs", "value": 650 },
  { "op": "replace", "path": "/tracks/2/curve/keyframes/2/timeMs", "value": 1300 }
]
```

**Contribución a `D_structural`:** Baja (no cambia count de keyframes ni interpolación) pero SÍ debe capturarse en `D_curve` vía un nuevo componente temporal:
```
D_temporal = mean(|child.kf[k].timeMs - parent.kf[k].timeMs| / durationMs) sobre keyframes comunes
```
Sugerido añadir este componente a `D_curve` con peso propio (`w_curve` se subdivide en `w_value=0.7, w_temporal=0.3` internamente).

---

### 2.2.2 `gene_splice` — Inserción de Keyframes Intermedios

**Objetivo:** Insertar 1-3 nuevos keyframes entre dos existentes, con valores interpolados + ruido, creando nueva "textura" temporal sin romper los anclajes existentes.

**Algoritmo:**
```
1. Elegir track numérico al azar (igual que pointMutation)
2. Elegir un GAP al azar entre kf[i] y kf[i+1] (requiere ≥2 keyframes existentes)
3. numInserts = 1 + floor(rng() * 3)   →  1 a 3 nuevos keyframes en ese gap

4. Para cada nuevo keyframe j en 1..numInserts:
     tFraction = j / (numInserts + 1)                     // posición relativa en el gap
     baseTimeMs = lerp(kf[i].timeMs, kf[i+1].timeMs, tFraction)
     baseValue  = lerp(kf[i].value, kf[i+1].value, tFraction)   // interpolación lineal base

     // Inyectar varianza salvaje sobre el valor base (no solo copiar la línea recta)
     noiseMagnitude = sampleFatTailedMagnitude(rng, scale=0.04, maxAbs=0.5)
     newValue = clamp(baseValue + noiseMagnitude * span, range[0], range[1])

     newInterpolation = pickRandom(['bezier', 'linear', 'step'], weights=[0.6, 0.3, 0.1])
     newBezierHandles = newInterpolation === 'bezier' ? randomEaseCurve(rng) : undefined

     insert { timeMs: baseTimeMs, value: newValue, interpolation: newInterpolation, bezierHandles: newBezierHandles }
       en la posición correcta del array keyframes (mantener orden ascendente)

5. Emitir delta como operación 'add' en el índice correcto:
     { op: 'add', path: `/tracks/${t}/curve/keyframes/${insertIdx}`, value: newKeyframe }
```

**Nota de implementación:** El `applyDelta` actual solo soporta `add` como *push al final* (`/tracks/-`) o *asignación directa por índice* (`cursor[lastKey] = op.value`, que SOBRESCRIBE en vez de insertar). Esto es un **gap de infraestructura** que debe resolverse en Fase 1 de ejecución (ver sección 4) — se necesita soporte de `splice(index, 0, value)` para inserciones verdaderas dentro de arrays en `applyDelta`.

**Contribución a rareza:** Activa `D_structural` (crece `keyframes.length`) — debería tener `operatorWeight` alto en `RarityEngine` (sugerido 0.60, similar a `gene_duplication`).

---

### 2.2.3 `gene_deletion` — Eliminación de Keyframes o Tracks

**Objetivo:** Simular pérdida genética — el operador opuesto y complementario a `gene_splice`/`gene_duplication`.

**Algoritmo (dos modos, elegidos por probabilidad):**

```
modo = rng() < 0.7 ? 'keyframe' : 'track'    // eliminar keyframe es más común que eliminar track completo

SI modo === 'keyframe':
  1. Elegir track con curve.keyframes.length >= 3   (nunca dejar <2 keyframes — invariante HephCurve)
  2. Elegir keyframe al azar EXCLUYENDO el primero y el último (preservar anclas inicio/fin)
  3. Eliminar ese keyframe → delta: { op: 'remove', path: `/tracks/${t}/curve/keyframes/${k}` }

SI modo === 'track':
  1. Requiere clip.tracks.length >= 2   (G5 prenatal exige al menos 1 track con ≥2 keyframes tras la deleción)
  2. Elegir track al azar que NO sea el único track con paramId === 'intensity'
     (proteger el canal de intensidad — es semánticamente crítico, G5 lo valida)
  3. Eliminar ese track → delta: { op: 'remove', path: `/tracks/${t}` }
```

**Guard de viabilidad (pre-screening dentro del operador):**
```
Antes de aplicar la deleción, verificar:
  - Si modo === 'keyframe': track.curve.keyframes.length - 1 >= 2
  - Si modo === 'track': clip.tracks.length - 1 >= 1 AND queda ≥1 track con paramId='intensity'
Si el guard falla → fallback automático a modo alternativo, o abortar con delta vacío (igual que hoy en pointMutation cuando numericTracks.length === 0)
```

**Contribución a rareza:** Máxima contribución a `D_structural` (reduce topología). `operatorWeight` sugerido: 0.55.

---

### 2.2.4 `interpolation_drift` — Mutación del Tipo de Curva

**Objetivo:** Cambiar CÓMO se interpola entre dos keyframes sin tocar sus valores — mutación puramente "estilística" pero con alto impacto visual (un `step` se ve completamente distinto a un `bezier` suave).

**Algoritmo:**
```
1. Elegir track y keyframe al azar (cualquier keyframe excepto el último — interpolation define transición HACIA el siguiente)

2. Matriz de transición de estados (Markov chain simplificada):
     bezier → linear   : 30%
     bezier → step     : 15%
     bezier → bezier (nuevos handles) : 55%
     linear → bezier   : 50%
     linear → step     : 20%
     linear → linear (no-op, re-roll) : 30%
     step   → bezier   : 40%
     step   → linear   : 40%
     step   → step (no-op, re-roll)   : 20%

3. Si el nuevo estado === estado actual → re-samplear una vez (evitar mutaciones vacías)

4. Si newInterpolation === 'bezier':
     newHandles = perturbar handles existentes (si los había) con sampleFatTailedMagnitude(scale=0.03)
                  O generar preset aleatorio (ease-in/out/in-out/overshoot/bounce/snap) si no había bezier antes

5. delta:
   { op: 'replace', path: `/tracks/${t}/curve/keyframes/${k}/interpolation`, value: newInterpolation }
   + (si aplica) { op: 'replace', path: `.../bezierHandles`, value: newHandles }
   + (si se remueven handles al pasar a linear/step) { op: 'remove', path: `.../bezierHandles` }
```

**Contribución a rareza:** Contribuye a `D_structural.interpRatio`. `operatorWeight` sugerido: 0.25 (es más sutil que splice/deletion pero más que point_mutation).

## 2.3 Tabla resumen de nuevos `OPERATOR_WEIGHTS`

| Operador | Weight actual | Weight propuesto | Justificación |
|---|---|---|---|
| `point_mutation` | 0.15 | 0.15 (sin cambio, pero ahora con cola pesada) | Sigue siendo el "ruido de fondo" |
| `phase_epigenetics` | 0.15 | 0.20 | Ahora medible correctamente vía `D_phase` |
| `gene_duplication` | 0.50 | 0.50 (sin cambio) | Ya adecuado |
| `gene_deletion` | — | **0.55** | Pérdida estructural = alta divergencia |
| `temporal_stretch` | — | **0.35** | Cambia ritmo sin cambiar forma — moderado |
| `gene_splice` | — (nuevo, no listado en tipo actual) | **0.60** | Mayor divergencia estructural posible |
| `interpolation_drift` | — (nuevo, no listado en tipo actual) | **0.25** | Estilístico, impacto visual medio |
| `crossover` | 0.85 | 0.85 (sin cambio) | Ver Pilar 3 |
| `context_drift` | 0.65 | 0.65 (sin cambio, fuera de alcance de este blueprint) | Pendiente diseño futuro |

**Nota de tipos:** `gene_splice` e `interpolation_drift` no existen en el union type `MutationOperator` (`@/electron-app/src/core/genesis/types.ts:17-26`). Deben añadirse en Fase 1 de ejecución.

---

# PILAR 3 — REPRODUCCIÓN SEXUAL: `crossover`

## 3.1 Concepto: Cruce por Dominios Semánticos

A diferencia de la mutación asexual (1 padre → 1 hijo con ruido), el `crossover` combina **dos organismos CHAMPION** en un híbrido que hereda subsistemas completos de cada padre. La clave del diseño: **no mezclar genes al azar bit-a-bit** (produciría basura incoherente), sino cruzar por **dominios funcionales completos** — el genoma de Selene ya está naturalmente segmentado en tracks por `paramId`, lo cual es un cromosoma natural.

## 3.2 Selección de Padres

```
Precondición: ambos organismos deben tener status === 'champion'
              (garantiza que ambos son fenotipos ya validados por fitness real, no basura genética)

Fase de selección (fuera del operador, en ColiseumService o un nuevo CrossoverArena):
  1. Query: SELECT * FROM lfx_organisms WHERE status = 'champion' ORDER BY fitness_score DESC
  2. Selección por torneo (tournament selection) en vez de random uniforme:
       - Tomar una muestra aleatoria de tamaño T=3 de los champions
       - El de mayor fitness_score de esa muestra gana → Padre A
       - Repetir independientemente para Padre B (permitir A === B se descarta, requiere A ≠ B)
  3. Materializar ambos clips completos vía OrganismMaterializer.materialize()
```

## 3.3 Algoritmo de Cruce — "Domain Crossover"

**Idea central citada por el usuario:** *"cruzar el track de intensidad del Padre A con la coreografía espacial del Padre B"*.

```
INPUT: parentA: HephAutomationClipV3, parentB: HephAutomationClipV3, seed

1. CLASIFICACIÓN DE DOMINIOS — agrupar tracks por "función":
   DOMAIN_TEMPORAL   = paramId ∈ {'intensity', 'color', 'strobe', 'strobeRate', 'zoom', 'focus'}
   DOMAIN_SPATIAL    = paramId ∈ {'pan', 'tilt'}  (incluye SIEMPRE su phaseConfig asociado)
   DOMAIN_PHASE_META = phaseConfig de CUALQUIER track (independiente del paramId)

2. HERENCIA POR DOMINIO (coin-flip ponderado, no 50/50 puro):
   heritanceRoll = rng()
   inheritTemporalFrom = heritanceRoll < 0.5 ? parentA : parentB
   heritanceRoll2 = rng()
   inheritSpatialFrom  = heritanceRoll2 < 0.5 ? parentA : parentB

   // Sesgo hacia diversidad: si ambos dominios cayeron en el mismo padre,
   // forzar re-roll para garantizar hibridación real (evitar clonar 1 padre)
   IF inheritTemporalFrom === inheritSpatialFrom:
     inheritSpatialFrom = (inheritSpatialFrom === parentA) ? parentB : parentA

3. CONSTRUCCIÓN DEL HÍBRIDO:
   child.tracks = []

   // 3a. Tomar tracks temporales del padre ganador de ese dominio
   FOR track OF inheritTemporalFrom.tracks WHERE track.paramId IN DOMAIN_TEMPORAL:
     child.tracks.push(deepClone(track))

   // 3b. Tomar tracks espaciales (pan/tilt) + su phaseConfig del padre ganador de ese dominio
   FOR track OF inheritSpatialFrom.tracks WHERE track.paramId IN DOMAIN_SPATIAL:
     child.tracks.push(deepClone(track))   // incluye phaseConfig completo, viaja junto

   // 3c. Metadata del clip: heredar de un padre elegido por fitness relativo (no 50/50)
   //     — el padre con mayor fitness_score dona más metadata (nombre base, DNA cognitiva)
   dominantParent = fitnessA >= fitnessB ? parentA : parentB
   child.cognitiveDNA = blendCognitiveDNA(parentA.cognitiveDNA, parentB.cognitiveDNA, dominantParent)
   child.durationMs   = Math.round((parentA.durationMs + parentB.durationMs) / 2)
   child.spatialZones = union(parentA.spatialZones, parentB.spatialZones)

4. RECONCILIACIÓN DE CONFLICTOS:
   // Si ambos padres tenían un track del MISMO paramId en el MISMO dominio ganador
   // (ej. dos tracks de 'color' en distintas zonas), NO se descartan — se fusionan
   // como tracks paralelos (multicelularidad ya soportada por el schema V3)
   Deduplicar solo si zones se solapan Y paramId es idéntico → en ese caso,
   quedarse con el del padre de mayor fitness para ese track específico.
```

### 3.3.1 `blendCognitiveDNA` — Mezcla del genoma cognitivo

```typescript
function blendCognitiveDNA(dnaA: CognitiveDNA, dnaB: CognitiveDNA, dominant: CognitiveDNA): CognitiveDNA {
  return {
    // Genome numérico: promedio ponderado hacia el dominante (60/40)
    genome: {
      aggression: 0.6 * dominant.genome.aggression + 0.4 * (dominant === dnaA ? dnaB : dnaA).genome.aggression,
      chaos:      0.6 * dominant.genome.chaos      + 0.4 * (dominant === dnaA ? dnaB : dnaA).genome.chaos,
      organicity: 0.6 * dominant.genome.organicity + 0.4 * (dominant === dnaA ? dnaB : dnaA).genome.organicity,
    },
    // Categóricos: heredar del dominante
    textureAffinity: dominant.textureAffinity,
    spatialBehavior: dominant.spatialBehavior,
    // Listas: UNIÓN (más compatibilidad = más oportunidades de fitness, la selección natural podará después)
    compatibleVibes: [...new Set([...dnaA.compatibleVibes, ...dnaB.compatibleVibes])],
    validSections:   [...new Set([...dnaA.validSections, ...dnaB.validSections])],
    // Rangos: envolvente (unión de rangos, más permisivo)
    energyZone: {
      min: minEnergyZone(dnaA.energyZone.min, dnaB.energyZone.min),
      max: maxEnergyZone(dnaA.energyZone.max, dnaB.energyZone.max),
    },
    aggressionRange: {
      min: Math.min(dnaA.aggressionRange.min, dnaB.aggressionRange.min),
      max: Math.max(dnaA.aggressionRange.max, dnaB.aggressionRange.max),
    },
  }
}
```

**Nota de seguridad G4:** La unión de `energyZone` puede violar el gate G4 (`zoneSpan > 2` = fail) si los padres cubren zonas muy separadas. El operador `crossover` debe ejecutar un **post-clamp**: si `zoneSpan(union) > 2`, colapsar al `energyZone` del `dominantParent` en vez de la unión. Esto se resuelve ANTES de entrar a `prenatalScreening`, evitando abortos innecesarios.

## 3.4 Delta JSON Patch para Crossover

A diferencia de los operadores de mutación (deltas incrementales pequeños), `crossover` produce un delta **estructuralmente distinto al padre de referencia** (`parentBlueprintId` en la DB sigue siendo el linaje de uno de los padres — sugerido: el `dominantParent`). El delta se calcula como un JSON Patch completo `replace` de `/tracks` en bloque:

```json
[
  { "op": "replace", "path": "/tracks", "value": [ /* array completo del child.tracks */ ] },
  { "op": "replace", "path": "/cognitiveDNA", "value": { /* blendCognitiveDNA result */ } }
]
```

**Decisión de linaje en DB:** Se propone añadir una columna `parent_organism_id_secondary TEXT NULL` a `lfx_organisms` para registrar AMBOS padres en cruces sexuales (hoy `parent_organism_id` solo soporta 1 padre — mitosis asexual). Esto es crítico para:
- Reconstrucción correcta en `OrganismMaterializer` (necesita resolver 2 linajes, no 1).
- Visualización del árbol genealógico en `LineageInspector.tsx` (mostrar ambos ancestros).

## 3.5 L2 Distance para Crossover

Como el hijo puede diferir radicalmente de AMBOS padres simultáneamente, se sugiere:

```
L2_crossover = min(
  computeL2DistanceV2(parentA, child),
  computeL2DistanceV2(parentB, child)
)
```

Usar el **mínimo** (no el promedio) porque representa "cuánto se alejó del padre más parecido" — es la medida más conservadora y evita inflar artificialmente la rareza combinando dos distancias grandes que en realidad reflejan la simple existencia de 2 padres distintos, no innovación real.

---

# 4. FASES DE EJECUCIÓN (Roadmap para GLM)

## FASE 1 — Infraestructura habilitante (prerrequisito de todo lo demás)
1. Extender `MutationOperator` type: añadir `'gene_splice'` e `'interpolation_drift'` al union.
2. Extender `applyDelta()` en `GeneticOperators.ts` para soportar **inserción verdadera en arrays** (`splice(index, 0, value)`), no solo push-al-final o sobrescritura por índice. Esto es OBLIGATORIO antes de implementar `gene_splice`.
3. Implementar `makeFatTailedRng()` — wrapper sobre el LCG existente (`makeRng`) que expone `sampleCauchy(scale, maxAbs)` y `samplePareto(xm, alpha)`.
4. Migración SQL: añadir columnas `l2_distance_schema_version INTEGER DEFAULT 1` y `parent_organism_id_secondary TEXT NULL` a `lfx_organisms`.

## FASE 2 — Fix Sensorial (Pilar 1)
1. Implementar `computeL2DistanceV2()` con las 3 sub-métricas (`D_curve`, `D_phase`, `D_structural`).
2. Correr Monte Carlo de recalibración de `DRIFT_MAX` (1000 mutaciones sintéticas por operador existente).
3. Actualizar `RarityEngine.computeRarity()` para usar V2 y loguear `schema_version = 2` en nuevos spawns.
4. Test de regresión: verificar que `phase_epigenetics` YA NO reporta `L2 = 0.0000`.

## FASE 3 — Varianza Salvaje en operadores existentes
1. Refactorizar `pointMutation()` para usar `sampleFatTailedMagnitude` en vez de `0.02 + rng()*0.06`.
2. Refactorizar `phaseEpigenetics()` para usar Cauchy/Pareto en sus 5 parámetros.
3. Añadir telemetría de clasificación de eventos (`MICRO`/`STANDARD`/`MAJOR`/`CATACLYSMIC`) — loguear en consola o nueva tabla `lfx_mutation_events` para análisis posterior.

## FASE 4 — Nuevos operadores estructurales
1. Implementar `temporal_stretch()`.
2. Implementar `gene_deletion()` (depende de Fase 1.2 para `remove` — ya soportado hoy, verificar).
3. Implementar `gene_splice()` (depende crítica de Fase 1.2 — inserción real).
4. Implementar `interpolation_drift()`.
5. Actualizar `applyOperator()` dispatcher con los 4 nuevos casos.
6. Actualizar `OPERATOR_WEIGHTS` en `RarityEngine.ts` con la tabla de la sección 2.3.
7. Tests unitarios por operador (siguiendo el patrón ya existente en `GeneticOperators.test.ts`: determinismo por seed, no-mutación del padre, delta válido, round-trip `applyDelta`).

## FASE 5 — Reproducción Sexual (Pilar 3)
1. Diseñar `CrossoverArena` (nuevo módulo) — encapsula selección por torneo de 2 champions.
2. Implementar `crossover(parentA, parentB, seed)` con el algoritmo de dominios (sección 3.3).
3. Implementar `blendCognitiveDNA()` con el post-clamp de G4.
4. Extender `ColiseumService.spawnOrganism()` (o crear `spawnHybrid()` dedicado) para aceptar 2 padres y escribir `parent_organism_id_secondary`.
5. Extender `OrganismMaterializer.materialize()` para resolver linaje dual (requiere lógica recursiva distinta — un crossover no tiene "1 padre + delta", tiene 2 padres + snapshot completo del child).
6. Extender `LineageInspector.tsx` para visualizar árbol genealógico con dos ramas ascendentes en nodos de tipo crossover.

## FASE 6 — Integración y Balanceo Final
1. Ajustar `LifecycleManager` — considerar si `crossover` requiere umbrales de promoción/culling distintos (un híbrido de 2 champions parte con expectativas más altas).
2. Ajustar frecuencia de invocación de cada operador en `ColiseumService` (hoy es un parámetro externo `operatorType` — definir una tabla de probabilidades de selección de operador por defecto, ponderada por diversidad deseada).
3. Auditoría final: correr el ecosistema en simulación acelerada (N generaciones) y verificar distribución de `rarity_tier` — el objetivo es una curva de rareza más sana (menos COMMON dominante, cola larga de EPIC/LEGENDARY genuinos).

---

# 5. IDEAS ADICIONALES (aportación propia — no solicitadas explícitamente pero relevantes)

## 5.1 "Mutación Catastrófica Controlada" — Safety Valve
Los eventos `CATACLYSMIC` (sección 2.1.3) pueden producir clips completamente rotos visualmente (aunque pasen `prenatalScreening`). Sugerido: cuando un operador produce un evento `CATACLYSMIC`, forzar automáticamente un `neonatalShield` extendido (multiplicar por 2x el shield normal) — le da al organismo "tiempo de prueba" extra antes de ser evaluado con el rigor normal, reconociendo que es un experimento de alto riesgo/alto valor.

## 5.2 Presión de Selección sobre el Propio Operador
Actualmente cada operador tiene un `operatorWeight` fijo en `RarityEngine`. Se propone un sistema de **meta-evolución**: trackear el `fitness_score` promedio de organismos agrupados por `operator_used` en una ventana móvil (últimas 100 generaciones). Si `gene_splice` produce sistemáticamente organismos con fitness bajo, reducir dinámicamente su probabilidad de ser elegido en `spawnOrganism` (sin eliminarlo — mantener exploración mínima vía epsilon-greedy, ej. 5% de probabilidad piso).

## 5.3 Distancia de Linaje Acumulada (Genealogical Drift)
Hoy `l2_distance_parent` solo mide distancia al padre inmediato. Para organismos de generación alta (G10+), esto oculta que múltiples mutaciones pequeñas acumuladas pueden producir un fenotipo muy distinto del ancestro de granito. Sugerido: añadir un campo derivado `l2_distance_ancestor` = distancia al `blueprintId` original (no al padre inmediato), calculado en background por `LifecycleManager` cuando evalúa transiciones. Esto permite detectar "linajes que se alejaron mucho silenciosamente" — candidatos naturales a canonización aunque cada salto individual pareciera modesto.
