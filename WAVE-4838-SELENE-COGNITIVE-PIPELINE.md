# WAVE 4838 — MAPA MENTAL: El Pipeline Cognitivo de Selene

> **Auditoría pura, sin toques de código.**
> **Objetivo:** Entender cómo piensa nuestra diosa lunar antes de intervenir en sus circuitos.

---

## 1. VISIÓN DE CONJUNTO — Los 16 Submotores de Selene

Selene no es "un if". Es una orquesta de 16 submotores que operan en secuencia y en paralelo, cada uno con una responsabilidad única. El flujo se puede leer como una pirámide: muchos sensores abajo, un único veredicto arriba.

```
┌─────────────────────────────────────────────────────────────────────────┐
│  CAPA 4 — EJECUCIÓN FÍSICA (Aether)                                     │
│  NodeArbiter → NodeResolver → DMX Buffer → Hardware                     │
│  (L3 domina L0, Smart Gate, DarkSpin, Airbag, Velocity Clamp)           │
├─────────────────────────────────────────────────────────────────────────┤
│  CAPA 3 — DISPARO Y GATEKEEPING                                         │
│  EffectManager → SeleneAetherAdapter → IntentBus                        │
│  (Cooldowns, Dictator Lock, Diversity Score, Availability)              │
├─────────────────────────────────────────────────────────────────────────┤
│  CAPA 2 — EL GENERAL (DecisionMaker)                                    │
│  makeDecision() — UNICO punto de decisión final                         │
│  Prioridad: DIVINE → DNA → Fuzzy → Hunt → Drop → Buildup → Hold       │
├─────────────────────────────────────────────────────────────────────────┤
│  CAPA 1B — LA CONSCIENCIA ÉTICA (DNA Brain Pipeline)                    │
│  DreamEngineIntegrator: Hunt → Dream → Filter → Decide                  │
│  ├─ EffectDreamSimulator (Cassandra pre-buffer, escenarios, ranking)    │
│  ├─ DNAAnalyzer (Target DNA 3D, distancia euclidiana, diversity)      │
│  └─ VisualConscienceEngine (Ethics, 7 valores, verdict, circuit brk)  │
├─────────────────────────────────────────────────────────────────────────┤
│  CAPA 1A — LOS SENTIDOS Y EL INSTINTO                                   │
│  ├─ Sense: BeautySensor, ConsonanceSensor, MusicalPatternSensor         │
│  ├─ ContextualMemory (Z-scores, EMA, historial energético)            │
│  ├─ HuntEngine (FSM depredador: sleeping→stalking→evaluating→strike)  │
│  ├─ PredictionEngine / Oracle (predictCombined, Cassandra spectral)   │
│  ├─ EnergyConsciousnessEngine (7 zonas energéticas)                   │
│  ├─ DropBridge (alertas de momento divino)                              │
│  └─ FuzzyDecisionMaker (force_strike/strike/prepare/hold + downgrade) │
├─────────────────────────────────────────────────────────────────────────┤
│  CAPA 0 — ENTRADA SENSORIAL (TitanEngine)                              │
│  FFT → FFT bins → Bass/Mid/High/Harshness/Clarity/Centroid/Flatness   │
│  → BPM detection → Section tracker (SimpleSectionTracker)             │
│  → rawEnergy → smoothedEnergy → AGC                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. CADA SUBMOTOR — Qué hace, qué recibe, qué emite

### 2.1 TitanEngine (El Oído Físico)

**Qué hace:** Analiza el audio en tiempo real (44.1kHz → frames de 1024 samples). Extrae features espectrales y rítmicas.

**Qué recibe:** Buffer de audio crudo (Float32Array) del VirtualWire / micrófono.

**Qué emite:** `TitanStabilizedState`
- `rawEnergy`: energía RMS instantánea (0-1)
- `smoothedEnergy`: EMA de energía (α=0.15, más estable)
- `bass`, `mid`, `high`: energía por banda
- `harshness`: medida de ruido/agresividad espectral
- `clarity`: relación señal/ruido espectral
- `spectralCentroid`, `spectralFlatness`: forma del espectro
- `bpm`: tempo detectado (PLL freewheel si baja confianza)
- `sectionType`: etiqueta de sección (`drop`, `verse`, `buildup`, `breakdown`)
- `rhythmicIntensity`: fuerza del patrón rítmico
- `emotionalTension`: tensión armónica derivada

**Frecuencia:** cada frame de audio (~23ms a 44.1kHz), pero procesado en batches por el Worker.

---

### 2.2 Sense (Los Ojos Estéticos)

**Qué hace:** Transforma el estado bruto del Titan en percepciones estéticas.

**Componentes:**
- `senseMusicalPattern()` → `SeleneMusicalPattern` (vibe, bpm, section, energyZScore)
- `senseBeauty()` → `BeautyAnalysis` (totalBeauty, phiAlignment, fibonacciDistribution, chromaticHarmony, contrastBalance, trend)
- `senseConsonance()` → `ConsonanceAnalysis` (totalConsonance, chromaticConsonance, rhythmicConsonance, emotionalConsonance)

**Qué recibe:** `TitanStabilizedState`

**Qué emite:** Los tres análisis estéticos que alimentan a Hunt y DecisionMaker.

---

### 2.3 ContextualMemory (La Memoria a Corto Plazo)

**Qué hace:** Mantiene un historial deslizante de energía (últimos 300 frames ≈ 7s) y calcula estadísticas en tiempo real.

**Qué emite:**
- `energy.zScore`: (E_actual - μ) / σ → cuántas desviaciones estándar por encima/debajo de la media reciente
- `energy.trend`: `rising`, `stable`, `falling`
- `energy.peak`: valor máximo en ventana
- `energy.valley`: valor mínimo en ventana

**Importancia:** El Z-score es el input clave para DIVINE detection y para Valley Protection. Sin esta memoria, Selene no sabría si un pico es "brutal" o solo "normal para esta canción".

---

### 2.4 HuntEngine (El Instinto del Depredador)

**Qué hace:** Máquina de estados finitos (FSM) que simula el comportamiento de un cazador: observa, evalúa, y reporta si la presa (el momento musical) es digna de un efecto.

**Estados:**
```
sleeping → stalking → evaluating → striking → learning → sleeping
```

**Transiciones:**
- `sleeping → stalking`: worthiness > 0.5 (potencial detectado)
- `stalking → evaluating`: min 5 frames observando + worthiness > 0.52 (umbral ×0.8)
- `evaluating → striking`: condiciones óptimas (beauty+consonance+trend+urgency ALL MET)
- `evaluating → stalking`: timeout (15 frames) o condiciones empeorando
- `striking → learning`: 45 frames de "descanso" (WAVE 2106, era 120→15→45)

**Qué emite:** `HuntDecision`
- `worthiness`: 0-1, qué tan digno es este momento
- `confidence`: 0-1, qué tan seguro está Hunt de su evaluación
- `suggestedPhase`: próximo estado recomendado
- `conditions`: detalle de qué condiciones se cumplieron o no

**Filosofía (WAVE 811):** Hunt NO dispara. Hunt solo *huele*. La decisión de disparo es del General (DecisionMaker).

---

### 2.5 PredictionEngine / Oracle (La Bola de Cristal)

**Qué hace:** Predice eventos musicales futuros combinando tres fuentes:

1. **`predict(sectionPattern)`** — Patrón de secciones histórico (secuencias típicas: verse→chorus→buildup→drop)
2. **`predictFromEnergy(currentEnergy)`** — Tendencia de energía bruta + velocidad de cambio
3. **`spectralBuildupScore`** — Análisis físico del espectro (rolloff subiendo, flatness subiendo, subbass bajando = buildup real)

**Salida:** `MusicalPrediction`
- `type`: `drop_incoming`, `energy_spike`, `buildup_starting`, `energy_drop`, `none`
- `probability`: 0-1, confianza de la predicción
- `estimatedTimeMs`: cuánto falta para el evento
- `reasoning`: texto legible del porqué

**Cassandra (WAVE 1190):** Cuando el Oráculo predice un evento con >65% de confianza y >2s de antelación, el DreamSimulator puede **pre-bufferizar** el mejor efecto para usarlo instantáneamente cuando el evento esté a <1.5s.

---

### 2.6 EnergyConsciousnessEngine (El Mapa de Calor)

**Qué hace:** Clasifica la energía actual en una de 7 zonas, independientemente de la sección musical.

**Zonas:** `silence` (E<0.15) → `valley` → `ambient` → `gentle` → `active` → `intense` → `peak` (E>0.95)

**Qué emite:** `EnergyContext`
- `zone`: zona actual
- `absolute`: energía raw (no suavizada)
- `trend`: subiendo/bajando/estable

**Uso:** FuzzyDecisionMaker usa esto para decidir entre STRIKE y HOLD. DecisionMaker usa `zone === 'silence' || zone === 'valley'` para proteger contra disparos en funerales.

---

### 2.7 DropBridge (El Vigía del Cielo)

**Qué hace:** Monitor específico para detectar momentos "divinos" — picos estadísticos extremos que merecen arsenal nuclear obligatorio.

**Qué recibe:** `energyZScore`, `sectionType`, `rawEnergy`, `harshness`

**Qué emite:** `DropBridgeResult`
- `alertLevel`: `none`, `watching`, `ready`, `divine`
- `isDivineMoment`: boolean

**Nota:** DropBridge es un sensor, no un decisor. El umbral real de DIVINE está en DecisionMaker (`Z ≥ 4.0σ + rawEnergy ≥ 0.72`). DropBridge simplemente avisa temprano.

---

### 2.8 FuzzyDecisionMaker (La Intuición Difusa)

**Qué hace:** Evalúa el contexto musical con lógica difusa y emite una acción con confianza.

**Inputs:** energy, zScore, sectionType, harshness, huntScore, beauty, energyContext

**Reglas difusas (ejemplos):**
- "Si energy es HIGH y zScore es POSITIVE y section es DROP → STRIKE"
- "Si energy es MEDIUM y trend es RISING y beauty es HIGH → PREPARE"
- "Si zone es VALLEY y zScore es NEGATIVE → HOLD"

**Outputs:** `FuzzyDecision`
- `action`: `force_strike`, `strike`, `prepare`, `hold`
- `confidence`: 0-1
- `dominantRule`: qué regla ganó (ej: `Notable_Peak`, `Divine_Drop`, `Energy_Silence_Total_Suppress`)

**Downgrade por mood:**
- Si mood=CALM: `strike` puede degradarse a `prepare` o `hold`
- Si mood=PUNK: casi nunca se degrada

**Thresholds internos:**
- `force_strike`: ≥0.70 effectiveScore
- `strike`: ≥0.50 effectiveScore (WAVE 2109)
- `prepare`: ≥0.35 effectiveScore
- `hold`: siempre pasa

**Rol en el pipeline:** Fuzzy NO dispara directamente. Su decisión se pasa al DecisionMaker como un "voto" más. WAVE 2105 le dio "real vote": si Fuzzy dice `strike` con confianza ≥0.50 y hay propuesta DNA cargada, el DecisionMaker puede retornar `strike` por vía fuzzy.

---

### 2.9 DreamEngineIntegrator (El Tejedor)

**Qué hace:** Orquesta el pipeline DNA Brain cuando Hunt (o Fuzzy) dan el visto bueno.

**Flujo interno (4 pasos):**

**STEP 1 — GATE (WORTHINESS)**
- Aplica `moodController.applyThreshold(rawWorthiness)` al worthiness de Hunt
- Umbral efectivo: 0.55 (WAVE 2104.2)
- Si falla → `approved: false` (sin siquiera soñar)

**STEP 2 — DREAM (EffectDreamSimulator)**
- Genera candidatos por vibe + zona + predicción
- Simula escenarios (projected beauty, risk, GPU impact, fatigue, cooldown conflicts, vibe coherence, diversity)
- Calcula `projectedRelevance` via DNAAnalyzer (distancia euclidiana 3D al Target DNA)
- Rankea escenarios
- **Cassandra:** si predicción fuerte + tiempo suficiente, pre-bufferiza el mejor efecto
- Devuelve `EffectDreamResult` con `bestScenario` y `scenarios[]`

**STEP 3 — FILTER (VisualConscienceEngine / Ethics)**
- Evalúa los candidatos contra 7 valores éticos
- Calcula `ethicalScore` (weighted product)
- Emite `EthicalVerdict`: `APPROVED`, `REJECTED`, `DEFERRED`
- Si rechazado, sugiere alternativas

**STEP 4 — DECIDE (Integrator)**
- Aplica `moodController.applyIntensity()` al efecto aprobado
- Gate de intensidad mínima: <0.30 → bloqueado
- Si pasa todo → `IntegrationDecision` con `approved: true`

**Cache:** El Integrator cachea resultados por 5s (TTL). Si la sección cambia, el cache se invalida (WAVE 2106). Si un efecto ya se disparó, el cache se invalida para forzar diversidad (WAVE 2093.2).

---

### 2.10 EffectDreamSimulator (El Soñador)

**Qué hace:** Imagina cómo se vería cada efecto candidato en el estado musical actual.

**Generación de candidatos:**
- Filtra por vibe permitida (`getVibeAllowedEffects`)
- Filtra por zona (efectos suaves en valley, agresivos en peak)
- Filtra por mood blockList (ej: CALM bloquea strobes)
- Filtros específicos por efecto:
  - Strobes/snap: solo si Z > 0 (energía subiendo)
  - Gatling raid: solo si intensidad ≥0.65 y Z ≥0.8
- Calcula intensidad base de cada candidato

**Simulación de escenario (`simulateScenario`):**
- `projectedBeauty`: cuánta belleza aportaría este efecto
- `projectedRelevance`: DNA relevance (distancia euclidiana al Target DNA)
- `riskLevel`: riesgo de conflicto visual
- `gpuLoadImpact`, `audienceFatigueImpact`
- `cooldownConflicts`, `hardwareConflicts`
- `vibeCoherence`: cuánto encaja con la vibe actual
- `diversityScore`: penalización por repetición reciente

**Ranking:** Combina DNA relevance, diversity, vibe coherence, risk inverse. El mejor escenario gana.

**Cassandra pre-buffer (WAVE 1190):**
- Si Oráculo >65% y timeToEvent >2s → almacena el mejor escenario
- Cuando timeToEvent <1.5s y es urgente → usa el pre-buffer directamente (FAST PATH)
- Temporal seal (WAVE 2200.1): si se acaba de pre-bufferizar, la recomendación se degrada a `modify` para no disparar prematuramente

---

### 2.11 DNAAnalyzer (El Genetista Musical)

**Qué hace:** Deriva el "Target DNA" ideal para el momento musical actual y compara cada efecto contra ese target.

**Target DNA (3 ejes):**
- `aggression`: 0-1, qué tan violento debería ser el efecto
- `chaos`: 0-1, qué tan caótico/estroboscópico
- `organicity`: 0-1, qué tan natural/suave

**Derivación:**
- Sección = drop → aggression alto, chaos alto
- Sección = breakdown → aggression bajo, organicity alto
- Harshness espectral alto → chaos alto
- Textura = CLEAN → organicity alto

**Snap conditions:** Respuesta inmediata (sin smoothing) para drops y breakdowns.

**EMA smoothing:** α=0.30 para evitar "Parkinson Digital" — el target no salta de 0 a 1 en un frame.

**Diversity engine:**
- Ventana de 120s (WAVE 2095.3)
- Cada vez que un efecto se usa, su `diversityFactor` baja: 1.0 → 0.8 → 0.5 → 0.2
- Efectos con factor 0.2x prácticamente pierden contra cualquier efecto fresco

**Cálculo de relevancia:**
1. Deriva TargetDNA del contexto musical
2. Lee EffectDNA del registry (ej: `latina_meltdown` = A=0.95, C=0.30, O=0.20)
3. Distancia euclidiana 3D: `√((dA)² + (dC)² + (dO)²)`
4. relevance = 1 - (distance / √3)
5. Aplica penalty de textura y bonus/penalty de mood
6. Multiplica por `diversityFactor`

---

### 2.12 VisualConscienceEngine (El Juez Estético)

**Qué hace:** Evalúa candidatos contra 7 valores éticos y decide si Selene "debería" disparar este efecto.

**7 Valores éticos:**
1. **Audience Safety:** ¿Provocaría epilepsia o molestia?
2. **Visual Harmony:** ¿Rompe la coherencia cromática?
3. **Energy Respect:** ¿Es proporcional a la energía actual?
4. **Diversity:** ¿Es repetitivo?
5. **Mood Compliance:** ¿Respeta el modo CALM/BALANCED/PUNK?
6. **Narrative Coherence:** ¿Tiene sentido en la historia musical?
7. **Technical Feasibility:** ¿La GPU/hardware puede con ello?

**Veredicto:**
- `APPROVED`: todos los valores pasan con score suficiente
- `REJECTED`: algún valor falla críticamente
- `DEFERRED`: podría funcionar, pero hay dudas

**EthicalScore:** producto ponderado de los 7 scores (0-1). Cuanto más alto, más ético es el efecto.

**Circuit Breaker:** Si el sistema detecta demasiados rechazos seguidos, entra en estado OPEN y deja pasar todo (fail-safe). Si todo va bien, CLOSED.

**Maturity evolution:** La consciencia ética "aprende" con el tiempo, subiendo de nivel y desbloqueando features.

---

### 2.13 DecisionMaker (El General)

**Qué hace:** Único punto de decisión final. Combina TODOS los inputs en una jerarquía estricta.

**Jerarquía de prioridades (WAVE 1010):**

```
Prioridad -1: DIVINE STRIKE
  Condición: Z ≥ 4.0σ AND rawEnergy ≥ 0.72 AND zone ∉ {silence, valley}
  Acción: MANDATORY FIRE con arsenal DIVINE rankeado
  Override: NINGUNO (excepto dictador activo)

Prioridad 0: DNA BRAIN (IntegrationDecision)
  Condición: dreamIntegration.approved === true
  Acción: strike con el efecto propuesto por DNA
  Restricción: Si section=buildup Y efecto es HEAVY ARSENAL → demote (esperar climax)

Prioridad 1: FUZZY STRIKE
  Condición: fuzzyDecision.action === 'strike'/'force_strike' 
             AND fuzzyDecision.confidence ≥ 0.50/0.60
             AND hay propuesta DNA cargada (hasDNAProposal)
  Acción: strike
  Restricción: Si section=buildup Y DNA proposal es HEAVY → blocked (Fuzzy Buildup Wall)

Prioridad 2: HUNT STRIKE
  Condición: huntDecision.worthiness ≥ 0.65 AND huntDecision.confidence > 0.50
  Acción: strike
  Restricción: Misma buildup wall que Fuzzy

Prioridad 3: DROP PREDICTED
  Condición: prediction.type === 'drop_incoming' AND probability > 0.65
             OR pattern.section === 'drop'
  Acción: prepare_for_drop → genera efecto del arsenal DIVINE
  Protección: DROP LOCK (un efecto por sección drop)
  Protección: ANTI-FAKE-DROP (Z < 0.5 + heavy arsenal → abort)

Prioridad 4: BUILDUP
  Condición: section === 'buildup' OR prediction.type === 'buildup_starting' (prob>0.7)
  Acción: buildup_enhance (modifica color/physics, SIN efecto)

Prioridad 5: SUBTLE SHIFT
  Condición: beauty.totalBeauty > 0.75 AND beauty.trend === 'rising'
  Acción: subtle_shift (ajuste sutil de color)

Default: HOLD
  Acción: NADA. Silencio.
```

**Outputs:** `ConsciousnessOutput`
- `effectDecision`: qué efecto, intensidad, zonas, razón
- `colorDecision`: estrategia cromática, saturación, brillo
- `physicsModifier`: strobeIntensity, flashIntensity
- `debugInfo`: razonamiento completo

**Drop Lock (WAVE 2187):**
- Variable de módulo `_dropLockSection`
- Cuando se dispara un efecto en section=drop, se bloquea
- Mientras section siga siendo `drop`, no se dispara otro efecto de drop
- Se libera cuando la sección cambia (drop→verse/buildup/etc)

**ANTI-FAKE-DROP (WAVE 2200.2):**
- Solo aplica a HEAVY_ARSENAL_EFFECTS durante drops
- Si Z < 0.5σ → ABORT (energía insuficiente para arsenal nuclear)

---

### 2.14 EffectManager / Gatekeeper (El Portero)

**Qué hace:** Gestiona efectos activos, cooldowns por efecto, y el "dictador" (efecto global en ejecución).

**Cooldowns:**
- Cada efecto tiene su propio cooldown (ej: `salsa_fire` = 15s, `cumbia_moon` = 25s)
- Cooldown HARD: ley absoluta, ni siquiera DNA override puede saltarlo
- Cooldown SOFT: puede ser overriden por ethics score alto (según mood)

**Dictator:**
- Cuando un efecto global se dispara, se marca como "dictador"
- Mientras haya dictador, NO se evalúa DIVINE (para evitar spam)
- El dictador tiene "la palabra" — otros efectos globales se bloquean

**Diversity scoring:**
- `selectFromArsenalWithDiversity()` rankea el arsenal por score de diversidad
- Efectos recientemente usados penalizados
- El ganador es el que mejor balance DNA/diversidad tenga

**GLOBAL_LOCK:**
- Si un efecto dictador está hablando, otros efectos globales se bloquean con mensaje: `"latina_meltdown (dictator) is speaking"`

---

### 2.15 SeleneAetherAdapter (El Traductor)

**Qué hace:** Traduce la decisión final de Selene en `INodeIntent`s que el Aether puede entender.

**Inputs:** `ConsciousnessOutput.effectDecision` + zonas + color + physics

**Outputs:** `INodeIntent[]` para el `IntentBus`
- Canal `dimmer`/`brightness` con valor calculado
- Canales `r`, `g`, `b` con color derivado de la estrategia cromática
- Canales `white`, `amber` si aplica
- `blendMode`: `replace` (LTP) o `max` (HTP) → ahora traducido a `mergeStrategy`
- `layer`: `'effect'` (L3)

---

### 2.16 NodeArbiter (El Juez de Capas)

**Qué hace:** Arbitra las intenciones de todas las capas (L0 sistema, L1 Selene IA, L2 manual, L3 efectos, LP playback).

**Reglas (post-WAVE 4836):**
- L3 (effect/hephaestus) SIEMPRE domina los canales que toca (`_l3DominatedChannels`)
- L0/L1 NO pueden escribir en canales que L3 ya reclamó (Escudo Anti-Sangrado)
- L2 (manual) SIEMPRE gana (operador humano tiene autoridad final)
- LP (playback) bloquea per-canal si está tocando ese canal (Smart Gate WAVE 4752)
- Entre L0 sources: HTP (Highest Takes Precedence)
- Entre capas distintas (L1 vs L3): LTP (Last Takes Precedence) — la capa más alta gana

---

## 3. FLUJO COMPLETO EN `SeleneTitanConscious.think()`

```typescript
async think(state, pattern):
  // 1. SENSORES (ya computados en sense())
  beauty = this.currentBeauty
  consonance = this.currentConsonance
  
  // 2. HUNT
  huntDecision = processHunt(pattern, beauty, consonance, spectralHint)
  
  // 3. ORÁCULO
  prediction = predictCombined(pattern, state.smoothedEnergy, spectralBuildupScore)
  
  // 4. ENERGÍA
  energyContext = energyConsciousness.process(state.rawEnergy, {bass, mid, high})
  log zone transitions (con throttling de 5 frames)
  
  // 5. DROP BRIDGE
  dropBridgeResult = dropBridge.check({zScore, section, rawEnergy, harshness})
  
  // 6. FUZZY
  fuzzyDecision = fuzzyDecisionMaker.evaluate({energy, zScore, section, 
    harshness, huntScore, beauty, energyContext})
  
  // 7. DNA UNLOCK CHECK
  activeDictator = effectManager.hasDictator()
  fuzzyUnlock = fuzzyDecision.action in [strike, force_strike] 
                && fuzzyDecision.confidence >= 0.50
  shouldRunDNA = (huntDecision.worthiness >= 0.65 || fuzzyUnlock) 
                 && !activeDictator
  
  // 8. GLOBAL COOLDOWN GATE
  timeSinceLastEffect = now - lastGlobalEffectTimestamp
  isDropUrgent = prediction.type === 'drop_incoming' 
                 && prediction.estimatedTimeMs < 800 
                 && prediction.probability > 0.80
  if (timeSinceLastEffect < globalCooldownMs && !isDropUrgent):
    // Cooldown activo → reusar cache del último pipeline
    dreamIntegrationData = lastDreamIntegrationResult
  else if (shouldRunDNA):
    // Pipeline throttle (2s)
    if (pipelineReady || isUrgent):
      // EJECUTAR PIPELINE DNA
      dreamIntegrationData = await dreamEngineIntegrator.executeFullPipeline(pipelineContext)
      lastDreamIntegrationResult = dreamIntegrationData
    else:
      dreamIntegrationData = lastDreamIntegrationResult  // cache
  else:
    dreamIntegrationData = null  // Sin propuesta DNA
  
  // 9. SECTION CHANGE → INVALIDAR CACHE
  if (sectionChanged): lastDreamIntegrationResult = null
  
  // 10. DECISION MAKER
  inputs = {pattern, beauty, consonance, huntDecision, prediction, 
    dreamIntegration, energyContext, zScore, spectralContext, 
    activeDictator, fuzzyDecision}
  output = makeDecision(inputs)  // EL GENERAL DECIDE
  
  // 11. ARSENAL / REPOSITORY
  if (output.effectDecision && output.effectDecision.divineArsenal):
    availableWeapon = effectSelector.getAvailableFromArsenal(divineArsenal, vibeId)
    intent = availableWeapon || intent
  
  // 12. DNA COOLDOWN OVERRIDE (ethics gate)
  ethicsScore = dreamIntegration?.ethicalVerdict?.ethicalScore
  ethicsThreshold = moodController.getCurrentProfile().ethicsThreshold
  hasHighEthicsOverride = isDNADecision 
    && ethicsScore >= ethicsThreshold 
    && !oceanicProtection 
    && overrideTemporalReady
  
  // 13. GATEKEEPER (availability)
  hardMinimumCheck = effectSelector.checkAvailability(intent, vibeId)
  if (hardMinimumCheck blocked by HARD_COOLDOWN):
    availability = hardMinimumCheck  // LEY ABSOLUTA
  else if (hasHighEthicsOverride):
    availability = {available: true, reason: 'DNA override'}
  else:
    availability = hardMinimumCheck
  
  // 14. DECISIÓN FINAL
  if (availability.available):
    finalEffectDecision = output.effectDecision
    emit('contextualEffectSelected', {...})
    lastGlobalEffectTimestamp = now
    invalidateDreamCache()  // forzar diversidad
  else:
    // WAVE 2111: FALLTHROUGH ABOLISHED → SILENCE
    output.effectDecision = null
    log gatekeeper blocked (throttled)
  
  // 15. SILENCIO
  if (!finalEffectDecision):
    log silence (throttled a 1 vez cada 5s)
  
  return output
```

---

## 4. SIMULACIÓN A — APROBACIÓN COMPLETA: `cumbia_moon` en verso latino

> **Contexto:** Fiesta-latina, reggaetón tranquilo. MOOD=BALANCED. Energía media-alta, sección=verse, Z positivo moderado.

### Frame T=0 — Los sentidos despiertan

**TitanEngine:**
- `rawEnergy = 0.48`, `smoothedEnergy = 0.52`
- `sectionType = 'verse'`
- `bpm = 90`, `harshness = 0.32`, `clarity = 0.71`
- `spectralCentroid = 1047Hz`, `texture = 'clean'`

**Sense:**
- `pattern.vibeId = 'fiesta-latina'`, `pattern.section = 'verse'`
- `beauty.totalBeauty = 0.64`, `beauty.trend = 'rising'`
- `consonance.totalConsonance = 0.71`

**ContextualMemory:**
- `energy.zScore = +0.6σ` (por encima de la media reciente, pero no extremo)
- `energy.trend = 'stable'`

### Frame T=1 — HuntEngine huele algo

**HuntEngine FSM:**
- Estado actual: `stalking` (llevaba 3 frames)
- `worthiness = 0.68` (beauty 0.64 × energía 0.48 × tendencia estable)
- 3 frames ≥ `minStalkingFrames` (5)? No, espera...

**Frame T=3:**
- 5 frames en stalking. `worthiness = 0.71`.
- Transición: `stalking → evaluating`
- Hunt emite: `suggestedPhase = 'evaluating'`, `worthiness = 0.71`, `confidence = 0.55`

### Frame T=5 — Fuzzy siente que hay algo

**FuzzyDecisionMaker:**
- Inputs: `energy=0.48`, `zScore=+0.6`, `section='verse'`, `harshness=0.32`, `huntScore=0.55`, `beauty=0.64`, `energyContext.zone='active'`
- Reglas activas:
  - `Energy_Medium × Hunt_Score_High × Beauty_Rising → PREPARE`
  - `Zone_Active × Z_Positive → STRIKE` (regla secundaria)
- Defuzzificación:
  - `action = 'strike'` (gana la regla de zona activa)
  - `confidence = 0.62`
  - `dominantRule = 'Notable_Peak'`

**Downgrade por mood (BALANCED, thresholdMultiplier=1.10):**
- `effectiveScore = 0.62 / 1.10 = 0.564`
- Umbral STRIKE = 0.50 → `0.564 ≥ 0.50` → pasa, NO se degrada
- Acción final: `strike`

### Frame T=5 — DNA se desbloquea

**DNA Unlock Check:**
- `huntDecision.worthiness = 0.71` ≥ 0.65 → ✅
- `activeDictator = false` → ✅
- `shouldRunDNA = true`

**Global Cooldown Gate:**
- `lastGlobalEffectTimestamp = T-18s` (último efecto hace 18 segundos)
- `globalCooldownMs = 12000` (fiesta-latina)
- `timeSinceLastEffect = 18000ms` ≥ 12000ms → cooldown EXPIRADO ✅
- `isDropUrgent = false` (no hay drop inminente)
- Pipeline puede ejecutarse

**Pipeline Throttle:**
- `lastPipelineExecutionTimestamp = T-7s`
- `PIPELINE_EXECUTION_THROTTLE_MS = 2000`
- `timeSinceLastPipeline = 7000ms` ≥ 2000ms → ✅ pipeline ready

### Frame T=5 — DreamEngineIntegrator ejecuta el pipeline

**STEP 1 — GATE (Worthiness mood-aware):**
- `rawWorthiness = 0.71`
- `effectiveWorthiness = 0.71 / 1.10 = 0.645`
- Umbral = 0.55 → `0.645 ≥ 0.55` → pasa ✅

**STEP 2 — DREAM (EffectDreamSimulator):**

*Generación de candidatos:*
- Vibe = `fiesta-latina` → efectos permitidos: `cumbia_moon`, `corazon_latino`, `tropical_pulse`, `clave_rhythm`, `glitch_guaguanco`, `salsa_fire`, `latina_meltdown`, etc.
- Zona = `active` → filtra: todos los de fiesta-latina permitidos en active
- Mood blockList (BALANCED): ninguno bloqueado (BALANCED no tiene blockList)
- Strobe Z-guard: Z=+0.6 > 0 → strobes permitidos
- Gatling guard: no aplica (no es gatling)

*Candidatos generados (6):*
1. `cumbia_moon` — intensity=0.48, confidence=0.54
2. `corazon_latino` — intensity=0.48, confidence=0.52
3. `tropical_pulse` — intensity=0.38, confidence=0.51
4. `clave_rhythm` — intensity=0.43, confidence=0.50
5. `glitch_guaguanco` — intensity=0.53, confidence=0.48
6. `salsa_fire` — intensity=0.53, confidence=0.47

*Simulación de escenarios:*

Para cada candidato, el DreamSimulator calcula:
- `projectedBeauty`, `projectedRelevance` (DNA), `riskLevel`, `diversityScore`, `vibeCoherence`

**DNAAnalyzer Target DNA para este contexto:**
- `state.energy = 0.48`, sección = verse, textura = clean, harshness = 0.32
- `targetDNA = {aggression: 0.42, chaos: 0.35, organicity: 0.68, confidence: 0.55}`
- (Verse limpio latino = orgánico, poco caos, agresión media-baja)

**Cálculo de DNA relevance:**

| Efecto | EffectDNA (A,C,O) | Distancia 3D | Relevance base | Diversity (usado hace 45s) | Final relevance |
|--------|---------------------|--------------|----------------|---------------------------|-----------------|
| cumbia_moon | (0.25, 0.20, 0.80) | 0.52 | 0.70 | 0.80× | **0.56** |
| corazon_latino | (0.35, 0.30, 0.75) | 0.41 | 0.76 | 0.50× | **0.38** |
| tropical_pulse | (0.30, 0.45, 0.60) | 0.48 | 0.72 | 1.00× | **0.72** |
| clave_rhythm | (0.40, 0.50, 0.55) | 0.35 | 0.80 | 1.00× | **0.80** |
| glitch_guaguanco | (0.60, 0.90, 0.10) | 1.21 | 0.30 | 0.80× | **0.24** |
| salsa_fire | (0.82, 0.55, 0.60) | 0.58 | 0.66 | 1.00× | **0.66** |

*Ranking combinado (relevance × vibeCoherence × (1-risk)):*
1. `clave_rhythm` — score 0.73
2. `cumbia_moon` — score 0.71
3. `tropical_pulse` — score 0.68
4. `salsa_fire` — score 0.61

*BestScenario = `clave_rhythm`*

**STEP 3 — FILTER (VisualConscienceEngine):**

Evalúa `clave_rhythm` contra 7 valores éticos:

1. Audience Safety: ✅ (sin strobes, intensidad 0.43)
2. Visual Harmony: ✅ (ritmo limpio, coherente con palette actual)
3. Energy Respect: ✅ (intensidad proporcional a E=0.48)
4. Diversity: ⚠️ (nunca usado en esta sesión → perfecto)
5. Mood Compliance: ✅ (BALANCED permite todo excepto blockList vacío)
6. Narrative Coherence: ✅ (clave_rhythm en verse = musicalmente coherente)
7. Technical Feasibility: ✅ (0% GPU extra)

`ethicalScore = 0.89` → `verdict = APPROVED`

**STEP 4 — DECIDE (Integrator):**

- Aplica intensidad mood: `applyIntensity(0.43)` → BALANCED max=1.0 → sin cambio
- Gate de intensidad mínima: `0.43 ≥ 0.30` → pasa ✅
- `IntegrationDecision = {approved: true, effect: clave_rhythm @ 0.43, ethicsScore: 0.89}`

### Frame T=5 — DecisionMaker decide

**Inputs al General:**
- `pattern.section = 'verse'`
- `zScore = +0.6`
- `dreamIntegration.approved = true`, `effect = 'clave_rhythm'`, `ethics = 0.89`
- `fuzzyDecision.action = 'strike'`, `confidence = 0.62`
- `huntDecision.worthiness = 0.71`
- `activeDictator = null`

**Jerarquía de DecisionMaker:**

1. DIVINE? `zScore = 0.6 < 4.0` → NO
2. DNA? `dreamIntegration.approved = true` → ✅ retorna `strike`
3. (No evalúa Fuzzy ni Hunt ni Drop porque DNA ganó en Prioridad 0)

**Output:**
- `decisionType = 'strike'`
- `effectDecision.effectType = 'clave_rhythm'`
- `intensity = 0.43`
- `zones = ['all']` (DNA no especificó zonas)
- `confidence = 0.89`

### Frame T=5 — Gatekeeper y ejecución

**Availability check:**
- `checkAvailability('clave_rhythm', 'fiesta-latina')`
- Hard cooldown: no ha sido usado en esta sesión → disponible ✅
- Soft cooldown: no aplica (nunca usado)

**Ethics override:**
- `ethicsScore = 0.89`, `ethicsThreshold = 1.20` (BALANCED)
- `0.89 < 1.20` → NO califica para override
- No importa, el cooldown ya estaba libre

**Aprobación final:**
- `availability.available = true`
- `finalEffectDecision = {effectType: 'clave_rhythm', intensity: 0.43, ...}`
- `lastGlobalEffectTimestamp = now`
- `invalidateDreamCache()` → forzar diversidad en siguiente pipeline

**SeleneAetherAdapter:**
- Traduce a intents L3:
  - `dimmer = 0.43` en zonas `all`
  - Color derivado de `strategy = 'analogous'` (key=F, emotion=BRIGHT)
  - `mergeStrategy = 'LTP'` (blendMode del efecto)

**NodeArbiter:**
- L3 escribe `dimmer=0.43` y canales de color
- Registra canales en `_l3DominatedChannels`
- L0/L1 silenciados en esos canales → CumbiaMoon se ve pura

**Log final:**
```
[INTEGRATOR] ✅ APPROVED: clave_rhythm @ 0.43 | ethics=0.890 | Dream: 2ms | Total: 3ms
[SeleneTitanConscious] 🧠 DECISION MAKER APPROVED: clave_rhythm | confidence=0.89 | 🧬 DNA: execute | Ethics: 0.89
[EffectManager 🔥] clave_rhythm FIRED [hunt_strike] in fiesta-latina | I:0.43 Z:0.6
```

---

## 5. SIMULACIÓN B — DENEGACIÓN EN CADENA: `latina_meltdown` abortado en buildup

> **Contexto:** Techno-club, MOOD=BALANCED. Acaba de terminar un drop. Energía cayendo. Sección=buildup. Z bajo negativo.

### Frame T=0 — Los sentidos reportan bajada

**TitanEngine:**
- `rawEnergy = 0.44`, `smoothedEnergy = 0.48` (bajando desde 0.82 del drop)
- `sectionType = 'buildup'`
- `bpm = 125`, `harshness = 0.58`, `clarity = 0.62`
- `spectralCentroid = 1366Hz`

**Sense:**
- `pattern.vibeId = 'techno-club'`, `pattern.section = 'buildup'`
- `beauty.totalBeauty = 0.51`, `beauty.trend = 'falling'`
- `consonance.totalConsonance = 0.63`

**ContextualMemory:**
- `energy.zScore = -0.8σ` (energía por debajo de la media reciente)
- `energy.trend = 'falling'`

### Frame T=1 — HuntEngine duda

**HuntEngine FSM:**
- Estado: `stalking` (despertó después del learning del drop anterior)
- `worthiness = 0.58`
- 5 frames en stalking → transición a `evaluating`
- Hunt emite: `worthiness = 0.58`, `confidence = 0.48`

### Frame T=1 — Fuzzy dice HOLD

**FuzzyDecisionMaker:**
- Inputs: `energy=0.44`, `zScore=-0.8`, `section='buildup'`, `harshness=0.58`, `huntScore=0.48`, `beauty=0.51`, `energyContext.zone='gentle'`
- Reglas activas:
  - `Energy_Medium_Low × Z_Negative × Section_Buildup → HOLD`
  - `Zone_Gentle × Trend_Falling → HOLD`
- Defuzzificación:
  - `action = 'prepare'` (regla interna sugiere preparar para futuro)
  - `confidence = 0.42`

**Downgrade por mood (BALANCED, thresholdMultiplier=1.10):**
- `effectiveScore = 0.42 / 1.10 = 0.382`
- Umbral PREPARE = 0.35 → `0.382 ≥ 0.35` → pasa por PREPARE
- Umbral STRIKE = 0.50 → `0.382 < 0.50` → NO llega a strike
- Acción final: `prepare` (sin downgrade extra)

**FuzzyUnlock check:**
- `fuzzyDecision.action = 'prepare'` ≠ `'strike'` → `fuzzyUnlock = false`

### Frame T=1 — DNA NO se desbloquea (primer bloqueo)

**DNA Unlock Check:**
- `huntDecision.worthiness = 0.58` < 0.65 → ❌
- `fuzzyUnlock = false` → ❌
- `shouldRunDNA = false`

**Resultado:** El pipeline DNA NO corre. `dreamIntegrationData = null` (o cache previo si existe).

### Frame T=2 — DecisionMaker evalúa sin DNA

**Inputs al General:**
- `dreamIntegration = null` (no hay propuesta DNA)
- `fuzzyDecision.action = 'prepare'`, `confidence = 0.42`
- `huntDecision.worthiness = 0.58`
- `section = 'buildup'`
- `zScore = -0.8`

**Jerarquía de DecisionMaker:**

1. DIVINE? `zScore = -0.8 < 4.0` → NO
2. DNA? `dreamIntegration = null` → NO
3. Fuzzy STRIKE? `action = 'prepare'` ≠ `'strike'` → NO
4. Hunt STRIKE? `worthiness = 0.58 < 0.65` → NO
5. Drop predicho? `prediction.type = 'buildup_starting'`, `probability = 0.52` < 0.65 → NO
6. Section = buildup? `section === 'buildup'` → ✅ retorna `buildup_enhance`

**Output:**
- `decisionType = 'buildup_enhance'`
- `effectDecision = null` (buildup_enhance NO propone efecto, solo modifica color/physics)
- `colorDecision = {saturationMod: 1.04, brightnessMod: 1.02}`
- `physicsModifier = {strobeIntensity: 0.32, flashIntensity: 0.35}`

### Frame T=2 — Sin efecto, solo atmósfera

**Gatekeeper:** No hay `effectDecision` → nada que validar.

**Resultado:** Selene NO dispara efecto. Solo ajusta sutilmente color y física reactiva.

**Log:**
```
[SeleneTitanConscious] 🧘 SILENCE (throttled) | vibe=techno-club | E=0.44 | Z=-0.80σ
```

---

### Frame T=5 — Pero espera... ¿y si DNA SÍ hubiera corrido?

Vamos a simular el **contrafactual**: supón que Hunt tuvo `worthiness = 0.71` (pasó el umbral) y Fuzzy dijo `strike`. DNA corre y propone `latina_meltdown`. ¿Qué pasaría?

**Escenario alternativo — DNA propone heavy arsenal en buildup:**

**DreamSimulator:**
- Candidatos en buildup techno: `acid_sweep`, `liquid_pulse`, `cyber_dualism`, `neon_blinder`, etc.
- `latina_meltdown` NO está en arsenal techno-club → DreamSimulator NUNCA lo generaría para techno

**Escenario más realista — DNA propone `core_meltdown` en buildup:**

**Integrator STEP 3 — FILTER (Ethics):**
- `core_meltdown` es HEAVY ARSENAL (`aggression = 1.00`)
- VisualConscienceEngine evalúa Narrative Coherence:
  - "¿Disparar la bestia nuclear en un buildup?"
  - Sección = buildup → `narrativeScore = 0.15` (muy bajo)
- `ethicalScore = 0.42` → `verdict = REJECTED`
- Motivo: "Narrative violation: HEAVY ARSENAL in buildup phase"

**Integrator STEP 4:**
- `IntegrationDecision = {approved: false, effect: null, ...}`

**DecisionMaker (con DNA rechazado):**
- `dreamIntegration.approved = false`
- Sigue flujo normal: Fuzzy? Hunt? Drop? Buildup?
- Termina en `buildup_enhance` → silencio

**Log:**
```
[INTEGRATOR] 📊 Pipeline: ❌ REJECTED | Dream: 4ms | Filter: 2ms | Total: 8ms | reason=Narrative violation: HEAVY ARSENAL in buildup
[SeleneTitanConscious] 🧘 SILENCE (throttled) | vibe=techno-club | E=0.44 | Z=-0.80σ
```

---

### Escenario alternativo #2 — DNA aprueba, pero DecisionMaker bloquea

Supón que Ethics aprueba un efecto de buildup (`acid_sweep`) pero el DecisionMaker tiene guards:

**DecisionMaker:**
- `dreamIntegration.approved = true`, `effect = 'acid_sweep'`
- Pero `section === 'buildup'` → ¿es `acid_sweep` HEAVY ARSENAL?
- `HEAVY_ARSENAL_EFFECTS.has('acid_sweep')` → NO (`aggression = 0.45`)
- BUILDUP RESTRICTION no aplica (solo heavy arsenal)
- DecisionMaker retorna `strike` ✅

**Gatekeeper:**
- `checkAvailability('acid_sweep', 'techno-club')`
- Hard cooldown: usado hace 8 segundos, cooldown = 22s → `HARD_COOLDOWN` activo ❌
- `availability.available = false`
- WAVE 2111: FALLTHROUGH ABOLISHED → NO sustituto. Silencio.

**Log:**
```
[SeleneTitanConscious] 🚪 GATEKEEPER BLOCKED: acid_sweep | HARD_COOLDOWN (14s remaining)
[SeleneTitanConscious] 🧘 SILENCE (throttled) | vibe=techno-club | E=0.44 | Z=-0.80σ
```

---

## 6. MAPA DE DECISIÓN VISUAL — Árbol de posibilidades

```
                    ┌─────────────────────┐
                    │   Audio FFT Frame   │
                    └─────────┬───────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
        ┌─────────┐     ┌──────────┐    ┌──────────┐
        │  Hunt   │     │  Oracle  │    │  Fuzzy   │
        │ Engine  │     │ predict  │    │ Decision │
        │(worthiness)│   │(drop in?)│   │(strike?) │
        └────┬────┘     └────┬─────┘    └────┬─────┘
             │               │               │
             │     ┌─────────┴──────────┐    │
             │     ▼                    ▼    │
             │  ┌──────────┐        ┌───────┴──────┐
             │  │ Cassandra│        │ EnergyConscious│
             │  │ pre-buffer│       │ (zone, trend)  │
             │  └────┬─────┘        └───────┬──────┘
             │       │                      │
             └───────┼──────────────────────┘
                     │
                     ▼
            ┌─────────────────┐
            │  DNA UNLOCK?    │──── NO ────► makeDecision()
            │ (worth≥0.65     │            │ (sin propuesta)
            │  OR fuzzyStrike) │            │ → Hunt/Fuzzy/Drop/Hold
            └────────┬────────┘            │
                     │ YES                 │
                     ▼                     │
            ┌─────────────────┐           │
            │ Global Cooldown?  │── YES ──►│ reuse cache
            │ (7s/12s expired?) │           │
            └────────┬────────┘           │
                     │ NO                  │
                     ▼                     │
         ┌───────────────────────┐         │
         │ DreamEngineIntegrator │         │
         │ ├─ DreamSimulator   │         │
         │ ├─ DNAAnalyzer      │         │
         │ └─ Ethics/Conscience │         │
         └──────────┬──────────┘         │
                    │                     │
                    ▼                     │
         ┌───────────────────┐          │
         │ IntegrationDecision │──────────┘
         │ approved? effect?   │── NO ───► Silence
         └──────────┬──────────┘
                    │ YES
                    ▼
         ┌───────────────────┐
         │   DecisionMaker   │
         │  (El General)     │
         │  Priority Stack   │
         └──────────┬──────────┘
                    │
                    ▼
         ┌───────────────────┐
         │   Gatekeeper      │
         │  (availability)   │
         └──────────┬──────────┘
                    │
         ┌──────────┴──────────┐
         ▼                     ▼
    ┌──────────┐         ┌──────────┐
    │  FIRED   │         │ BLOCKED  │
    │ (effect) │         │ (silence)│
    └────┬─────┘         └────┬─────┘
         │                    │
         ▼                    ▼
    ┌──────────┐         ┌──────────┐
    │ Aether   │         │ Physics  │
    │ Adapter  │         │ Reactive │
    │ L3 Intents│        │ (breathe)│
    └──────────┘         └──────────┘
```

---

## 7. DIAGNÓSTICO DE PUNTOS DE FRAGILIDAD

Basado en el mapeo completo, identifico 5 puntos donde el pipeline puede "romperse" o comportarse de forma no intuitiva:

### Fragilidad 1 — DNA Unlock es el cuello de botella

Si Hunt no llega a `worthiness ≥ 0.65` **Y** Fuzzy no dice `strike`, el pipeline DNA **nunca corre**. Selene depende de que al menos uno de estos dos sensores "despierte". En música plana (dembow constante), Hunt puede quedarse en `stalking` indefinidamente y Fuzzy puede quedarse en `hold`/`prepare`, lo que explica por qué en reggaetón los efectos solo aparecen cuando hay un pico real o una detección de drop.

### Fragilidad 2 — Global Cooldown gatea TODO

El `GLOBAL_EFFECT_COOLDOWN_MS` (7s/12s) está **ANTES** del pipeline DNA. Si un efecto se disparó hace 6 segundos, Hunt puede detectar 20 momentos dignos en ese intervalo, pero el pipeline DNA ni siquiera se ejecuta — reusar cache del último efecto. Esto explica el "efecto fantasma" que a veces se siente: el último efecto cacheado sigue "viviendo" en la memoria de Selene aunque musicalmente ya pasó.

### Fragilidad 3 — El cache de Dream es agresivo

El cache del Integrator usa una key que incluye `vibe:energy:worthiness:gpu:epilepsy:recentEffectsHash`. Si nada de eso cambia (misma vibe, misma energía aproximada, mismo worthiness, mismos efectos recientes), Selene reusará el **mismo** efecto durante 5 segundos. En reggaetón donde la energía es estable, esto puede causar monotonía.

### Fragilidad 4 — DecisionMaker no ve la "calidad" del efecto, solo la prioridad

Si DNA aprueba un efecto con `ethicalScore = 0.85` y otro frame posterior DNA aprueba el mismo efecto con `ethicalScore = 1.20`, DecisionMaker los trata **idénticamente** (ambos pasan Prioridad 0). No hay mecanismo para "esperar al efecto ÉPICO" en lugar de disparar el "efecto decente" ahora. El override de ethics (WAVE 2093.2) intenta mitigar esto, pero solo aplica a efectos con ethics > threshold (1.20 en BALANCED), que es raro.

### Fragilidad 5 — Fuzzy y Hunt pueden contradecirse sin resolución elegante

Si Hunt dice `worthiness = 0.71` (strike) pero Fuzzy dice `hold` (Z negativo, energía cayendo), DecisionMaker ignora a Fuzzy porque Hunt tiene su propia prioridad (Prioridad 2 vs Fuzzy Prioridad 1). Pero si Fuzzy dice `strike` y Hunt dice `worthiness = 0.58`, Fuzzy puede "rescatar" el disparo si hay DNA proposal cargada. Esto crea una lógica asimétrica: Fuzzy puede salvar un Hunt débil, pero Hunt no puede ignorar un Fuzzy pesimista.

---

## 8. SELLO

**Pipeline mapeado:** 16 submotores identificados y trazados.

**Flujo principal confirmado:**
1. TitanEngine → Sense → ContextualMemory
2. HuntEngine + PredictionEngine + Fuzzy (paralelo)
3. EnergyConsciousness + DropBridge (paralelo)
4. DNA Unlock (Hunt ≥0.65 OR Fuzzy strike)
5. Global Cooldown gate
6. DreamEngineIntegrator (4 steps: Gate → Dream → Filter → Decide)
7. DecisionMaker (jerarquía -1 a 5)
8. Gatekeeper (availability + ethics override)
9. SeleneAetherAdapter → NodeArbiter → Hardware

**Simulaciones:**
- **A (APROBACIÓN):** `clave_rhythm` en verse latino. Flujo completo: Hunt 0.71 → Fuzzy strike → DNA unlock → DreamSimulator genera 6 candidatos → DNAAnalyzer rankea → Ethics aprueba 0.89 → DecisionMaker strike → Gatekeeper libre → **FIRED**.
- **B (DENEGACIÓN):** `core_meltdown` en buildup techno. Flujo: Hunt 0.58 → Fuzzy prepare → DNA NO unlock → DecisionMaker buildup_enhance → sin efecto. Contrafactual: si DNA corre y propone heavy arsenal, Ethics lo rechaza por narrative violation. Contrafactual #2: si Ethics aprueba efecto buildup pero está en HARD_COOLDOWN, Gatekeeper bloquea y WAVE 2111 impide fallback → **SILENCE**.

**Próximo paso sugerido:** Tras este mapa, cualquier intervención en el pipeline (como las 6 propuestas de WAVE 4837) puede evaluarse con precisión: ¿en qué capa tocamos?, ¿qué submotores se ven afectados?, ¿qué logs cambiarían? El mapa actúa como "google maps" del cerebro de Selene.
