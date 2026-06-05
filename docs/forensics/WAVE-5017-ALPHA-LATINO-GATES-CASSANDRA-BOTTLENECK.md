# WAVE 5017-ALPHA — LATINO GATES & CASSANDRA BOTTLENECK
## Forensic Audit — Kimi Extracts for the Architect

---

## 🔍 ÁREA 1: Umbrales Base y Divinos para Latino (DecisionMaker.ts)

### 1.1 Umbral DIVINE global

```typescript
// @electron-app/src/core/intelligence/think/DecisionMaker.ts:66-69
/**
 * Umbral de Z-Score para DIVINE moment (momento de máximo impacto obligatorio)
 * 🔬 WAVE 2185: Elevado de 3.5 a 4.0 + dual validation con energía efectiva
 */
export const DIVINE_THRESHOLD = 4.0
```

### 1.2 Umbrales discriminados por vibe (Techno vs. Latino)

```typescript
// @electron-app/src/core/intelligence/think/DecisionMaker.ts:454-457
  // 🔒 WAVE 1177: Si hay dictador activo, no intentar DIVINE
  const isTechnoVibe = (pattern.vibeId as string) === 'techno-club' || (pattern.vibeId as string) === 'hard-techno' || (pattern.vibeId as string)?.includes('techno') || false
  const effectiveDivineThreshold = isTechnoVibe ? 2.5 : DIVINE_THRESHOLD
```

**Respuesta Kimi:**
- **Techno:** `effectiveDivineThreshold = 2.5` (50% más bajo que el global).
- **Latino (fiesta-latina):** `effectiveDivineThreshold = 4.0` (el umbral global intacto).
- **Implicación:** Un género de alta energía constante como el latino necesita un Z-Score **≥ 4.0σ** para desbloquear el arsenal divino, mientras que el techno lo consigue con **≥ 2.5σ**. Dado que latino mantiene energía elevada de forma sostenida (sin los picos estadísticos extremos del techno minimal), un Z=4.0 es prácticamente inalcanzable en vivo. **El gate Divino está demasiado alto para latino.**

### 1.3 Gates de energía y espectral (anti-fake-drop)

```typescript
// @electron-app/src/core/intelligence/think/DecisionMaker.ts:372-414
  // ═══════════════════════════════════════════════════════════════════════
  // 🐘 WAVE 4861: ABSOLUTE ENERGY GATE — El Candado Físico Anti-Silencio
  // ═══════════════════════════════════════════════════════════════════════
  // 🐘 WAVE 5001: Calibración Latino Montecarlo
  // Los redobles bajan temporalmente al ~50%. 0.60 ahogaba drops legítimos.
  // 0.48 permite el clímax tras el redoble sin habilitar silencios (< 30%).
  const ABSOLUTE_ENERGY_GATE_RATIO = 0.48
  const ABSOLUTE_ENERGY_GATE_FALLBACK = 0.40
  const rawEnergy = energyContext?.absolute ?? pattern.rawEnergy ?? 0
  const maxHistoric = (energyMaxHistoric ?? 0) > 0 ? energyMaxHistoric! : null
  const absoluteGateThreshold = maxHistoric !== null
    ? maxHistoric * ABSOLUTE_ENERGY_GATE_RATIO
    : ABSOLUTE_ENERGY_GATE_FALLBACK
  const energyGateOpen = rawEnergy >= absoluteGateThreshold

  // ═══════════════════════════════════════════════════════════════════════
  // 🌴 WAVE 4864: SPECTRAL GATE — Anti-Bad-Bunny
  // ═══════════════════════════════════════════════════════════════════════
  // PROBLEMA CONFIRMADO (FFT X-RAY): En reggaetón/latino, la compresión de
  // voces autotuneadas infla la banda MID, elevando rawEnergy (TOTAL) por
  // encima del umbral del Absolute Gate durante valles rítmicos donde el
  // bombo/bajo ha desaparecido. Resultado: disparos HEAVY/DROP en silencios.
  //
  // SOLUCIÓN: En latino/dembow, exigir presencia física del bajo/bombo:
  //   • hasHeavyKick:   lowBand >= maxHistoric * 0.55  (bombo empujando fuerte)
  //   • isNotJustVocals: lowBand >= midBand * 0.95    (WAVE 5001 Spotify fix)
  //
  // MANTENIMIENTO: Este gate solo afecta DIVINE/DROP/HEAVY. Efectos menores
  // (DNA, hunt_strike suave, buildup, ambientales) siguen fluyendo libremente.
  // ═══════════════════════════════════════════════════════════════════════
  const _vId = pattern.vibeId ?? ''
  const isLatinoVibeForSpectral = _vId.includes('latino') || _vId.includes('latina') || _vId.includes('dembow')
  let spectralGateOpen = true
  if (isLatinoVibeForSpectral && energyGateOpen) {
    const lowBand = pattern.bassPresenceSustained ?? pattern.bassPresence ?? 0
    const midBand = pattern.midPresence ?? 0
    const kickThreshold = (maxHistoric ?? 0) * 0.75
    const hasHeavyKick = lowBand >= kickThreshold
    const isNotJustVocals = lowBand >= (midBand * 0.95)
    spectralGateOpen = hasHeavyKick && isNotJustVocals
  }
  const isAbsoluteGateOpen = energyGateOpen && spectralGateOpen
```

### 1.4 Gate de energía para DIVINE (dual validation)

```typescript
// @electron-app/src/core/intelligence/think/DecisionMaker.ts:438-504
  // ═══════════════════════════════════════════════════════════════════════
  // 🔬 WAVE 2201: DIVINE ENERGY GATE — Hard Techno Minimal Calibration
  // ═══════════════════════════════════════════════════════════════════════
  // SOLUCIÓN (2 tramos):
  //   • energy < 0.85 (zone gentle/active pero no hirviendo):
  //       → FALL THROUGH a prioridades inferiores.
  //   • 0.85 <= energy (zone intense/peak — la pista REALMENTE está ardiendo):
  //       → DIVINE STRIKE.
  //
  // CAMBIO vs WAVE 2185:
  //   Antes: energy < 0.65 → return 'strike' (disparo garantizado, solo no-DIVINE)
  //   Ahora: energy < 0.85 → fall through (el contexto musical decide, no forzamos)
  //   El tramo 0.65–0.84 ya NO fuerza ningún strike — deja al resto de prioridades
  //   evaluar si corresponde o no. Más musical, menos mecánico.
  // ═══════════════════════════════════════════════════════════════════════
  const DIVINE_ENERGY_GATE = 0.72  // 🔬 WAVE 2494: 0.85→0.72
  
  // 🔒 WAVE 1177: Si hay dictador activo, no intentar DIVINE
  const isTechnoVibe = (pattern.vibeId as string) === 'techno-club' || (pattern.vibeId as string) === 'hard-techno' || (pattern.vibeId as string)?.includes('techno') || false
  const effectiveDivineThreshold = isTechnoVibe ? 2.5 : DIVINE_THRESHOLD

  if (activeDictator) {
    // No loggear nada - silencio total para evitar spam
  } else if (currentZ >= effectiveDivineThreshold) {
    const zone = energyContext?.zone ?? 'gentle'
    const effectiveEnergy = energyContext?.absolute ?? 0
    
    if (zone === 'silence' || zone === 'valley') {
      console.log(`[DecisionMaker 🌩️] DIVINE BLOCKED: Z=${currentZ.toFixed(2)}σ but zone=${zone} (protected)`)
    } else if (!isAbsoluteGateOpen) {
      // ... DIVINE BLOCKED por Absolute Gate o Spectral Gate
    } else if (effectiveEnergy < DIVINE_ENERGY_GATE) {
      // 🔬 WAVE 2201: Z estadísticamente masivo pero energía real insuficiente
      // → NO forzar ningún strike, dejar que el pipeline musical decida
      // Fall through — NO return aquí.
    } else {
      console.log(`[DecisionMaker 🌩️] DIVINE MOMENT: Z=${currentZ.toFixed(2)}σ energy=${effectiveEnergy.toFixed(2)} zone=${zone} → MANDATORY FIRE`)
      return 'divine_strike'
    }
  }
```

### 1.5 Umbral para strikes normales (HuntEngine)

```typescript
// @electron-app/src/core/intelligence/think/DecisionMaker.ts:653-665
  // 🔥 WAVE 811: Usar worthiness (0-1) en lugar de shouldStrike (boolean)
  // Prioridad 1: Momento digno detectado por HuntEngine
  const WORTHINESS_THRESHOLD = 0.65  // Umbral para considerar "digno de efecto"
  if (huntDecision.worthiness >= WORTHINESS_THRESHOLD && huntDecision.confidence > 0.50) {
    // ... puede ser bloqueado por FUZZY BUILDUP WALL
    return 'strike'
  }
```

**Respuesta Kimi (resumen ÁREA 1):**

| Gate | Valor Latino | ¿Exigente? |
|------|-------------|------------|
| DIVINE Z-Score | **4.0σ** (vs 2.5σ en techno) | **SÍ, excesivamente** para energía constante |
| DIVINE Energy Gate | **0.72** rawEnergy | Moderado |
| Absolute Energy Gate | **48%** del pico histórico (30s) | Generoso |
| Spectral Gate (latino) | `lowBand ≥ max*0.75` AND `lowBand ≥ mid*0.95` | Estricto en valles vocales |
| Normal Strike (Hunt) | worthiness ≥ **0.65** | Moderado |

**Conclusión arquitectónica:** El DIVINE nunca dispara en latino porque **Z≥4.0 es un pico estadístico extremo** que raramente se alcanza en géneros de energía sostenida (reggaetón/cumbia mantienen E~0.75-0.85 de forma continua, sin los silencios→explosión del techno que generan Z altos). El umbral debería ser asimétrico por vibe o usar percentiles en vez de σ.

---

## 🔍 ÁREA 2: Inmunidad del Arsenal Divino (DecisionMaker.ts + SeleneTitanConscious.ts + EffectManager.ts)

### 2.1 DecisionMaker: generación del DIVINE strike (sin bypass de cooldown)

```typescript
// @electron-app/src/core/intelligence/think/DecisionMaker.ts:810-888
function generateDivineStrikeDecision(
  inputs: DecisionInputs,
  output: ConsciousnessOutput,
  confidence: number
): ConsciousnessOutput {
  const { beauty, pattern, zScore, energyContext, spectralContext } = inputs
  const vibeId = pattern.vibeId
  
  output.confidence = 0.99  // DIVINE = máxima confianza
  output.source = 'hunt'
  output.debugInfo.huntState = 'striking'
  output.debugInfo.beautyScore = beauty.totalBeauty
  
  // ⚡ WAVE 4914+4915: LIVE REGISTRY — única fuente de verdad.
  const _registryDivine = getDynamicEffectRegistry().getDivineArsenal(vibeId)
  const arsenal: string[] = _registryDivine.map(e => e.id)

  if (arsenal.length === 0) {
    console.warn(`[DecisionMaker 🌩️] DIVINE registry empty for vibe=${vibeId} — no divine strike possible.`)
    output.confidence = 0.0
    output.debugInfo.reasoning = `DIVINE SUPPRESSED: empty divine registry for ${vibeId}`
    return output
  }
  
  // 🎲 WAVE 2494: DIVERSITY FIX v3 — pasar arsenal completo RANKEADO por diversity score
  const rankedArsenal = rankArsenalByDiversity(arsenal)
  const suggestedEffect = rankedArsenal[0] || arsenal[0]
  
  output.effectDecision = {
    effectType: suggestedEffect,
    intensity: 1.0,  // DIVINE = máxima intensidad
    zones: ['all'],  // DIVINE afecta todo
    reason: `🌩️ DIVINE: Z=${(zScore ?? 0).toFixed(2)}σ > ${DIVINE_THRESHOLD} | Ranked: ${rankedArsenal.join(' > ')} | Full arsenal: ${arsenal.join(', ')}`,
    confidence: 0.99,
    divineArsenal: rankedArsenal,
  } as any
  
  // Color decision: Máximo impacto
  output.colorDecision = {
    suggestedStrategy: 'complementary',
    saturationMod: 1.25,
    brightnessMod: 1.20,
    confidence: 0.99,
    reasoning: `DIVINE Strike (Z=${(zScore ?? 0).toFixed(2)}σ)`,
  }
  
  // Physics modifier: Máxima potencia
  output.physicsModifier = {
    strobeIntensity: 1.0,
    flashIntensity: 1.0,
    confidence: 0.99,
  }
  
  console.log(
    `[DecisionMaker 🌩️] DIVINE STRIKE: Z=${(zScore ?? 0).toFixed(2)}σ | ` +
    `vibe=${vibeId} | zone=${energyContext?.zone ?? 'unknown'} | ` +
    `texture=${spectralContext?.texture ?? 'N/A'} | ` +
    `arsenal=[${arsenal.join(', ')}]`
  )
  
  return output
}
```

**Respuesta Kimi:** `generateDivineStrikeDecision` **NO conoce el globalCooldown**. Genera un `output.effectDecision` con `intensity: 1.0` y `divineArsenal` sin preguntar cuándo se disparó el último efecto. El DIVINE se genera en `makeDecision()` que corre en **cada frame** (60fps), independientemente del pipeline DNA.

### 2.2 SeleneTitanConscious: disponibilidad del DIVINE arsenal

```typescript
// @electron-app/src/core/intelligence/SeleneTitanConscious.ts:1288-1327
      // 🔪 WAVE 1010: DIVINE STRIKE con Arsenal - el Repository elige el arma disponible
      const divineArsenal = (output.effectDecision as any).divineArsenal as string[] | undefined
      if (divineArsenal && divineArsenal.length > 0) {
        // El General ordenó DIVINE STRIKE, el Bibliotecario busca el arma
        const availableWeapon = this.effectSelector.getAvailableFromArsenal(divineArsenal, pattern.vibeId)
        if (availableWeapon) {
          intent = availableWeapon
          output.effectDecision.effectType = availableWeapon
          
          const reasonStr = output.effectDecision.reason ?? ''
          const isDivineOrigin = reasonStr.includes('🌩️ DIVINE')
          const originEmoji = isDivineOrigin ? '🌩️' : '🔴'
          const originLabel = isDivineOrigin ? 'DIVINE ARSENAL' : 'DROP ARSENAL'
          console.log(
            `[SeleneTitanConscious ${originEmoji}] ${originLabel}: Selected ${availableWeapon} from [${divineArsenal.join(', ')}]`
          )
        } else {
          // Todo el arsenal en cooldown - silencio forzado
          console.log(
            `[SeleneTitanConscious 🌩️] DIVINE ARSENAL EXHAUSTED - all weapons in cooldown`
          )
          output = {
            ...output,
            effectDecision: null,
            debugInfo: {
              ...output.debugInfo,
              reasoning: `🌩️ DIVINE BLOCKED: Arsenal exhausted [${divineArsenal.join(', ')}]`,
            }
          }
        }
      }
```

### 2.3 SeleneTitanConscious: el availability check donde el DIVINE salta gates

```typescript
// @electron-app/src/core/intelligence/SeleneTitanConscious.ts:1371-1406
      // 🔪 WAVE 1010: Si ya procesamos DIVINE arsenal, el efecto ya está validado
      const alreadyValidatedByArsenal = divineArsenal && divineArsenal.length > 0 && output.effectDecision
      
      // ═══════════════════════════════════════════════════════════════════════════
      // 🔒 WAVE 1179: DICTATOR HARD MINIMUM PROTECTION
      // ═══════════════════════════════════════════════════════════════════════════
      const hardMinimumCheck = this.effectSelector.checkAvailability(intent, pattern.vibeId)
      const isHardMinimumBlocked = hardMinimumCheck.reason?.includes('HARD_COOLDOWN')

      // 🛡️ WAVE 4860: POST-DROP REFRACTORY LOCK — La Regla del Respiro Retinal
      const timeSinceHighSeverity = now - this.lastHighSeverityEffectTimestamp
      const isInRefractory = timeSinceHighSeverity < this.POST_DROP_REFRACTORY_MS
      const isHighSeverityCandidate = isHighSeverityEffect(intent)
        || output.effectDecision?.reason?.includes('DROP')
        || output.effectDecision?.reason?.includes('DIVINE')
      const refractoryBlocked = isInRefractory && !isHighSeverityCandidate && !isHardMinimumBlocked

      if (refractoryBlocked) {
        console.log(
          `[Gatekeeper] Veto: Post-Drop Breathing Space — ${intent} blocked ` +
          `(${Math.ceil((this.POST_DROP_REFRACTORY_MS - timeSinceHighSeverity) / 1000)}s remaining)`
        )
      }
      
      const availability = isHardMinimumBlocked
        ? hardMinimumCheck  // 🔒 HARD MINIMUM es LEY ABSOLUTA
        : refractoryBlocked
        ? { available: false, reason: 'Post-Drop Refractory Lock (WAVE 4860)' }
        : alreadyValidatedByArsenal
        ? { available: true, reason: 'DIVINE arsenal pre-validated' }
        : hasHighEthicsOverride
        ? { available: true, reason: `DNA override (${currentMoodProfile.emoji} ${currentMoodProfile.name}: ethics ${ethicsScore.toFixed(2)} > ${ethicsThreshold})` }
        : hardMinimumCheck
```

**Respuesta Kimi:** `alreadyValidatedByArsenal` **sí salta el `hardMinimumCheck`** (cooldown individual del efecto), pero **NO salta el `refractoryBlocked`**: el DIVINE es considerado `isHighSeverityCandidate`, así que si está en periodo refractario post-drop, el DIVINE PASA (no es bloqueado por refractario). Esto es correcto: un DIVINE debe poder sobreescribir un respiro.

### 2.4 EffectManager: cooldown gate (sin bypass para DIVINE)

```typescript
// @electron-app/src/core/effects/EffectManager.ts:412-434
    // ═══════════════════════════════════════════════════════════════════════
    // ⏱️ WAVE 2730: THE GATEKEEPER — Per-effect cooldown check BEFORE trigger
    // ═══════════════════════════════════════════════════════════════════════
    const bypassCooldownGate = config.source === 'chronos' || config.source === 'manual'
    if (!bypassCooldownGate) {
      try {
        const selector = getArsenalRepository()
        const cooldownCheck = selector.checkAvailability(config.effectType, vibeId)
        if (!cooldownCheck.available) {
          console.log(`[EffectManager ⏱️ GATEKEEPER] ${config.effectType} BLOCKED: ${cooldownCheck.reason}`)
          this.emit('effectBlocked', {
            effectType: config.effectType,
            vibeId,
            reason: `COOLDOWN_GATE: ${cooldownCheck.reason}`,
          })
          return null
        }
      } catch (_) { /* ... */ }
    }
```

**Respuesta Kimi (resumen ÁREA 2):**

- **¿El DIVINE tiene bypass explícito del globalCooldown?** → **NO**. El globalCooldown (7s general / 5s latino) vive en `SeleneTitanConscious.ts` y solo bloquea el **DNA pipeline** (`shouldRunDNA`). El DIVINE se genera en `makeDecision()` que corre en cada frame independientemente del globalCooldown.
- **¿Pero el DIVINE puede ser bloqueado por cooldown individual del arma?** → **SÍ, indirectamente**. Selene usa `getAvailableFromArsenal()` que ya filtra por disponibilidad (cooldown individual pasado). El EffectManager también hace `checkAvailability()`, pero si `getAvailableFromArsenal` hizo bien su trabajo, el arma ya está libre.
- **¿El JUST-FIRED SHIELD (2s) bloquea el DIVINE?** → **NO**. El shield vive dentro del bloque `shouldRunDNA` (DNA pipeline). El DIVINE strike se genera fuera de ese bloque en `makeDecision()`.
- **Conclusión:** El DIVINE tiene **inmunidad parcial**: no respeta el globalCooldown ni el JUST-FIRED shield, pero respeta el cooldown individual del arma (vía `getAvailableFromArsenal`). Si el arsenal entero está en cooldown → "DIVINE ARSENAL EXHAUSTED".

---

## 🔍 ÁREA 3: El Bloqueo del Pre-Buffer (EffectDreamSimulator.ts + DreamEngineIntegrator.ts + SeleneTitanConscious.ts)

### 3.1 SeleneTitanConscious: el DNA pipeline bloqueado por globalCooldown

```typescript
// @electron-app/src/core/intelligence/SeleneTitanConscious.ts:1066-1095
      // 🩸 WAVE 2101.4: GLOBAL EFFECT COOLDOWN GATE
      // Si se disparó CUALQUIER efecto hace menos de 8s, ni siquiera ejecutar pipeline.
      // Excepción: drops inminentes (<800ms, prob>0.80) bypasean.
      const nowGlobal = Date.now()
      const timeSinceLastEffect = nowGlobal - this.lastGlobalEffectTimestamp
      const isDropUrgent = prediction.type === 'drop_incoming' 
                         && prediction.estimatedTimeMs < 800 
                         && prediction.probability > 0.80
      const baseCooldownMs = pattern.vibeId === 'fiesta-latina'
        ? this.LATINA_GLOBAL_EFFECT_COOLDOWN_MS
        : this.GLOBAL_EFFECT_COOLDOWN_MS
      // 🎭 WAVE 4860: Conectar mood cooldownMultiplier al reloj global
      // CALM x4.0 = 28s-32s | BALANCED x2.2 = 15s-18s | PUNK x0.7 = 5s-6s
      const globalCooldownMs = MoodController.getInstance().applyCooldown(baseCooldownMs)

      // ⚡ WAVE 4849: JUST-FIRED HARD SHIELD — 2s de inmunidad total
      // isDropUrgent bypasea el cooldown largo, pero NO puede saltar este escudo.
      const JUST_FIRED_SHIELD_MS = 2000
      if (timeSinceLastEffect < JUST_FIRED_SHIELD_MS) {
        dreamIntegrationData = this.lastDreamIntegrationResult  // Hard block — ni drops pasan
      } else if (timeSinceLastEffect < globalCooldownMs && !isDropUrgent) {
        // 🩸 WAVE 2104.1: DIAGNOSTIC
        if (this.stats.framesProcessed % 15 === 0) {
          console.log(`[GLOBAL_COOLDOWN] ⏸️ Cached: ${Math.ceil((globalCooldownMs - timeSinceLastEffect) / 1000)}s left | vibe=${pattern.vibeId} lastEffect=${this.lastEffectType ?? 'none'}`)
        }
        dreamIntegrationData = this.lastDreamIntegrationResult  // Reusar cache
      } else {
```

### 3.2 SeleneTitanConscious: pipeline execution throttle (también bloquea DNA)

```typescript
// @electron-app/src/core/intelligence/SeleneTitanConscious.ts:1096-1112
      // 🩸 WAVE 2101.4: PIPELINE EXECUTION THROTTLE (HARDENED)
      const nowPipeline = Date.now()
      const timeSinceLastPipeline = nowPipeline - this.lastPipelineExecutionTimestamp
      const isDropType = prediction.type === 'drop_incoming' || prediction.type === 'energy_spike'
      const isUrgent = isDropType 
                     && prediction.estimatedTimeMs < 800 
                     && prediction.probability > 0.80
      const pipelineReady = isUrgent || timeSinceLastPipeline >= this.PIPELINE_EXECUTION_THROTTLE_MS
      
      if (!pipelineReady) {
        // Reusar el último resultado del pipeline si está reciente y sigue siendo válido
        dreamIntegrationData = this.lastDreamIntegrationResult
      } else {
        this.lastPipelineExecutionTimestamp = nowPipeline
        // ... construir pipelineContext y ejecutar pipeline
```

### 3.3 EffectDreamSimulator: almacenamiento del pre-buffer (sin chequeo de globalCooldown)

```typescript
// @electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts:287-310
    // ═══════════════════════════════════════════════════════════════
    // 🔮 WAVE 1190: PROJECT CASSANDRA - Pre-buffer Storage
    // Si alta confianza y tiempo suficiente, guardar el mejor para después
    // ═══════════════════════════════════════════════════════════════
    
    if (bestScenario && 
        oracleProbability >= this.PRE_BUFFER_MIN_PROBABILITY && 
        timeToEvent >= this.PRE_BUFFER_MIN_TIME_MS &&
        !this.preBuffer) {  // Solo si no hay buffer ya
      
      const predictionType = musicalPrediction.predictionType ?? 'none'
      
      if (predictionType !== 'none') {
        this.preBuffer = {
          effect: bestScenario.effect,
          score: bestScenario.projectedRelevance,
          bufferedAt: now,
          predictedEventAt: now + timeToEvent,
          predictionType,
          oracleProbability,
        }
        
        console.log(`[DREAM_SIMULATOR] 🔮📦 CASSANDRA PRE-BUFFER: "${bestScenario.effect.effect}" stored for ${predictionType} in ~${(timeToEvent / 1000).toFixed(1)}s (${(oracleProbability * 100).toFixed(0)}% confidence)`)
      }
    }
```

### 3.4 Constantes del pre-buffer

```typescript
// @electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts:192-196
  // 🔮 WAVE 1190: PROJECT CASSANDRA - Pre-buffer system
  private preBuffer: PreBufferedEffect | null = null
  private readonly PRE_BUFFER_MIN_PROBABILITY = 0.65  // Solo buffer si Oráculo > 65% seguro
  private readonly PRE_BUFFER_MIN_TIME_MS = 2000      // Solo buffer si > 2s hasta evento
  private readonly PRE_BUFFER_MAX_AGE_MS = 5000       // Expira después de 5s
```

**Respuesta Kimi (resumen ÁREA 3):**

- **¿Cassandra puede pre-buffear durante globalCooldown?** → **NO indirectamente**. El `EffectDreamSimulator` NO tiene gate de globalCooldown en su pre-buffer storage (líneas 292-310). PERO... el simulador solo se ejecuta cuando el **DNA pipeline** corre, y el DNA pipeline está protegido por el `GLOBAL EFFECT COOLDOWN GATE` en `SeleneTitanConscious.ts` (líneas 1066-1094). Si un efecto se disparó hace 3s y no es un drop urgente, el pipeline NO corre → `dreamIntegrationData = lastDreamIntegrationResult` (cache) → no hay nueva simulación → no hay nuevo pre-buffer.
- **¿El efecto soft de 4s de buildup enmascara el drop?** → **SÍ, exactamente**. Un efecto de buildup (ej. `acid_sweep`) dispara y pone `lastGlobalEffectTimestamp = now`. Luego el drop llega 2s después. El globalCooldown para latino es 5s (base) * 2.2 (BALANCED) = **11s**. Como `timeSinceLastEffect = 2000ms < 11000ms`, el DNA pipeline está bloqueado. Cassandra NO puede simular nuevos candidatos para el drop → **no hay pre-buffer del drop** → el drop pasa desapercibido o solo genera un `prepare_for_drop` de baja calidad sin efecto bufferizado.
- **¿El isDropUrgent bypasea esto?** → Solo si `prediction.estimatedTimeMs < 800 && probability > 0.80`. Con el Fluid Timing de WAVE 5016, el `estimatedTimeMs` ahora es dinámico, pero si el drop llega de forma abrupta (Z-Score alto), el Glass Break (WAVE 5016) debería detonar el pre-buffer existente. PERO si el pre-buffer no existe (porque el pipeline estaba bloqueado por globalCooldown), no hay nada que detonar.

---

## 🎯 Síntesis Ejecutiva para el Arquitecto

### Problema 1: DIVINE inaccesible en Latino
El `effectiveDivineThreshold` es **4.0σ** para latino (vs 2.5σ para techno). En música latina de alta energía constante, el Z-Score raramente supera 3.0 porque la energía no cae a valles extremos. **Recomendación:** Asimetría de umbrales por vibe o reemplazar Z-Score por percentiles de energía (p.ej. top 2% del histórico 30s).

### Problema 2: Efectos de buildup enmascaran drops
El `globalCooldown` (5s base × 2.2 BALANCED = **11s efectivos** para latino) bloquea el DNA pipeline completamente. Si un efecto soft de buildup dispara, Cassandra queda **sorda durante 11s**. El drop que llega 3-4s después no puede generar pre-buffer porque el simulador no corre. **Recomendación:** Permitir que los drops urgentes (`isDropUrgent`) invaliden el cache del pipeline y fuerzen una re-simulación, o reducir el `LATINA_GLOBAL_EFFECT_COOLDOWN_MS` por debajo del intervalo típico entre drops en reggaetón (4-6s).

### Problema 3: El DIVINE no tiene bypass de globalCooldown
Aunque el DIVINE genera su `effectDecision` en cada frame, el `getAvailableFromArsenal` filtra por cooldown individual. Si todo el arsenal divino está en cooldown (porque un efecto normal lo consumió hace 3s), el DIVINE queda en "DIVINE ARSENAL EXHAUSTED". **Recomendación:** Considerar un `DIVINE_COOLDOWN_BYPASS` que permita al DIVINE strike sobreescribir el globalCooldown cuando Z ≥ threshold + energy gate abierto.
