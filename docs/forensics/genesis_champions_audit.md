# AUDITORÍA FORENSE — Genesis: Champions Amnésicos + ADN Corrupto

> **Bug 1:** Los champions no se disparan nunca (no acumulan trials ni
> fitness tras la promoción).
>
> **Bug 2:** Los operadores generan parámetros de curva inválidos como
> `"strobeRate"` que no existen en el tipo `HephParamId` de Hephaestus.

---

## 1. DIAGNÓSTICO RAÍZ — Tres bugs convergentes

### 1.1 Bug A — EffectManager excluye champions del loop de fitness (CRÍTICO)

**Síntoma:** Los champions nunca se disparan. Nunca acumulan trials.
Nunca llegan al Hall of Fame (requiere 25 trials).

**Causa raíz:** `EffectManager.ts:571-574`:

```typescript
const organisms = db.prepare(
  `SELECT organism_id FROM lfx_organisms
   WHERE blueprint_id = ? AND status = 'alive'`,
).all(config.effectType) as { organism_id: string }[]
```

**El query filtra exclusivamente `status = 'alive'`.** Los organisms
con `status = 'champion'` son **excluidos** del loop de fitness.

Cuando un champion es disparado en vivo (el DreamSimulator SÍ lo
pre-bufferea y dispara), el EffectManager **no le suma trials, no le
suma passes, no le actualiza fitness_score, no le actualiza
last_fired_at**.

#### La cadena del bug

1. Organismo `alive` acumula fitness y trials.
2. LifecycleManager lo promueve a `champion` (fitness > avg × 1.30,
   trials ≥ 5).
3. El DreamSimulator lo pre-bufferea y lo dispara (correcto —
   `liveCandidates = rankedScenarios.filter(s => entry?.organismStatus !== 'alive')`).
4. El EffectManager busca `status = 'alive'` → el champion NO aparece.
5. El champion no recibe `trials_count + 1` ni `fitness_score + reward`.
6. El `applyEMA` con `γ^Δt_días` decae su fitness por inactividad
   (1%/día).
7. LifecycleManager lo demote cuando `fitness < avg × 0.80`.
8. Vuelve a `alive`, acumula trials, vuelve a promocionar...
9. **Ciclo infinito alive → champion → alive sin acumular los 25
   trials necesarios para HoF.**

#### El split-brain DreamSimulator vs EffectManager

| Componente | Qué hace con champions | Correcto |
|------------|----------------------|:--------:|
| `DreamSimulator:320-322` | Filtra `organismStatus !== 'alive'` para pre-buffer | ✓ SÍ — champions se pre-bufferean |
| `DreamSimulator:333` | "Only champion/canonized organisms can be pre-buffered for live fire" | ✓ SÍ |
| `EffectManager:573` | `WHERE status = 'alive'` para trials/fitness | ✗ **NO** — excluye champions |
| `SpeciesQuotaSelector:70` | `WHERE status IN ('alive', 'champion', 'canonized')` | ✓ SÍ |
| `LifecycleManager:87` | `WHERE status IN ('alive', 'champion')` | ✓ SÍ |
| `SpeciationEngine:170` | `WHERE status IN ('alive', 'champion')` | ✓ SÍ |

**El EffectManager es el único componente que excluye a los champions
del loop ecológico.** Todos los demás módulos los incluyen. Es un
split-brain: el DreamSimulator dispara champions, pero el
EffectManager no los recompensa por sobrevivir.

#### Consecuencia cuantitativa

- Un champion necesita `HALL_OF_FAME_TRIALS = 25` y
  `survivalRate > 0.85` para HoF.
- Sin trials nuevos, `survivalRate = passes / (trials + 1)` se
  congela en el valor que tenía al promocionar.
- El fitness decae por `γ^Δt_días`: 30 días sin trials → 74% del
  fitness original.
- El champion es demoted antes de acumular trials suficientes.

---

### 1.2 Bug B — Blueprint con paramId inválido "strobeRate"

**Síntoma:** Los operadores generan parámetros de curva como
`"strobeRate"` que no existen en Hephaestus.

**Causa raíz:** `divine_obliteration.lfx:132-142`:

```json
{
  "id": "nuke-pars-strobe",
  "paramId": "strobe",        // ← track paramId: CORRECTO
  "zones": ["all-pars", "ambient", "flash"],
  "blendMode": "replace",
  "curve": {
    "paramId": "strobeRate",  // ← curve paramId: INVÁLIDO
    "valueType": "number",
    ...
  }
}
```

**El track declara `paramId: "strobe"` pero la curva interna declara
`paramId: "strobeRate"`.** `strobeRate` NO es un `HephParamId`
válido — es un campo de `CombinedEffectOutput` (effects/types.ts:115)
y un alias de canal Aether (NodeArbiter.ts:76), pero NO un paramId
de track de Hephaestus.

El tipo `HephParamId` (hephaestus/types.ts:178-204) es una unión
cerrada de 24 strings:
```
'intensity' | 'color' | 'white' | 'amber' | 'speed' | 'pan' | 'tilt' |
'zoom' | 'focus' | 'iris' | 'gobo1' | 'gobo2' | 'prism' | 'strobe' |
'globalComp' | 'width' | 'direction' | 'scale_x' | 'scale_y' |
'rot_x' | 'rot_y' | 'gobo_rotation' | 'smoke_pump' | 'smoke_density' | 'fan_speed'
```

`strobeRate` no está en la lista. El paramId válido para strobe es
`'strobe'`.

#### Por qué el bug no fue detectado

1. **TypeScript no lo valida** porque los .lfx son JSON cargado en
   runtime, no código TypeScript.
2. **El PrenatalScreening no valida paramIds** (ver Bug C).
3. **El CurveEvaluator** usa `curves.get(paramId)` — si el track se
   registra con `paramId: 'strobe'` pero la curva dice
   `paramId: 'strobeRate'`, el evaluador puede no encontrar la curva
   o evaluarla bajo el key equivocado.
4. **Los operadores genéticos heredan el blueprint** y propagan el
   paramId inválido a los descendientes. El `gene_augmentation` usa
   `AUGMENTABLE_PARAMS` (válido), pero los tracks heredados del
   blueprint padre conservan su paramId original.

#### Impacto

- El track `nuke-pars-strobe` puede no evaluarse correctamente en
  runtime (el CurveEvaluator busca por `paramId` de la curva, no del
  track).
- Los mutantes descendientes de `divine_obliteration` heredan el
  track con la curva inconsistente.
- El `HephParameterOverlay` puede no aplicar el strobe correctamente
  porque busca `paramId === 'strobe'` pero la curva dice
  `'strobeRate'`.

---

### 1.3 Bug C — PrenatalScreening no valida paramIds

**Síntoma:** Los organismos con paramIds inválidos pasan el screening
prenatal y se insertan en la base de datos.

**Causa raíz:** `PrenatalScreening.ts` tiene 7 gates (G1-G7):

| Gate | Qué valida | Aborta |
|------|-----------|:------:|
| G1 | Schema (id, name, durationMs) | ✓ |
| G2 | Checksum | N/A |
| G3 | Genome ACO ∈ [0,1] | ✓ |
| G4 | Compat (vibes, sections, zones ≤ 2) | ✓ |
| G5 | Curves (≥1 track con ≥2 keyframes) | ✓ |
| G6 | Strobe consistency | ✓ |
| G7 | Redundancy (L2 < 0.02 = clone) | ✓ |
| G7-spatial | Spatial behavior vs pan/tilt | warn |

**No existe un gate que valide que los `paramId` de los tracks sean
`HephParamId` válidos.** Un organismo con `paramId: "stroberate"`,
`paramId: "banana"`, o cualquier string pasa el screening si las
demás condiciones se cumplen.

Esto es una brecha de defensa en profundidad: el tipo TypeScript
`HephParamId` protege el código compilado, pero los .lfx cargados en
runtime y los mutantes genéticos no pasan por validación de tipos.
El screening prenatal es la última línea de defensa antes de la
inserción en BD, y no valida los paramIds.

---

## 2. FLUJO COMPLETO DEL BUG

### Champions Amnésicos

```
Organismo alive → acumula fitness (0.05·intensity por fire)
  ↓
LifecycleManager: fitness > avg×1.30, trials ≥ 5
  ↓
Promovido a champion ✓
  ↓
DreamSimulator: pre-bufferea champion (correcto)
  ↓
Champion se dispara en vivo ✓
  ↓
EffectManager: SELECT WHERE status = 'alive'
  ↓
Champion NO aparece en el resultado ✗
  ↓
Champion no recibe trials_count + 1 ✗
Champion no recibe fitness_score + reward ✗
Champion no recibe last_fired_at update ✗
  ↓
applyEMA: fitness × γ^(Δt_días) — decae 1%/día
  ↓
LifecycleManager: fitness < avg × 0.80
  ↓
Demoted a alive
  ↓
Ciclo se repite — nunca acumula 25 trials para HoF
```

### ADN Corrupto

```
divine_obliteration.lfx cargado
  ↓
Track: paramId = "strobe" (correcto)
Curve: paramId = "strobeRate" (INVÁLIDO)
  ↓
PrenatalScreening: G1-G7 — ninguno valida paramId
  ↓
Organismo insertado en BD con paramId inválido ✓
  ↓
Operadores genéticos heredan el track
  ↓
Mutantes con paramId "strobeRate" propagados
  ↓
CurveEvaluator: curves.get("strobeRate") — comportamiento indefinido
  ↓
HephParameterOverlay: busca paramId === "strobe" — no coincide
  ↓
Strobe no se aplica correctamente ✗
```

---

## 3. FIXES PROPUESTOS

### Fix A: EffectManager — incluir champions en el loop de fitness

**Archivo:** `EffectManager.ts:573`

Cambiar:
```sql
WHERE blueprint_id = ? AND status = 'alive'
```

Por:
```sql
WHERE blueprint_id = ? AND status IN ('alive', 'champion')
```

**Justificación:** Los champions son organismos vivos que se disparan
en vivo (el DreamSimulator los pre-bufferea). Deben recibir trials y
fitness como cualquier otro organismo vivo. Esto cierra el split-brain
entre DreamSimulator (que dispara champions) y EffectManager (que no
los recompensa). Coherente con SpeciesQuotaSelector, LifecycleManager
y SpeciationEngine, todos los cuales incluyen `status IN ('alive',
'champion')`.

### Fix B: divine_obliteration.lfx — corregir paramId de la curva

**Archivo:** `divine_obliteration.lfx:142`

Cambiar:
```json
"paramId": "strobeRate"
```

Por:
```json
"paramId": "strobe"
```

**Justificación:** El track ya declara `paramId: "strobe"` (línea
134). La curva interna debe ser consistente. `strobeRate` no es un
`HephParamId` válido — es un campo de output de efectos y un alias
de canal Aether, no un paramId de track de Hephaestus.

### Fix C: PrenatalScreening — añadir gate G8 PARAM_ID

**Archivo:** `PrenatalScreening.ts`

Añadir un gate G8 que valide que todos los `paramId` de los tracks
sean `HephParamId` válidos. Abortar si cualquier track tiene un
paramId inválido.

**Justificación:** El screening prenatal es la última línea de
defensa antes de la inserción en BD. Los .lfx cargados en runtime no
pasan por validación de tipos TypeScript. Sin este gate, blueprints
corruptos pueden generar descendencia con paramIds inválidos que
propagan el error a través del ecosistema.

---

## 4. VEREDICTO FORENSE

| Pregunta del Arquitecto | Respuesta |
|--------------------------|-----------|
| ¿Por qué los champions no se disparan? | **Se disparan** (DreamSimulator los pre-bufferea), pero el EffectManager no les da trials ni fitness porque filtra `status = 'alive'`. Sin trials, su fitness decae y son demoted antes de llegar a HoF |
| ¿Por qué los operadores generan paramIds como "stroberate"? | **El blueprint `divine_obliteration.lfx` tiene un track con `paramId: "strobe"` pero la curva interna dice `paramId: "strobeRate"`. Los operadores heredan esta inconsistencia. El PrenatalScreening no valida paramIds, así que los mutantes con paramIds inválidos pasan |
| ¿Es un bug del ADN (genoma)? | **No del genoma ACO.** El genoma (aggression/chaos/organicity) está sano. El bug es del ADN estructural — los paramIds de los tracks, que no son validados |
| ¿Los operadores son inefectivos? | **No inherentemente.** Los operadores usan `AUGMENTABLE_PARAMS` válido. El problema es que heredan tracks corruptos de blueprints con paramIds inválidos |

**CAUSA RAÍZ (Champions):** `EffectManager.ts:573` filtra
`status = 'alive'`, excluyendo a los champions del loop de fitness.
Es el único módulo del ecosistema que excluye a los champions.

**CAUSA RAÍZ (paramIds inválidos):** `divine_obliteration.lfx:142`
tiene `paramId: "strobeRate"` (inválido) en la curva, mientras el
track dice `paramId: "strobe"`. El PrenatalScreening no valida
paramIds, permitiendo que el error se propague a los descendientes.

---

## 5. REFERENCIAS DE CÓDIGO

- `EffectManager.ts:571-574` — `WHERE status = 'alive'` (excluye champions)
- `EffectManager.ts:603-628` — Loop de fitness (trials + reward)
- `EffectManager.ts:616-623` — `UPDATE lfx_organisms SET fitness_score = MIN(fitness_score + @reward, 1.0), trials_count = trials_count + 1`
- `EffectDreamSimulator.ts:320-322` — `liveCandidates = rankedScenarios.filter(s => entry?.organismStatus !== 'alive')`
- `EffectDreamSimulator.ts:333` — "Only champion/canonized organisms can be pre-buffered for live fire"
- `SpeciesQuotaSelector.ts:70` — `WHERE status IN ('alive', 'champion', 'canonized')`
- `LifecycleManager.ts:87` — `WHERE status IN ('alive', 'champion')`
- `SpeciationEngine.ts:170` — `WHERE status IN ('alive', 'champion')`
- `LifecycleManager.ts:155-168` — Promoción alive → champion
- `LifecycleManager.ts:171-182` — Democión champion → alive
- `LifecycleManager.ts:130-137` — Hall of Fame (trials ≥ 25, survival > 0.85)
- `FitnessEvaluator.ts:189-201` — `applyEMA` con `γ^Δt_días` (olvido por inactividad)
- `hephaestus/types.ts:178-204` — `HephParamId` unión cerrada de 24 strings
- `divine_obliteration.lfx:134` — Track `paramId: "strobe"` (correcto)
- `divine_obliteration.lfx:142` — Curve `paramId: "strobeRate"` (INVÁLIDO)
- `PrenatalScreening.ts:257-288` — `prenatalScreening()` — sin validación de paramId
- `PrenatalScreening.ts:276` — `hardFailGates = ['G1', 'G3', 'G4', 'G5', 'G6', 'G7']`
- `GeneticOperators.ts:716` — `AUGMENTABLE_PARAMS` (válido, subconjunto de HephParamId)
- `GeneticOperators.ts:971` — `paramId: chosenParam as HephParamId` (cast sin validación)

---

*Forense: GLM-5.2 High. Operación Genesis — los champions disparaban
al vacío y el ADN estructural no tenía inmune contra paramIds
forasteros.*
