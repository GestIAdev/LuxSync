# AUDITORÍA FORENSE — Genesis: Operadores Light + Mantis Estéril

> **Bug 1:** Los operadores apenas modifican keyframes — se ven "light".
> **Bug 2:** `color_hue_shift` nunca se selecciona (peso perdido).
> **Bug 3:** La reproducción sexual entre campeones no se produce.
> **Bug 4:** `evaluateFireEvent` (EMA + contexto + decaimiento temporal) es dead code.

---

## 1. DIAGNÓSTICO RAÍZ — Cuatro bugs

### 1.1 Bug A — `pickWeightedOperator` no normaliza: `color_hue_shift` NUNCA se selecciona

**Síntoma:** El operador `color_hue_shift` (peso 0.08, añadido en WAVE 7546)
nunca es seleccionado por la ruleta.

**Causa raíz:** `ColiseumService.ts:64-72`:

```typescript
function pickWeightedOperator(rng: () => number): MutationOperator {
  const r = rng()                    // r ∈ [0, 1)
  let acc = 0
  for (const [op, weight] of OPERATOR_WEIGHTS_ROULETTE) {
    acc += weight
    if (r < acc) return op
  }
  return OPERATOR_WEIGHTS_ROULETTE[0][0]
}
```

El comentario dice: *"Total still sums to 1.05 → normalized at runtime
by pickWeightedOperator (which divides by the cumulative sum)."*

**Pero el código NO divide por la suma acumulada.** Usa pesos crudos.

Los pesos totales: 0.18 + 0.15 + 0.15 + 0.17 + 0.13 + 0.12 + 0.10 + 0.08 = **1.08**

Como `rng()` devuelve `[0, 1)`, `r` siempre es `< 1.0`. La suma acumulada
llega a 1.00 en `adaptive_pruning` (índice 6). `color_hue_shift` empieza
en `acc = 1.00` — solo capturaría `r ∈ [1.00, 1.08)`, pero `r < 1.0`
siempre. **`color_hue_shift` es inalcanzable.**

| Operador | acc | Rango r | Probabilidad real |
|----------|-----|---------|:-----------------:|
| focal_mutation | 0.18 | [0, 0.18) | 18% |
| macro_splice | 0.33 | [0.18, 0.33) | 15% |
| proportional_stretch | 0.48 | [0.33, 0.48) | 15% |
| gene_augmentation | 0.65 | [0.48, 0.65) | 17% |
| spatial_resonance | 0.78 | [0.65, 0.78) | 13% |
| curve_adaptation | 0.90 | [0.78, 0.90) | 12% |
| adaptive_pruning | 1.00 | [0.90, 1.00) | 10% |
| **color_hue_shift** | 1.08 | **[1.00, 1.08)** | **0% — NUNCA** |

**Impacto:** El operador de evolución de paleta de color, diseñado para
"enable color palette evolution across generations", nunca se dispara.
Los organismos nunca mutan sus colores via este operador. La paleta
de color del ecosistema se estanca.

### 1.2 Bug B — Mitosis excluye champions (Mantis sin descendencia asexual)

**Síntoma:** Los champions no se reproducen asexualmente (mitosis).

**Causa raíz:** `ColiseumService.ts:754-760`:

```typescript
const candidates = db.prepare(
  `SELECT organism_id, blueprint_id, fitness_score, generation
   FROM lfx_organisms
   WHERE status = 'alive'                    -- ← EXCLUYE champions
     AND fitness_score >= ${MITOSIS_THRESHOLD}
     AND trials_count >= ${MITOSIS_MIN_TRIALS}
     AND generation < 16`,
).all()
```

**Mismo bug que EffectManager (WAVE 7755 Fix 1).** La mitosis filtra
`status = 'alive'`, excluyendo champions. Un champion con fitness 0.90
y 15 trials nunca se reproduce por mitosis.

**La reproducción sexual SÍ incluye champions** (`status IN ('alive',
'champion')` en línea 817), pero requiere fitness ≥ 0.80 Y trials ≥ 10.
Con el bug anterior (EffectManager no daba trials a champions), los
champions nunca alcanzaban 10 trials. Ahora que Fix 1 les da trials,
la reproducción sexual debería funcionar — pero la mitosis sigue
excluyéndolos.

**Split-brain consistente:**

| Componente | Query | ¿Incluye champions? |
|------------|-------|:-------------------:|
| SpeciesQuotaSelector | `status IN ('alive', 'champion', 'canonized')` | ✓ |
| LifecycleManager | `status IN ('alive', 'champion')` | ✓ |
| SpeciationEngine | `status IN ('alive', 'champion')` | ✓ |
| Sexual reproduction | `status IN ('alive', 'champion')` | ✓ |
| EffectManager (post-fix) | `status IN ('alive', 'champion')` | ✓ |
| **Mitosis** | `status = 'alive'` | **✗ NO** |

### 1.3 Bug C — `evaluateFireEvent` es dead code (fitness sin EMA ni contexto)

**Síntoma:** El fitness no sigue la ecuación documentada en el
whitepaper. No hay EMA, no hay decaimiento temporal, no hay
coherencia contextual.

**Causa raíz:** `FitnessEvaluator.ts:262` define `evaluateFireEvent()`
con la ecuación completa:

```
ΔF = R_customs + R_context
F_new = (1 − λ)·F_old·γ^(Δt_días) + λ·ΔF
```

Pero **nunca es llamada**. Búsqueda de `evaluateFireEvent(` en todo
`src/core/`: solo la definición, cero consumidores.

El fitness real se actualiza en `EffectManager.ts:616-623`:

```typescript
db.prepare(
  `UPDATE lfx_organisms
   SET fitness_score = MIN(fitness_score + @reward, 1.0),
       trials_count = trials_count + 1,
       passes_count = passes_count + 1,
       last_fired_at = @now,
       last_evaluated_at = @now
   WHERE organism_id = @id`,
).run({
  reward: 0.05 * decision.intensity,
  ...
})
```

**El fitness es una acumulación lineal de `+0.05 * intensity` por
disparo, capped a 1.0.** Sin EMA, sin decaimiento temporal, sin
coherencia contextual, sin pesos de customs (chosen/rejected).

**Consecuencias:**

1. **El fitness no tiene relación con el contexto ecológico.** Un
   organismo disparado en un valle orgánico recibe el mismo reward
   que uno disparado en un drop agresivo.

2. **No hay olvido por inactividad.** El `γ^Δt_días` (1%/día) nunca
   se aplica. Un organismo con fitness 0.90 que no se dispara en 30
   días mantiene 0.90 en lugar de decaer a 0.66.

3. **Los thresholds de reproducción son alcanzables pero por la
   razón equivocada.** Un organismo llega a 0.80 (sexual) o 0.85
   (mitosis) por acumulación lineal, no por calidad ecológica.

4. **El `applyEMA` y `evaluateContext` son dead code.** Toda la
   maquinaria de softmax 6D, distancias contextuales, y pesos α
   está desconectada.

**Evaluación:** Este bug es estructural pero NO se recomienda
conectar `evaluateFireEvent` en este fix — el EffectManager
actualmente recompensa a TODOS los organismos con el mismo
blueprint_id por cada disparo, lo cual es incompatible con la
semántica de `evaluateFireEvent` (que espera un organismo
específico). Conectarlo requeriría rediseñar el loop de reward
del EffectManager, que es un cambio arquitectónico mayor. Se
documenta como deuda técnica.

### 1.4 Bug D — Operadores "light": pleiotropy conservadora

**Síntoma:** Los operadores apenas modifican keyframes.

**Análisis:** `focal_mutation` y `color_hue_shift` usan:

```typescript
const effectiveChaos = Math.min(1.0, chaos * 1.5)
const numMutations = 1 + Math.floor(effectiveChaos * rng() * 3)
```

| Chaos | effectiveChaos | rng()=0.5 | numMutations |
|:-----:|:--------------:|:---------:|:------------:|
| 0.2 | 0.30 | 0.45 | 1 |
| 0.4 | 0.60 | 0.90 | 1 |
| 0.5 | 0.75 | 1.125 | 2 |
| 0.7 | 1.00 | 1.50 | 2 |
| 0.9 | 1.00 | 2.70 | 3 |

**Con chaos < 0.5 (la mayoría de organismos nuevos), siempre es 1
mutación.** Solo organismos con chaos alto (≥ 0.5) hacen 2-3
mutaciones por operador.

La magnitud de la mutación (Cauchy scale=0.15) también es
conservadora: mediana de 0.15·span. Para intensity [0,1], eso es
un cambio de 0.15 — perceptible pero sutil.

**Esto es by design** (equilibrio puntuado: la mayoría de mutaciones
son pequeñas, raras veces grandes). Pero combinado con:
- `color_hue_shift` nunca se selecciona (Bug A)
- Mitosis excluye champions (Bug B) → menos mutaciones totales
- Organismos culled antes de acumular chaos suficiente

...el resultado neto es un ecosistema que evoluciona muy lentamente.

---

## 2. FIXES

### Fix A: Normalizar `pickWeightedOperator`

Dividir `r` por la suma total de pesos antes de comparar.

### Fix B: Mitosis incluir champions

`status = 'alive'` → `status IN ('alive', 'champion')`.

### Fix C: Documentar `evaluateFireEvent` como dead code

No se conecta en este fix (requiere rediseño arquitectónico del
loop de reward). Se documenta la deuda.

---

## 3. VEREDICTO FORENSE

| Pregunta | Respuesta |
|----------|-----------|
| ¿Por qué los operadores son light? | By design: chaos < 0.5 → 1 mutación por operador. Magnitud Cauchy mediana = 0.15·span. Pero agravado por color_hue_shift nunca seleccionado |
| ¿Por qué color_hue_shift no funciona? | `pickWeightedOperator` no normaliza. Total pesos = 1.08, pero `rng()` < 1.0, así que el último operador (acc=1.00) es inalcanzable |
| ¿Por qué la Mantis no se reproduce? | Sexual SÍ incluye champions, pero antes de WAVE 7755 los champions no recibían trials. Mitosis aún excluye champions. Con Fix 1 (WAVE 7755) + Fix B (este commit), ambos paths incluirán champions |
| ¿El fitness es correcto? | No. `evaluateFireEvent` (EMA + contexto + decaimiento) es dead code. El fitness es acumulación lineal `+0.05*intensity`. Deuda documentada |

---

*Forense: GLM-5.2 High. Operación Mantis — la ruleta tenía un número
ganador que nunca salía, y la mitosis miraba solo a los vivos.*

---

## 4. AMPLIACIÓN — Mantis End-to-End + Operadores Caóticos

### 4.1 ¿Funciona la Mantis ahora?

**SÍ, con los fixes WAVE 7755 + 7756.** El flujo end-to-end:

```
_sexualReproduction()
  → query: status IN ('alive','champion') AND fitness ≥ 0.80 AND trials ≥ 10
  → pair within species (first pass) + across species (second pass)
  → _breedAndSacrifice()
    → spawnHybrid(parentA, parentB)
      → materialize both parents
      → crossover() — keyframe-level 1-point crossover
      → prenatalScreening()
      → INSERT hybrid into lfx_organisms
    → if success: UPDATE both parents SET status='culled' (MANTIS)
```

**Bloqueos previos (ya resueltos):**
1. Champions no recibían trials (WAVE 7755 Fix 1 — EffectManager)
2. Mitosis excluía champions (WAVE 7756 Fix B)
3. `color_hue_shift` nunca se seleccionaba (WAVE 7756 Fix A)

**Bloqueo residual:** `SEXUAL_FITNESS_THRESHOLD = 0.80` requiere ~16
disparos con intensity=1.0 (fitness = acumulación lineal +0.05·intensity).
Con el bug C (evaluateFireEvent dead code), el fitness sube lentamente.
Pero ahora que los champions reciben trials, deberían llegar.

### 4.2 Operadores light — análisis estructural

**`AUGMENTABLE_PARAMS` solo tiene 6 de 24 `HephParamId`:**

```typescript
const AUGMENTABLE_PARAMS: HephParamId[] = [
  'intensity', 'color', 'strobe', 'pan', 'tilt', 'zoom'
]
```

**Faltan 18 parámetros:** `white`, `amber`, `speed`, `focus`, `iris`,
`gobo1`, `gobo2`, `prism`, `globalComp`, `width`, `direction`,
`scale_x`, `scale_y`, `rot_x`, `rot_y`, `gobo_rotation`, `smoke_pump`,
`smoke_density`, `fan_speed`.

**Consecuencia:** `gene_augmentation` solo puede inyectar tracks de
6 parámetros. Si el blueprint ya tiene los 6 (común en efectos
complejos), el operador cae en el path multicelular — añade un
DUPLICADO de un parámetro existente en una zona complementaria.
Por eso el usuario ve "pistas duplicadas de color, dimmer, strobe".

**`curve_adaptation` es frecuentemente no-op:**

```typescript
if (newInterp === currentInterp) {
  return { clip: child, delta, operator: 'curve_adaptation', l2Distance: 0 }
}
```

Si el keyframe ya tiene la interpolación que el DNA pediría
(organicity > 0.5 → bezier), el operador retorna sin cambios.
**L2 = 0, delta = [], operador desperdiciado.**

**`focal_mutation` pleiotropy conservadora:**

```typescript
const numMutations = 1 + Math.floor(effectiveChaos * rng() * 3)
```

Con chaos < 0.5 (la mayoría), siempre es 1 mutación. Magnitud Cauchy
mediana = 0.15·span. Para intensity [0,1], eso es un cambio de 0.15.

### 4.3 Fixes de caos

**Fix C:** Ampliar `AUGMENTABLE_PARAMS` a 18 parámetros con sus rangos.
**Fix D:** `focal_mutation` — pleiotropy 2-5 mutaciones, Cauchy scale=0.25.
**Fix E:** `curve_adaptation` — mutar múltiples keyframes, forzar cambio.
**Fix F:** `gene_augmentation` — más keyframes, más variedad de parámetros.
