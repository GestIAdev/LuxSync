# MAPEO-SELENE-COGNITION.md
## Auditoría Completa del Sistema Cognitivo Selene

> **Fecha:** 2025-01-25  
> **Alcance:** Mapa exhaustivo de la tubería de decisión de Selene Titan Conscious, desde la percepción sensorial hasta la emisión de `ConsciousnessOutput`, incluyendo todos los mecanismos de veto, override y protección.

---

## 1. Arquitectura General

```
TitanStabilizedState
       │
       ▼
┌──────────────────┐
│ 0. CASSANDRA     │ ← Reloj Soberano + Glass Break (bypass total)
│ SOVEREIGN CLOCK  │
└──────────────────┘
       │
       ▼
┌──────────────────┐
│ 1. ENERGY        │ ← Si smoothedEnergy > 0.75 → VETO TOTAL
│ OVERRIDE CHECK   │    (física reactiva manda, sin modulaciones)
└──────────────────┘
       │ (valley mode)
       ▼
┌──────────────────┐
│ 2. SENSE         │ ← MusicalPatternSensor + BeautySensor + ConsonanceSensor
│                  │    + ContextualMemory (Z-Scores, 30s buffer)
│                  │    + FFT X-Ray Sniffer (180 frames)
│                  │    + SpectralBuildupScore (Cassandra)
└──────────────────┘
       │
       ▼
┌──────────────────┐
│ 3. THINK         │ ← HuntEngine + PredictionEngine + DropBridge
│                  │    + FuzzyDecisionMaker + DreamEngineIntegrator
│                  │    + DecisionMaker (EL ÚNICO GENERAL)
└──────────────────┘
       │
       ▼
┌──────────────────┐
│ 3.5 GATEKEEPER   │ ← ArsenalRepository + Cooldowns + Refractory Lock
│                  │    + DNA Cooldown Override (mood-aware)
└──────────────────┘
       │
       ▼
┌──────────────────┐
│ 4. DREAM         │ ← BiasDetector (pass-through, ScenarioSimulator frozen)
└──────────────────┘
       │
       ▼
┌──────────────────┐
│ 5. VALIDATE      │ ← ConstitutionGuard (hue/saturation/strategy)
└──────────────────┘
       │
       ▼
ConsciousnessOutput
```

**Archivo núcleo:** `electron-app/src/core/intelligence/SeleneTitanConscious.ts` (2046 líneas)

---

## 2. Tubería Detallada del Método `process()`

### 2.0 Cassandra Sovereign Clock + Glass Break (WAVE 5011/5016)

**Prioridad:** Absoluta — se ejecuta ANTES que todo, incluyendo EnergyOverride.

**Flujo:**
1. Consulta `dreamEngineIntegrator.getPreBufferStatus()` para ver si hay un efecto pre-bufferizado por el Oráculo.
2. **Sovereign Window:** Si `timeToEvent <= 0` y `>= -500ms`, dispara el efecto inmediatamente, bypassando HuntEngine, Fuzzy y EnergyOverride.
3. **Glass Break Sensor:** Si `timeToEvent > 0` pero el Z-Score actual es anómalo (`>= 2.5σ` con valle respirado, `>= 3.5σ` sin valle) Y `rawEnergy > 0.55`, rompe la cuenta regresiva y dispara AHORA (el DJ adelantó el drop).
4. **Divine Leak Fix B (WAVE 5020):** Re-evalúa Z-Score antes de disparar un efecto divino pre-bufferizado. Si el Z actual no cumple el threshold del vibe (techno: 2.5, latino: 2.0, estándar: 3.5), aborta.
5. **Silent Clear:** Si la ventana expiró hace más de 500ms, limpia el buffer silenciosamente.

**Valle Breath (WAVE 6040):** `minEnergySinceLastEffect <= 0.45` indica que hubo un valle real desde el último disparo. Sin valle, el Z-threshold de Glass Break se endurece (2.5 → 3.5) para evitar falsos drops en autotune sostenido.

### 2.1 EnergyOverride (WAVE 500)

**Archivo:** `electron-app/src/core/intelligence/validate/EnergyOverride.ts`

**Condición:** `state.smoothedEnergy > ENERGY_OVERRIDE_THRESHOLD` (0.75, bajado de 0.85 en WAVE 4829 para capturar drops latinos).

**Efecto:** Devuelve un `ConsciousnessOutput` fijo con:
- `strobeIntensity: 1.0`, `flashIntensity: 1.0`
- `colorDecision: null`, `movementDecision: null`, `effectDecision: null`
- La física reactiva toma el control total. Selene "no piensa" durante el clímax.

**Predicción:** `predictEnergyOverride()` calcula probabilidad de activación basándose en cercanía al umbral, sección musical y `isDropActive` del FSM.

### 2.2 SENSE: Percepción Sensorial

**Sensores:**
- **MusicalPatternSensor** (`sense/MusicalPatternSensor.ts`): Detecta sección, BPM, energía rítmica, presencia de bajo/media.
- **BeautySensor** (`sense/BeautySensor.ts`): Calcula belleza total (alineación phi, Fibonacci, armonía cromática, contraste).
- **ConsonanceSensor** (`sense/ConsonanceSensor.ts`): Consonancia cromática, rítmica y emocional.
- **ContextualMemory** (`memory/`): Buffer de 1800 frames (~30s @ 60fps). Calcula Z-Scores de energía. Thresholds: notable=1.5σ, significant=2.0σ, epic=2.5σ.
- **FFT X-Ray Sniffer (WAVE 4863):** Buffer rodante de 180 frames (~3s) con media por bandas (LOW/MID/HIGH/TOTAL). Log cada 3s para diagnóstico de valles.
- **SpectralBuildupScore (WAVE 1190):** Detecta buildups espectrales (rising centroid + rising flatness + falling bass) en historial de 10 muestras.

**Enriquecimiento del patrón:**
- `energyZScore` desde ContextualMemory
- `bassPresenceSustained` — promedio de últimos 30 frames del buffer LOW (WAVE 4867, inercia contra plosivas)

**Derivación de textura espectral (WAVE 1026 Rosetta Stone):**
- `harshness > 0.6 && clarity > 0.7` → `'harsh'` (poder controlado)
- `harshness > 0.6 && clarity < 0.4` → `'noisy'` (caos)
- `spectralCentroid < 300` → `'warm'` (oscuro/profundo)
- Default → `'clean'`

### 2.3 THINK: Cognición

#### 2.3.1 HuntEngine — El Depredador

**Archivo:** `electron-app/src/core/intelligence/think/HuntEngine.ts`

**Función:** `processHunt(pattern, beauty, consonance, spectralHint)` → `HuntDecision`

**Worthiness Scoring (`calculateWorthiness`):**
Combina métricas: belleza, consonancia, tensión, ritmo, energía. Bonificaciones por sección (`drop`, `buildup`).

**Spectral-Aware Worthiness (WAVE 1026):**
- "Controlled power" (high harshness + high clarity) → boost
- "Clean & beautiful" (high clarity, low harshness) → boost
- "Chaos" (high harshness + low clarity) → penalización

**VIBE_STRIKE_MATRIX (WAVE 625):** Matriz de pesos y thresholds por género:
- `fiesta-latina`, `techno-club`, `pop-rock`, `chill-lounge`, `idle`
- Cada vibe pondera diferente: belleza, consonancia, tensión, ritmo, energía
- `evaluateStrikeConditions` calcula un `strikeScore` ponderado contra threshold vibe-specific

#### 2.3.2 PredictionEngine — El Oráculo (Cassandra)

**Archivo:** `electron-app/src/core/intelligence/think/PredictionEngine.ts`

**Función:** `predictCombined(pattern, smoothedEnergy, spectralBuildupScore)` → `MusicalPrediction`

Predice eventos: `drop_incoming`, `energy_spike`, `transition_beat`, `none`. Proporciona `probability`, `estimatedTimeMs`, `suggestedActions`.

#### 2.3.3 DropBridge — El Puente del Trueno

**Archivo:** `electron-app/src/core/intelligence/think/DropBridge.ts`

**Condición Divina:**
```
(energyZScore >= zScoreThreshold) AND (section ∈ {drop, chorus}) AND (rawEnergy >= minEnergy)
```

**Thresholds por vibe (WAVE 4860):**
- **Estándar:** Z ≥ 3.0σ, E ≥ 0.60
- **Latino:** Z ≥ 3.5σ, E ≥ 0.70 (dembow infla Z-scores)
- **Techno:** Z ≥ 2.2σ, E ≥ 0.55 (techno maxes at ~2.6σ)

**Intensidad:** Base 0.85 + zExcess * 0.15, bonus +0.05 por kick, +0.03 por harshness > 0.7. Máximo 1.0.

**Wrapper con estado:** Cooldown de 2000ms entre activaciones. Tracking de `consecutiveHighZScores` (alerta alta tras 3 frames consecutivos sobre `imminentThreshold`).

**Niveles de alerta:** `none` → `watching` → `imminent` → `activated`

#### 2.3.4 FuzzyDecisionMaker — Lógica Difusa

**Archivo:** `electron-app/src/core/intelligence/think/FuzzyDecisionMaker.ts`

**Entradas:** energy, zScore, sectionType, harshness, huntScore, beauty, energyContext (zona), minEnergySinceLastEffect (valley tracker).

**Reglas difusas (WAVE 2105/6040/2108-2110):**
- `Hunt_Buildup_Strike` — Hunt detecta worthy en buildup
- `Notable_Energy_Strike` — Z-Score notable + energía activa
- `Pure_Energy_Strike` — Z-Score épico + sección peak
- `Energy_Building_Strike` — Energía subiendo + worthy
- `Normal_State` — Mantener hold
- `Energy_Silence_Total_Suppress` — Zona silence/valley → supresión total

**Defuzzificación (WAVE 2107-2109):**
- Prioridad: `forceStrike > strike > prepare > hold`
- Thresholds recalibrados para cada acción
- Calcula `intensity` y `confidence` basados en la fuerza y claridad de la decisión

**Mood Integration (WAVE 700.1/1176):**
- `applyMoodModifiers` ajusta el score efectivo y la intensidad
- Si el score efectivo no cumple el threshold mood-adjusted, el acción se degrada
- BALANCED: cooldownMultiplier 2.2 (objetivo 3-4 EPM en latino)
- PUNK: más agresivo, CALM: más conservador

#### 2.3.5 DreamEngineIntegrator — DNA Brain

**Archivo:** `electron-app/src/core/intelligence/integration/DreamEngineIntegrator.ts`

**Tubería:** Hunt → Dream (EffectDreamSimulator) → Decide → Filter (VisualConscienceEngine) → Execute

**Gates en `executeFullPipeline`:**

1. **Mood-Aware Threshold (WAVE 920):** Ajusta `worthiness` según mood. Más selectivo en CALM, menos en PUNK.

2. **Worthiness Gate (WAVE 973.2/976.5/2100/2104.2/5008):** Filtra candidatos si `effectiveWorthiness < threshold`, a menos que haya predicción activa del Oracle.

3. **Zone Gate Reform (WAVE 2103):** Bloquea solo si `energyZone === 'silence'` (E < 0.15). Valley y ambient pasan (normales en techno).

4. **Temporal Seal Gate (WAVE 4913/5009):** Si Cassandra recomienda `'modify'` y no es FAST PATH, short-circuit. Evita disparo prematuro.

5. **Cassandra Pre-Buffer Guard (WAVE 5011):** Bloquea aprobaciones normales si hay efecto pre-bufferizado no expirado.

6. **Ethical Filtering:** `VisualConscienceEngine` evalúa con `AudienceSafetyContext` → `EthicalVerdict` con `ethicalScore`.

7. **Mood-Adjusted Intensity:** Modifica intensidad del efecto aprobado según mood.

8. **Minimum Intensity Gate (WAVE 2102):** Rechaza efectos con intensidad < 0.30.

9. **Divine Leak Fix Sniper Route (WAVE 5020):** Bloquea efectos divinos si Z-Score no cumple threshold, como salvaguarda adicional al DecisionMaker.

**Cassandra Pre-Buffer (WAVE 1190):**
- `EffectDreamSimulator.dreamEffects()` almacena el mejor escenario si `oracleProbability >= min` y `timeToEvent >= 2000ms`
- **Temporal Seal (WAVE 2200.1):** Si se acaba de almacenar un pre-buffer, la recomendación se degrada a `'modify'` para evitar disparo prematuro
- **FAST PATH:** Cuando `timeToEvent < 1500ms`, usa el efecto pre-bufferizado directamente

**Output:** `IntegrationDecision` con `approved`, `effect`, `ethicalVerdict`, `dreamRecommendation`, timing.

#### 2.3.6 DecisionMaker — El Único General

**Archivo:** `electron-app/src/core/intelligence/think/DecisionMaker.ts`

**Input:** `DecisionInputs` — pattern, beauty, consonance, huntDecision, prediction, dreamIntegration, energyContext, zScore, spectralContext, activeDictator, fuzzyDecision, energyMaxHistoric.

**Jerarquía de decisiones en `determineDecisionType`:**

1. **DIVINE MOMENT (WAVE 1010):** Z > 3.5σ → mandatory strike. Selecciona del divine arsenal filtrado por vibe, con diversity-aware selection (WAVE 2183/2494).

2. **VALLEY PROTECTION (WAVE 1178):** Z < 0 en zona valley con energía decreciente → bloqueo total.

3. **BREAKDOWN PROTECTION (WAVE 2106):** Sección `breakdown` → bloqueo excepto Divine Strikes.

4. **DNA BRAIN (WAVE 972.2):** Si `dreamIntegration.approved` → usa el efecto del DNA. **Silence Rule (WAVE 975):** Si DNA no propone, silencio — confía en físicas reactivas.

5. **BUILDUP RESTRICTION (WAVE 2200.3/4843):** Bloquea arsenal pesado en buildups via `isEffectAllowedInSection` del DynamicEffectRegistry.

6. **DIVINE LEAK FIX (WAVE 5020):** Re-verifica Z-Score antes de aprobar efecto divino del DNA.

7. **FUZZY BUILDUP WALL (WAVE 2203):** Bloquea arsenal pesado cuando Fuzzy dice strike en buildup.

8. **FUZZY STRIKE (WAVE 2105-2109):** Si Fuzzy aprueba `strike` con confianza suficiente → strike.

9. **HUNT STRIKE:** HuntEngine detecta worthy (≥ 0.70) con confianza alta → strike.

10. **DROP PREPARATION:** Predicción de drop inminente o sección `drop`:
    - **Absolute Energy Gate (WAVE 4861):** E < 48% del máximo del buffer 30s → bloquear
    - **Spectral Gate (WAVE 4864):** Para latino: requiere heavy kick (lowBand ≥ 75% del max) Y que vocales no eclipsen al beat (lowBand ≥ midBand * 0.95)
    - **Anti-Fake-Drop (WAVE 2200.2/4860/5000):** Z-Score sanity check. Latino: Z ≥ 1.1σ. Techno: Z ≥ 0.2σ (o -1.0 si bass > 0.65). Si DNA aprobó en PUNK/BALANCED: -0.2σ.
    - **Drop Lock (WAVE 5003):** Un solo efecto por sección drop. `acquireDropLock()` bloquea repeticiones.

11. **BUILDUP ENHANCE:** Sección buildup → modulaciones sutiles de color/física.

12. **SUBTLE SHIFT:** Belleza alta con tendencia ascendente → ajuste mínimo.

13. **HOLD:** Default. Silencio. Físicas reactivas.

**Diversity-Aware Arsenal Selection (WAVE 2183):**
`selectFromArsenalWithDiversity` y `rankArsenalByDiversity` priorizan efectos no usados recientemente para evitar monotonía.

### 2.4 Gatekeeper (en SeleneTitanConscious.ts)

Después de que DecisionMaker produce `output.effectDecision`, el Gatekeeper aplica:

1. **Divine Arsenal Resolution:** Si hay `divineArsenal`, busca arma disponible en `ArsenalRepository`. Si todo está en cooldown → silencio forzado.

2. **DNA Cooldown Override (WAVE 973.3/2093.2):** Si DNA aprobó con `ethicalScore >= ethicsThreshold` (mood-aware) Y `allowEthicsOverride` está activo (PUNK sí, BALANCED no) Y restricciones temporales:
   - Mínimo 12s entre cualquier override
   - Mínimo 20s para repetir el mismo efecto
   - Oceanic protection sagrada (chill-lounge)
   - HARD_COOLDOWN es LEY ABSOLUTA

3. **Dictator Hard Minimum Protection (WAVE 1179):** Si `HARD_COOLDOWN` está activo → bloqueo absoluto.

4. **Post-Drop Refractory Lock (WAVE 4860):** 4s de respiro retinal tras efecto DROP/DIVINE. Efectos menores bloqueados, altos pasan.

5. **Fallthrough Abolished (WAVE 2111):** Si el efecto elegido está bloqueado → SILENCIO. No plan B, no sustitución pánica. "The true intelligence is knowing when NOT to fire."

6. **Global Cooldown (WAVE 2101.4/2106):**
   - Base: 7000ms (estándar), 5000ms (latino)
   - Modulado por MoodController: CALM x4.0, BALANCED x2.2, PUNK x0.7
   - Just-Fired Hard Shield: 2000ms de inmunidad total (ni drops urgentes pasan)
   - Excepción: drops urgentes (< 800ms, prob > 0.80) y pre-buffer arming bypasean

7. **Pipeline Execution Throttle (WAVE 2104):** 2000ms entre ejecuciones del pipeline DNA.

8. **Section Change Cache Invalidation (WAVE 2106):** Si la sección cambia, se nukea `lastDreamIntegrationResult` para evitar decisiones stale.

9. **Cache Staleness Check (WAVE 2730):** Si el efecto cacheado ya no está disponible (cooldown), invalida cache.

### 2.5 DREAM — BiasDetector

**Estado:** Pass-through. `ScenarioSimulator` está frozen (WAVE 1169, pendiente WAVE 2.0). Solo registra decisiones para análisis de sesgos vía `recordDecision()`.

### 2.6 VALIDATE — ConstitutionGuard

**Archivo:** `electron-app/src/core/intelligence/validate/ConstitutionGuard.ts`

**Validaciones sobre `colorDecision`:**

1. **Forbidden Hue Ranges:** Si `suggestedHue` está en un rango prohibido por el Vibe, busca el hue permitido más cercano (considerando wrap-around del círculo cromático) y auto-corrije.

2. **Saturation Clamp:** `saturationMod` clampeado a [0.8, 1.2].

3. **Brightness Clamp:** `brightnessMod` clampeado a [0.8, 1.2].

4. **Forbidden Strategy:** Si la Constitution fuerza una estrategia (`forceStrategy`), ignora la sugerencia de Selene.

**Logging:** Throttled a 1 log por tipo de violación cada 5 segundos (WAVE 2105).

---

## 3. Sistema de Capas del NodeArbiter

**Archivo:** `electron-app/src/core/aether/NodeArbiter.ts`

El `ConsciousnessOutput` de Selene se inyecta como **L1 (Selene IA)** en el NodeArbiter. Las capas son:

| Capa | Origen | Descripción |
|------|--------|-------------|
| L0 | IntentBus (Systems) | ColorSystem, ImpactSystem, KineticSystem, VMM |
| L1 | Selene + Chronos | IA overrides + playback timeline |
| L2 | Manual | MIDI, OSC, UI faders (operador humano) |
| L3 | Effect + Hephaestus | LiveFXEngine, Diamond Data |
| L4 | Blackout | Flag de estado (egress) |

### 3.1 Smart Gate (WAVE 4752)

- Tracking per-node de canales tocados por L2/Chronos en cada frame
- L0/L1 solo bloqueados en los canales exactos que L2/Chronos escribieron
- Un toque de dimmer en `:impact` NO bloquea color de L0 en `:color`

### 3.2 L3 Supremacy — Escudo Anti-Sangrado (WAVE 4829/4836)

- `_l3DominatedChannels: Map<NodeId, Set<channel>>` registra canales reclamados por L3
- En `_applyIntent()` para layer `'system'|'selene'`: si `l3DominatedChannels.has(channel)` → `continue`
- L3 SIEMPRE domina los canales que escribe — zero blend, LTP puro
- Pre-pass (`_primeL3DominancePrePass`) construye el mapa ANTES de aplicar L0/L1

**L3 Luminance Gag (WAVE 4871):** Si L3 escribe en nodo `:impact` o `:color`, todos los canales de luminancia del fixture padre (`dimmer`, `strobe`, `shutter`, `master_brightness`) quedan dominados.

**Hephaestus Color Exclusivity (WAVE 4918.5):** Si Hephaestus escribe color a un nodo, L0 calla completamente en ese nodo este frame.

### 3.3 Manual Hard Lock (WAVE 4714) — La Ley del Operador

**Flujo en `arbitrate()`:**
1. L0 (System) → aplica via `_applyIntent('system')`
2. L1 (Selene) → aplica via `_applyIntent('selene')`
3. L1 (Chronos) → aplica via `_applyIntent('chronos')`
4. L2 (Manual) → escritura directa sobre `_result` + registro en `_manualChannelLocks`
5. L3 (Effect) → aplica via `_applyIntent('effect')`
6. L3+ (Hephaestus) → aplica via `_applyIntent('hephaestus')`
7. L3++ (Calibration) → aplica via `_applyIntent('calibration')`
8. **MANUAL HARD LOCK:** Re-aplica todos los canales L2 (salvo `pan_base`/`tilt_base`) después de L3. **El operador humano tiene la palabra final.**
9. Manual Intensity Lock: dimmer/brightness lockeado por nodo.
10. Grand Master: escala strobe/shutter/dimmer/brightness.
11. Inhibit Limits: cap sobre dimmer post-arbitraje.
12. Relative Offset Fusion (WAVE 4914): `pan_final = clamp01(pan_base + pan_offset * amp * aspect * distScale * gimbalFactor)`
13. Release Fades (WAVE 4984): ease-out cubic al soltar overrides manuales.

**Exclusiones del Hard Lock:** `pan_base` y `tilt_base` (canales orbit del radar) no se re-aplican post-L3. Se manejan via Relative Offset Fusion.

### 3.4 Relative Offset Routing (WAVE 4914)

Reemplaza el pin absoluto del bloque L2-MOTOR:
- L2 (IK/AetherKineticEngine) escribe `pan_base`/`tilt_base` (centro de gravedad)
- L0 (KineticAdapter VMM) escribe `pan_offset`/`tilt_offset` ∈ [-1, +1] (órbita)
- Fórmula: `pan_final = clamp01(base + offset * amp * scale * distScale * gimbalFactor)`
- Gimbal Lock fade: atenua pan_offset cuando tilt_base ≈ 0.5 (haz cenital/nadiral)
- L2 Absolute Supremacy (WAVE 4933.2): Si L2 tiene pan/tilt absoluto sin pan_base → offset L0 descartado
- Hold State (WAVE 4934): Si L2 tiene base pero no motor → congelación total, L0 silenciado

### 3.5 AetherKineticEngine — L2 Nativo

**Archivo:** `electron-app/src/core/aether/AetherKineticEngine.ts`

Motor cinético nativo que reemplaza al VMM para control MANUAL:
- Acumulador de fase por nodeId (monotonic, deterministic)
- Patrones del Golden Dozen en [-1, 1]
- Escribe `pan_base`/`tilt_base` via `setManualOverride()`
- Desfase fan: fanValue [0,1] → 2π radianes entre fixture 0 y N-1
- Velocidad: 0.03 Hz ... 1.2 Hz
- Zero-alloc: `_phaseMap` y `_overridePool` pre-asignados

---

## 4. MoodController — Modulación de Personalidad

**Archivo:** `electron-app/src/core/mood/MoodController.ts`

**Perfiles de mood:**
- **CALM:** cooldownMultiplier alto, ethicsThreshold alto, allowEthicsOverride probablemente false
- **BALANCED:** cooldownMultiplier 2.2, ethicsThreshold moderado, allowEthicsOverride false
- **PUNK:** cooldownMultiplier bajo (0.7), ethicsThreshold bajo, allowEthicsOverride true

**Impacto en el pipeline:**
- **FuzzyDecisionMaker:** ajusta score efectivo e intensidad (WAVE 700.1/1176)
- **DreamEngineIntegrator:** ajusta worthiness threshold (WAVE 920) y intensidad aprobada
- **DNA Cooldown Override:** `allowEthicsOverride` determina si la ética puede saltar cooldowns
- **Global Cooldown:** `applyCooldown(baseMs)` multiplica el cooldown base
- **DropBridge:** No afecta directamente (usa thresholds vibe-specific)

---

## 5. Mecanismos de Veto y Override — Resumen Jerárquico

De mayor a menor prioridad:

| # | Mecanismo | Origen | Efecto |
|---|-----------|--------|--------|
| 1 | **Cassandra Sovereign Clock** | Pre-todo | Dispara efecto pre-bufferizado, bypass total |
| 2 | **Glass Break Sensor** | Pre-todo | Dispara si drop adelantado detectado |
| 3 | **EnergyOverride** | Físico | Veto total si E > 0.75, física manda |
| 4 | **Manual Hard Lock (L2)** | Operador | Re-aplica canales L2 post-L3, ley final |
| 5 | **L3 Supremacy Shield** | Effect/Heph | Silencia L0/L1 en canales que L3 escribe |
| 6 | **Divine Moment Gate** | DecisionMaker | Z > 3.5σ → strike obligatorio |
| 7 | **Valley Protection** | DecisionMaker | Z < 0 en valley → bloqueo total |
| 8 | **Breakdown Protection** | DecisionMaker | Sección breakdown → bloqueo |
| 9 | **Buildup Restriction** | DecisionMaker | Arsenal pesado bloqueado en buildup |
| 10 | **Divine Leak Fix** | DreamIntegrator + DecisionMaker | Re-valida Z para efectos divinos |
| 11 | **Anti-Fake-Drop** | DecisionMaker | Z-Score sanity check para drops |
| 12 | **Absolute Energy Gate** | DecisionMaker | E < 48% del max → no drop |
| 13 | **Spectral Gate** | DecisionMaker | Latino: requiere kick + beat > vocals |
| 14 | **Drop Lock** | DecisionMaker | Un efecto por drop |
| 15 | **Post-Drop Refractory** | Gatekeeper | 4s de respiro post efecto severo |
| 16 | **Global Cooldown** | Gatekeeper | 5-7s base, modulado por mood |
| 17 | **Just-Fired Shield** | Gatekeeper | 2s inmunidad total post-disparo |
| 18 | **HARD_COOLDOWN** | ArsenalRepository | Ley absoluta, inamovible |
| 19 | **ConstitutionGuard** | Validate | Corrije hue/saturación/estrategia |
| 20 | **Fallthrough Abolished** | Gatekeeper | Si bloqueado → silencio, no plan B |

---

## 6. Flujo de Datos: Del Audio al DMX

```
Audio FFT → TitanStabilizedState
    │
    ├── rawEnergy, smoothedEnergy, bass, mid, high, ultraAir
    ├── harshness, clarity, spectralFlatness, spectralCentroid
    ├── sectionType (FSM), isDropActive
    └── currentPalette (colores actuales)
         │
         ▼
    SeleneTitanConscious.process()
         │
         ├── [Cassandra Sovereign Clock] ──→ return early (bypass)
         ├── [EnergyOverride] ──→ return override output (física)
         ├── SENSE → pattern + beauty + consonance + Z-Score
         ├── THINK:
         │    ├── HuntEngine → worthiness, confidence
         │    ├── PredictionEngine → prediction type/prob/time
         │    ├── DropBridge → shouldForceStrike, alertLevel
         │    ├── FuzzyDecisionMaker → action, intensity, confidence
         │    ├── DreamEngineIntegrator → approved effect + ethics
         │    └── DecisionMaker → effectDecision + colorDecision + physicsModifier
         ├── GATEKEEPER → availability check + cooldowns
         ├── DREAM → recordDecision (bias tracking)
         ├── VALIDATE → ConstitutionGuard corrections
         └── return ConsciousnessOutput
              │
              ▼
    ConsciousnessOutput → SeleneBus (L1) → NodeArbiter
         │
         ├── L0: Systems (Color, Impact, Kinetic, VMM)
         ├── L1: Selene + Chronos
         ├── L2: Manual (operador)
         ├── L3: Effects + Hephaestus
         ├── [Smart Gate + L3 Shield + Manual Hard Lock]
         ├── [Relative Offset Fusion]
         └── ArbitratedNodeMap → NodeResolver → DMX
```

---

## 7. Observaciones Clave

1. **Silence Rule (WAVE 975):** Si el DNA no propone efecto, no se dispara nada. Las físicas reactivas manejan la escena. Esto es filosofía central: "Better silence than garbage effects."

2. **DNA Simula, DecisionMaker Decide:** El DreamEngineIntegrator genera DATA (escenarios, ética). El DecisionMaker toma la DECISIÓN final. Separación clara entre simulación y acción.

3. **Mood como Personalidad:** MoodController no es solo un modificador de thresholds — define la personalidad completa de Selene. PUNK es agresivo (permite overrides éticos, cooldowns cortos), CALM es contemplativo (cooldowns largos, sin overrides).

4. **Cassandra (Oracle) como Reloj Soberano:** El sistema de pre-buffer permite que Cassandra armue efectos con segundos de antelación. El Sovereign Clock y Glass Break aseguran que se disparen en el momento exacto, incluso si el DJ adelanta el drop.

5. **L2 Manual Hard Lock es Absoluto:** Ninguna capa automática (L0, L1, L3) puede contrarrestar al operador humano. L3 domina L0/L1 pero el Hard Lock re-aplica L2 post-L3. Es la doctrina: "El operador tiene la palabra final."

6. **Diversity-Aware Selection:** El sistema evita monotonía priorizando efectos no usados recientemente. El `rankArsenalByDiversity` penaliza efectos repetidos.

7. **Vibe-Aware Everything:** Desde HuntEngine hasta DropBridge hasta DecisionMaker, todos los módulos ajustan thresholds y pesos según el género musical. Latino tiene thresholds más altos (dembow infla Z-scores), techno más bajos (Z plano característico).

8. **Zero-Fallthrough (WAVE 2111):** 11 WAVEs de patches demostraron que el fallthrough era una idea equivocada. Si el efecto elegido está bloqueado, SILENCIO. No sustitución pánica.

9. **Section Change Invalidation (WAVE 2106):** El cache del DNA se invalida al cambiar de sección. Una decisión correcta para buildup no debe dispararse en breakdown.

10. **Temporal Seal (WAVE 2200.1):** Cuando Cassandra almacena un pre-buffer, la recomendación se degrada a 'modify'. El efecto queda sellado hasta que el FAST PATH lo libere.

---

## 8. Archivos Auditados

| Archivo | Líneas | Función |
|---------|--------|---------|
| `SeleneTitanConscious.ts` | 2046 | Cerebro — orquesta todo el pipeline |
| `HuntEngine.ts` | 836 | Worthiness scoring + VIBE_STRIKE_MATRIX |
| `FuzzyDecisionMaker.ts` | 1135 | Lógica difusa + defuzzificación + mood |
| `DecisionMaker.ts` | 1327 | Decisión final + gates + arsenal selection |
| `DreamEngineIntegrator.ts` | ~1000 | Pipeline DNA + ética + pre-buffer |
| `DropBridge.ts` | 425 | Condición divina + cooldown + alertas |
| `EnergyOverride.ts` | 201 | Veto físico en drops |
| `ConstitutionGuard.ts` | 294 | Validación de hue/saturación/estrategia |
| `NodeArbiter.ts` | 1522 | Arbitraje multicapa + Smart Gate + L3 Shield |
| `AetherKineticEngine.ts` | 704 | Motor cinético L2 nativo |
| `EffectDreamSimulator.ts` | 1607 | Simulación de escenarios + Cassandra pre-buffer |

---

*Fin del reporte.*
