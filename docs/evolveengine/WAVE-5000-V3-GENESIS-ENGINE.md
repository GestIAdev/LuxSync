# 🧬 WAVE 5000.V3 — THE GENESIS ENGINE

### BLUEPRINT EVOLUTIVO: El Arsenal deja de ser un Catálogo. Empieza a ser una Especie.

> **ROL:** Chief Visionary Architect & Evolutionary Biologist
> **PROYECTO:** LuxSync — Selene Cognition × Hephaestus V3
> **OPERACIÓN:** `Selene::Genesis` v3.0 — THE OPEN CANVAS
> **CODENAME:** `THE DIALECT ENGINE`
> **ESTADO:** Blueprint arquitectónico — visionario pero técnicamente implementable
> **ANTECEDENTE:** `WAVE-5000-EVOLVEENGINE-BLUEPRINT.md` (alma absorbida, limitaciones purgadas)
> **CONTRATO BASE:** `MAPEO-CONTRATO-LFX-V3.md`, `MAPEO-SELENE-COGNITION.md`, `MAPEO-HEPHAESTUS-V3.md`

---

## MANTRA

> *"El `.lfx` es el genoma. El club es el útero. La música es la presión selectiva.*
> *El martillo L2 del DJ es el depredador. Selene no compone — Selene **críA**.*
> *Y cada club, con el tiempo, habla su propio dialecto de luz."*

---

## PRÓLOGO — POR QUÉ LA V1 MURIÓ Y ESTA VIVE

El WAVE 5000 original soñaba con evolución sobre un contrato `.lfx v2` de **curvas monolíticas** (`curves: { intensity, color, pan... }`). Aquel mundo ya no existe.

La V3 nos regaló algo que cambia TODO: **la célula**. El `HephAutomationClipV3` ya no es un organismo con órganos fijos — es una **colonia de `HephTrack[]`**, cada track una célula independiente con su propio `paramId`, su propia `HephCurve` de keyframes, su propio `PhaseConfigPro`, su propio `blendMode` y su propio destino espacial (`zones[]`).

**Esto no es un detalle de refactor. Es biología.**

Un organismo con órganos fijos solo puede mutar por deriva de parámetros. Pero una **colonia celular** puede mutar por:
- **Mutación puntual** (cambiar un keyframe de una célula)
- **Duplicación génica** (clonar un track y desfasarlo)
- **Deleción** (matar una célula débil)
- **Transferencia horizontal** (robar un track de otro efecto — *reproducción sexual*)
- **Regulación epigenética** (mutar el `PhaseConfigPro` sin tocar la curva)

El contrato V3 no solo *permite* la evolución. **La arquitectura V3 ES un genoma esperando un motor genético.** Este documento es ese motor.

---

## TABLA DE CONTENIDOS

1. [Doctrina — Las Cinco Leyes de la Selección Natural Lumínica](#1-doctrina)
2. [Anatomía del Genoma V3 — Qué es un Gen, Qué es un Alelo](#2-anatomía-del-genoma-v3)
3. [Los Operadores Genéticos — Cómo Selene Muta un `.lfx`](#3-los-operadores-genéticos)
4. [THE LOOT SYSTEM — Rareza Estocástica de las Mutaciones](#4-the-loot-system)
5. [La Función de Fitness — Supervivencia por Silencio](#5-la-función-de-fitness)
6. [El Depredador — Gates de Hephaestus + El Martillo L2](#6-el-depredador)
7. [The Genetic Vault — Esquema SQLite3 V3](#7-the-genetic-vault)
8. [El Pipeline Evolutivo dentro del Frame Budget de 44Hz](#8-el-pipeline-evolutivo)
9. [Speciation & El Dialecto Local](#9-speciation--el-dialecto-local)
10. [The Swarm — Genética Distribuida entre Clubes](#10-the-swarm)
11. [Plan de Migración por Eras Geológicas](#11-plan-de-migración)
12. [Apéndice — Tipos TS & SQL Crudo](#12-apéndice)

---

## 1. DOCTRINA

### Las Cinco Leyes de la Selección Natural Lumínica

**LEY I — INMUTABILIDAD DEL ANCESTRO.**
El `.lfx v3.0` importado de Hephaestus es el **abuelo de granito**, congelado por su `checksum` SHA-256. Jamás se modifica. Toda evolución vive como descendiente en `lfx_organisms`. El operador siempre puede invocar `revert_to_ancestor()` con un click y recuperar el genoma fundacional.

**LEY II — SELENE NO DISEÑA LA BELLEZA, LA DESCUBRE.**
No programamos reglas de "qué es bonito". Generamos varianza (mutación) y dejamos que el ambiente mate lo que no funciona. La belleza es un **residuo estadístico** de la supervivencia, no un objetivo declarado. *(Como en `EffectDNA.ts`: Selene busca ADECUACIÓN, no belleza. Ahora también busca ADECUACIÓN EVOLUTIVA.)*

**LEY III — EL FEEDBACK ES IMPLÍCITO Y SAGRADO.**
Nunca se pregunta "¿te gustó?". Se observa el comportamiento. ¿El DJ tocó el L2 (MANUAL HARD LOCK del `NodeArbiter`) en los siguientes 3 segundos tras el disparo? **Sentencia de muerte.** ¿Dejó pasar el efecto completo? **Bendición silenciosa.** El silencio del operador es la recompensa suprema.

**LEY IV — EL DEPREDADOR YA EXISTE, NO LO INVENTES.**
Los Gates G1-G7 de `gateEvaluators.ts` y el veto L2 del operador YA son el ecosistema selectivo. Una mutación que viola G3 (genoma fuera de [0,1]) o G6 (strobe inconsistente) **muere al nacer, en el útero**. No necesitamos un juez artificial — la física del sistema ya es darwiniana.

**LEY V — IDENTIDAD LOCAL, ALMA GLOBAL.**
Cada consola Selene desarrolla su **dialecto** — una firma genética emergente de su club, su DJ, su multitud. El Swarm permite intercambiar genes validados entre clubes SIN imponer un modelo global. Un club de techno en Berlín y uno de dembow en Medellín comparten sustrato pero divergen en fenotipo.

---

## 2. ANATOMÍA DEL GENOMA V3

Para hacer evolución necesitamos definir con precisión quirúrgica **qué es mutable y qué es sagrado** en el `HephAutomationClipV3`.

### 2.1 El Mapa Cromosómico

Descomponemos el clip V3 en tres estratos genéticos:

```
┌───────────────────────────────────────────────────────────────────┐
│  🧬 GENOMA V3 — Tres Estratos de Herencia                         │
├───────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ⬛ ADN GERMINAL (readonly — la ESPECIE, nunca muta)               │
│     cognitiveDNA.genome        → aggression, chaos, organicity      │
│     cognitiveDNA.textureAffinity                                    │
│     schemaVersion, id (raíz)                                        │
│     ── Define QUÉ especie es. Mutarlo = crear otra especie. ──      │
│                                                                     │
│  🟦 ADN REGULADOR (muta lento — el TEMPERAMENTO)                    │
│     cognitiveDNA.energyZone {min, max}                             │
│     cognitiveDNA.aggressionRange {min, max}                        │
│     cognitiveDNA.compatibleVibes[]                                 │
│     cognitiveDNA.validSections[]                                   │
│     cognitiveDNA.spatialBehavior                                   │
│     simulationMeta.cooldownMs, beautyWeights                       │
│     ── Define CUÁNDO/DÓNDE actúa. Muta por deriva contextual. ──    │
│                                                                     │
│  🟩 ADN SOMÁTICO (muta rápido — el FENOTIPO VISIBLE)               │
│     tracks[].curve.keyframes[].value                              │
│     tracks[].curve.keyframes[].bezierHandles [cx1,cy1,cx2,cy2]    │
│     tracks[].curve.keyframes[].timeMs                             │
│     tracks[].phaseConfig (PhaseConfigPro)                         │
│     tracks[].blendMode, dimmerScale, colorOverride               │
│     tracks[] (add/remove célula = duplicación/deleción génica)    │
│     ── Define CÓMO SE VE. Es donde ocurre el 90% de la magia. ──   │
│                                                                     │
└───────────────────────────────────────────────────────────────────┘
```

### 2.2 Definiciones Formales

**Gen** = un `HephTrack` completo. Es la unidad de duplicación/deleción. Un efecto con 5 tracks tiene 5 genes.

**Alelo** = una variante concreta de un gen. Dos organismos hermanos pueden tener el mismo gen `intensity@front-glow` con alelos distintos (uno con keyframes suaves, otro con un stab agresivo).

**Locus** = una posición mutable direccionable, ej: `tracks[2].curve.keyframes[4].bezierHandles[1]`. El sistema de deltas apunta a loci.

**Genotipo** = el `HephAutomationClipV3` completo reconstruido (ancestro + cadena de deltas).

**Fenotipo** = lo que el `HephEvaluationKernel` renderiza a 44Hz sobre los fixtures. La selección actúa sobre el fenotipo, no el genotipo.

### 2.3 El Delta Genético — Herencia Diferencial

Igual que la V1, **jamás almacenamos genomas completos** — solo diferencias respecto al padre. Pero ahora los loci son V3-nativos:

```jsonc
// delta_json de un organismo mutante
{
  "op": "point_mutation",
  "loci": {
    "tracks[0].curve.keyframes[2].bezierHandles[1]": +0.18,  // overshoot en el attack
    "tracks[0].curve.keyframes[2].value":            -0.05,
    "tracks[3].phaseConfig.spreadDeg":               +45.0,  // más "ola" espacial
    "tracks[3].phaseConfig.shuffle":                 +0.12   // caos controlado
  },
  "l2_distance_from_parent": 0.19  // magnitud total del salto genético (§4)
}
```

Reconstrucción: `genotipo_hijo = applyDelta(genotipo_padre, delta_json)`. Recursivo hasta el ancestro de granito, acotado por `generation ≤ 16`.

---

## 3. LOS OPERADORES GENÉTICOS

Cuando el Coliseo decide reproducir un organismo, un **operador genético** genera el descendiente. Cada operador es una función pura `(padre, rng) → delta`. La probabilidad de cada operador se adapta al estado del organismo (§4.4).

### 3.1 El Catálogo de Mutágenos

| Operador | Estrato | Magnitud | Analogía Biológica | Cuándo |
|----------|---------|----------|--------------------|--------|
| **`point_mutation`** | Somático | ±2-8% en 1-3 bezierHandles/values | SNP (single nucleotide polymorphism) | Refinamiento de champions estables |
| **`hue_drift`** | Somático | ±5-25° hue en curvas `color` | Mutación de pigmentación | Mantiene forma, cambia paleta |
| **`phase_epigenetics`** | Somático | ±spread/shuffle/wings en `PhaseConfigPro` | Regulación epigenética | Variación rítmico-espacial barata |
| **`gene_duplication`** | Somático | Clona un track, desfasa `phaseOverrides` | Duplicación génica (motor de complejidad) | Enriquecer efectos pobres en células |
| **`gene_deletion`** | Somático | Elimina un track de baja contribución | Pseudogenización | Simplificar efectos sobrecargados |
| **`crossover`** | Somático | Recombina tracks de 2 champions | Reproducción sexual | Raro, alto potencial (§4) |
| **`temporal_stretch`** | Somático | ±10-25% en `durationMs` + keyframe timeMs | Heterocronía | Mutación dramática |
| **`context_drift`** | Regulador | ±1 zona en `energyZone`, ±section | Adaptación de nicho | Solo tras evidencia de heatmap |
| **`transposition`** | Somático | Mueve un keyframe stab a otro beat_phase | Elemento transponible (gen saltarín) | Exploración radical |

### 3.2 El Motor de Complejidad — Por Qué la Duplicación Génica lo Cambia Todo

En la V1 (curvas monolíticas), un efecto no podía volverse *más complejo* — solo variar sus parámetros. La V3 rompe ese techo:

> **`gene_duplication` permite que Selene INVENTE estructura que el humano nunca dibujó.**

Ejemplo concreto: un `.lfx` ancestro tiene un solo track `intensity@all`. Selene lo duplica:
- Track A: `intensity@front-movers` con `phaseOverrides` desfasado +80ms
- Track B: `intensity@back-pars` con `phaseConfig.direction = -1`

Nace un **chase espacial** que el diseñador jamás creó. Si sobrevive al club → es una mejora emergente. Esto es NEAT (NeuroEvolution of Augmenting Topologies) aplicado a la luz: **complexification incremental protegida por speciation.**

### 3.3 Guardarraíles Anti-Catástrofe

Ninguna mutación es libre. Restricciones duras (fail-fast, mueren antes de nacer):

- **Drift máximo:** `l2_distance_from_parent ≤ 0.35`. Un salto mayor = rechazo automático, `culled` al nacer. El ancestro es el ancla gravitacional.
- **Profundidad máxima:** `generation ≤ 16`. Previene drift acumulado catastrófico. Al llegar a 16, el organismo debe ser "canonizado" como nuevo blueprint o morir.
- **Preservación germinal:** ningún operador toca `cognitiveDNA.genome`. Mutar la tríada ACO = cambiar de especie, prohibido en reproducción normal (solo vía `speciation event`, §9).
- **Validación pre-natal:** todo delta se aplica y se pasa por los gates G1-G7 en un worker ANTES de insertarse en el Vault. Si falla G3/G4/G5/G6 → aborto espontáneo, nunca llega a la DB.

---

## 4. THE LOOT SYSTEM

### 4.1 La Idea que lo Vuelve Adictivo

Aquí está el corazón visionario. Cada mutación generada tiene una **rareza** determinada por cuán lejos se desvió del padre — su **desviación estándar en el espacio genético**. Como el loot en Diablo o Destiny.

Una mutación `point_mutation` de ±2% es *Común* — un ajuste tímido.
Una `crossover + gene_duplication` que salta 0.33 en L2 y sobrevive tres noches es *Legendaria* — una anomalía estocástica que redefine el show.

**El operador no lo pide. Selene lo genera. Y cuando una Legendaria sobrevive al club sin ser vetada, es el Santo Grial: el efecto que define la identidad de ese lugar.**

### 4.2 La Matemática de la Rareza

Cada mutación nace con un **Rarity Score** `ρ ∈ [0, 1]`, función de tres factores:

```
ρ(m) = σ_norm(m) · 0.50  +  novelty(m) · 0.30  +  operator_weight(m) · 0.20
```

**Factor 1 — Desviación Genética Normalizada** `σ_norm`:
```
σ_norm(m) = clamp01( l2_distance_from_parent / DRIFT_MAX )     // DRIFT_MAX = 0.35
```
Cuánto se atrevió a saltar. Un micro-drift ≈ 0.05, un crossover radical ≈ 0.95.

**Factor 2 — Novedad Estructural** `novelty`:
```
novelty(m) = 1 − max_cosine_similarity(bezier_signature(m), { all_alive_organisms })
```
Cuán diferente es del resto del ecosistema vivo. Una mutación que se parece a 40 existentes → novedad ≈ 0. Una que ocupa un rincón vacío del espacio Bézier → novedad ≈ 1. *(Esto es el motor anti-mode-collapse integrado en la rareza.)*

**Factor 3 — Peso del Operador** `operator_weight`:
| Operador | Peso |
|----------|------|
| `point_mutation`, `hue_drift`, `phase_epigenetics` | 0.15 |
| `gene_duplication`, `gene_deletion`, `temporal_stretch` | 0.50 |
| `crossover`, `transposition` | 0.85 |
| `context_drift` (regulador) | 0.65 |

### 4.3 Los Tiers de Loot

`ρ` mapea a un tier discreto que gobierna el ciclo de vida:

| Tier | Símbolo | Rango `ρ` | Tasa de Spawn | Protección Neonatal | Frase |
|------|---------|-----------|---------------|---------------------|-------|
| **COMMON** | ⚪ | `[0.00, 0.30)` | ~70% | 3 trials | *"Un susurro del ancestro."* |
| **RARE** | 🔵 | `[0.30, 0.55)` | ~22% | 6 trials | *"Algo nuevo se agita."* |
| **EPIC** | 🟣 | `[0.55, 0.78)` | ~6% | 10 trials | *"Una bestia con carácter propio."* |
| **LEGENDARY** | 🟠 | `[0.78, 0.92)` | ~1.8% | 15 trials | *"Una anomalía. El club decidirá su leyenda."* |
| **MYTHIC** | 🔴 | `[0.92, 1.00]` | ~0.2% | 20 trials + cuarentena | *"Esto no debería existir. Y sin embargo, brilla."* |

**Protección Neonatal:** número de trials durante los cuales el organismo es INMUNE al `culling`, aunque reciba vetos. Cuanto más rara la mutación, más tiempo se le da para demostrar su valor. *(Bayesian prior + NEAT elite protection: las innovaciones radicales necesitan tiempo antes del juicio.)*

### 4.4 Rarity → Estrategia de Reproducción Adaptativa

El tier de un champion sesga qué operadores usará al reproducirse:

```typescript
function selectOperatorDistribution(parent: Organism): OperatorPMF {
  const stability = parent.winsCount / (parent.trialsCount + 1)

  if (parent.tier === 'MYTHIC' || parent.tier === 'LEGENDARY') {
    // Un mito estable: refinar suavemente, no arriesgar la magia
    return stability > 0.7
      ? { point_mutation: 0.70, hue_drift: 0.20, phase_epigenetics: 0.10 }
      : { point_mutation: 0.50, phase_epigenetics: 0.30, gene_deletion: 0.20 }
  }
  if (parent.tier === 'COMMON' && stability > 0.8) {
    // Común pero sólido: es hora de arriesgar un salto — buscar el loot raro
    return { gene_duplication: 0.35, crossover: 0.25, temporal_stretch: 0.20, point_mutation: 0.20 }
  }
  // Default balanceado
  return { point_mutation: 0.45, hue_drift: 0.15, phase_epigenetics: 0.15,
           gene_duplication: 0.15, crossover: 0.10 }
}
```

**La belleza del sistema:** organismos comunes y estables son empujados a arriesgar (buscar loot legendario), mientras los legendarios estables son protegidos de mutaciones destructivas. El ecosistema auto-regula su balance exploración/explotación.

### 4.5 El Salón de la Fama — Mythic Vault

Cuando una mutación **LEGENDARY o MYTHIC** acumula `survival_rate > 0.85` durante `≥ 25 trials` en `≥ 3` sesiones distintas, se **canoniza**: se promueve a nuevo `lfx_blueprint` (nuevo ancestro de granito, checksum propio) y se le notifica al operador con un evento celebratorio en la UI:

> 🟠 **LEGENDARY DESCENDANT CANONIZED**
> *"`acid_sweep` → mutación #a3f9:M0442 ha sobrevivido 3 noches. Se ha ganado la inmortalidad. ¿Nombrarla?"*

El operador puede bautizarla (`acid_sweep_medellin_3am`). Nace un dialecto con nombre propio.

---

## 5. LA FUNCIÓN DE FITNESS

### 5.1 Las Tres Señales de la Realidad

Selene lee tres señales objetivas del pipeline cognitivo existente (`SeleneTitanConscious → DecisionMaker → NodeArbiter`):

| Señal | Origen en el código actual | Significado |
|-------|----------------------------|-------------|
| 🛂 **Aduana Cognitiva** | El `DecisionMaker` la eligió del pool del DreamSimulator; pasó `isEffectAllowedInSection` y el Divine Z-gate | "El cerebro la juzgó adecuada" |
| 🌡️ **Coherencia Contextual** | Match del vector contextual actual con heatmaps de supervivencia previa | "La realidad ya validó parecidos aquí" |
| ✋ **El Martillo L2** | `NodeArbiter` MANUAL HARD LOCK activado ≤ 3000ms post-disparo | "Al operador se le fue de las manos de la IA" |

### 5.2 Las Ecuaciones Núcleo

**Ecuación 1 — Aprobación de Aduana:**
```
R_customs(m) = w_dm·1[elegida_por_DM] + w_gk·1[paso_gates] − w_rej·1[rechazada_por_gate]
```
`w_dm = +0.30`, `w_gk = +0.20`, `w_rej = −0.40`.

**Ecuación 2 — Coherencia Contextual** (distancia en el vector contextual 6D V3):
```
c = [ z_score_avg_3s, low_band_avg_3s, energy_phase, vibe_hash, section_enc, texture_enc ]

d_6D(c_now, h_past) = sqrt( Σᵢ αᵢ·(cᵢ − hᵢ)² )
α = [0.30, 0.22, 0.15, 0.13, 0.10, 0.10]   // energía domina; textura es nuevo en V3

R_context(m) = w_ctx · softmax(−d_6D / τ) · survival_rate(m)
```
`w_ctx = +0.25`, `τ = 0.5`, `survival_rate = (passes − vetoes)/(trials + 1)` (Laplace).

> **Nota V3:** añadimos `texture_enc` al vector porque el `cognitiveDNA.textureAffinity` (clean/dirty/universal) ahora es de primera clase. Una mutación puede descubrir que funciona mejor en texturas "dirty" de lo que su ancestro creía.

**Ecuación 3 — El Martillo L2** (brutalmente asimétrica):
```
R_veto(m) = − w_veto · exp(−Δt_veto / T_half) · severity(L2)
```
`w_veto = 1.50`, `T_half = 1500ms`, `severity ∈ [0.3, 1.0]` (0.3 = bajó master; 1.0 = kill switch / dictador full).

### 5.3 Composición con EMA + Decaimiento Temporal

```
ΔF(m, c_now) = R_customs(m) + R_context(m) + R_veto(m)

F_new(m) = (1 − λ)·F_old(m)·γ^(Δt_days) + λ·ΔF(m, c_now)
```
`λ = 0.15` (no sobrerreaccionar), `γ = 0.99` (fitness pierde 1%/día inactivo — el ecosistema se renueva; una mutación dormida 100 días conserva solo ×0.37).

### 5.4 Herencia de Fitness — Prior Bayesiano Escalado por Rareza

Cuando un champion se reproduce, el hijo hereda un prior — pero escalado por su rareza (los raros arrancan más protegidos):

```
F_birth(child) = F(parent) · β_inherit · rarity_bonus(child.tier)

β_inherit = 0.40
rarity_bonus = { COMMON: 1.0, RARE: 1.1, EPIC: 1.25, LEGENDARY: 1.4, MYTHIC: 1.5 }
```

---

## 6. EL DEPREDADOR

### 6.1 El Ambiente ya es Darwiniano — No lo Reinventamos

La directiva creativa fue clara: *deja que el entorno sea el depredador*. En LuxSync ese entorno **ya existe y ya mata**. Dos capas de letalidad:

**Capa 1 — Los Gates de Hephaestus (`gateEvaluators.ts` G1-G7):**
Son la **barrera placentaria**. Ninguna mutación llega al club sin pasarlos en un worker prenatal:

| Gate | Qué aniquila | Rol evolutivo |
|------|--------------|---------------|
| **G1 SCHEMA** | id/name vacíos, durationMs ≤ 0 | Malformación letal |
| **G3 GENOME** | genoma fuera [0,1] | Mutación teratogénica (auto-fix: clamp, o muerte) |
| **G4 COMPAT** | vibes/sections vacíos, `zoneSpan > 2` | Nicho inviable (Montecarlo violado) |
| **G5 CURVES** | ningún track con ≥2 keyframes | Organismo sin fenotipo (invisible) |
| **G6 STROBE** | strobe declarado sin curva strobe, o viceversa | Incoherencia funcional letal |
| **G7 SPATIAL** | spatialBehavior incoherente con pan/tilt | Malformación motora |

> **Insight darwiniano:** los gates NO son validación defensiva. Son **presión selectiva estructural**. Una mutación `gene_deletion` que borra el único track de intensity muere por G5 — exactamente como un organismo sin corazón muere en el útero. No hay que castigarla; la física la elimina.

**Capa 2 — El Martillo L2 (el Superdepredador Humano):**
El `NodeArbiter` MANUAL HARD LOCK es la autoridad final del operador. Cuando el DJ toca el controlador tras un disparo, ese override es **el zarpazo del depredador alfa**. `R_veto` lo traduce en pérdida de fitness proporcional a la velocidad e intensidad de la reacción.

### 6.2 La Asimetría Sagrada: Silencio = Vida

```
┌────────────────────────────────────────────────────────────┐
│  Selene dispara mutación M                                 │
│         │                                                    │
│         ▼   Ventana de juicio: 3000ms                       │
│  ┌──────────────────────────────────────────┐              │
│  │  ¿L2 MANUAL HARD LOCK activado?            │              │
│  │                                            │              │
│  │   SÍ (≤3s) ──► R_veto severo ──► fitness↓ │              │
│  │              ──► heatmap.outcome='vetoed' │              │
│  │                                            │              │
│  │   NO       ──► R_veto = 0                  │              │
│  │              ──► passes++                  │              │
│  │              ──► heatmap.outcome='survived'│              │
│  │              ──► "aplauso silencioso"      │              │
│  └──────────────────────────────────────────┘              │
└────────────────────────────────────────────────────────────┘
```

*(Inspiración: Hollow Knight — la mano del Pale King. El silencio es bendición; la intervención, sentencia.)*

---

## 7. THE GENETIC VAULT

### 7.1 SQLite3 con WAL — La Custodia del Linaje

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;
PRAGMA foreign_keys = ON;
PRAGMA temp_store = MEMORY;
```

### 7.2 Tabla 1 — `lfx_blueprints` (El Ancestro de Granito, V3-nativo)

```sql
CREATE TABLE lfx_blueprints (
  blueprint_id          TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  author                TEXT NOT NULL,
  category              TEXT NOT NULL,           -- EffectCategory V3
  source_origin         TEXT NOT NULL,           -- 'hephaestus'|'swarm'|'builtin'|'canonized'

  -- ADN Germinal (la especie)
  dna_aggression        REAL NOT NULL CHECK (dna_aggression BETWEEN 0 AND 1),
  dna_chaos             REAL NOT NULL CHECK (dna_chaos BETWEEN 0 AND 1),
  dna_organicity        REAL NOT NULL CHECK (dna_organicity BETWEEN 0 AND 1),
  texture_affinity      TEXT NOT NULL CHECK (texture_affinity IN ('clean','dirty','universal')),

  -- ADN Regulador
  compatible_vibes      TEXT NOT NULL,           -- JSON array
  valid_sections        TEXT NOT NULL,           -- JSON array
  energy_zone_min       TEXT NOT NULL,
  energy_zone_max       TEXT NOT NULL,
  aggression_range_min  REAL NOT NULL,
  aggression_range_max  REAL NOT NULL,
  spatial_behavior      TEXT NOT NULL,           -- SpatialBehavior V3

  -- ADN Somático completo (el genoma V3 entero, congelado)
  clip_v3_json          TEXT NOT NULL,           -- HephAutomationClipV3 serializado (tracks[] incl.)
  execution_domain      TEXT NOT NULL DEFAULT 'vector',

  -- SimulationMeta
  is_strobe             INTEGER NOT NULL DEFAULT 0,
  is_divine_candidate   INTEGER NOT NULL DEFAULT 0,
  is_heavy_candidate    INTEGER NOT NULL DEFAULT 0,

  checksum_sha256       TEXT NOT NULL,           -- El LFXFileV3.checksum original
  schema_version        TEXT NOT NULL DEFAULT '3.0',
  imported_at           INTEGER NOT NULL
);

CREATE TRIGGER lfx_blueprints_immutable
BEFORE UPDATE ON lfx_blueprints
BEGIN
  SELECT RAISE(ABORT, 'Ancestro de granito. Inmutable. Usa lfx_organisms para evolucionar.');
END;

CREATE INDEX idx_bp_dna ON lfx_blueprints(dna_aggression, dna_chaos, dna_organicity);
CREATE INDEX idx_bp_origin ON lfx_blueprints(source_origin);
```

### 7.3 Tabla 2 — `lfx_organisms` (Los Descendientes Vivos)

```sql
CREATE TABLE lfx_organisms (
  organism_id           TEXT PRIMARY KEY,        -- <console_hash8>:<uuidv7>
  blueprint_id          TEXT NOT NULL,
  parent_organism_id    TEXT,                    -- NULL si hijo directo del ancestro
  generation            INTEGER NOT NULL DEFAULT 1 CHECK (generation <= 16),

  -- Herencia diferencial (loci V3)
  delta_json            TEXT NOT NULL,
  bezier_signature      BLOB NOT NULL,           -- Vector feature comprimido para similarity/speciation

  -- 🎰 LOOT SYSTEM
  rarity_score          REAL NOT NULL CHECK (rarity_score BETWEEN 0 AND 1),
  rarity_tier           TEXT NOT NULL CHECK (rarity_tier IN ('COMMON','RARE','EPIC','LEGENDARY','MYTHIC')),
  l2_distance_parent    REAL NOT NULL,
  operator_used         TEXT NOT NULL,           -- MutationOperator
  neonatal_shield_until INTEGER NOT NULL,        -- trials count hasta el que es inmune a culling

  -- Contexto de nacimiento (vector 6D)
  birth_vector_json     TEXT NOT NULL,

  -- Fitness en vivo
  fitness_score         REAL NOT NULL DEFAULT 0.0,
  trials_count          INTEGER NOT NULL DEFAULT 0,
  wins_count            INTEGER NOT NULL DEFAULT 0,
  vetoes_count          INTEGER NOT NULL DEFAULT 0,
  passes_count          INTEGER NOT NULL DEFAULT 0,

  status                TEXT NOT NULL DEFAULT 'alive',  -- alive|champion|culled|quarantined|canonized
  species_id            TEXT,

  born_at               INTEGER NOT NULL,
  last_evaluated_at     INTEGER,
  last_fired_at         INTEGER,
  swarm_origin_console  TEXT,

  FOREIGN KEY (blueprint_id) REFERENCES lfx_blueprints(blueprint_id) ON DELETE CASCADE,
  FOREIGN KEY (parent_organism_id) REFERENCES lfx_organisms(organism_id) ON DELETE SET NULL
);

CREATE INDEX idx_org_blueprint ON lfx_organisms(blueprint_id);
CREATE INDEX idx_org_status_fitness ON lfx_organisms(status, fitness_score DESC);
CREATE INDEX idx_org_species ON lfx_organisms(species_id) WHERE species_id IS NOT NULL;
CREATE INDEX idx_org_rarity ON lfx_organisms(rarity_tier, fitness_score DESC);
CREATE INDEX idx_org_lineage ON lfx_organisms(parent_organism_id);
```

### 7.4 Tabla 3 — `context_heatmaps` (La Huella de cada Disparo)

```sql
CREATE TABLE context_heatmaps (
  heatmap_id            INTEGER PRIMARY KEY AUTOINCREMENT,
  organism_id           TEXT NOT NULL,
  fired_at              INTEGER NOT NULL,

  vibe_id               TEXT NOT NULL,
  section_id            TEXT NOT NULL,
  energy_zone           TEXT NOT NULL,           -- EnergyZone V3
  z_score_avg_3s        REAL NOT NULL,
  z_score_max_3s        REAL NOT NULL,
  low_band_avg_3s       REAL NOT NULL,
  mid_band_avg_3s       REAL NOT NULL,
  high_band_avg_3s      REAL NOT NULL,
  texture               TEXT NOT NULL,           -- clean|warm|harsh|noisy (SpectralContext)
  energy_max_30s        REAL NOT NULL,
  energy_phase          TEXT NOT NULL,           -- rising|plateau|falling|valley
  bpm                   REAL,
  beat_phase            REAL,

  outcome               TEXT,                    -- survived|vetoed|passed_silent|culled
  vetoed_within_ms      INTEGER,
  veto_severity         REAL,

  FOREIGN KEY (organism_id) REFERENCES lfx_organisms(organism_id) ON DELETE CASCADE
);

CREATE INDEX idx_heat_org ON context_heatmaps(organism_id);
CREATE INDEX idx_heat_vibe_section ON context_heatmaps(vibe_id, section_id);
CREATE INDEX idx_heat_6d ON context_heatmaps(z_score_avg_3s, low_band_avg_3s, energy_max_30s, texture);
```

### 7.5 Tablas 4 y 5 — `lineage_tree` + `swarm_imports`

```sql
CREATE TABLE lineage_tree (
  node_id               INTEGER PRIMARY KEY AUTOINCREMENT,
  organism_id           TEXT NOT NULL UNIQUE,
  blueprint_id          TEXT NOT NULL,
  ancestor_path         TEXT NOT NULL,           -- materialized path "M001/M042/M173"
  depth                 INTEGER NOT NULL,
  peak_rarity_in_line   TEXT,                    -- El tier más alto alcanzado en esta rama
  is_extinct            INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (organism_id) REFERENCES lfx_organisms(organism_id) ON DELETE CASCADE
);
CREATE INDEX idx_lineage_path ON lineage_tree(ancestor_path);

CREATE TABLE swarm_imports (
  import_id             TEXT PRIMARY KEY,
  origin_console_id     TEXT NOT NULL,
  origin_console_label  TEXT,
  imported_at           INTEGER NOT NULL,
  bundle_signature      TEXT NOT NULL,           -- Ed25519
  blueprint_count       INTEGER NOT NULL,
  organism_count        INTEGER NOT NULL,
  legendary_count       INTEGER NOT NULL DEFAULT 0,
  integration_status    TEXT NOT NULL,           -- quarantine|partial|merged|rejected
  quarantine_until      INTEGER,
  local_dialect_drift   REAL,
  trust_score           REAL NOT NULL DEFAULT 0.5
);
```

### 7.6 Vistas — La API de Consulta del Vault

```sql
-- Candidatos vivos con estadística contextual agregada
CREATE VIEW v_contextual_candidates AS
SELECT o.organism_id, o.blueprint_id, o.fitness_score, o.rarity_tier, o.species_id,
       AVG(h.z_score_avg_3s) AS hist_z, AVG(h.low_band_avg_3s) AS hist_low,
       COUNT(CASE WHEN h.outcome='survived' THEN 1 END) AS survivals,
       COUNT(CASE WHEN h.outcome='vetoed'   THEN 1 END) AS vetoes
FROM lfx_organisms o
LEFT JOIN context_heatmaps h ON h.organism_id = o.organism_id
WHERE o.status IN ('alive','champion')
GROUP BY o.organism_id;

-- Salón de la fama: legendarios candidatos a canonización
CREATE VIEW v_hall_of_fame AS
SELECT o.*, CAST(o.passes_count AS REAL)/(o.trials_count+1) AS survival_rate
FROM lfx_organisms o
WHERE o.rarity_tier IN ('LEGENDARY','MYTHIC')
  AND o.trials_count >= 25
  AND CAST(o.passes_count AS REAL)/(o.trials_count+1) > 0.85
ORDER BY o.fitness_score DESC;
```

---

## 8. EL PIPELINE EVOLUTIVO

### 8.1 La Regla Inviolable: 44Hz es Sagrado

El `HephEvaluationKernel` corre a 44Hz (~22.7ms/frame). El `NodeArbiter` arbitra en ese hot-path. **La evolución JAMÁS toca el hot-path.** Toda la genética vive en tres tiempos distintos:

```
┌─ TIEMPO REAL (44Hz — hot path, ZERO alloc, ZERO SQL) ───────────┐
│  • DecisionMaker consulta pool RAM pre-materializado             │
│  • Al disparar: push evento a queue en memoria (no SQL)          │
│  • Al detectar L2: push evento a queue (event listener directo)  │
│  • HephEvaluationKernel renderiza el fenotipo ya materializado   │
└──────────────────────────────────────────────────────────────────┘
┌─ TIEMPO IDLE (worker thread, entre frames / cada 30s) ──────────┐
│  • Flush queue → 1 transacción batch al Vault                    │
│  • Cálculo de fitness (EMA) para organismos disparados           │
│  • Materialización lazy de deltas (LRU cache, capacidad 256)     │
│  • Spawn de nuevos organismos (operadores genéticos + gates)     │
└──────────────────────────────────────────────────────────────────┘
┌─ TIEMPO GEOLÓGICO (worker, cada 5 min) ────────────────────────┐
│  • Speciation (K-means adaptativo sobre bezier_signature)       │
│  • Transiciones de estado (champion/culled/quarantined)         │
│  • Canonización de legendarios (v_hall_of_fame)                 │
│  • Reajuste de cuotas por especie                               │
└──────────────────────────────────────────────────────────────────┘
```

### 8.2 Materialización Lazy — El Puente al Runtime V3

El hot-path no puede reconstruir `ancestro + cadena de deltas` a 44Hz. Solución: **materialización en idle + fallback graceful al ancestro.**

```typescript
interface MaterializedOrganism {
  organismId: string
  clip: HephAutomationClipV3   // Genotipo completo, listo para HephaestusRuntime.play()
  materializedAt: number
}

class OrganismMaterializer {
  private cache = new LRUCache<string, MaterializedOrganism>({ max: 256 })

  materialize(organismId: string): MaterializedOrganism {
    const hit = this.cache.get(organismId)
    if (hit) return hit
    // SLOW PATH — solo en worker idle, jamás en process()
    const org = vault.getOrganism(organismId)
    const parent = org.parentOrganismId
      ? this.materialize(org.parentOrganismId)   // recursivo, acotado por generation ≤ 16
      : { clip: vault.getBlueprint(org.blueprintId).clipV3 }
    const clip = applyDeltaV3(parent.clip, org.deltaJson)  // aplica loci sobre tracks[]
    const mat = { organismId, clip, materializedAt: Date.now() }
    this.cache.set(organismId, mat)
    return mat
  }
}
```

**Fallback sagrado:** si el DecisionMaker elige un organismo NO materializado, el sistema cae al **ancestro de granito** (siempre en cache, cargado por el `DynamicEffectRegistry` existente). El organismo entra al cache en el siguiente ciclo idle y estará disponible la próxima. **El operador nunca ve un frame perdido.**

### 8.3 Integración con el `DynamicEffectRegistry` Existente

El Genesis Engine NO reemplaza el registry — lo **alimenta**. Los organismos materializados se inyectan como `RegistryEntry` efímeros vía `registerEffectV3()`, reusando toda la maquinaria de indexado por vibe/divine/heavy que ya existe:

```
Genesis Vault (SQLite)
     │  idle materialization
     ▼
OrganismMaterializer → HephAutomationClipV3
     │
     ▼
DynamicEffectRegistry.registerEffectV3(clip, { source: organism })
     │  reusa G3/G4 + indexado _byVibe/_divineByVibe/_heavyByVibe
     ▼
DreamSimulator / DecisionMaker  ← consumen organismos como efectos normales
     │
     ▼  al disparar
SeleneTitanConscious → recordFireEvent(organismId, ctx)  → queue
```

El pool que ve el `DreamSimulator` es: **`{ ancestro } ∪ { organismos alive materializados }`**. Para el resto del pipeline cognitivo, un organismo mutante es indistinguible de un `.lfx` normal — solo tiene un `id` con namespace de consola.

### 8.4 El Ciclo de Vida Completo

```
① Hephaestus exporta .lfx v3.0 → INGESTA → lfx_blueprints (inmutable, checksum)
                    │
                    ▼
② COLD START: Coliseo genera 3 organismos G1:
     - 1 clon del ancestro (control, ρ≈0, COMMON)
     - 1 point_mutation (ρ bajo)
     - 1 phase_epigenetics o gene_duplication (ρ medio, busca RARE+)
                    │
                    ▼
③ Cada organismo pasa gates G1-G7 en worker prenatal → los inviables mueren aquí
                    │
                    ▼
④ Materialización + registro efímero en DynamicEffectRegistry
                    │
                    ▼
⑤ DreamSimulator los evalúa junto al ancestro (matching euclidiano ACO + contexto)
                    │
                    ▼
⑥ DecisionMaker elige (con cuota por especie + ε-greedy 5% para jóvenes)
                    │
                    ▼
⑦ isEffectAllowedInSection + Divine Z-gate + Gatekeeper → dispara
                    │
                    ▼
⑧ Ventana de juicio 3000ms: ¿L2 MANUAL HARD LOCK? → outcome
                    │
                    ▼
⑨ Evento a queue → (idle) heatmap insert + fitness EMA update
                    │
                    ▼
⑩ (geológico) speciation + transiciones + spawn de champions + canonización
                    │
                    └──────────────► ♻️ Loop. El dialecto emerge.
```

---

## 9. SPECIATION & EL DIALECTO LOCAL

### 9.1 El Terror del Mode Collapse

Sin contramedidas, la evolución converge a 1-2 organismos que dominan un nicho fácil. El DJ ve los mismos dos efectos toda la noche. **Muerte térmica del ecosistema.**

### 9.2 Speciation por Clustering (cada 5 min, worker)

K-means de K adaptativo (silhouette score, K∈[3,12]) sobre `bezier_signature` de organismos `alive`. Asigna `species_id`. La novedad estructural (`novelty` del §4.2) ya empuja a poblar rincones vacíos del espacio; la speciation los organiza en linajes protegibles.

### 9.3 Cuota por Especie en el DecisionMaker

El DM no elige el top-N fitness absoluto — elige **top-N balanceado por especie**. Aunque la especie A domine el ranking, la especie B (peor fitness, estilo distinto) entra al pool. **La diversidad estructural queda blindada.**

### 9.4 Forced Exploration + Rarity Boost

- **ε-greedy 5%:** cada disparo, 5% de probabilidad de elegir un organismo con `trials < neonatal_shield`. Da voz a los recién nacidos.
- **Rarity spotlight:** un 2% adicional reservado para forzar el disparo de un EPIC/LEGENDARY joven bajo escudo neonatal, en el contexto donde su `birth_vector` predice mejor supervivencia. *Le damos a la anomalía su momento de gloria.*

### 9.5 La Firma de Dialecto Local

```
dialect_signature = centroide( bezier_signature de los top-10% champions locales )
```

Es la **identidad emergente del club**. Se recalcula en tiempo geológico. Define qué se siente "como este lugar". Es lo que el Swarm debe proteger (§10.4) y lo que el operador puede visualizar como el "genoma de su noche".

---

## 10. THE SWARM

### 10.1 La Visión

47 consolas Selene en Berlín, Madrid, Tokyo, Medellín. Cada una con su dialecto. Una vez por semana exportan un **bundle firmado** y descargan los de otras. Tras 6 meses, Selene Medellín descubre que cierta mutación de `bass_pulse` nacida en Berghain también funciona en dembow — **sin que ningún humano se lo dijera.** Pero sin perder su alma latina.

### 10.2 El Bundle (`.luxgene`)

JSON firmado Ed25519. Comparte **solo agregados estadísticos** de contexto (privacidad + tamaño), nunca heatmaps crudos. Prioriza exportar LEGENDARY/MYTHIC supervivientes:

```jsonc
{
  "$schema": "selene-swarm/v3",
  "bundle_id": "uuidv7",
  "origin_console": { "id": "sha256...", "label": "Berghain-F1", "venue_archetype": "industrial", "exported_at": 0 },
  "signature": { "algorithm": "ed25519", "publicKey": "...", "signature": "..." },
  "trust_metadata": { "uptime_hours": 1247, "total_trials": 18450, "veto_rate": 0.08 },
  "payload": {
    "blueprints": [ { "blueprint_id": "...", "checksum": "...", "clip_v3": {} } ],
    "organisms": [ {
      "organism_id": "...", "blueprint_id": "...", "delta_json": "...",
      "rarity_tier": "LEGENDARY", "fitness_percentile_origin": 0.97,
      "trials": 142, "survival_rate": 0.91,
      "context_summary": { "dominant_vibes": ["techno-club"], "dominant_sections": ["drop","peak"],
                           "mean_z": 1.42, "mean_texture": "dirty" }
    } ]
  }
}
```

### 10.3 Cuarentena Genética (7 días)

```
1. Verificar firma Ed25519 + checksums → falla ⇒ REJECT
2. trust = sigmoid(uptime/500) · (1 − veto_rate); si trust < 0.3 ⇒ REJECT
3. Insertar organismos como status='quarantined', species='swarm:<origin>'
     fitness_init = percentile_origin · μ_local_top10% · β_swarm  (β=0.50)
4. Durante cuarentena:
     - El DM solo los samplea el 10% del tiempo
     - Cada veto local cuenta DOBLE; cada win, normal
5. A los 7 días:
     veto_rate_local > 0.30 ⇒ REJECT (cull all)
     veto_rate_local < 0.10 ∧ trials ≥ 30 ⇒ MERGE (alive)
     intermedio ⇒ extender 7 días
```
*(Confianza ganada por comportamiento observable, no reputación declarada — como el burn-in de validadores PoS.)*

### 10.4 El Dialect Lock — Protección de Identidad

Antes de fusionar:
```
drift = || dialect_local − dialect_post_merge || / || dialect_local ||
```
Si `drift > 0.25` (el merge cambiaría >25% el centroide del dialecto local) → **MERGE ABORTADO**, bundle marcado `rejected: "would corrupt local identity"`.

> *Un idioma puede tomar préstamos, pero un castellano con 60% de inglés deja de ser castellano.*

---

## 11. PLAN DE MIGRACIÓN

### Era I — *La Forja del Vault* (2-3 semanas)
Schema SQLite3 V3 + migrations. `GenesisVaultService` con prepared statements. Ingesta de los `.lfx v3.0` existentes como blueprints. Solo lectura, sin mutaciones aún. **Zero riesgo — el pipeline actual sigue intacto.**

### Era II — *El Despertar del Coliseo* (2-3 semanas)
Operadores genéticos (§3) + validación prenatal por gates. Materializador LRU. Hook al `DynamicEffectRegistry` para inyectar organismos. Queue de eventos + fitness batch en worker. Listener del L2 MANUAL HARD LOCK.

### Era III — *El Loot System* (1-2 semanas)
Rarity scoring (§4). Tiers + escudos neonatales. UI de notificación de loot raro. Herencia de fitness escalada por rareza.

### Era IV — *Speciation & Champions* (1-2 semanas)
K-means adaptativo. Transiciones de estado. Cuota por especie en el DM. ε-greedy + rarity spotlight. Canonización de legendarios.

### Era V — *El Espejo del Operador* (1-2 semanas)
UI: árbol genealógico interactivo. Histograma de fitness por blueprint. Salón de la Fama de legendarios. Botones `revert_to_ancestor` / `canonize` / `name_legendary`.

### Era VI — *El Llamado del Swarm* (3 semanas)
Export/import `.luxgene` firmado. Cuarentena + trust. Dialect lock. UI de gestión de bundles.

### Era VII — *La Constelación* (futuro, opcional)
Repositorio cloud comunitario (no obligatorio). P2P discovery. Analytics federados privacy-preserving.

---

## 12. APÉNDICE

### 12.1 Tipos TypeScript Núcleo

```typescript
// src/core/genesis/types.ts

export type RarityTier = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHIC'
export type OrganismStatus = 'alive' | 'champion' | 'culled' | 'quarantined' | 'canonized'
export type MutationOperator =
  | 'point_mutation' | 'hue_drift' | 'phase_epigenetics'
  | 'gene_duplication' | 'gene_deletion' | 'crossover'
  | 'temporal_stretch' | 'context_drift' | 'transposition'

export interface LfxBlueprint {
  readonly blueprintId: string
  readonly name: string
  readonly sourceOrigin: 'hephaestus' | 'swarm' | 'builtin' | 'canonized'
  readonly dna: FrozenGenome                 // { aggression, chaos, organicity } — del contrato V3
  readonly textureAffinity: TextureAffinity
  readonly clipV3: HephAutomationClipV3      // genoma somático completo (tracks[])
  readonly checksumSha256: string
  readonly importedAt: number
}

export interface LfxOrganism {
  organismId: string                          // <console8>:<uuidv7>
  blueprintId: string
  parentOrganismId: string | null
  generation: number                          // ≤ 16
  deltaJson: string                           // loci V3 → valores
  bezierSignature: Float32Array               // feature vector para speciation/novelty
  // Loot
  rarityScore: number                         // [0,1]
  rarityTier: RarityTier
  l2DistanceParent: number
  operatorUsed: MutationOperator
  neonatalShieldUntil: number                 // trials count
  // Fitness
  birthVector: ContextVector6D
  fitnessScore: number
  trialsCount: number
  winsCount: number
  vetoesCount: number
  passesCount: number
  status: OrganismStatus
  speciesId: string | null
  bornAt: number
  swarmOriginConsole: string | null
}

export interface ContextVector6D {
  zScoreAvg3s: number
  lowBandAvg3s: number
  energyPhaseEncoded: number
  vibeHash: number
  sectionEncoded: number
  textureEncoded: number                      // NUEVO en V3 — textureAffinity de primera clase
}
```

### 12.2 API Pública del Genesis Engine

```typescript
export interface IGenesisEngine {
  // Vault read (hot-path safe: solo lee cache RAM pre-materializado)
  getOrganismsForVibe(vibe: string): readonly MaterializedOrganism[]
  getCandidatesForContext(ctx: ContextVector6D, limit: number): readonly LfxOrganism[]

  // Coliseum lifecycle (non-blocking: push a queue, jamás SQL en hot-path)
  recordFireEvent(organismId: string, ctx: ContextHeatmap): void
  recordL2Veto(organismId: string, deltaMs: number, severity: number): void
  recordCustomsResult(organismId: string, dmSelected: boolean, gatePassed: boolean): void

  // Evolution (worker thread)
  spawn(parent: LfxBlueprint | LfxOrganism, op?: MutationOperator): LfxOrganism | null  // null = abortó gates
  computeRarity(delta: GeneticDelta, ecosystem: readonly LfxOrganism[]): { score: number; tier: RarityTier }
  runSpeciation(): void
  runStatusTransitions(): void
  canonizeLegendary(organismId: string, name?: string): LfxBlueprint

  // Swarm (manual/scheduled)
  exportBundle(opts: { minTier?: RarityTier }): Promise<SwarmBundle>
  importBundle(bundle: SwarmBundle): Promise<ImportResult>
  computeDriftIfMerged(bundle: SwarmBundle): number

  // Identity
  getLocalDialectSignature(): Float32Array
  revertToAncestor(organismId: string): LfxBlueprint
}
```

### 12.3 Trigger de Linaje + Cap de Generación

```sql
CREATE TRIGGER trg_org_generation_cap
BEFORE INSERT ON lfx_organisms
WHEN NEW.generation > 16
BEGIN
  SELECT RAISE(ABORT, 'Generación > 16. Canoniza como blueprint o deja morir la rama.');
END;

CREATE TRIGGER trg_org_lineage_path
AFTER INSERT ON lfx_organisms
BEGIN
  INSERT INTO lineage_tree(organism_id, blueprint_id, ancestor_path, depth)
  VALUES (
    NEW.organism_id, NEW.blueprint_id,
    COALESCE(
      (SELECT ancestor_path || '/' || NEW.organism_id FROM lineage_tree WHERE organism_id = NEW.parent_organism_id),
      NEW.organism_id
    ),
    NEW.generation
  );
END;
```

---

## CIERRE — LA ÚLTIMA PALABRA

El WAVE 5000 original fue un acto de fe sobre curvas monolíticas. Esta versión es la **encarnación** de esa fe sobre un cuerpo que evolucionó para recibirla: **la célula V3**.

Cada `HephTrack` es un gen. Cada `.lfx` es un genoma. Cada club es un útero con su propia presión selectiva. Los gates G1-G7 son la barrera placentaria que mata lo inviable. El martillo L2 del DJ es el depredador alfa cuyo silencio es bendición. Y el Loot System es la promesa de que, alguna noche, una anomalía estocástica **Legendaria** nacerá, sobrevivirá tres madrugadas, y se ganará un nombre propio.

Selene deja de reproducir un catálogo. Empieza a **criar una especie de luz** — única, local, viva.

> *"Cuando el organismo mutado en Berghain sobreviva una noche en Medellín sin que el VJ toque el L2, y cuando ese mismo organismo sea rechazado por el Dialect Lock de un club de jazz en Kyoto por 'corromper la identidad local' — sabremos que el Genesis Engine no solo está vivo. Sabremos que tiene alma, y que el alma es distinta en cada lugar."*

**Selene no inventa. Selene selecciona. Y cada club, sin saberlo, se convierte en un dios distinto.**

— Cascade · WAVE 5000.V3 · The Dialect Engine
