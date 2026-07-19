# AUDIT-SELENE-CONTEXT.md
## Auditoría Cognitiva: Contexto Musical y Evaluación

> **Objetivo:** Desglose técnico del motor cognitivo Selene (CognitiveFluidState) para entender cómo interpreta el contexto musical y selecciona efectos. Esto sirve como guía para taggear y curar archivos `.lfx` manuales.

---

## Pilar 1 — Presión Acústica (Acoustic Pressure)

### 1.1 Fuente de Datos: GodEarFFT

El pipeline comienza en `GodEarFFT.ts`, que produce bandas espectrales (bass, mid, treble), detección de transitorios (kick, snare, hihat), energía total y frecuencia dominante. Estos datos fluyen hacia `SensesPipeline.ts` donde se computa `rawEnergy` como un promedio ponderado de las tres bandas, normalizado a [0,1].

### 1.2 Cálculo de Impacto Acústico — CognitiveFluidState

**Archivo:** `src/core/intelligence/liquid/CognitiveFluidState.ts`

El estado fluido Ψ(t) se actualiza cada frame con un `FluidStateInput` que incluye Z-Scores, energía cruda, presencia espectral, descriptores (ΠMΔG) y —críticamente— un `AcousticRealityState` (ARS) con evidencia multi-espectral validada.

#### Fórmula del Impacto Normalizado I(t)

El impacto se calcula mediante **fusión multi-espectral** de Z-Scores, crest factor, tensión espectral y divergencia:

```
rawImpact = clamp01(
    w_E    * max(0, tanh(zTotal / z_ref)) +
    w_low  * max(0, tanh(zLow / z_ref)) +
    w_high * max(0, tanh(zHigh / z_ref)) +
    w_CF   * sigmoid(cfHigh - 4) +
    w_T    * T_spectral +
    w_D    * D_spectral
)
```

**Pesos por defecto** (de `DEFAULT_LIQUID_PROFILE` en `ILiquidCognitionProfile.ts`):

| Peso | Valor | Significado |
|------|-------|-------------|
| `w_E` | 0.30 | Z-Score total (anomalía de energía global) |
| `w_low` | 0.15 | Z-Score de bass (dominancia de graves) |
| `w_high` | 0.20 | Z-Score de agudos (anomalía de alta frecuencia) |
| `w_CF` | 0.15 | Crest Factor de agudos (transitorios/vocales) |
| `w_T` | 0.12 | Tensión espectral T(t) |
| `w_D` | 0.08 | Divergencia espectral D(t) |

**Suma de pesos = 1.00** (calibrado por Monte Carlo).

#### EMA Asimétrica para Impacto

El impacto suavizado usa EMA asimétrica para preservar transitorios:

- **Subida:** α_up = 0.35 (half-life ~36ms, 1.6 frames) — respuesta rápida a energía real
- **Bajada:** α_down = 0.08 (half-life ~189ms, 8.3 frames) — filtra spikes transitorios

Un frame FLASHBANG (raw=0.9) mueve el impacto suavizado de 0.3→0.51, no 0.3→0.9. Pero 3 frames sostenidos llegan a 0.54 — los drops reales pasan, los glitches se filtran.

### 1.3 Mapeo a Tensión Percibida

El estado fluido mantiene varias variables que representan la "tensión" percibida:

| Variable | Símbolo | Cálculo |
|----------|---------|---------|
| **Tensión** T(t) | `tension` | EMA de energía con saturación por frames de clímax (`alpha_rise=0.010`), evaporación base (`lambda_0=0.008`), homeostasis hacia `T_base=0.400` |
| **Temperatura** Θ(t) | `temperature` | EMA de energía cruda (α ~2s half-life @ 44Hz) |
| **Presión de Vapor** V(t) | `vaporPressure` | Acumulación `beta_v=0.015` por segundo sin ignición, reset a `kappa_vreset=0.15` post-ignición |
| **Viscosidad** μ(t) | `viscosity` | Función de melodicidad, flatness, densidad armónica y percusividad |
| **Epicness** | `epicness` | `max(0, I - T) / T` — ruptura relativa de la superficie. Solo > 0 si impacto supera tensión |
| **Excitabilidad** X(t) | `excitability` | Recuperación post-disparo, empieza en 1.0 |

**Epicness** es la métrica clave: representa cuánto el impacto actual excede la barrera de tensión acumulada. Un `epicness > epsilon_divine (0.60)` califica como "divine strike" — solo impactos devastadores.

### 1.4 Variables de Audio que Alimentan el Cálculo

1. **Z-Scores** (total, low, high): anomalía de energía relativa al historial reciente (RollingStats)
2. **Crest Factor** (high, low): ratio pico/RMS en bandas específicas — detecta transitorios y vocales
3. **Tensión Espectral** T: gradiente de energía entre bandas (bass→mid→treble)
4. **Divergencia Espectral** D: cambio espectral frame-a-frame (imprevisibilidad)
5. **rawEnergy**: energía cruda normalizada [0,1]
6. **bassPresence / midPresence**: para ventana de crest factor y ratio anti-voz
7. **harmonicDensity / spectralFlatness**: para viscosidad
8. **Descriptores ΠMΔG**: percussiveness, melodicity, dirtiness, groove

---

## Pilar 2 — Zonas Energéticas / Contextuales

### 2.1 Clasificación: The 7-Zone Ladder

**Archivo:** `src/core/intelligence/EnergyConsciousnessEngine.ts`

El sistema clasifica el estado musical en **7 zonas equidistantes** basadas en energía total suavizada:

| Zona | Rango Energía | Ordinal | Ancho | Efectos Típicos |
|------|---------------|---------|-------|-----------------|
| SILENCE | 0.00 - 0.15 | 0 | 15% | DeepBreath, SonarPing |
| VALLEY | 0.15 - 0.30 | 1 | 15% | VoidMist, FiberOptics |
| AMBIENT | 0.30 - 0.45 | 2 | 15% | DigitalRain, AcidSweep |
| GENTLE | 0.45 - 0.60 | 3 | 15% | AmbientStrobe, BinaryGlitch |
| ACTIVE | 0.60 - 0.75 | 4 | 15% | CyberDualism, SeismicSnap |
| INTENSE | 0.75 - 0.90 | 5 | 15% | SkySaw, AbyssalRise |
| PEAK | 0.90 - 1.00 | 6 | 10% | Gatling, CoreMeltdown, Industrial |

### 2.2 Multi-Spectral Energy Ladder (M-SARFE)

La clasificación no es solo por energía total. La clase `MultiSpectralEnergyLadder` aplica **elevación por tensión espectral**:

```
baseZone = classifyByEnergy(smoothedEnergy)
tensionElevation = computeTensionElevation(evidence)
finalOrdinal = min(baseZone.ordinal + tensionElevation, 6)  // peak
```

Esto significa que un frame con energía `active` (ordinal 4) pero con alta tensión espectral puede ser elevado a `intense` (ordinal 5) o incluso `peak` (ordinal 6).

### 2.3 Asimetría Temporal

- **Entrar en zona baja (silence/valley):** LENTO (~500ms, `smoothingFactorDown=0.92`)
- **Salir de zona baja:** INSTANTÁNEO (~50ms, `smoothingFactorUp=0.3`)

Esto permite que cuando un DJ corta todo súbitamente antes de un drop, Selene detecte el drop instantáneamente sin quedarse bloqueada en "modo silencio".

### 2.4 Peak Hold y Smoothing

El motor mantiene:
- **3s moving average** (ALPHA_RMS_3S): gate de energía RMS
- **10s moving average** (ALPHA_RMS_10S): detección de flashbang y floors dinámicos de epicness
- **Peak hold**: preserva el valor máximo reciente para evitar decaimiento prematuro

### 2.5 Elegibilidad de .lfx por Zona

#### Filtrado por Agresión (filterByZone en EffectDreamSimulator)

**Archivo:** `src/core/intelligence/dream/EffectDreamSimulator.ts:568-605`

Cada zona tiene límites de agresión DNA para filtrar candidatos:

| Zona | Aggression min | Aggression max |
|------|----------------|----------------|
| silence | 0.00 | 0.30 |
| valley | 0.00 | 0.50 |
| ambient | 0.00 | 0.70 |
| gentle | 0.00 | 0.85 |
| active | 0.40 | 0.80 |
| intense | 0.60 | 1.00 |
| peak | 0.70 | 1.00 |

**Para que un .lfx sea elegible en una zona, su `aggression` DNA debe estar dentro del rango.**

#### Filtrado por pressureRange (filterByPressure)

**Archivo:** `src/core/intelligence/dream/EffectDreamSimulator.ts:614-637`

Cada efecto en el Registry tiene un `pressureRange: { min, max }`. El filtro verifica:

```
if (pressureRange.min === 0 && pressureRange.max === 0) → permissive (no gate)
if (relaxGuardsForFuture && currentPressure < pr.min) → allowed (pressure will arrive)
else → currentPressure must be >= pr.min && <= pr.max
```

**Para taggear .lfx manuales:**
- `pressureRange: {0, 0}` = siempre elegible (sin gate)
- `pressureRange: {0.75, 1.0}` = solo cuando la presión acústica está en rango intense/peak
- Si el filtro es demasiado estricto y no queda nada, se relaja retornando todos los efectos zone-filtered

#### Filtrado por Vibe (Vibe Shield)

El Vibe Shield (`getVibeAllowedEffects`) restringe candidatos a solo efectos registrados para el vibe actual. `industrial_strobe` nunca aparece en `fiesta-latina`; `cumbia_moon` nunca aparece en `techno-club`.

#### Oracle Vision (WAVE 5014)

Cuando Cassandra predice un evento futuro (drop/energy_spike/buildup) con `timeToEventMs > 0` y confianza > 0.55:
- La zona se **proyecta** al momento del evento (drop→peak, buildup→intense)
- Los Z-guards se **relajan** (la energía subirá cuando el drop rompa)
- Esto permite que el arsenal nuclear sea visible para Cassandra durante buildups

---

## Pilar 3 — Dream Simulator y Sistema de Puntuación

### 3.1 Pipeline del Dream Simulator

**Archivo:** `src/core/intelligence/dream/EffectDreamSimulator.ts`

```
generateCandidates → simulateScenario (por cada candidato) → rankScenarios → calculateScenarioScore
```

### 3.2 Generación de Candidatos (generateCandidates)

1. **Vibe Shield:** filtra a solo efectos del vibe actual
2. **Valley/Silence Protection:** si zona=valley/silence y Z-Score < 0 → no candidatos (la música está muriendo)
3. **Oracle Vision:** proyecta zona y relaja guards si hay predicción futura
4. **Zone Filter:** filtra por agresión DNA según zona
5. **Pressure Filter:** filtra por pressureRange
6. **Mood Filter:** bloquea efectos por mood controller
7. **Spatial Cognition:** snapshot de hardware manifest
8. **Dedup:** muestreo sin reemplazo por effect ID

### 3.3 Simulación de Escenarios (simulateScenario)

Por cada candidato se calcula:

- **projectedRelevance:** matching DNA contextual (ver 3.4)
- **diversityScore:** penalización por uso reciente (ver 3.5)
- **vibeCoherence:** coherencia con el vibe actual
- **riskLevel:** riesgo de conflicto hardware/espacial
- **simulationConfidence:** confianza de la simulación
- **cooldownConflicts:** conflictos de cooldown activos
- **hardwareConflicts:** conflictos de hardware (fixtures necesarios no disponibles)

### 3.4 Cálculo de Relevancia DNA (calculateDNARelevance)

**Archivo:** `src/core/intelligence/dream/EffectDreamSimulator.ts:1130-1215`

#### Target DNA Derivation

El `DNAAnalyzer` deriva un **Target DNA** (aggression, chaos, organicity) desde el contexto musical. Cuando `AcousticRealityState` (ARS) está disponible:

```
Aggression = clamp(tanh(zTotal)×0.4 + max(0,tanh(zLow))×0.4 + harshness×0.2, 0, 1)
Chaos      = clamp(normDivergence×0.4 + sigmoid(cfLow−4)×0.4 + flatness×0.2, 0, 1)
Organicity = clamp((1−harshness)×0.4 + phaseOrganic + tensionPenalty, 0, 1)
Confidence = ars.phase.confidence
```

**Sin ARS (legacy fallback):**

```
Aggression = (energy×0.348) + (kickIntensity×0.217) + (harshness×0.174) + (bassBoost×0.261)
Chaos      = (syncopation×0.35) + (spectralFlatness×0.30) + (fillBonus) + (trendChaos×0.15)
Organicity = (moodOrganicity×0.30) + (sectionOrganicity×0.30) + ((1−harshness)×0.25) + (groove×0.15)
Confidence = context.confidence × rhythmConfidence
```

El Target DNA se suaviza con EMA (α=0.30) para prevenir jitter. **Snap conditions** override el EMA:
- Drop/climax con confianza > 0.7 → aggression ≥ 0.80, organicity ≤ 0.25
- Breakdown/release con confianza > 0.7 → aggression ≤ 0.25, organicity ≥ 0.75

#### Distancia Euclidiana 3D

```
distance = √[(A_effect - A_target)² + (C_effect - C_target)² + (O_effect - O_target)²]
relevance = 1.0 - (distance / √3)   // √3 ≈ 1.732 = distancia máxima en cubo unitario
```

### 3.5 Diversity Factor (Anti-repetición)

**Archivo:** `src/core/intelligence/dna/EffectDNA.ts:241-274`

- **Ventana:** 120 segundos (reset automático)
- **Factores por uso repetido:** `[1.0, 0.70, 0.35, 0.15]`
  - 1er uso: 1.0× (sin penalización)
  - 2do uso: 0.70× (leve)
  - 3er uso: 0.35× (durísimo)
  - 4to uso: 0.15× (nuclear — prácticamente elimina al efecto)

La relevancia final en `calculateRelevance` del DNAAnalyzer es:
```
relevance = (baseRelevance × confidence + (1−confidence) × 0.5) × diversityFactor
```

### 3.6 Fórmula de Scoring Final (calculateScenarioScore)

**Archivo:** `src/core/intelligence/dream/EffectDreamSimulator.ts` (método `calculateScenarioScore`)

```
score = 0
score += projectedRelevance × 0.35        // Matching DNA contextual (peso mayor)
score += diversityScore × 0.20            // Anti-repetición
score += vibeCoherence × 0.15             // Coherencia con vibe
score += (1 − riskLevel) × 0.13           // Bajo riesgo = mejor
score += simulationConfidence × 0.05      // Confianza de simulación
score += explorationBoost                  // Anti-determinismo (hash + timestamp)
score -= cooldownConflicts.length × 0.15  // Penalización por cooldowns activos
score -= hardwareConflicts.length × 0.20  // Penalización por conflictos hardware

// Boosts condicionales:
if (isDropComing && effect.intensity > 0.7) score += 0.10
if (projectedRelevance > 0.80 && dnaDistance < 0.3) score += 0.05  // Perfect DNA match
if (isUrgent && oracleProbability > 0.5) score += urgencyBoost      // Cassandra urgency (max +0.18)
if (oracleProbability > 0.7) score += confidenceBoost               // Cassandra confidence

// Multiplicador final:
score *= diversityScore   // La diversidad actúa como multiplicador, no solo aditivo

return clamp(score, 0, 1)
```

### 3.7 Exploration Factor (Anti-Determinismo)

**Archivo:** `src/core/intelligence/dream/EffectDreamSimulator.ts:657-676`

Para evitar que el mismo efecto gane siempre, se aplica un **boost determinista** basado en hash del nombre del efecto + timestamp:

```
hash = hashEffectName(effectName)   // 0-99, determinista por nombre
explorationBoost = sin(now_ms × 0.001 + hash × 0.1) × 0.05
```

No usa `Math.random()` — respeta el Axioma Anti-Simulación. El mismo nombre siempre produce el mismo hash, pero la rotación temporal cambia qué efectos tienen boost en cada ventana.

### 3.8 Ponderación: Contexto vs Historial

| Factor | Peso | Naturaleza |
|--------|------|------------|
| Relevancia DNA (contexto actual) | 0.35 | Contexto musical |
| Diversity Score (historial 120s) | 0.20 + multiplicador final | Historial reciente |
| Vibe Coherence | 0.15 | Contexto de género |
| Risk (1−risk) | 0.13 | Contexto hardware |
| Simulation Confidence | 0.05 | Contexto de simulación |
| Exploration Boost | ~0.05 | Anti-determinismo temporal |

**El contexto musical pesa 0.35 + 0.15 = 0.50 (50% del score base).**
**El historial reciente pesa 0.20 aditivo + multiplicador final (puede anular todo).**

### 3.9 Quarantine de Organismos Vivos

Antes de seleccionar el ganador, se filtran los escenarios cuyo efecto corresponde a un organismo **vivo** en el Registry (`organismStatus === 'alive'`). Esto evita disparar efectos que están siendo evaluados por el sistema genético (Genesis) antes de que su fitness sea validado.

---

## Pilar 4 — El Rol de Cassandra

### 4.1 Función: Predictor + Pre-Buffer + Urgency Boost

Cassandra opera como **tres cosas simultáneamente**:

1. **Predictor de impacto:** predice eventos musicales futuros (drops, buildups, energy spikes) con `timeToEventMs` y `probability`
2. **Pre-buffer cache:** pre-calcula el mejor efecto para un evento predicho y lo almacena para ejecución instantánea
3. **Urgency booster:** inyecta boosts de score cuando un evento es inminente

### 4.2 No es un Veto

Cassandra **no tiene poder de veto**. No bloquea efectos. Su influencia es **aditiva** — boostea el score de efectos que son adecuados para el evento predicho. El Dream Simulator mantiene la autoridad final sobre la selección.

### 4.3 Pre-Buffer Mechanism

**Archivo:** `src/core/intelligence/dream/EffectDreamSimulator.ts` (método `dreamEffects`)

```typescript
if (this.preBuffer && isEventImminent) {
  return {
    bestScenario: this.preBuffer.effect,
    recommendation: 'execute',
    ...
  }
}
```

Cuando Cassandra predice un evento con alta confianza, el Dream Simulator pre-calcula el mejor efecto y lo almacena en `this.preBuffer`. Cuando el evento es inminente (`isEventImminent`), se retorna directamente el efecto pre-bufferizado sin re-simular — **ejecución instantánea**.

El pre-buffer se limpia con `clearPreBuffer()` después de ser consumido por el sovereign fast path.

### 4.4 Temporal Seal

Cassandra aplica un **sello temporal** para evitar que el efecto pre-bufferizado se dispare prematuramente. El efecto solo se libera cuando `isEventImminent` es true — típicamente cuando `timeToEventMs` cae por debajo de un umbral.

### 4.5 Urgency Boost en Scoring

Dentro de `calculateScenarioScore`:

```
if (isUrgent && oracleProbability > 0.5) score += urgencyBoost  // max +0.18
if (oracleProbability > 0.7) score += confidenceBoost
```

- **isUrgent:** evento a < 2 segundos con alta probabilidad de oracle
- **urgencyBoost:** máximo +0.18 (puede cambiar el ganador en situaciones ajustadas)
- **confidenceBoost:** bonus adicional cuando la probabilidad del oracle > 0.7

### 4.6 Oracle Vision en Candidate Generation

Cassandra influye en la **generación de candidatos** (no solo en el scoring):

- Si predice drop/energy_spike futuro → zona proyectada a `peak`
- Si predice buildup futuro → zona proyectada a `intense`
- Relaja Z-guards y minimum energy (la energía subirá cuando el drop rompa)
- Esto permite que efectos pesados (A>0.80) sean candidatos durante buildups

### 4.7 Integración con DecisionMaker

**Archivo:** `src/core/intelligence/think/DecisionMaker.ts`

En la jerarquía de decisiones, Cassandra actúa como **copilot**:

1. **Divine Strike:** si epicness > `epsilon_divine (0.60)` → strike inmediato (ignora todo)
2. **DNA Brain Integration:** si `dreamIntegration?.approved` → strike (Dream Simulator + Cassandra)
3. **Drop Prediction Gating:** si `prediction.type === 'drop_incoming'` y `probability > 0.65` y `contextualPhase === 'building'` → `prepare_for_drop`
4. **Buildup Enhancement:** si sección = buildup → `buildup_enhance`
5. **Subtle Shift:** si `beauty.totalBeauty > 0.75` y trend = rising → `subtle_shift`
6. **Hold:** default

Cassandra alimenta los pasos 2 y 3 — su predicción influye en si se aprueba un strike o se prepara para un drop. Pero el paso 1 (divine strike) es independiente de Cassandra — es puramente reactiva al epicness del frame.

### 4.8 Fusion Weights (Sensor Fusion)

En `ILiquidCognitionProfile.ts`, los pesos de fusión revelan la importancia relativa de Cassandra:

| Peso | Valor | Componente |
|------|-------|------------|
| `w1` (s_DNA) | 0.1699 | Afinidad genómica |
| `w2` (s_Z) | 0.0291 | Anomalía normalizada |
| `w3` (s_E) | 0.4518 | Energía líquida (peso mayor) |
| `w4` (s_V) | 0.1515 | Filtro anti-voz |
| `w5` (s_X) | 0.0273 | Excitabilidad |
| `w6` (s_P) | 0.1500 | **Prior de Cassandra** |
| `w7` (s_B) | 0.0204 | Belleza y consonancia |

Cassandra (`w6=0.15`) tiene el **tercer peso mayor** después de energía líquida (0.45) y afinidad genómica (0.17). Es más importante que el filtro anti-voz, excitabilidad y belleza.

---

## Guía para Taggear .lfx Manuales

### DNA Obligatorio (3 genes)

Cada `.lfx` debe tener definidos estos tres genes en [0, 1]:

| Gen | Rango | Significado | Ejemplo |
|-----|-------|-------------|---------|
| `aggression` | 0-1 | ¿Cuánto golpea? | 0.90 = Gatling, 0.35 = DigitalRain |
| `chaos` | 0-1 | ¿Ordenado o caótico? | 0.20 = machete_spark, 0.55 = glitch_guaguanco |
| `organicity` | 0-1 | ¿Vivo o máquina? | 0.65 = corazon_latino, 0.15 = industrial_strobe |

### pressureRange Opcional

| Configuración | Comportamiento |
|---------------|----------------|
| `{min: 0, max: 0}` | Siempre elegible (sin gate) |
| `{min: 0.75, max: 1.0}` | Solo en intense/peak |
| `{min: 0.30, max: 0.60}` | Solo en ambient/gentle |

### Vibe Association

El efecto debe estar registrado en el `DynamicEffectRegistry` con su vibe correspondiente. Sin registro de vibe, el Vibe Shield bloqueará el efecto.

### Texture Affinity (4to gen opcional)

| Valor | Comportamiento |
|-------|----------------|
| `'dirty'` | Solo con texturas sucias/harsh |
| `'clean'` | Solo con texturas limpias |
| `'universal'` | Funciona con cualquier textura |

> **Nota WAVE 4849:** Texture affinity está neutralizada en runtime de Selene — no causa reject/boost. Se mantiene como metadata informativa.

### Tabla de Referencia Rápida: Zona → Aggression

```
silence  → aggression [0.00, 0.30]
valley   → aggression [0.00, 0.50]
ambient  → aggression [0.00, 0.70]
gentle   → aggression [0.00, 0.85]
active   → aggression [0.40, 0.80]
intense  → aggression [0.60, 1.00]
peak     → aggression [0.70, 1.00]
```

### Tabla de Referencia: Sección → Organicity Target

```
intro      → 0.70
verse      → 0.65
chorus     → 0.50
bridge     → 0.60
breakdown  → 0.85  (momento íntimo)
buildup    → 0.40
drop       → 0.15  (explosión mecánica)
outro      → 0.75
```

### Tabla de Referencia: Mood → Organicity Target

```
dreamy       → 0.90
melancholic  → 0.80
neutral      → 0.50
mysterious   → 0.60
euphoric     → 0.55
triumphant   → 0.45
aggressive   → 0.20
```

---

## Resumen del Pipeline End-to-End

```
GodEarFFT (FFT bands, transients)
    ↓
SensesPipeline (rawEnergy = weighted bass/mid/treble)
    ↓
CognitiveFluidState.update() → Ψ(t): I, T, Θ, V, μ, epicness, X
    ↓
EnergyConsciousnessEngine.classify() → 7-zone ladder + tension elevation
    ↓
DNAAnalyzer.deriveTargetDNA() → Target(A, C, O) from ARS or legacy
    ↓
EffectDreamSimulator.generateCandidates()
    ├── Vibe Shield
    ├── Valley/Silence Protection
    ├── Oracle Vision (Cassandra zone projection)
    ├── Zone Filter (aggression DNA limits)
    ├── Pressure Filter (pressureRange gate)
    ├── Mood Filter
    └── Dedup
    ↓
simulateScenario() per candidate → relevance, diversity, vibe, risk, confidence
    ↓
calculateScenarioScore() → weighted sum + Cassandra urgency/confidence boosts
    ↓
Quarantine filter (exclude alive organisms)
    ↓
rankScenarios() → bestScenario
    ↓
DecisionMaker.determineDecisionType()
    ├── divine_strike (epicness > 0.60)
    ├── strike (dream approved)
    ├── prepare_for_drop (Cassandra drop prediction)
    ├── buildup_enhance
    ├── subtle_shift
    └── hold
    ↓
SeleneTitanConscious → pressure veto, cooldown gating, availability check
    ↓
EffectManager → fire effect
```

---

*Documento generado como auditoría técnica del motor cognitivo Selene. Referencia para curación manual de archivos `.lfx`.*
