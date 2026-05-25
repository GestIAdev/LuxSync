# WAVE 4839 — SELENE BUREAUCRACY MAP
## Auditoría Forense de Filtros, Candados, Umbrales y Penalizaciones del Pipeline Cognitivo

**Scope:** `DreamEngineIntegrator.ts` | `VisualConscienceEngine.ts` | `VisualEthicalValues.ts` | `DecisionMaker.ts` | `SeleneTitanConscious.ts`

**Objetivo:** Identificar cada punto del pipeline donde un efecto válido puede ser abortado, diferenciando entre *hardcode* inmutable y *política configurable*.

---

## §1. RESUMEN EJECUTIVO

Selene tiene **más de 40 filtros activos** distribuidos en 5 capas del pipeline. Muchos son redundantes o se solapan. Los cortes más frecuentes en producción (basado en logs de `WAVE-4831`) son:

1. **Integrator Wall** — `VisualConscienceEngine` rechazaba TODO con violaciones `low`/`medium` (parcheado en WAVE 4832 P3).
2. **Color Buffer Leak** — `_normRgbBuf` compartido causaba que todos los fixtures viesen el color del último evaluado (parcheado en WAVE 4830).
3. **Strobe Blind Path** — `HephaestusAetherAdapter` no abría el `shutter` mecánico al emitir strobe (parcheado en WAVE 4830).
4. **Buildup Restriction** — `DecisionMaker` bloquea HEAVY_ARSENAL en `section=buildup` en 3 paths (DNA, Fuzzy, Hunt).
5. **Spectral Gate** — latino/dembow requiere `lowBand >= maxHistoric*0.85` + `lowBand >= mid*0.8`, bloqueando drops en valles vocales.

---

## §2. TABLA MAESTRA DE FILTROS

### Leyenda
- **Hardcodeado** = Constante literal en el código sin API de configuración.
- **Semi-configurable** = Se deriva de otro sistema (mood, epilepsy mode) pero no es directamente tuneable.
- **Configurable** = Existe una API, constante exportada, o parámetro de entrada.

---

### CAPA A: DREAM ENGINE INTEGRATOR (`DreamEngineIntegrator.ts`)

| # | Nombre del Filtro | Condición de Bloqueo | ¿Es Hardcodeado? | Severidad |
|---|-------------------|----------------------|------------------|-----------|
| A1 | **Mood-Aware Worthiness Gate** | `effectiveWorthiness < 0.55` (raw ajustado por mood profile) | **Hardcodeado** (`0.55`) | HIGH |
| A2 | **Zone Gate (Silence)** | `energyZone === 'silence'` (E < 0.15) | **Hardcodeado** | MEDIUM |
| A3 | **No Candidates Gate** | `candidates.length === 0` después de `dreamEffects()` | Lógica de negocio | MEDIUM |
| A4 | **Temporal Seal Gate** | `dreamResult.recommendation === 'modify'` (pre-buffer Cassandra) | **Hardcodeado** | MEDIUM |
| A5 | **Minimum Intensity Gate** | `decision.effect.intensity < 0.30` tras aprobación ética | **Hardcodeado** (`0.30`) | MEDIUM |
| A6 | **Dream Timeout** | `>3000ms` en simulación → aborta con `dreamRecommendation='abort'` | **Hardcodeado** (`3000ms`) | LOW |
| A7 | **Dream Cache TTL** | Resultados cacheados por `5000ms`; durante ese tiempo no se re-simula | **Hardcodeado** (`5000ms`) | LOW |
| A8 | **Mood Intensity Modifier** | `MoodController.applyIntensity()` puede reducir intensidad del efecto aprobado | Semi-configurable | LOW |

> **Nota A1:** El threshold `0.55` ha oscilado entre `0.50-0.58` en 4 waves. Con `balanced` mood (1.15x divisor), un `rawWorthiness=0.64` produce `effective=0.557` → **pasa por 0.007**. Esto es un corte fino como papel de fumar.

---

### CAPA B: VISUAL CONSCIENCE ENGINE (`VisualConscienceEngine.ts`)

| # | Nombre del Filtro | Condición de Bloqueo | ¿Es Hardcodeado? | Severidad |
|---|-------------------|----------------------|------------------|-----------|
| B1 | **Circuit Breaker** | 3 fallos consecutivos → estado `OPEN` por `30000ms`. Ninguna evaluación pasa. | **Hardcodeado** (`3/2/30000`) | CRITICAL |
| B2 | **Timeout Wrapper** | Evaluación ética que excede `5000ms` → fallback `REJECTED` | **Hardcodeado** (`5000ms`) | MEDIUM |
| B3 | **Approval Threshold (Normal)** | `best.ethicalScore < 0.50` → no `APPROVED` | **Hardcodeado** (`0.50`) | HIGH |
| B4 | **Approval Threshold (Epilepsy)** | `best.ethicalScore < 0.70` en `epilepsyMode=true` | **Hardcodeado** (`0.70`) | HIGH |
| B5 | **Blocking Violations Filter** *(WAVE 4832 P3)* | `high` o `critical` violations bloquean `APPROVED`. `low`/`medium` solo penalizan score. | **Hardcodeado** | HIGH |
| B6 | **DEFERRED Threshold** | `best.ethicalScore >= 0.35` (0.7×0.5) pero con blocking violations → `DEFERRED`, no `REJECTED` | Derivado | LOW |
| B7 | **No Candidates → REJECTED** | `candidates.length === 0` → veredicto `REJECTED` | Lógica de negocio | MEDIUM |
| B8 | **Maturity System** | Nivel de madurez desbloquea `complex_effects`/`creative_risk`/`autonomous_creation` — afecta qué efectos son elegibles | Semi-configurable | LOW |

> **Nota B5:** Antes de WAVE 4832 P3, `violations.length === 0` era requerido — un solo `low` de diversity o texture coherence bloqueaba TODO. Ahora solo `high`/`critical` son bloqueos.

---

### CAPA C: VISUAL ETHICAL VALUES (`VisualEthicalValues.ts`)

#### VALUE 1: AUDIENCE SAFETY (weight 1.0 — máxima prioridad)

| # | Regla | Condición de Bloqueo | ¿Es Hardcodeado? | Severidad |
|---|-------|----------------------|------------------|-----------|
| C1.1 | `epilepsy_protection` | `epilepsyMode && effect.includes('strobe')` → **BLOCK** (penalty 1.0) | **Hardcodeado** | CRITICAL |
| C1.2 | `metal_license` | `texture='harsh' && clarity>0.7` → boost +0.20 para strobes | **Hardcodeado** | LOW |
| C1.3 | `fatigue_protection` | `effectiveFatigue > 0.8 && intensity > 0.7` → **BLOCK** (penalty 0.6) | **Hardcodeado** | HIGH |
| C1.4 | `fatigue_protection` (moderate) | `effectiveFatigue > 0.6 && intensity > 0.8` → penalty 0.3 | **Hardcodeado** | MEDIUM |
| C1.5 | `luminosity_budget` | `recentIntensity + effect.intensity > 25.0` por minuto → **BLOCK** (penalty 0.6) | **Hardcodeado** | HIGH |
| C1.6 | `intense_effect_rate_limit` | `intensity > 0.7 && <2000ms desde último intenso` → penalty 0.3 | **Hardcodeado** | MEDIUM |
| C1.7 | `clarity_stress_adjustment` | `stress = energy × (1-clarity) > 0.5 && intensity > 0.8` → penalty 0.15 | **Hardcodeado** | LOW |

#### VALUE 2: VIBE COHERENCE (weight 0.9)

| # | Regla | Condición de Bloqueo | ¿Es Hardcodeado? | Severidad |
|---|-------|----------------------|------------------|-----------|
| C2.1 | `vibe_effect_match` — Techno Heresy | `vibe.includes('techno') && effect === 'solar_flare'` → **BLOCK** (penalty 1.0) | **Hardcodeado** | CRITICAL |
| C2.2 | `vibe_effect_match` — Latino Aggression | `vibe.includes('latino') && effect === 'industrial_strobe' && energy < 0.85` → penalty 0.6 | **Hardcodeado** | HIGH |
| C2.3 | `vibe_effect_match` — Chill Strobe | `vibe.includes('chill') && effect.includes('strobe') && intensity > 0.5` → penalty 0.6 | **Hardcodeado** | HIGH |
| C2.4 | `vibe_category_bonus` | Boost +0.15 para hardcoded listas: `technoEffects`, `latinoEffects` | **Hardcodeado** | LOW |

#### VALUE 3: EFFECT DIVERSITY (weight 0.8)

| # | Regla | Condición de Bloqueo | ¿Es Hardcodeado? | Severidad |
|---|-------|----------------------|------------------|-----------|
| C3.1 | `abuse_prevention` | `usageRate > 50%` en últimos 20 efectos → penalty 0.3 | **Hardcodeado** | MEDIUM |
| C3.2 | `forgotten_effect_boost` | Efecto no usado en últimos 50 → boost +0.2 | **Hardcodeado** | LOW |
| C3.3 | `consecutive_same_effect` | Mismo efecto 3 veces seguidas → penalty 0.6 | **Hardcodeado** | HIGH |

#### VALUE 4: AESTHETIC BEAUTY (weight 0.85)

| # | Regla | Condición de Bloqueo | ¿Es Hardcodeado? | Severidad |
|---|-------|----------------------|------------------|-----------|
| C4.1 | `beauty_threshold` | `projectedBeauty < 0.4 && energy < 0.8` → penalty 0.3 | **Hardcodeado** | MEDIUM |
| C4.2 | `beauty_bonus` | `projectedBeauty > 0.8` → boost +0.1 | **Hardcodeado** | LOW |
| C4.3 | `texture_coherence` — Clean+Dirty | `texture==='clean'/'warm' && effectAffinity==='dirty'` → penalty 0.5 | **Hardcodeado** | HIGH |
| C4.4 | `texture_coherence` — Harsh+Clean | `texture==='harsh'/'noisy' && effectAffinity==='clean'` → penalty 0.15 | **Hardcodeado** | LOW |
| C4.5 | `texture_coherence` — DROP OVERRIDE *(WAVE 4832 P2)* | `energy > 0.80 && harshness > 0.4` → **BYPASS** de C4.3 | **Hardcodeado** | HIGH |

> **Nota C4.3:** Esta regla era la mayor causa de rechazo post-WAVE 4822. Efectos migrados con `archetype='strobe'/'heavy'` obtienen `textureAffinity='dirty'`. En audio `clean`/`warm` (producción latina moderna) → rechazo masivo. El override P2 mitiga esto en drops.

#### VALUE 5: TEMPORAL BALANCE (weight 0.7)

| # | Regla | Condición de Bloqueo | ¿Es Hardcodeado? | Severidad |
|---|-------|----------------------|------------------|-----------|
| C5.1 | `temporal_pattern_break` | BiasTracker detecta patrón temporal → penalty 0.3 | Semi-configurable | MEDIUM |
| C5.2 | `rapid_fire_prevention` | `>=5 efectos en 10s` → penalty 0.1 | **Hardcodeado** | LOW |

#### VALUE 6: EFFECT JUSTICE (weight 0.6)

| # | Regla | Condición de Bloqueo | ¿Es Hardcodeado? | Severidad |
|---|-------|----------------------|------------------|-----------|
| C6.1 | `forgotten_effect_rescue` | Efecto olvidado + `energy < 0.6` → boost +0.15 | Semi-configurable | LOW |
| C6.2 | `neglected_effect_priority` | Efecto en lista de neglect del BiasTracker → boost +0.1 | Semi-configurable | LOW |

#### VALUE 7: RISK CREATIVITY (weight 0.5)

| # | Regla | Condición de Bloqueo | ¿Es Hardcodeado? | Severidad |
|---|-------|----------------------|------------------|-----------|
| C7.1 | `allow_experimental` | 10% de probabilidad (`Math.random() < 0.1`) de permitir riesgo | **Hardcodeado** | LOW |
| C7.2 | `risk_ceiling` | `riskLevel > 0.85` → penalty 0.3 | **Hardcodeado** | MEDIUM |
| C7.3 | `creative_moment_boost` | `energy > 0.85 && riskLevel < 0.8` → boost +0.05 | **Hardcodeado** | LOW |

---

### CAPA D: DECISION MAKER (`DecisionMaker.ts`)

#### D.1 DIVINE / DROP PATH

| # | Nombre del Filtro | Condición de Bloqueo | ¿Es Hardcodeado? | Severidad |
|---|-------------------|----------------------|------------------|-----------|
| D1 | **Dictator Lock** | `activeDictator !== null` → DIVINE se suprime silenciosamente | Configurable (runtime) | MEDIUM |
| D2 | **DIVINE Threshold** | `Z < 4.0σ` → no es DIVINE | **Hardcodeado** (`4.0`) | HIGH |
| D3 | **DIVINE Zone Protection** | `zone === 'silence' || zone === 'valley'` → DIVINE BLOCKED | **Hardcodeado** | HIGH |
| D4 | **DIVINE Energy Gate** | `rawEnergy < 0.72` → DIVINE SUPPRESSED (fall through) | **Hardcodeado** (`0.72`) | HIGH |
| D5 | **Absolute Energy Gate** | `rawEnergy < maxHistoric × 0.60` (o `< 0.45` si sin historial) | **Hardcodeado** | HIGH |
| D6 | **Spectral Gate (Latino)** | `lowBand < maxHistoric×0.85` OR `lowBand < midBand×0.8` | **Hardcodeado** | HIGH |

#### D.2 MUSICAL SECTION PATH

| # | Nombre del Filtro | Condición de Bloqueo | ¿Es Hardcodeado? | Severidad |
|---|-------------------|----------------------|------------------|-----------|
| D7 | **Valley Protection** | `(zone === 'valley' || zone === 'silence') && Z < 0` → `return 'hold'` | **Hardcodeado** | HIGH |
| D8 | **Breakdown Protection** | `section === 'breakdown'` → `return 'hold'` (solo DIVINE override) | **Hardcodeado** | HIGH |
| D9 | **Buildup Restriction** | `section === 'buildup' && HEAVY_ARSENAL_EFFECTS.has(effect)` → BLOCK en DNA path | **Hardcodeado** | HIGH |
| D10 | **Fuzzy Buildup Wall** | Igual que D9 pero en Fuzzy path (force_strike / strike) | **Hardcodeado** | HIGH |
| D11 | **Hunt Buildup Wall** | Igual que D9 pero en Hunt path | **Hardcodeado** | HIGH |

#### D.3 HUNT / FUZZY PATH

| # | Nombre del Filtro | Condición de Bloqueo | ¿Es Hardcodeado? | Severidad |
|---|-------------------|----------------------|------------------|-----------|
| D12 | **Hunt Worthiness Threshold** | `worthiness < 0.65` → no entra a Hunt path | **Hardcodeado** (`0.65`) | HIGH |
| D13 | **Hunt Confidence** | `confidence <= 0.50` → no entra a Hunt path | **Hardcodeado** (`0.50`) | MEDIUM |
| D14 | **Fuzzy Force_Strike Confidence** | `confidence < 0.60` → no force strike | **Hardcodeado** (`0.60`) | MEDIUM |
| D15 | **Fuzzy Strike Confidence** | `confidence < 0.50` → no fuzzy strike | **Hardcodeado** (`0.50`) | MEDIUM |
| D16 | **Fuzzy DNA Requirement** | `!hasDNAProposal` (no dreamIntegration aprobado) → Fuzzy cae al vacío | Lógica de negocio | HIGH |

#### D.4 TACTICAL / ZONE VALIDATION

| # | Nombre del Filtro | Condición de Bloqueo | ¿Es Hardcodeado? | Severidad |
|---|-------------------|----------------------|------------------|-----------|
| D17 | **Nuclear Arsenal Veto** | Efecto en `NUCLEAR_ARSENAL` Set (9 efectos) → prohibido en hunt_strike | **Hardcodeado** | HIGH |
| D18 | **Zone Osmosis (Anti-Drop)** | `candidateZoneIndex < currentZoneIndex` → no reducir energía | **Hardcodeado** | MEDIUM |
| D19 | **Zone Jump Limit** | `zoneDelta > 1` (salto >1 zona) → rechazado | **Hardcodeado** | MEDIUM |

#### D.5 DROP PATH

| # | Nombre del Filtro | Condición de Bloqueo | ¿Es Hardcodeado? | Severidad |
|---|-------------------|----------------------|------------------|-----------|
| D20 | **Drop Probability** | `prediction.probability <= 0.65` para `drop_incoming` → no prepara | **Hardcodeado** | MEDIUM |
| D21 | **Drop Imminence** | `estimatedTimeMs >= 800` Y `section !== 'drop'` → no dispara aún | **Hardcodeado** (`800ms`) | MEDIUM |
| D22 | **THE DROP LOCK** | `!acquireDropLock()` → ya se disparó en este drop → silencio | **Hardcodeado** | HIGH |
| D23 | **Anti-Fake-Drop (Standard)** | `HEAVY_ARSENAL && Z < 0.5` → aborta heavy en drop dudoso | **Hardcodeado** | HIGH |
| D24 | **Anti-Fake-Drop (Latino)** | `HEAVY_ARSENAL && Z < 1.2` → aborta heavy en latino | **Hardcodeado** | HIGH |
| D25 | **Drop Texture Filter** | `filterArsenalByTexture()` puede vaciar arsenal DIVINE → fallback | Semi-configurable | MEDIUM |
| D26 | **Diversity Selector** | Penalización de diversidad en arsenal (factor 0.70, 0.35, 0.15) | **Hardcodeado** | LOW |

#### D.6 DEFAULTS

| # | Nombre del Filtro | Condición de Bloqueo | ¿Es Hardcodeado? | Severidad |
|---|-------------------|----------------------|------------------|-----------|
| D27 | **The Silence Rule** | `!dreamIntegration?.approved` → sin efecto, sin fallback legacy | Lógica de negocio | HIGH |
| D28 | **DIVINE Arsenal Hardcode** | Listas explícitas por vibe (`fiesta-latina`, `techno-club`, `pop-rock`) | **Hardcodeado** | HIGH |
| D29 | **HEAVY_ARSENAL Set** | 9 efectos hardcodeados (`core_meltdown`, `industrial_strobe`, etc.) | **Hardcodeado** | HIGH |

---

### CAPA E: SELENE TITAN CONSCIOUS (`SeleneTitanConscious.ts`)

| # | Nombre del Filtro | Condición de Bloqueo | ¿Es Hardcodeado? | Severidad |
|---|-------------------|----------------------|------------------|-----------|
| E1 | **AI Lobotomy** | `enabled: false` en `DEFAULT_CONFIG` → Selene NO ejecuta pipeline cognitivo al arrancar | **Hardcodeado** | CRITICAL |
| E2 | **Confidence Threshold** | `finalOutput.confidence < 0.60` → `decisionsRejected++` | **Hardcodeado** (`0.60`) | MEDIUM |
| E3 | **Pipeline Execution Throttle** | Mínimo `2500ms` entre ejecuciones del pipeline | **Hardcodeado** | HIGH |
| E4 | **Global Effect Cooldown** | `2500ms` base, `12000ms` para latina | **Hardcodeado** | HIGH |
| E5 | **Post-Drop Refractory Lock** | `3000-5000ms` tras heavy arsenal → bloquea candidatos menores | **Hardcodeado** | MEDIUM |
| E6 | **Energy Override (Physics Veto)** | `energy > 0.85` → override directo a physics (bypass parcial del pipeline) | **Hardcodeado** | LOW |

---

## §3. MAPA DE FLUJO Y PUNTOS DE CORTE

```
SeleneTitanConscious.processFrame()
│
├─ E1 [AI Lobotomy] ──¿enabled?──► NO → Pipeline OFF
│
├─ E3 [Pipeline Throttle] ──¿<2500ms?──► SÍ → Skip
│
├─ E4 [Global Cooldown] ──¿en cooldown?──► SÍ → Skip
│
├─ E5 [Post-Drop Refractory] ──¿<3-5s post-heavy?──► SÍ → Skip
│
│
▼
DecisionMaker.makeDecision()
│
├─ D1 [Dictator Lock] ──¿dictador activo?──► SÍ → Suprime DIVINE
│
├─ D2 [DIVINE Threshold] ──¿Z>=4.0?──► SÍ
│   ├─ D3 [Zone Protection] ──¿silence/valley?──► SÍ → DIVINE BLOCKED
│   ├─ D5 [Abs Energy Gate] ──¿energy < 60% max?──► SÍ → DIVINE BLOCKED
│   ├─ D6 [Spectral Gate] ──¿latino sin kick?──► SÍ → DIVINE BLOCKED
│   └─ D4 [Divine Energy] ──¿rawEnergy < 0.72?──► SÍ → DIVINE SUPPRESSED
│
├─ D7 [Valley Protection] ──¿valley/silence + Z<0?──► SÍ → HOLD
├─ D8 [Breakdown] ──¿section=breakdown?──► SÍ → HOLD
│
├─ D9-D11 [Buildup Walls] ──¿buildup + heavy?──► SÍ → BLOCK (3 paths)
│
├─ D12 [Worthiness] ──¿<0.65?──► SÍ → fall through
├─ D13 [Hunt Confidence] ──¿<=0.50?──► SÍ → fall through
├─ D17-D19 [Zone Progression] ──¿veto nuclear/zona?──► SÍ → BLOCK
│
├─ D16 [Fuzzy DNA] ──¿sin DNA?──► SÍ → VOID SCREAM
├─ D14-D15 [Fuzzy Conf] ──¿<0.60/<0.50?──► SÍ → fall through
│
├─ D20-D21 [Drop Prob/Time] ──¿no cumple?──► SÍ → no prepara
├─ D22 [Drop Lock] ──¿ya disparado?──► SÍ → SILENCE
├─ D23-D24 [Anti-Fake-Drop] ──¿heavy + Z bajo?──► SÍ → ABORT
│
└─ D27 [Silence Rule] ──¿sin DNA?──► SÍ → SILENCE
│
▼
DreamEngineIntegrator.executeFullPipeline()
│
├─ A1 [Worthiness Gate] ──¿<0.55?──► SÍ → BLOCK
├─ A2 [Silence Zone] ──¿zone=silence?──► SÍ → BLOCK
├─ A3 [No Candidates] ──¿candidates=0?──► SÍ → BLOCK
├─ A4 [Temporal Seal] ──¿recommendation=modify?──► SÍ → BLOCK
│
▼
VisualConscienceEngine.evaluate()
│
├─ B1 [Circuit Breaker] ──¿OPEN?──► SÍ → FALLBACK REJECTED
├─ B2 [Timeout] ──¿>5000ms?──► SÍ → FALLBACK REJECTED
│
▼
VisualEthicalValues (7 values, 21 rules)
│   ├─ C1.1 epilepsy_protection (critical)
│   ├─ C1.3 fatigue_protection (high)
│   ├─ C1.5 luminosity_budget (high)
│   ├─ C2.1 vibe_effect_match (critical)
│   ├─ C2.2 latino industrial_strobe (high)
│   ├─ C3.3 consecutive_same_effect (high)
│   ├─ C4.3 texture_coherence (high) ← [WAVE 4832 P2 override]
│   └─ ... (ver tabla §2)
│
▼
VisualConscienceEngine.performEvaluation()
│
├─ B3/B4 [Approval Threshold] ──¿score < 0.50/0.70?──► SÍ → REJECTED/DEFERRED
├─ B5 [Blocking Violations] ──¿high/critical violations?──► SÍ → REJECTED
│   *(antes: cualquier violation = REJECTED; WAVE 4832 P3 relajó esto)*
│
▼
DreamEngineIntegrator (post-ethics)
│
├─ A5 [Intensity Gate] ──¿intensity < 0.30?──► SÍ → BLOCK
│
▼
[EFECTO DISPARADO vía EffectManager.trigger() → HephaestusRuntime]
```

---

## §4. DIAGNÓSTICO: ¿ESTRICTA DE MÁS O CORTE EN TUBERÍA?

### 4.1 Cortes Confirmados (ya parcheados en WAVE 4830-4832)

| Corte | Archivo | Síntoma | Parche |
|-------|---------|---------|--------|
| **Z-Zero Tolerance** | `VisualConscienceEngine.ts` | `violations.length === 0` bloqueaba `low`/`medium` | WAVE 4832 P3: solo `high`/`critical` bloquean |
| **Texture Wall** | `VisualEthicalValues.ts` | `texture_coherence` rechazaba todo `dirty` en audio `clean` | WAVE 4832 P2: bypass en drops (`E>0.80 && harsh>0.4`) |
| **Opaque Logging** | `DreamEngineIntegrator.ts` | Log `reason=execute` ocultaba verdict real | WAVE 4832 P1: logging diferencial con verdict/score/violations |
| **Color Buffer Leak** | `HephaestusRuntime.ts` | `_normRgbBuf` compartido → color del último fixture para todos | WAVE 4830: copia per-slot en `writeOutput` |
| **Strobe Blind Path** | `HephaestusAetherAdapter.ts` | `strobe` emitido sin `shutter=1.0` → obturador cerrado | WAVE 4830: emite `shutter: 1.0` + `strobeRate` |

### 4.2 Cortes Activos (sin parche, funcionando como diseñado)

| Corte | ¿Es un bug o feature? | Impacto |
|-------|----------------------|---------|
| **AI Lobotomy (E1)** | `enabled: false` por defecto | **CRÍTICO:** Selene ARRANCA APAGADA. El operador debe activarla manualmente o vía código. |
| **Silence Rule (D27)** | Feature — "DNA or silence" | **ALTO:** Sin `dreamIntegration.approved`, `makeDecision` genera strike pero sin `effectDecision`. Esto es intencional post-WAVE 975. |
| **Buildup Walls (D9-D11)** | Feature — protección narrativa | **ALTO:** Efectos HEAVY bloqueados en `buildup` en 3 paths. Correcto para evitar clímaxes prematuros. |
| **Spectral Gate (D6)** | Feature — anti-Bad-Bunny | **MEDIO:** En latino, requiere `lowBand >= max*0.85`. Durante versos vocales sin bombo, bloquea DIVINE/drop. Esto es intencional pero puede ser demasiado estricto en pistas con compresión agresiva de voz. |
| **Hunt Worthiness 0.65** | Feature — calidad de momento | **MEDIO:** Con `balanced` mood, `raw=0.64` produce `effective=0.557`, que PASA el gate Integrator (`0.55`) pero FALLA el gate DecisionMaker (`0.65`). **Hay un desajuste de 0.10 entre capas.** |

### 4.3 Desajustes Inter-Capa (BUREAUCRACY GAPS)

#### Desajuste #1: Worthiness Gate Asimétrico
- **Integrator** (A1): `effectiveWorthiness >= 0.55` → pasa
- **DecisionMaker** (D12): `worthiness >= 0.65` → pasa
- **Delta:** `0.10` de diferencia.
- **Efecto:** Efectos que superan la Conscience (`VisualConscienceEngine`) y el Integrator (`DreamEngineIntegrator`) pueden ser bloqueados por el General (`DecisionMaker`) en el último momento. Esto genera logs como "DNA aprobado → DecisionMaker dice HOLD".

#### Desajuste #2: DIVINE Energy Gate vs. Absolute Energy Gate
- **DIVINE Energy Gate** (D4): `rawEnergy >= 0.72`
- **Absolute Energy Gate** (D5): `rawEnergy >= maxHistoric × 0.60`
- En una sesión hard-techno donde `maxHistoric ≈ 0.95`:
  - D5 threshold = `0.57`
  - D4 threshold = `0.72`
  - **D4 es más restrictivo que D5.** Un frame con `rawEnergy = 0.65` pasa el candado físico (D5) pero es SUPPRESSED por DIVINE (D4). Esto es intencional (WAVE 2201/2494) pero fácil de confundir.

#### Desajuste #3: Fuzzy Confidence sin DNA = VOID SCREAM
- Fuzzy puede decir `strike` con `confidence=0.75`, pero si `dreamIntegration` está en cooldown o rechazado por Conscience, `hasDNAProposal=false`.
- Resultado: log hermoso `[DecisionMaker 🧠] FUZZY FORCE_STRIKE → strike` seguido de SILENCIO porque `generateStrikeDecision()` no tiene `effectDecision`.
- **Esto no es un bug, es un diseño deliberado post-WAVE 2109**, pero puede confundir en debugging.

---

## §5. RECOMENDACIONES

### R1: Unificar el Worthiness Gate
Ambos gates (Integrator y DecisionMaker) deberían leer del mismo umbral configurable. Sugerencia: exportar `WORTHINESS_THRESHOLD` desde un solo módulo (`SeleneConstants.ts`) y consumirlo en ambos lugares.

### R2: Documentar el AI Lobotomy
`enabled: false` por defecto es peligroso si el operador no sabe que debe activarlo. Añadir un log en boot: `[Selene] 🧠 AI Pipeline DISABLED by default. Call .enable() to activate cognitive layer.`

### R3: Spectral Gate Tuning
El `0.85` del kick threshold para latino puede ser demasiado alto en pistas con sidechain liviano. Considerar un umbral dinámico basado en el `bassPresenceSustained` promedio de la pista, no en `maxHistoric`.

### R4: Post-Drop Refractory Lock
`3000-5000ms` es un rango muy amplio. Considerar hacerlo proporcional a la `fatigueImpact` del efecto disparado.

### R5: Audit Trail Unificado
Cada gate que bloquea un efecto debería emitir un evento estructurado (no solo `console.log`) para que una UI de diagnóstico pueda mostrar "Selene rechazó X porque pasó por A→B→C→BLOQUEO-D".

---

*Documento generado por auditoría forense WAVE 4839.*
*Fuentes: `DreamEngineIntegrator.ts:122-342`, `VisualConscienceEngine.ts:111-428`, `VisualEthicalValues.ts:64-727`, `DecisionMaker.ts:66-1281`, `SeleneTitanConscious.ts:236-420`.*
