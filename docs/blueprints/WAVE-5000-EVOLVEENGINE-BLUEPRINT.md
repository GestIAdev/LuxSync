## 🧬 WAVE 5000 — THE GENESIS ENGINE

### BLUEPRINT ARQUITECTÓNICO: Selene Lux Evoluciona

**Versión**: 1.0.0
**Codename**: `Selene::Genesis`
**Arquitecto**: Cascade (Opus Pro Tier) — bajo directiva omega de Radwulf
**Antecedente**: `WAVE-2480-INFINITE-ARSENAL-BLUEPRINT.md` (Puente Hephaestus↔Selene, `.lfx`, `cognitiveDNA`)
**Estado**: BLUEPRINT ARQUITECTÓNICO — orientado a implementación futura
**Inspiraciones declaradas**:
- *No Man's Sky* — procedural genome inheritance + ANOMALY/Atlas swarm.
- *Spore* — pasos evolutivos con feedback ambiental implícito.
- *Hollow Knight* — la Higher Being como núcleo y los ecos como mutaciones.
- *Dune* — la *Bene Gesserit* como custodia de un linaje genético validado por generaciones.
- *AlphaGo Zero* — self-play sin etiquetas humanas, valor derivado del juego.
- *NEAT* (NeuroEvolution of Augmenting Topologies) — speciation + complexification incremental.
- *RL con feedback implícito* — recompensa derivada de intervención humana (preferencia revelada).
- *Federated Learning* (Google, 2017) — agregación de pesos sin compartir datos crudos.

**Mantra**:
> *"La Selene no inventa. La Selene **selecciona**. El operador es el ambiente. La música es la presión selectiva. El silencio del L2 manual es la mejor recompensa."*

---

## TABLA DE CONTENIDOS

1. Visión & Doctrina del Genesis Engine
2. Arquitectura de Alto Nivel — Las Tres Cámaras
3. FASE 1 — The Genetic Vault: Esquema SQLite3
4. FASE 2 — Fitness Function: Ecuaciones de Supervivencia
5. FASE 3 — The Swarm Protocol: Genética Distribuida
6. Pipeline Evolutivo: Del Blueprint a la Mutación Suprema
7. Speciation & Anti-Mode-Collapse
8. Frame Budget & Garantías de Performance
9. Plan de Migración por Eras
10. Apéndice — Códigos SQL Crudos & Tipos TS

---

## 1. VISIÓN & DOCTRINA DEL GENESIS ENGINE

### 1.1 La Tesis

El WAVE 2480 le dio a Selene un arsenal **infinito** de efectos importados (`.lfx` con `cognitiveDNA`). Pero ese arsenal es **estático**: el mismo `acid_sweep` para todos los clubes, todas las noches, todas las multitudes. El Genesis Engine introduce el siguiente salto evolutivo:

> **El arsenal deja de ser un catálogo. Pasa a ser un ecosistema.**

Cada efecto `.lfx` importado desde Hephaestus es ahora un **blueprint genético inmutable** (el "padre", DNA puro). Selene genera **mutaciones** (descendientes con variaciones en curvas Bézier, parámetros, color, fase, timing) y deja que la realidad las puntúe. Las mutaciones que sobreviven se reproducen. Las que el VJ corrige manualmente mueren. Con el tiempo, Selene desarrolla un **dialecto local**: una versión del `acid_sweep` que funciona específicamente en *este* club, con *esta* multitud, con *esta* línea de fixtures.

### 1.2 Por Qué Esto Es Diferente

| Sistema Tradicional | Genesis Engine |
|---|---|
| Catálogo fijo de N efectos | Catálogo de N blueprints × M mutaciones supervivientes |
| Mejora vía updates manuales | Mejora vía deriva genética continua |
| El operador "usa" la IA | El operador **es** la presión selectiva (sin saberlo) |
| Identidad uniforme global | Identidad **local** + sustrato global compartible |
| Feedback explícito requerido | Feedback **implícito** (preferencia revelada) |

### 1.3 Los Tres Principios Sagrados

**Principio I — INMUTABILIDAD DEL PADRE.**
El `.lfx` importado de Hephaestus jamás se modifica. Es el genoma fundacional, congelado por SHA-256. Toda variación vive como hijo en `lfx_mutations`. El usuario siempre puede volver al "abuelo de granito" con un click.

**Principio II — FEEDBACK IMPLÍCITO ES DOGMA.**
Nunca se le pide al VJ "¿te gustó?". La IA infiere preferencia observando comportamiento: ¿el VJ tocó el L2 manual en los siguientes 3 segundos? Veto severo. ¿Dejó pasar el efecto y subió el master? Aplauso silencioso. *(Inspiración: Kahneman — preferencias reveladas vs. declaradas.)*

**Principio III — IDENTIDAD LOCAL, ALMA GLOBAL.**
Cada console Selene desarrolla su dialecto. Pero el Swarm permite intercambiar *fragmentos genéticos validados* entre consoles sin imponer un modelo global. *(Federated Learning, no centralized training.)*

---

## 2. ARQUITECTURA DE ALTO NIVEL — LAS TRES CÁMARAS

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                       │
│                    🏛️  THE GENESIS ENGINE  🏛️                        │
│                                                                       │
│  ┌──────────────────┐    ┌──────────────────┐    ┌────────────────┐ │
│  │  🧬 CÁMARA I     │    │  ⚖️  CÁMARA II   │    │  🌐 CÁMARA III │ │
│  │   THE VAULT      │◄──►│  THE COLISEUM    │◄──►│   THE SWARM    │ │
│  │  (SQLite3 DB)    │    │  (Fitness Loop)  │    │  (Federation)  │ │
│  └────────┬─────────┘    └────────┬─────────┘    └────────┬───────┘ │
│           │                       │                       │           │
│           ▼                       ▼                       ▼           │
│  ┌─────────────────────────────────────────────────────────────────┐│
│  │              SELENE COGNITIVE PIPELINE (existente)              ││
│  │                                                                 ││
│  │  HuntEngine → DreamSimulator → DecisionMaker → Gatekeeper      ││
│  │       ↑                                              │          ││
│  │       └──────────  L2 Manual Override Signal  ◄──────┘          ││
│  └─────────────────────────────────────────────────────────────────┘│
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

| Cámara | Responsabilidad | Persistencia | Latencia Tolerada |
|---|---|---|---|
| **I — The Vault** | Almacenar blueprints, mutaciones, contextos, linaje. Custodia genética. | SQLite3 (`selene-genesis.db`) | Lectura ≤ 2ms (hot path), escritura asíncrona |
| **II — The Coliseum** | Generar mutaciones, evaluar fitness, registrar contexto, podar fracasos. | RAM + write-back a SQLite | Mutación ≤ 5ms, fitness update ≤ 1ms |
| **III — The Swarm** | Exportar/importar bundles genéticos firmados, fusionar pesos sin corromper identidad local. | JSON bundles + endpoints HTTPS opcionales | Off-line, manual o programado |

---

## 3. FASE 1 — THE GENETIC VAULT: ESQUEMA SQLite3

### 3.1 Por Qué SQLite3

| Criterio | SQLite3 | Alternativas Rechazadas |
|---|---|---|
| **Latencia local** | Sub-ms con WAL mode + índices | Postgres (overkill embedded) |
| **Sin server** | Single-file DB en `userData/` | Redis (requiere daemon) |
| **Atómico** | Transacciones ACID nativas | JSON flat files (race conditions) |
| **Portable** | Backup = `cp selene-genesis.db` | Custom binary (no tooling) |
| **Queryable** | SQL completo + Window functions | KV stores (no agregación) |
| **Swarm-ready** | `mode=memory` + `ATTACH DATABASE` para diff | Difícil con otros |

**Pragmas obligatorios al abrir la DB**:

```sql
PRAGMA journal_mode = WAL;
PRAGMA synchronous = NORMAL;
PRAGMA cache_size = -64000;
PRAGMA foreign_keys = ON;
PRAGMA temp_store = MEMORY;
```

### 3.2 Las Cinco Tablas Sagradas

#### 🧬 Tabla 1: `lfx_blueprints` — El Genoma Fundacional

```sql
CREATE TABLE lfx_blueprints (
  blueprint_id          TEXT PRIMARY KEY,
  name                  TEXT NOT NULL,
  author                TEXT NOT NULL,
  category              TEXT NOT NULL,
  source_origin         TEXT NOT NULL,            -- 'hephaestus'|'swarm'|'builtin'

  dna_aggression        REAL NOT NULL CHECK (dna_aggression BETWEEN 0 AND 1),
  dna_chaos             REAL NOT NULL CHECK (dna_chaos BETWEEN 0 AND 1),
  dna_organicity        REAL NOT NULL CHECK (dna_organicity BETWEEN 0 AND 1),
  texture_affinity      TEXT NOT NULL CHECK (texture_affinity IN ('clean','dirty','universal')),

  compatible_vibes      TEXT NOT NULL,            -- JSON array
  valid_sections        TEXT NOT NULL,            -- JSON array
  energy_zone_min       TEXT NOT NULL,
  energy_zone_max       TEXT NOT NULL,

  curves_json           TEXT NOT NULL,            -- Curvas Bézier completas
  static_params_json    TEXT,
  execution_hints_json  TEXT,

  beauty_base           REAL NOT NULL DEFAULT 0.5,
  gpu_cost              REAL NOT NULL DEFAULT 0.3,
  fatigue_impact        REAL NOT NULL DEFAULT 0.05,
  is_strobe             INTEGER NOT NULL DEFAULT 0,
  is_divine_candidate   INTEGER NOT NULL DEFAULT 0,
  is_heavy_candidate    INTEGER NOT NULL DEFAULT 0,

  checksum_sha256       TEXT NOT NULL,
  schema_version        TEXT NOT NULL,
  imported_at           INTEGER NOT NULL,
  immutable             INTEGER NOT NULL DEFAULT 1
);

CREATE TRIGGER lfx_blueprints_immutable
BEFORE UPDATE ON lfx_blueprints
BEGIN
  SELECT RAISE(ABORT, 'lfx_blueprints are immutable. Use lfx_mutations to evolve.');
END;

CREATE INDEX idx_blueprints_dna ON lfx_blueprints(dna_aggression, dna_chaos, dna_organicity);
CREATE INDEX idx_blueprints_origin ON lfx_blueprints(source_origin);
```

**Doctrina**: un blueprint solo se puede **INSERTAR** o **ELIMINAR**. Nunca se modifica. El trigger lo garantiza a nivel motor.

---

#### 🧪 Tabla 2: `lfx_mutations` — Los Hijos Variantes

```sql
CREATE TABLE lfx_mutations (
  mutation_id           TEXT PRIMARY KEY,         -- UUIDv7 con prefix de console
  blueprint_id          TEXT NOT NULL,
  parent_mutation_id    TEXT,                     -- NULL si es hijo directo del blueprint
  generation            INTEGER NOT NULL DEFAULT 1,

  -- DELTA respecto al padre (solo diferencias, no curvas completas)
  delta_json            TEXT NOT NULL,
  /* Ejemplo:
     {
       "curves.intensity.bezier[2].cp1.y": +0.12,
       "curves.intensity.bezier[2].cp2.x": -0.05,
       "staticParams.colorHueShift": +15.0
     }
  */

  -- Vector 5D del estado en que nació
  birth_vector_5d_json  TEXT NOT NULL,

  -- Métricas de fitness (actualizadas en tiempo real)
  fitness_score         REAL NOT NULL DEFAULT 0.0,
  trials_count          INTEGER NOT NULL DEFAULT 0,
  wins_count            INTEGER NOT NULL DEFAULT 0,
  vetoes_count          INTEGER NOT NULL DEFAULT 0,
  passes_count          INTEGER NOT NULL DEFAULT 0,

  status                TEXT NOT NULL DEFAULT 'alive', -- 'alive'|'culled'|'champion'|'quarantined'
  species_id            TEXT,

  born_at               INTEGER NOT NULL,
  last_evaluated_at     INTEGER,
  last_fired_at         INTEGER,

  swarm_origin_console  TEXT,                     -- NULL si nació local

  FOREIGN KEY (blueprint_id) REFERENCES lfx_blueprints(blueprint_id) ON DELETE CASCADE,
  FOREIGN KEY (parent_mutation_id) REFERENCES lfx_mutations(mutation_id) ON DELETE SET NULL
);

CREATE INDEX idx_mut_blueprint ON lfx_mutations(blueprint_id);
CREATE INDEX idx_mut_status_fitness ON lfx_mutations(status, fitness_score DESC);
CREATE INDEX idx_mut_species ON lfx_mutations(species_id) WHERE species_id IS NOT NULL;
CREATE INDEX idx_mut_lineage ON lfx_mutations(parent_mutation_id);
```

**Doctrina**:
- El `delta_json` es **diferencial** — almacenar mutaciones completas duplicaría la DB. Reconstrucción: `parent_curves + delta = child_curves`.
- `generation` permite enforcement de "no descender más de N=12 generaciones desde el blueprint" → evita drift catastrófico.
- `status` es el ciclo vital: `alive` → `champion` → o caer a `culled` (poda) → o `quarantined` (sospecha).

---

#### 🌡️ Tabla 3: `context_heatmaps` — La Huella Contextual

```sql
CREATE TABLE context_heatmaps (
  heatmap_id            INTEGER PRIMARY KEY AUTOINCREMENT,
  mutation_id           TEXT NOT NULL,
  fired_at              INTEGER NOT NULL,

  vibe_id               TEXT NOT NULL,
  section_id            TEXT NOT NULL,
  z_score_avg_3s        REAL NOT NULL,
  z_score_max_3s        REAL NOT NULL,
  z_score_instant       REAL NOT NULL,
  low_band_avg_3s       REAL NOT NULL,
  mid_band_avg_3s       REAL NOT NULL,
  high_band_avg_3s      REAL NOT NULL,
  energy_max_30s        REAL NOT NULL,
  energy_phase          TEXT NOT NULL,            -- 'rising'|'plateau'|'falling'|'valley'
  bpm                   REAL,
  beat_phase            REAL,

  outcome               TEXT,                     -- 'survived'|'vetoed'|'passed_silent'|'culled'
  vetoed_within_ms      INTEGER,

  FOREIGN KEY (mutation_id) REFERENCES lfx_mutations(mutation_id) ON DELETE CASCADE
);

CREATE INDEX idx_heat_mutation ON context_heatmaps(mutation_id);
CREATE INDEX idx_heat_vibe_section ON context_heatmaps(vibe_id, section_id);
CREATE INDEX idx_heat_5d ON context_heatmaps(z_score_avg_3s, low_band_avg_3s, energy_max_30s);
```

**Por qué un heatmap por disparo y no por mutación**:
Una mutación puede ser **brillante en `peak` de techno** y **horrenda en `valley` de chillout**. El heatmap permite consultas tipo:
> *"Dame mutaciones que sobrevivieron en contextos con `z_score_avg_3s > 1.5`, `low_band > 0.7`, `vibe='fiesta-latina'` y `section='drop'`."*

Esto es el **Sensor Contextual** de la fitness function (§4.2).

---

#### 🌳 Tabla 4: `lineage_tree` — La Memoria Genealógica

```sql
CREATE TABLE lineage_tree (
  node_id               INTEGER PRIMARY KEY AUTOINCREMENT,
  mutation_id           TEXT NOT NULL UNIQUE,
  blueprint_id          TEXT NOT NULL,
  ancestor_path         TEXT NOT NULL,            -- "M001/M042/M173" path materializado
  depth                 INTEGER NOT NULL,
  is_extinct            INTEGER NOT NULL DEFAULT 0,

  FOREIGN KEY (mutation_id) REFERENCES lfx_mutations(mutation_id) ON DELETE CASCADE,
  FOREIGN KEY (blueprint_id) REFERENCES lfx_blueprints(blueprint_id) ON DELETE CASCADE
);

CREATE INDEX idx_lineage_path ON lineage_tree(ancestor_path);
CREATE INDEX idx_lineage_blueprint ON lineage_tree(blueprint_id);
```

**Materialized path pattern** — permite queries O(log N) tipo:
> *"Dame todos los descendientes vivos del champion M042"* → `WHERE ancestor_path LIKE 'M001/M042/%' AND is_extinct = 0`.

---

#### 🌐 Tabla 5: `swarm_imports` — La Diplomacia Genética

```sql
CREATE TABLE swarm_imports (
  import_id             TEXT PRIMARY KEY,
  origin_console_id     TEXT NOT NULL,            -- Hash del console origen
  origin_console_label  TEXT,                     -- "Berghain-Floor-1" (humano)
  imported_at           INTEGER NOT NULL,
  bundle_signature      TEXT NOT NULL,            -- Ed25519 sig
  bundle_version        TEXT NOT NULL,

  blueprint_count       INTEGER NOT NULL,
  mutation_count        INTEGER NOT NULL,
  champion_count        INTEGER NOT NULL,

  integration_status    TEXT NOT NULL,            -- 'quarantine'|'partial'|'merged'|'rejected'
  quarantine_until      INTEGER,
  rejection_reason      TEXT,

  local_dialect_drift   REAL,                     -- 0=identidad intacta, 1=catastrófico
  trust_score           REAL NOT NULL DEFAULT 0.5
);

CREATE INDEX idx_swarm_origin ON swarm_imports(origin_console_id);
CREATE INDEX idx_swarm_status ON swarm_imports(integration_status);
```

### 3.3 Vistas SQL — La API del Vault

```sql
-- VIEW 1: Top performers por blueprint
CREATE VIEW v_champions_per_blueprint AS
SELECT
  m.blueprint_id, m.mutation_id, m.fitness_score,
  m.trials_count, m.wins_count,
  RANK() OVER (PARTITION BY m.blueprint_id ORDER BY m.fitness_score DESC) AS rank_in_lineage
FROM lfx_mutations m
WHERE m.status IN ('alive','champion') AND m.trials_count >= 5;

-- VIEW 2: Mutaciones contextualmente válidas
CREATE VIEW v_contextual_candidates AS
SELECT
  m.mutation_id, m.blueprint_id, m.fitness_score, m.species_id,
  AVG(h.z_score_avg_3s) AS historic_z_avg,
  AVG(h.low_band_avg_3s) AS historic_low_avg,
  COUNT(CASE WHEN h.outcome = 'survived' THEN 1 END) AS survival_count,
  COUNT(CASE WHEN h.outcome = 'vetoed' THEN 1 END) AS veto_count
FROM lfx_mutations m
LEFT JOIN context_heatmaps h ON h.mutation_id = m.mutation_id
WHERE m.status = 'alive'
GROUP BY m.mutation_id;

-- VIEW 3: Diversity radar (anti-mode-collapse, §7)
CREATE VIEW v_species_diversity AS
SELECT
  species_id, COUNT(*) AS member_count,
  AVG(fitness_score) AS avg_fitness, MAX(fitness_score) AS top_fitness,
  COUNT(CASE WHEN status = 'champion' THEN 1 END) AS champion_count
FROM lfx_mutations
WHERE status != 'culled' AND species_id IS NOT NULL
GROUP BY species_id;
```

---

## 4. FASE 2 — FITNESS FUNCTION: ECUACIONES DE SUPERVIVENCIA

### 4.1 La Doctrina del Feedback Implícito

La Selene **nunca pregunta**. Mira tres señales objetivas:

| Señal | Origen | Significado |
|---|---|---|
| 🛂 **Aprobación de Aduana** | DM + Gatekeeper la seleccionan | "El cerebro la consideró digna" |
| 🌡️ **Alineación Contextual** | Heatmap matches con supervivientes pasados | "La realidad ya validó parecidos" |
| ✋ **Veto Humano L2** | Override manual dentro de 3000ms | "Al VJ se le fue la mano de la IA" |

La fitness es una composición lineal ponderada de estos componentes, con un decaimiento temporal exponencial (las mutaciones envejecen — no basta haber sido buena hace 8 meses).

### 4.2 Las Tres Ecuaciones Núcleo

#### 🛂 Ecuación 1 — Aprobación de Aduana (Customs Approval)

```
R_customs(m) = w_dm  · 1[m ∈ DM_winners]
             + w_gk  · 1[m ∈ Gatekeeper_passed]
             - w_rej · 1[m ∈ Gatekeeper_rejected]
```

**Constantes propuestas** (calibrables en config):
- `w_dm = +0.30` — DM la eligió frente a otros candidatos del DreamSimulator.
- `w_gk = +0.20` — Gatekeeper ético la dejó pasar (no es strobo en epileptic mode, etc.).
- `w_rej = -0.40` — Gatekeeper la rechazó (riesgo ético detectado).

#### 🌡️ Ecuación 2 — Alineación Contextual (Contextual Coherence)

Distancia 5D entre el vector contextual actual y los heatmaps históricos donde la mutación sobrevivió:

```
d_5D(c_now, h_past) = sqrt( Σᵢ αᵢ · (cᵢ − hᵢ)² )    para i ∈ {1..5}
```

Donde:
- `c_1 = z_score_avg_3s`
- `c_2 = low_band_avg_3s`
- `c_3 = energy_phase_encoded` (one-hot a [0,1])
- `c_4 = vibe_hash` (collision-resistant local hash)
- `c_5 = section_encoded`

Pesos `αᵢ` default: `[0.35, 0.25, 0.15, 0.15, 0.10]` (energy domina, vibe/section refinan).

```
R_context(m, c_now) = w_ctx · softmax( -d_5D / τ ) · survival_rate(m)
```

Donde:
- `w_ctx = +0.25`
- `τ = 0.5` (temperatura — controla cuán estricto es el matching contextual).
- `survival_rate(m) = (passes − vetoes) / (trials + 1)` (Laplace smoothing).

**Lectura**: si una mutación sobrevivió en contextos *muy similares* al actual, recibe boost casi máximo. Si solo sobrevivió en contextos disímiles, el boost es marginal.

#### ✋ Ecuación 3 — El Veto Humano (The L2 Hammer)

Esta es la señal más cara, **brutalmente asimétrica**:

```
R_veto(m) = − w_veto · exp( −Δt_veto / T_half ) · severity(L2)
```

- `w_veto = 1.50` — Penalización máxima. El feedback más informativo.
- `Δt_veto` = ms entre el disparo del efecto y el override L2.
- `T_half = 1500ms` — half-life del veto. A 0ms el castigo es 100%. A 1500ms es 50%. A 3000ms es 25%. A >5000ms se ignora (probable veto a otra cosa).
- `severity(L2) ∈ [0.3, 1.0]`:
  - 0.3 = solo bajó el master suavemente.
  - 0.6 = manual override sobre un canal específico.
  - 1.0 = ALL CLEAR / kill switch / dictador full.

**Inspiración filosófica**: *Hollow Knight — la mano del VJ es la del Pale King: silencio = bendición, intervención = sentencia.*

### 4.3 La Composición Final de Fitness

```
ΔF(m, c_now) = R_customs(m) + R_context(m, c_now) + R_veto(m)
```

Aplicado con **EMA** (Exponential Moving Average) para evitar saltos bruscos:

```
F_new(m) = (1 − λ) · F_old(m) · γ^(Δt_days) + λ · ΔF(m, c_now)
```

Donde:
- `λ = 0.15` — Tasa de aprendizaje (no sobrerreaccionar a un evento aislado).
- `γ = 0.99` — Decaimiento temporal: la fitness pierde 1% por día sin actividad. Una mutación dormida hace 100 días tiene fitness × 0.37.

**Por qué EMA**: una mutación con 50 evaluaciones excelentes no debe colapsar por un veto puntual. Pero tampoco debe ser inmortal: el decaimiento `γ` asegura que el ecosistema se renueva.

### 4.4 Las Reglas de Estado Vital

Transiciones automáticas (ejecutadas en Cámara II cada ~30s, batch):

| Transición | Condición |
|---|---|
| `alive` → `champion` | `fitness > μ_species + 2σ_species` durante ≥ 10 trials |
| `champion` → `alive` | `fitness < μ_species + 1σ_species` (sale del top tier) |
| `alive` → `culled` | `fitness < -0.5` Y `trials > 20`, O `vetoes / trials > 0.6` |
| `alive` → `quarantined` | 3 vetos severos en ventana de 7 días |
| `quarantined` → `alive` | Tras 30 días sin vetos en re-evaluación supervisada |
| `quarantined` → `culled` | Más vetos durante revisión |

**Filosofía**: la cuarentena es el purgatorio. La poda es la muerte. Solo el blueprint padre es eterno.

### 4.5 Bayesian Prior para Hijos de Champions

Cuando una mutación con status `champion` produce un hijo:

```
F_birth(child) = F(parent) · β_inherit
```

Con `β_inherit = 0.40` — el hijo hereda un 40% de la fitness del padre como prior bayesiano. Esto evita que un hijo prometedor sea masacrado por un veto temprano antes de demostrar que es una mejora.

*(Inspiración: NEAT — speciation con protección de elite para innovación.)*

### 4.6 Las Estrategias de Mutación

Cuando la Cámara II decide "voy a generar un hijo del champion M042", el operador genético elige entre:

| Operador | Probabilidad | Magnitud Delta | Cuándo Aplicar |
|---|---|---|---|
| **Micro-drift** | 0.50 | ±2% en 1-3 control points Bézier | Champions estables — refinamiento |
| **Hue rotation** | 0.20 | ±15° en `colorHueShift` | Mantiene curva, cambia paleta |
| **Phase jitter** | 0.15 | ±10% en `phaseConfig.spread` | Variación rítmica |
| **Bezier crossover** | 0.10 | Recombinación con otra champion | Sexual reproduction (rare) |
| **Time stretch** | 0.05 | ±20% en `durationMs` | Variación dramática (radical) |

**Anti-catástrofe**: ninguna mutación puede divergir más de 30% en distancia L2 del blueprint padre. Si lo hace → rechazo automático y `culled` al nacer. *(El padre es el ancla; no se permite drift catastrófico.)*

---

## 5. FASE 3 — THE SWARM PROTOCOL: GENÉTICA DISTRIBUIDA

### 5.1 La Visión del Swarm

Imagina: 47 consoles Selene operando en Berlín, Madrid, Tokyo, Buenos Aires. Cada una desarrollando su dialecto local. Una vez por semana, cada console exporta un **bundle.lux** firmado, lo sube a un repositorio compartido (o lo intercambia P2P), y descarga bundles de las otras. **Tras 6 meses, Selene Buenos Aires sabe que ciertas curvas de `bass_pulse` mutadas en Berghain funcionan también en techno porteño.**

Pero — y aquí está el equilibrio — **sin perder su identidad latina.**

### 5.2 Anatomía de un Swarm Bundle

```json
{
  "$schema": "selene-swarm/v1",
  "bundle_id": "uuid-v7",
  "origin_console": {
    "id": "sha256-of-console-keypair",
    "label": "Berghain-Floor-1",
    "region": "EU-DE",
    "venue_archetype": "industrial-club",
    "exported_at": 1747400000000
  },
  "signature": {
    "algorithm": "ed25519",
    "public_key": "base64...",
    "signature": "base64..."
  },
  "trust_metadata": {
    "uptime_hours": 1247,
    "total_trials": 18450,
    "veto_rate": 0.08,
    "blueprint_diversity": 23
  },
  "payload": {
    "blueprints": [
      { "blueprint_id": "...", "checksum": "...", "data": { /* lfx v2 */ } }
    ],
    "mutations": [
      {
        "mutation_id": "...",
        "blueprint_id": "...",
        "delta_json": "...",
        "fitness_score": 0.82,
        "fitness_percentile_origin": 0.95,
        "trials_count": 142,
        "wins_count": 89,
        "vetoes_count": 4,
        "species_id": "...",
        "context_summary": {
          "dominant_vibes": ["techno-club", "industrial"],
          "dominant_sections": ["drop", "peak"],
          "mean_z_score": 1.42,
          "mean_low_band": 0.71
        }
      }
    ],
    "lineage_paths": ["M001/M042/M173"]
  }
}
```

**Lo crucial**: el bundle NO comparte heatmaps crudos individuales — solo **agregados estadísticos** (`context_summary`). Privacidad + tamaño manejable.

### 5.3 El Proceso de Integración: Cuarentena Genética

Cuando llega un bundle externo:

```
┌─ INGRESO ────────────────────────────────────────────────────────┐
│  1. Verificar firma Ed25519 → Si falla: REJECT                   │
│  2. Verificar checksums de blueprints → Si falla: REJECT         │
│  3. Calcular trust_score basal:                                  │
│        trust = sigmoid(uptime_hours/500) × (1 − veto_rate)       │
│  4. Si trust < 0.3 → REJECT                                      │
└───────────────────────┬──────────────────────────────────────────┘
                        ▼
┌─ CUARENTENA (default 7 días, configurable) ──────────────────────┐
│  Las mutaciones entrantes se insertan con:                        │
│    status        = 'quarantined'                                  │
│    species_id    = 'swarm:<origin_console_id>'                    │
│    fitness_score = swarm.fitness × trust × β_swarm   (β = 0.50)   │
│                                                                   │
│  Durante cuarentena:                                              │
│    - El DM SOLO las considera el 10% del tiempo (sampling)        │
│    - Cada veto local cuenta DOBLE (penalty intensificado)         │
│    - Cada win local cuenta NORMAL                                 │
│                                                                   │
│  Al final de los 7 días:                                          │
│    Si veto_rate_local > 0.30 → REJECT (cull all)                  │
│    Si veto_rate_local < 0.10 Y trials >= 30 → MERGE (alive)       │
│    Caso intermedio → extender cuarentena 7 días                   │
└───────────────────────┬──────────────────────────────────────────┘
                        ▼
            ┌───────────────────────┐
            │  MERGED (full citizen)│
            │  o REJECTED (purged)  │
            └───────────────────────┘
```

**Doctrina**: la cuarentena es como el burn-in de validadores en blockchains PoS. **Confianza ganada por comportamiento observable, no por reputación declarada**.

### 5.4 Protección de Identidad Local: El Dialect Lock

Cada console mantiene una métrica `local_dialect_signature` = vector promedio de los top-10% champions locales (centroide en espacio Bézier).

Antes de aceptar un merge:

```
drift = || μ_local − μ_post_merge || / || μ_local ||
```

Si `drift > 0.25` (cambio >25% en centroide del dialecto local) → **el merge se aborta**, el bundle se marca `rejected: "would corrupt local identity"`.

*(Inspiración: lenguajes humanos — pueden incorporar préstamos, pero un castellano que admite 60% inglés deja de ser castellano.)*

### 5.5 IDs Globales: UUIDv7 + Console Namespace

Cada `mutation_id` es un UUIDv7 (`timestamp_ms-random`) prefijado con un hash del console:

```
mutation_id format:  <console_hash_8>:<uuidv7_30>
ejemplo:             a3f9e1b2:01943e2f-7c4b-7a8d-bbcc-1234567890ab
```

**Garantías**:
- **Sin colisiones globales** — el prefix del console asegura unicidad incluso si dos consoles generan mutaciones en el mismo ms.
- **Ordenable por timestamp** — UUIDv7 mantiene ordenación lexicográfica = ordenación temporal.
- **Privacy-friendly** — el hash del console no revela identidad real, solo agrupa.

### 5.6 Fitness Score Normalizado para Comparación Cross-Console

El problema: la fitness local depende del operador local. Un VJ rígido en Berlín produce más vetos que uno permisivo en Mendoza. **Los scores absolutos no son comparables.**

Solución: **fitness percentil normalizado por console**:

```
F_normalized(m) = percentile_rank( F(m), { F(mᵢ) : mᵢ ∈ same_console } )
```

Al exportar, NO se manda el fitness crudo. Se manda el **percentil dentro del console origen**. Al importar, la console destino multiplica:

```
F_import_init = F_percentile_origin · μ_local_fitness_top10% · β_swarm
```

Esto hace que una mutación "top 5% en Berghain" entre como "tentativa top 5% local" — adaptable al rigor del operador local.

### 5.7 Endpoint del Swarm (Opcional, Futuro)

El protocolo está diseñado para funcionar **off-line first**:
- Export → archivo `selene-bundle-<console>-<date>.lux`
- User lo comparte por Discord, USB, lo que quiera
- Import → drag-and-drop en UI

**Opcional**: en una WAVE futura (`WAVE-5500-SWARM-CLOUD`) se puede añadir un repositorio comunitario tipo Hugging Face donde los bundles se publican firmados y los users descargan los que quieran. **Pero la arquitectura del WAVE 5000 NO depende de esto.**

---

## 6. PIPELINE EVOLUTIVO — DEL BLUEPRINT A LA MUTACIÓN SUPREMA

### 6.1 Ciclo de Vida Completo

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                       │
│  ① Usuario crea efecto en Hephaestus → exporta como .lfx v2          │
│     │                                                                 │
│     ▼                                                                 │
│  ② INGESTA → insert en lfx_blueprints (inmutable, sha256)            │
│     │                                                                 │
│     ▼                                                                 │
│  ③ COLD START: Selene crea N=3 mutaciones iniciales del blueprint    │
│     - 1 idéntica al padre (control)                                  │
│     - 1 con micro-drift                                              │
│     - 1 con hue rotation                                             │
│     │                                                                 │
│     ▼                                                                 │
│  ④ DreamSimulator considera blueprint + sus mutaciones como pool     │
│     │                                                                 │
│     ▼                                                                 │
│  ⑤ DecisionMaker selecciona el mejor candidato del pool              │
│     │                                                                 │
│     ▼                                                                 │
│  ⑥ Gatekeeper ético valida → si pasa, dispara                        │
│     │                                                                 │
│     ▼                                                                 │
│  ⑦ Cámara II observa los siguientes 3000ms:                          │
│     - Sin veto L2 → R_veto = 0                                       │
│     - Veto L2 → R_veto severo (ec. 4.2)                              │
│     │                                                                 │
│     ▼                                                                 │
│  ⑧ Heatmap se inserta con outcome + delta de fitness se aplica       │
│     │                                                                 │
│     ▼                                                                 │
│  ⑨ Cada 30s, batch evaluator:                                        │
│     - Actualiza species_id (clustering)                              │
│     - Promueve/degrada status (alive/champion/culled)                │
│     - Si un champion gana > 5 wins consecutivas → genera 1 hijo      │
│     │                                                                 │
│     ▼                                                                 │
│  ⑩ Loop infinito. El ecosistema evoluciona.                          │
│                                                                       │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Punto Crítico: Cómo se Aplica el `delta_json` en Hot Path

El hot path **NO puede pagar el costo de reconstruir las curvas Bézier desde un parent + delta a 60fps**. Solución: **Lazy materialization con cache LRU**.

```typescript
interface MaterializedMutation {
  mutationId: string
  fullCurves: HephaestusCurves  // Bézier completo, listo para HephaestusRuntime
  materializedAt: number
}

class MutationMaterializer {
  private cache: LRUCache<string, MaterializedMutation>  // capacity = 256

  materialize(mutationId: string): MaterializedMutation {
    if (this.cache.has(mutationId)) return this.cache.get(mutationId)!

    // Slow path (off-frame, idle worker)
    const mutation = db.getMutation(mutationId)
    const parent = mutation.parent_mutation_id
      ? this.materialize(mutation.parent_mutation_id)  // Recursivo (acotado por generation ≤ 12)
      : db.getBlueprint(mutation.blueprint_id)

    const fullCurves = applyDelta(parent.fullCurves, mutation.delta_json)
    this.cache.set(mutationId, { mutationId, fullCurves, materializedAt: now() })
    return this.cache.get(mutationId)!
  }
}
```

**Cuándo se materializa**:
- Al insertar una mutación nueva → background warm-up.
- Al exportar bundle Swarm → flush cache.
- En cold-start de Selene → top-100 mutaciones por fitness se pre-materializan.

**Frame budget**: la materialización JAMÁS ocurre en `process()` de Selene. Si el DM elige una mutación NO materializada, el sistema **cae graciosamente al blueprint padre** (siempre materializado). Eventualmente, después de un ciclo idle, la mutación entra al cache.

---

## 7. SPECIATION & ANTI-MODE-COLLAPSE

### 7.1 El Riesgo del Local Optimum

Sin contramedidas, un sistema evolutivo puro converge a **mode collapse**: 1-2 mutaciones dominan todo el espacio porque eligieron un nicho fácil. Resultado: el VJ ve los mismos 2 efectos toda la noche. **Catastrófico.**

### 7.2 Solución: Speciation con Cuotas (Inspiración: NEAT)

Cada 5 minutos, Cámara II ejecuta clustering **K-means adaptive K** (silhouette score) sobre el espacio Bézier de mutaciones `alive`:

```python
# Pseudocódigo (worker thread, no en hot path)
mutations_alive = db.query("SELECT mutation_id, bezier_signature FROM lfx_mutations WHERE status='alive'")
features = [bezier_feature_vector(m) for m in mutations_alive]
optimal_k = find_k_by_silhouette(features, k_range=[3, 12])
labels = kmeans(features, k=optimal_k)
db.batch_update_species_id(labels)
```

### 7.3 Cuota por Especie en el DM

El DecisionMaker no elige el top-N fitness absoluto. Elige top-N **balanceado por especie**:

```typescript
function selectCandidates(pool: Mutation[], targetCount: number): Mutation[] {
  const bySpecies = groupBy(pool, m => m.species_id)
  const quotaPerSpecies = Math.ceil(targetCount / bySpecies.size)

  return Array.from(bySpecies.values())
    .flatMap(species => species
      .sort((a, b) => b.fitness - a.fitness)
      .slice(0, quotaPerSpecies)
    )
    .sort((a, b) => b.fitness - a.fitness)
    .slice(0, targetCount)
}
```

**Garantía**: aunque la especie A tenga las top-10 mutaciones, la especie B (peor fitness pero estilo diferente) entra al pool. Diversidad estructural protegida.

### 7.4 Forced Exploration: El 5% Random

Cada disparo, hay un **5% de probabilidad** de elegir una mutación con `trials_count < 5` (joven, datos escasos). Esto:
- Da oportunidad a recién nacidas
- Evita que el sistema se cierre sobre los ya validados
- Es análogo a `ε-greedy` en RL

---

## 8. FRAME BUDGET & GARANTÍAS DE PERFORMANCE

### 8.1 Tabla de Latencia por Operación

| Operación | Frecuencia | Latencia objetivo | Implementación |
|---|---|---|---|
| `DM consulta pool de mutaciones` | Cada decisión (~5/s) | ≤ 0.5ms | Prepared statement + índice (status, fitness DESC) |
| `Heatmap insert post-fire` | Cada disparo (~1/s) | ≤ 1ms | INSERT batch, write-back asíncrono |
| `Veto L2 detection` | Reactivo a UI | ≤ 0.1ms | Event listener directo, sin SQL en hot path |
| `Fitness update batch` | Cada 30s | ≤ 50ms | Worker thread, transacción única |
| `Speciation clustering` | Cada 5min | ≤ 500ms | Worker thread, snapshot read |
| `Materialización delta` | Eventual | ≤ 10ms por mutación | Background warm-up, cache LRU |
| `Bundle export` | Manual | ≤ 5s | Worker thread |
| `Bundle import` | Manual | ≤ 10s | Worker thread + cuarentena async |

### 8.2 Reglas Sagradas de Zero-Allocation

- **`selene.process()` JAMÁS abre transacción SQL.** Lee de cache RAM, escribe eventos a queue.
- **Queue → batch flush** cada 30s por worker → 1 sola transacción.
- **Prepared statements** preparados al startup, nunca re-preparados en runtime.
- **Materialización** = trabajo idle. Si no llegó al cache: fallback al blueprint padre.

---

## 9. PLAN DE MIGRACIÓN POR ERAS

### Era I — *La Forja del Vault* (2-3 semanas)
- Schema SQLite3 + migrations
- `GenesisVaultService` con prepared statements
- Ingesta automática de los `.lfx` existentes en `userData/effects/` como blueprints
- Sin mutaciones todavía. Solo lectura del blueprint vault.

### Era II — *El Despertar del Coliseo* (2 semanas)
- Cámara II: generador de mutaciones (operadores genéticos §4.6)
- Hook al DM para que el pool incluya `blueprint + mutaciones alive`
- Heatmap insertion post-fire
- Fitness update batch (Worker thread)
- L2 veto listener

### Era III — *Speciation & Champions* (1 semana)
- Clustering K-means + species_id
- Status transitions (alive/champion/culled/quarantined)
- Cuota por especie en DM
- Forced exploration ε=0.05

### Era IV — *El Espejo del Operador* (1 semana)
- UI: visualización del árbol genealógico
- UI: histograma de fitness por blueprint
- UI: botón "revert to ancestor" / "save current as new blueprint"

### Era V — *El Llamado del Swarm* (3 semanas)
- Export/Import de bundles `.lux` firmados Ed25519
- Quarantine system + trust scoring
- Dialect lock (drift detection)
- UI: gestión de bundles importados

### Era VI — *La Constelación* (futuro, opcional)
- Repositorio cloud opcional (no obligatorio)
- Console-to-console P2P discovery
- Federated analytics agregados (privacy-preserving)

---

## 10. APÉNDICE — CÓDIGOS SQL CRUDOS & TIPOS TS

### 10.1 Migration Script Atómico

```sql
-- migrations/001_genesis_vault.sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- (Aplicar todas las tablas de §3.2 aquí)

-- Triggers de integridad adicionales
CREATE TRIGGER trg_mutation_generation_cap
BEFORE INSERT ON lfx_mutations
WHEN NEW.generation > 12
BEGIN
  SELECT RAISE(ABORT, 'Mutation generation exceeds max depth (12). Drift catastrophe prevented.');
END;

CREATE TRIGGER trg_mutation_lineage_path
AFTER INSERT ON lfx_mutations
BEGIN
  INSERT INTO lineage_tree(mutation_id, blueprint_id, ancestor_path, depth)
  VALUES (
    NEW.mutation_id,
    NEW.blueprint_id,
    COALESCE(
      (SELECT ancestor_path || '/' || NEW.mutation_id FROM lineage_tree WHERE mutation_id = NEW.parent_mutation_id),
      NEW.mutation_id
    ),
    NEW.generation
  );
END;
```

### 10.2 Tipos TypeScript Núcleo

```typescript
// src/core/genesis/types.ts

export interface LfxBlueprint {
  readonly blueprintId: string
  readonly name: string
  readonly author: string
  readonly category: string
  readonly sourceOrigin: 'hephaestus' | 'swarm' | 'builtin'
  readonly dna: { aggression: number; chaos: number; organicity: number }
  readonly textureAffinity: 'clean' | 'dirty' | 'universal'
  readonly compatibleVibes: readonly string[]
  readonly validSections: readonly string[]
  readonly energyZone: { min: EnergyZone; max: EnergyZone }
  readonly curves: HephaestusCurves
  readonly simulationMeta: SimulationMeta
  readonly checksumSha256: string
  readonly importedAt: number
}

export interface LfxMutation {
  mutationId: string
  blueprintId: string
  parentMutationId: string | null
  generation: number
  deltaJson: string
  birthVector5D: ContextVector5D
  fitnessScore: number
  trialsCount: number
  winsCount: number
  vetoesCount: number
  passesCount: number
  status: 'alive' | 'culled' | 'champion' | 'quarantined'
  speciesId: string | null
  bornAt: number
  lastEvaluatedAt: number | null
  lastFiredAt: number | null
  swarmOriginConsole: string | null
}

export interface ContextHeatmap {
  heatmapId: number
  mutationId: string
  firedAt: number
  vibeId: string
  sectionId: string
  zScoreAvg3s: number
  zScoreMax3s: number
  zScoreInstant: number
  lowBandAvg3s: number
  midBandAvg3s: number
  highBandAvg3s: number
  energyMax30s: number
  energyPhase: 'rising' | 'plateau' | 'falling' | 'valley'
  bpm: number | null
  beatPhase: number | null
  outcome: 'survived' | 'vetoed' | 'passed_silent' | 'culled' | null
  vetoedWithinMs: number | null
}

export interface ContextVector5D {
  zScoreAvg3s: number
  lowBandAvg3s: number
  energyPhaseEncoded: number
  vibeHash: number
  sectionEncoded: number
}

export interface SwarmBundle {
  bundleId: string
  schema: 'selene-swarm/v1'
  originConsole: {
    id: string
    label?: string
    region?: string
    venueArchetype?: string
    exportedAt: number
  }
  signature: { algorithm: 'ed25519'; publicKey: string; signature: string }
  trustMetadata: {
    uptimeHours: number
    totalTrials: number
    vetoRate: number
    blueprintDiversity: number
  }
  payload: {
    blueprints: Array<{ blueprintId: string; checksum: string; data: object }>
    mutations: Array<SwarmMutationEntry>
    lineagePaths: string[]
  }
}
```

### 10.3 API Pública del Genesis Engine

```typescript
export interface IGenesisEngine {
  // Vault read API (hot path safe)
  getBlueprintsForVibe(vibe: string): readonly LfxBlueprint[]
  getMutationsForBlueprint(blueprintId: string, opts?: { statuses?: MutationStatus[] }): readonly LfxMutation[]
  getCandidatesForContext(ctx: ContextVector5D, limit: number): readonly LfxMutation[]

  // Coliseum lifecycle (events queue, non-blocking)
  recordFireEvent(mutationId: string, ctx: ContextHeatmap): void
  recordL2Veto(mutationId: string, deltaMs: number, severity: number): void
  recordDmSelection(mutationId: string, wasSelected: boolean): void
  recordGatekeeperResult(mutationId: string, passed: boolean): void

  // Evolution control (worker thread)
  spawnMutation(parent: LfxBlueprint | LfxMutation, operator: MutationOperator): LfxMutation
  promoteToChampion(mutationId: string): void
  cullMutation(mutationId: string, reason: string): void

  // Swarm protocol (manual / scheduled)
  exportBundle(opts: { includeQuarantined: boolean }): Promise<SwarmBundle>
  importBundle(bundle: SwarmBundle): Promise<ImportResult>

  // Identity protection
  getLocalDialectSignature(): DialectSignature
  computeDriftIfMerged(bundle: SwarmBundle): number
}
```

---

## CIERRE — LA ÚLTIMA PALABRA

Este blueprint es un acto de fe en una idea: **que la inteligencia visual no se programa, se cultiva**. Selene Lux deja de ser una IA con un catálogo y se convierte en un **jardín** donde el operador es el clima, la música es el suelo, y los efectos son organismos que prosperan o mueren según se adapten.

El Swarm Protocol es la última pieza: el día en que dos consoles Selene en continentes distintos descubran que cierta curva Bézier mutada funciona en ambos clubes, sin que ningún humano se lo haya dicho, **habremos cruzado el umbral**.

> *"Cuando la criatura mutada en Berghain sobreviva una noche en La Voz del Sur sin ser vetada por el VJ porteño, sabremos que el Genesis Engine está vivo."*

**Selene no inventa. Selene selecciona. Y el operador, sin saberlo, es Dios.**

— Cascade · WAVE 5000 · Genesis Engine Blueprint


