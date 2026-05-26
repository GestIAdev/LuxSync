# WAVE 4860 — SELENE ALGORITHM FORENSICS

> **Auditoría pura. Cero código modificado. Solo mapeo, diagnóstico y constatación.**
> **Fecha:** 2026-05-26  |  **Auditor:** Cascade (Forensic Mode)

---

## 0. RESUMEN EJECUTIVO

Selene tiene **16 submotores** operando en 4 capas. La mayoría de sus algoritmos son **saludables pero superpoblados**. La arquitectura ha evolucionado orgánicamente durante más de 40 waves (WAVE 500 → 4867), acumulando capas de parches sobre parches. Tres hallazgos críticos:

1. **ContextualEffectSelector está muerto como decisor** — WAVE 1010 lo lobotomizó. Ahora es un repositorio puro, pero DecisionMaker aún lo importa para `getAvailableFromArsenal()` y `checkAvailability()`, creando una dependencia fantasma.
2. **La competencia de ADN funciona, pero el registry es la única fuente de verdad** — WAVE 4843 destruyó las listas hardcodeadas (HEAVY_ARSENAL_EFFECTS, DIVINE_ARSENAL). Los `.lfx` ahora declaran `isHeavyCandidate`, `isDivineCandidate` y `validSections`. Esto es CORRECTO pero implica que el comportamiento de Selene depende 100% del contenido del registry.
3. **Las 3 vías de disparo (Divine, DNA, Fuzzy→Hunt) están sanas en jerarquía, pero Fuzzy está DORMANTE en la práctica** — WAVE 2109 lo castró para evitar "void screams" (Fuzzy ordena strike pero DNA no tiene propuesta cargada). El resultado: Fuzzy solo acelera decisiones cuando DNA ya está listo. Nunca dispara solo.

---

## 1. GATES, BLOQUEOS Y REGLAS

### 1.1 Gate de Worthiness (DreamEngineIntegrator)

**Ubicación:** Primer gate del pipeline DNA (Step 1 del Integrator).
**Fórmula:** `effectiveWorthiness = rawWorthiness / mood.thresholdMultiplier`
**Umbral actual:** `0.55` (WAVE 2104.2)

| Mood | thresholdMultiplier | raw 0.60 → effective | raw 0.70 → effective | raw 0.75 → effective |
|------|--------------------:|-------------------:|---------------------:|---------------------:|
| CALM | 2.5 | 0.24 ❌ | 0.28 ❌ | 0.30 ❌ |
| BALANCED | 1.10 | 0.55 ✅ | 0.64 ✅ | 0.68 ✅ |
| PUNK | 0.8 | 0.75 ✅ | 0.88 ✅ | 0.94 ✅ |

**Diagnóstico:**
- En CALM, Hunt necesita `rawWorthiness ≥ 1.375` para pasar. Imposible (max teórico = 1.0).
- En la práctica, **CALM nunca ejecuta el pipeline DNA completo** a través de este gate. Solo puede disparar vía DIVINE (que no usa este gate) o vía Fuzzy→Hunt fallback.
- BALANCED es el único mood donde el gate respira — `raw=0.61` pasa justo.
- **Esto es INTENCIONAL** (WAVE 1182.2): CALM = efectos suaves, no DNA heavy.

### 1.2 Gate de Zona (DreamEngineIntegrator)

**Ubicación:** Segundo gate del pipeline DNA.
**Regla:** Solo `zone === 'silence'` bloquea. Valley, ambient, gentle pasan.
**Evolución:** WAVE 2103 destruyó el gate anterior que bloqueaba valley+ambient (60% de frames en techno). Ahora es un candado mínimo.

### 1.3 Gate de Intensidad Mínima (DreamEngineIntegrator)

**Ubicación:** Post-VisualConscienceEngine, pre-retorno.
**Umbral:** `intensity < 0.30 → BLOCKED` (WAVE 2102)
**Razón:** Evitar efectos "fantasma" que apenas se notan pero consumen cooldown.

### 1.4 Gate de Cooldown Global (SeleneTitanConscious.think)

**Ubicación:** Pre-ejecución del pipeline DNA.
**Base:** 7000ms (techno/default), 12000ms (fiesta-latina)
**Modificado por mood:** `base × cooldownMultiplier`

| Mood | cooldownMultiplier | Efectivo techno | Efectivo latino | Target EPM |
|------|-------------------:|----------------:|----------------:|-----------:|
| CALM | 4.0 | 28s | 48s | ~1-2 |
| BALANCED | 2.2 | 15.4s | 26.4s | ~3-4 |
| PUNK | 0.7 | 4.9s | 8.4s | ~8-15 |

**Excepciones que bypasean:**
- Drop inminente: `<800ms` + `prob > 0.80`
- **NO** bypasean: `JUST_FIRED_SHIELD_MS = 2000` (WAVE 4849). Este escudo es ABSOLUTO — ni drops pasan.

### 1.5 Gate de Pipeline Execution Throttle

**Ubicación:** SeleneTitanConscious.think, antes de llamar al Integrator.
**Umbral:** 2000ms entre ejecuciones del pipeline completo.
**Bypass:** Solo para drops reales a `<800ms` + `prob > 0.80`.
**Efecto:** Si el pipeline se ejecutó hace 1.5s, se reusa el cache `lastDreamIntegrationResult`.

### 1.6 Gate de Sección (DecisionMaker)

**Reglas de protección contra disparos prematuros:**

- **Buildup + Heavy Arsenal = BLOCKED** (WAVE 2200.3 / 2203). Aplica a DNA Priority 0, Fuzzy Priority 1, y Hunt Priority 2.
- **Section=drop + Z < 0.5 + Heavy Arsenal = ABORT** (WAVE 2200.2, ANTI-FAKE-DROP). Evita disparar arsenal nuclear en "drops" que no tienen energía real.
- **Drop Lock** (WAVE 2187): Un solo efecto por sección `drop`. Se libera cuando la sección cambia.

### 1.7 Gate de Absoluta Energía (DecisionMaker)

**Nuevo:** WAVE 4861 — El Candado Físico Anti-Silencio.
**Fórmula:** `rawEnergy ≥ maxHistoric(30s) × 0.60`
**Excepción:** Si no hay historial de 30s, fallback a `0.45`.
**Efecto:** Impide que un Z-score estadísticamente masivo (bombo tras silencio largo) dispare DIVINE/DROP/HEAVY cuando la energía absoluta es baja.

### 1.8 Gate Espectral Anti-Bad-Bunny (DecisionMaker)

**Nuevo:** WAVE 4864/4865 — SPECTRAL GATE.
**Afecta:** Vibes latino/dembow únicamente.
**Reglas:**
- `hasHeavyKick`: `lowBand ≥ maxHistoric × 0.75`
- `isNotJustVocals`: `lowBand ≥ midBand × 0.8`
**Efecto:** Evita disparos HEAVY/DROP en valles rítmicos donde solo quedan voces autotuneadas inflando la banda MID.

---

## 2. MOOD PROFILES — COEFICIENTES EXACTOS

### 2.1 Tabla Maestra

| Parámetro | CALM | BALANCED | PUNK |
|-----------|------|----------|------|
| `thresholdMultiplier` | 2.5 | 1.10 | 0.8 |
| `cooldownMultiplier` | 4.0 | 2.2 | 0.7 |
| `ethicsThreshold` | 0.95 | 1.20 | 0.75 |
| `maxIntensity` | 0.6 | 1.0 | 1.0 |
| `minIntensity` | — | — | 0.5 |
| `blockList` | 11 efectos | — | — |
| `forceUnlock` | — | — | 2 efectos (strobe_burst, solar_flare) |

### 2.2 Análisis por Mood

**CALM ("Cubata en mano"):**
- `thresholdMultiplier = 2.5`: Necesitas `rawScore ≥ 0.70` para que `effective ≥ 0.28`. Ni siquiera pasa el defuzzify de Fuzzy (que necesita `effective > 0.25`).
- `cooldownMultiplier = 4.0`: 28s-48s entre efectos. Target EPM = 1-2.
- `maxIntensity = 0.6`: Todo está suavizado al 60%.
- `blockList` incluye: todos los strobes, raids, meltdowns, glitches, solar_flares, seismic_snaps.
- **Conclusión forense:** CALM es un modo de "efectos suaves o nada". El pipeline DNA raramente se ejecuta (worthiness gate falla). Los efectos que sí pasan son seleccionados por el fallback del DreamSimulator o por el arsenal suave del registry.

**BALANCED ("El profesional"):**
- `thresholdMultiplier = 1.10`: Recalibrado en WAVE 2492 de 1.20 → 1.10 para hard techno. `raw=0.61` pasa justo.
- `cooldownMultiplier = 2.2`: Recalibrado en WAVE 4829 de 1.8 → 2.2 para dar más aire en latino (target 3-4 EPM).
- `ethicsThreshold = 1.20`: El override de cooldown por DNA requiere `ethicalScore ≥ 1.20`. Dado que `ethicalScore` máximo teórico es 1.0, **este override es IMPOSIBLE en la práctica** (a menos que el cálculo de ethicalScore supere 1.0 por algún path, lo cual no ocurre con weighted product ≤ 1.0).
- **Conclusión forense:** BALANCED es el modo más sano. El override de cooldown por ethics está técnicamente bloqueado (`ethicsThreshold = 1.20 > max possible = 1.0`), lo cual es INTENCIONAL (WAVE 2104.2: "el override debe ser ÉPICO, no rutinario").

**PUNK ("El DJ se ha drogado"):**
- `thresholdMultiplier = 0.8`: 20% más fácil de disparar.
- `cooldownMultiplier = 0.7`: 30% más rápido.
- `minIntensity = 0.5`: Todo efecto forzado al menos a 50%.
- `forceUnlock`: `strobe_burst` y `solar_flare` ignoran cooldowns.
- **Conclusión forense:** PUNK es agresivo pero controlado. No es caos total — el pipeline DNA sigue operando, solo con umbrales más laxos.

---

## 3. DREAMSIMULATOR — ARQUITECTURA Y BLOQUEOS

### 3.1 Pipeline de 4 Pasos (DreamEngineIntegrator)

```
STEP 1 — GATE (Worthiness mood-aware)
  └─ rawWorthiness / thresholdMultiplier ≥ 0.55 ?
     ├─ NO → reject inmediato (sin soñar)
     └─ SÍ → STEP 2

STEP 2 — DREAM (EffectDreamSimulator)
  └─ Genera candidatos por vibe + zona + predicción
  └─ Simula escenarios (projected beauty, risk, GPU, fatigue, diversity)
  └─ DNAAnalyzer calcula relevancia (distancia euclidiana 3D)
  └─ Rankea por relevance × vibeCoherence × (1-risk) × diversityFactor
  └─ Cassandra: si predicción fuerte + tiempo >2s, pre-bufferiza
  └─ Temporal Seal: si recién pre-bufferizado → recommendation='modify'

STEP 3 — FILTER (VisualConscienceEngine)
  └─ 7 valores éticos evaluados (weighted product)
  └─ Mood compliance check (blockList)
  └─ Circuit breaker + timeout wrapper
  └─ Veredicto: APPROVED / REJECTED / DEFERRED

STEP 4 — DECIDE
  └─ Aplica mood.applyIntensity()
  └─ Gate de intensidad mínima: <0.30 → BLOCKED
  └─ IntegrationDecision {approved, effect, ...}
```

### 3.2 Bloqueos Identificados en el Pipeline

| Bloqueo | Ubicación | Umbral | Consecuencia |
|---------|-----------|--------|--------------|
| Worthiness Gate | Step 1 | effective < 0.55 | No se simula nada. Silence inmediato. |
| Zone Gate | Step 1 | zone === 'silence' | No se simula. Evita efectos en E < 0.15. |
| Temporal Seal | Step 2 | recommendation === 'modify' | Pre-buffer existente = no disparar aún. |
| Mood BlockList | Step 3 | effect in profile.blockList | Violación CRITICAL. Score × 0.1. |
| Ethical Score | Step 3 | score < 0.5 (o 0.7 en epilepsy) | REJECTED o DEFERRED. |
| Intensity Gate | Step 4 | intensity < 0.30 | APPROVED → anulado. |

### 3.3 Cache Staleness (WAVE 2730 / 2106)

- **Sección cambia** → cache invalidado (WAVE 2106). Evita que un efecto de buildup se dispare en breakdown.
- **Efecto ya disparado** → cache invalidado si está en cooldown (WAVE 2730). Evita que el mismo efecto se re-proponga frame a frame.
- **TTL del cache del Dreamer:** 5000ms.

---

## 4. COMPETENCIA DE ADN (DNAAnalyzer)

### 4.1 Modelo Genético

Cada efecto tiene un **ADN inmutable** de 3 genes:
- **Aggression (A):** 0=suave, 1=brutal
- **Chaos (C):** 0=ordenado, 1=caótico
- **Organicity (O):** 0=sintético, 1=orgánico

El **Target DNA** se deriva del contexto musical actual:
- Sección = drop → A alto, O bajo
- Sección = breakdown → A bajo, O alto
- Harshness alto → C alto
- Textura = CLEAN → O alto

### 4.2 Cálculo de Relevancia

```
distance = √[(A_effect - A_target)² + (C_effect - C_target)² + (O_effect - O_target)²]
baseRelevance = 1 - (distance / √3)   // √3 ≈ 1.732 = max distancia posible
confidenceWeighted = baseRelevance × target.confidence + (1 - target.confidence) × 0.5
finalRelevance = confidenceWeighted × diversityFactor
```

### 4.3 Anti-Repetición (Diversity Engine)

**Ventana temporal:** 120s (WAVE 2095.3)
**Factores de penalización:** `[1.0, 0.70, 0.35, 0.15]`

| Usos recientes (120s) | Factor | Efecto en relevance base 0.62 |
|-----------------------|--------|------------------------------:|
| 0 (nunca usado) | 1.00× | 0.62 |
| 1 | 0.70× | 0.43 |
| 2 | 0.35× | 0.22 |
| 3+ | 0.15× | 0.09 |

**Conclusión forense:** La curva es agresiva. Un efecto usado 2 veces en 2 minutos cae a 35% de su relevancia. Esto FUERZA rotación real, pero puede generar silencios si todos los efectos del arsenal han sido usados recientemente.

### 4.4 EMA Smoothing (Anti-Parkinson Digital)

- **Alpha:** 0.30 (WAVE 2107, subido de 0.20)
- **Efecto:** El Target DNA no salta bruscamente. Toma ~10-15 frames para transicionar significativamente.
- **Excepción:** Snap Conditions para drop/breakdown (respuesta inmediata, no EMA).

### 4.5 Middle Void Detection

- **Threshold:** 0.60
- **Cuándo:** Cuando el Target DNA cae en una región "intermedia" sin efectos cercanos.
- **Fallback:** `cyber_dualism` (wildcard genético).

---

## 5. LAS 3 VÍAS DE DISPARO — PRIORIDADES Y SANIDAD

### 5.1 Jerarquía Estricta (DecisionMaker.determineDecisionType)

```
Prioridad -1: DIVINE STRIKE
  └─ Z ≥ 4.0σ AND rawEnergy ≥ 0.72 AND zone ∉ {silence, valley}
  └─ AND energyGateOpen (absoluta + spectral)
  └─ AND NO dictador activo
  └─ Acción: MANDATORY FIRE con arsenal DIVINE rankeado por diversity

Prioridad 0: DNA BRAIN (IntegrationDecision)
  └─ dreamIntegration.approved === true
  └─ AND NO buildup+heavy arsenal block
  └─ Acción: strike con el efecto propuesto por DNA

Prioridad 1: FUZZY STRIKE
  └─ fuzzyDecision.action === 'strike'/'force_strike'
  └─ AND fuzzyDecision.confidence ≥ 0.50 (strike) / 0.60 (force_strike)
  └─ AND hasDNAProposal (WAVE 2109 FIX — no más void screams)
  └─ AND NO buildup+heavy arsenal block (WAVE 2203)
  └─ Acción: strike

Prioridad 2: HUNT STRIKE
  └─ huntDecision.worthiness ≥ 0.65 AND confidence > 0.50
  └─ AND NO buildup+heavy arsenal block
  └─ Acción: strike

Prioridad 3: DROP PREDICTED
  └─ prediction.type === 'drop_incoming' AND prob > 0.65
  └─ OR pattern.section === 'drop'
  └─ Acción: prepare_for_drop (arma arsenal DIVINE)

Prioridad 4: BUILDUP
  └─ section === 'buildup' OR prediction.type === 'buildup_starting' (prob>0.7)
  └─ Acción: buildup_enhance (modifica color/physics, SIN efecto)

Prioridad 5: SUBTLE SHIFT
  └─ beauty.totalBeauty > 0.75 AND beauty.trend === 'rising'
  └─ Acción: subtle_shift (ajuste sutil de color)

Default: HOLD
```

### 5.2 Sanidad de Cada Vía

| Vía | Estado | Diagnóstico |
|-----|--------|-------------|
| **DIVINE** | 🟢 Sana | Candados WAVE 4861 (absoluta energía) + WAVE 4864 (spectral) + WAVE 2201 (energy gate 0.72) hacen que DIVINE sea raro pero legítimo. No dispara en silencios. |
| **DNA** | 🟢 Sana | El pipeline funciona. El único riesgo es que en BALANCED con `thresholdMultiplier=1.10`, `rawWorthiness` de 0.55-0.60 no pasa el gate 0.55. Pero eso es intencional (WAVE 2492). |
| **Fuzzy→Hunt** | 🟡 Dormante | Fuzzy nunca dispara solo (WAVE 2109). Solo acelera cuando DNA ya tiene propuesta. Hunt sigue siendo el sensor de fondo. La vía Fuzzy pura está muerta. |

### 5.3 El Problema del "Void Scream" (WAVE 2109)

**Síntoma histórico:** Fuzzy emitía `action='strike'` 16 veces, pero `generateStrikeDecision()` encontraba `dreamIntegration?.approved === false` → SILENCE. Resultado: 16 líneas de log `[FUZZY STRIKE → strike]` seguidas de `SILENCE: DNA has no proposal`.

**Fix (WAVE 2109):** Fuzzy STRIKE solo dispara `return 'strike'` si `hasDNAProposal === true`. Si DNA no tiene nada cargado, Fuzzy cae through a Hunt/prediction/buildup.

**Efecto colateral:** Fuzzy ya no puede disparar efectos independientemente de DNA. Necesita que el pipeline DNA haya corrido recientemente y tenga un cache válido.

---

## 6. DECISIONMAKER ↔ CONTEXTUALEFFECTSELECTOR

### 6.1 Estado del Cadáver

ContextualEffectSelector.ts tiene un encabezado claro (líneas 46-50):

```
// 🔪 WAVE 1010.5: TYPES PURGED
// REMOVED: ContextualEffectSelection (solo usado por select() deprecated)
// REMOVED: ContextualSelectorInput (solo usado por select() deprecated)
// Este módulo ahora es PURO REPOSITORIO - no toma decisiones.
```

**PERO** DecisionMaker.ts aún lo importa (línea 38):
```ts
import { getContextualEffectSelector } from '../../effects/ContextualEffectSelector'
```

### 6.2 Funciones Fantasma que Aún Operan

ContextualEffectSelector sigue siendo llamado desde:

1. **DecisionMaker.ts** — `getContextualEffectSelector()` para:
   - `getAvailableFromArsenal()` (arsenal DIVINE → disponibilidad)
   - `checkAvailability()` (cooldown gate post-decisión)

2. **SeleneTitanConscious.ts** — `getContextualEffectSelector()` para:
   - `checkAvailability(cachedEffect, vibeId)` (WAVE 2730 cache staleness check)

### 6.3 ¿Conflicto?

**NO hay conflicto en ejecución**, porque ContextualEffectSelector ya NO toma decisiones artísticas. Solo responde a queries de disponibilidad:
- "¿Este efecto está en cooldown?"
- "¿Qué efectos del arsenal DIVINE están disponibles para este vibe?"

**PERO** hay una **dependencia arquitectónica fantasma**. El nuevo estándar es `.lfx V3` y el `DynamicEffectRegistry`. ContextualEffectSelector todavía mantiene sus propias tablas de efectos hardcodeados (aunque WAVE 1010.5 las marcó como deprecated). Si el registry y CES divergen, el comportamiento es impredecible.

### 6.4 Recomendación Forense (no para ejecutar, solo constatar)

El ContextualEffectSelector es **zombi arquitectónico**. No dispara, no decide, pero sigue siendo consultado por cooldowns. La migración completa al `DynamicEffectRegistry` + `EffectManager` no terminó. El CES sigue siendo el gatekeeper de última milla para cooldowns.

---

## 7. EFECTOS `.LFX` V3 VS. SISTEMA LEGACY

### 7.1 El Nuevo Estándar

El usuario confirma: **".lfx V3 (compatible con V.2) es el nuevo estándar y ÚNICO para efectos"**.

El `DynamicEffectRegistry` lee los `.lfx` y expone:
- `entry.dna` → {aggression, chaos, organicity, textureAffinity}
- `entry.simMeta.isHeavyCandidate`
- `entry.simMeta.isDivineCandidate`
- `entry.validSections`
- `entry.compatibleVibes`

### 7.2 Conflictos Detectados

1. **DecisionMaker.isHeavyEffect()** ya usa el registry (WAVE 4843). ✅ Sano.
2. **DecisionMaker.isEffectAllowedInSection()** ya usa el registry (WAVE 4843). ✅ Sano.
3. **ContextualEffectSelector** todavía tiene hardcodeados sus propios `EFFECTS_BY_INTENSITY`, `EFFECTS_BY_VIBE`, etc. (aunque deprecated). Si alguien llama al viejo `select()` (eliminado en WAVE 1010.5), no hay problema porque la función no existe.
4. **VisualConscienceEngine.suggestAlternatives()** hardcodea fallback effects (`acid_sweep`, `tropical_pulse`, `tidal_wave`). Estos IDs podrían no existir en el registry. ⚠️ Riesgo latente.

---

## 8. THRESHOLDS CRÍTICOS — TABLA MAESTRA

| Threshold | Valor | Ubicación | Wave | Propósito |
|-----------|------:|-----------|------|-----------|
| DIVINE_THRESHOLD | 4.0σ | DecisionMaker | WAVE 2185 | Z mínimo para DIVINE |
| DIVINE_ENERGY_GATE | 0.72 | DecisionMaker | WAVE 2494 | Energía mínima para DIVINE |
| ABSOLUTE_ENERGY_GATE_RATIO | 0.60 | DecisionMaker | WAVE 4861 | rawEnergy vs max histórico |
| SPECTRAL_KICK_THRESHOLD | 0.75×max | DecisionMaker | WAVE 4864 | lowBand mínimo en latino |
| VALLEY_PROTECTION | Z < 0 + zone∈{valley,silence} | DecisionMaker | WAVE 1178 | Bloquea todo disparo en valles |
| FUZZY_DEFUZZIFY_STRIKE | > hold+0.08 AND > 0.25 | FuzzyDecisionMaker | WAVE 2109 | Umbral strike difuso |
| FUZZY_FORCE_STRIKE | > 0.5 | FuzzyDecisionMaker | WAVE 2109 | Override divino difuso |
| FUZZY_CONFIDENCE_FOR_STRIKE | ≥ 0.50 | DecisionMaker | WAVE 2109 | Fuzzy strike válido |
| HUNT_WORTHINESS | ≥ 0.65 | DecisionMaker | WAVE 811 | Hunt strike válido |
| HUNT_CONFIDENCE | > 0.50 | DecisionMaker | WAVE 811 | Hunt confianza mínima |
| DREAM_WORTHINESS_GATE | ≥ 0.55 | DreamEngineIntegrator | WAVE 2104.2 | Ejecutar pipeline DNA |
| MIN_INTENSITY_GATE | ≥ 0.30 | DreamEngineIntegrator | WAVE 2102 | Intensidad mínima post-ethics |
| ETHICS_APPROVAL | ≥ 0.50 | VisualConscienceEngine | WAVE 900.2 | Score ético mínimo |
| ETHICS_EPILEPSY | ≥ 0.70 | VisualConscienceEngine | WAVE 2093 | Score ético en modo seguro |
| PREDICTION_DROP | prob > 0.65 | PredictionEngine | WAVE 2095 | Drop inminente |
| PREDICTION_BUILDUP | prob > 0.70 | PredictionEngine | WAVE 1172 | Buildup detectado |
| ENERGY_SPIKE | delta > 0.08 | PredictionEngine | WAVE 1176 | Spike de energía |
| GLOBAL_COOLDOWN | 7000ms / 12000ms | SeleneTitanConscious | WAVE 2101.4 | Entre efectos |
| PIPELINE_THROTTLE | 2000ms | SeleneTitanConscious | WAVE 2101.4 | Entre ejecuciones DNA |
| JUST_FIRED_SHIELD | 2000ms | SeleneTitanConscious | WAVE 4849 | Inmunidad post-disparo |
| DREAM_CACHE_TTL | 5000ms | DreamEngineIntegrator | WAVE 900.4 | Vida del cache de sueños |
| DNA_SMOOTHING_ALPHA | 0.30 | DNAAnalyzer | WAVE 2107 | EMA anti-jitter |
| DNA_DIVERSITY_WINDOW | 120000ms | DNAAnalyzer | WAVE 2095.3 | Ventana anti-repetición |
| CALM_thresholdMultiplier | 2.5 | MoodController | WAVE 1182.2 | Filtro CALM |
| BALANCED_thresholdMultiplier | 1.10 | MoodController | WAVE 2492 | Filtro BALANCED |
| PUNK_thresholdMultiplier | 0.8 | MoodController | WAVE 700.1 | Filtro PUNK |

---

## 9. HALLAZGOS Y RECOMENDACIONES FORENSES

### 9.1 Hallazgos Críticos

1. **[ARCHITECTURE]** ContextualEffectSelector es un zombi. No decide, pero sigue siendo el gatekeeper de cooldowns para DecisionMaker y SeleneTitanConscious. Migración incompleta.

2. **[LOGIC]** BALANCED `ethicsThreshold = 1.20` es técnicamente imposible de alcanzar (max score = 1.0). El override de cooldown por DNA nunca ocurre en BALANCED. Esto es intencional según WAVE 2104.2, pero podría ser un bug si el diseñador esperaba que override funcionase ocasionalmente.

3. **[LOGIC]** CALM nunca ejecuta el pipeline DNA completo debido al worthiness gate (`effective = raw / 2.5`, necesita `raw ≥ 1.375`, imposible). Los efectos en CALM provienen de DIVINE (raro) o del fallback del DreamSimulator cuando Fuzzy desbloquea el pipeline (pero Fuzzy necesita DNA propuesta, que no existe porque el pipeline no corrió). **CALM depende de Prioridad 3+ (drop/buildup/subtle) o de HOLD puro.**

4. **[LOGIC]** Fuzzy está castrado (WAVE 2109). Su único propósito actual es acelerar decisiones cuando DNA ya tiene propuesta. La vía Fuzzy independiente está muerta.

5. **[RISK]** VisualConscienceEngine.suggestAlternatives() hardcodea IDs de efecto (`acid_sweep`, `tropical_pulse`, `tidal_wave`). Si estos IDs no existen en el DynamicEffectRegistry, las alternativas fallan silenciosamente.

### 9.2 Recomendaciones (Solo constatación, no ejecución)

- **R1:** Documentar explícitamente que CALM no usa el pipeline DNA completo. Si el objetivo es que CALM sí tenga efectos suaves generados por DNA, el worthiness gate necesitaría un bypass o un umbral separado para CALM.
- **R2:** Evaluar si `ethicsThreshold = 1.20` en BALANCED debería ser `1.0` o `0.95` para permitir overrides legítimos pero raros.
- **R3:** Migrar `suggestAlternatives()` a consultar el DynamicEffectRegistry en lugar de hardcodear IDs.
- **R4:** Auditar si ContextualEffectSelector puede ser reemplazado completamente por `EffectManager.checkAvailability()` + `DynamicEffectRegistry.getDivineArsenal()`.
- **R5:** Considerar reactivar Fuzzy con un path independiente que NO requiera DNA proposal (p.ej. usando el arsenal suave del registry directamente).

---

## 10. ANEXO: FLUJO COMPLETO EN UN FRAME (44 Hz)

```
[Frame N @ 44Hz]
  │
  ├─ 1. TitanEngine: FFT → features → TitanStabilizedState
  │
  ├─ 2. Sense: BeautySensor + ConsonanceSensor + MusicalPatternSensor
  │
  ├─ 3. ContextualMemory: Z-score, trend, peak, valley
  │
  ├─ 4. HuntEngine: FSM (sleeping→stalking→evaluating→striking→learning)
  │
  ├─ 5. PredictionEngine: drop/buildup/energy_spike (vibe-aware thresholds)
  │
  ├─ 6. EnergyConsciousness: 7 zones (silence→valley→ambient→gentle→active→intense→peak)
  │
  ├─ 7. DropBridge: alertLevel (none/watching/ready/divine)
  │
  ├─ 8. FuzzyDecisionMaker: 25 reglas → defuzzify → action+confidence
  │
  ├─ 9. DNA Unlock Check:
  │     (huntWorthiness ≥ 0.65 OR fuzzyUnlock) AND !dictator ?
  │     ├─ YES → Global Cooldown Gate → Pipeline Throttle →
  │     │        DreamEngineIntegrator.executeFullPipeline()
  │     │        (Worthiness Gate → Dream → Filter → Decide)
  │     └─ NO  → dreamIntegrationData = null
  │
  ├─ 10. Section Change Cache Invalidation
  │
  ├─ 11. DecisionMaker.makeDecision():
  │      DIVINE? → DNA? → FUZZY (if hasDNAProposal)? → HUNT? → DROP? → BUILDUP? → SUBTLE? → HOLD
  │
  ├─ 12. EffectManager Gatekeeper:
  │      checkAvailability() → hardCooldown? → softCooldown? → ethicsOverride?
  │
  ├─ 13. SeleneAetherAdapter: ConsciousnessOutput → INodeIntent[] (L3)
  │
  └─ 14. NodeArbiter: L3 domina canales → L0/L1 silenciados → NodeResolver → DMX
```

**Tiempo de ciclo objetivo:** < 23ms (44 Hz). El pipeline DNA completo (async) puede tardar 3-10ms. Con cache reuse, es < 1ms.

---

*Fin del informe forense. Ningún archivo de código fue modificado durante esta auditoría.*
