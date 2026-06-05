# WAVE 5012-ALPHA (THE GHOST ARSENAL)

**Auditoría Forense: Minimal Techno — Arsenales Divino/Pesado Bloqueados**
**Fecha:** 2026-06-04  
**Solicitante:** Arquitecto  
**Auditor:** Kimi  
**Mandato:** EXTRAER únicamente los fragmentos exactos. Sin resúmenes, sin interpretación.

---

## 🔍 BÚSQUEDA 1: La Construcción del Arsenal

**Archivo:** `electron-app/src/core/arsenal/DynamicEffectRegistry.ts`
**Pregunta:** ¿Qué condiciones exactas (tags, isDivineCandidate, vibe arrays) debe cumplir un efecto JSON para entrar en la lista de heavy o divine cuando el vibe es techno-club?

### 1.1 Tipos de entrada (lfxTypes.ts)

```ts
@/electron-app/src/core/arsenal/lfxTypes.ts:166-185
/** Metadata para el EffectDreamSimulator (beauty, GPU cost, fatigue). */
export interface SimulationMeta {
  readonly beautyWeights: {
    readonly base: number
    readonly energyMultiplier: number
    readonly vibeBonus: number
  }
  readonly gpuCost: number
  readonly fatigueImpact: number
  readonly minDurationMs: number
  readonly cooldownMs: number
  readonly isStrobe: boolean
  readonly isDivineCandidate: boolean
  readonly isHeavyCandidate: boolean
  readonly zScoreGuards: {
    readonly requireRising: boolean
    readonly minimumZ: number | null
    readonly minimumEnergy: number | null
  }
}
```

### 1.2 Métodos públicos de filtrado

```ts
@/electron-app/src/core/arsenal/DynamicEffectRegistry.ts:197-210
  /** Retorna efectos pre-filtrados por vibe (referencia al array indexado). */
  public getEffectsForVibe(vibe: string): readonly RegistryEntry[] {
    return this._byVibe.get(vibe) ?? DynamicEffectRegistry._EMPTY_ENTRIES
  }

  /** Retorna arsenal DIVINE pre-indexado por vibe. */
  public getDivineArsenal(vibe: string): readonly RegistryEntry[] {
    return this._divineByVibe.get(vibe) ?? DynamicEffectRegistry._EMPTY_ENTRIES
  }

  /** Retorna arsenal HEAVY pre-indexado por vibe. */
  public getHeavyArsenal(vibe: string): readonly RegistryEntry[] {
    return this._heavyByVibe.get(vibe) ?? DynamicEffectRegistry._EMPTY_ENTRIES
  }
```

### 1.3 Lógica de indexación (donde se decide qué entra y qué no)

```ts
@/electron-app/src/core/arsenal/DynamicEffectRegistry.ts:274-302
  private _appendToIndices(entry: RegistryEntry): void {
    // 🎯 WAVE 4865: Deduplicar por canonical vibe.
    // Un efecto puede declarar ['latin', 'fiesta-latina'] — ambos mapean al mismo canonical.
    // Sin este Set, el entry se insertaría DOS VECES en el mismo bucket → candidatos clonados.
    const seenCanonicalVibes = new Set<string>()

    for (const rawVibe of entry.compatibleVibes) {
      // Normalizar alias legacy → slug canónico del sistema (ej: 'latin' → 'fiesta-latina')
      const vibe = (VIBE_ALIAS_MAP as Record<string, string>)[rawVibe] ?? rawVibe

      // Saltar si ya procesamos este canonical vibe para este entry
      if (seenCanonicalVibes.has(vibe)) continue
      seenCanonicalVibes.add(vibe)

      let bucket = this._byVibe.get(vibe)
      if (!bucket) { bucket = []; this._byVibe.set(vibe, bucket) }
      bucket.push(entry)

      if (entry.simMeta.isDivineCandidate) {
        let dBucket = this._divineByVibe.get(vibe)
        if (!dBucket) { dBucket = []; this._divineByVibe.set(vibe, dBucket) }
        dBucket.push(entry)
      }
      if (entry.simMeta.isHeavyCandidate) {
        let hBucket = this._heavyByVibe.get(vibe)
        if (!hBucket) { hBucket = []; this._heavyByVibe.set(vibe, hBucket) }
        hBucket.push(entry)
      }
    }
  }
```

**Condición forense exacta para entrar en `_divineByVibe`:**  
`entry.simMeta.isDivineCandidate === true` **Y** `entry.compatibleVibes` debe contener (directamente o vía `VIBE_ALIAS_MAP`) el `vibe` consultado.

**Condición forense exacta para entrar en `_heavyByVibe`:**  
`entry.simMeta.isHeavyCandidate === true` **Y** la misma condición de vibe.

---

## 🔍 BÚSQUEDA 2: El Candado Divino

**Archivo:** `electron-app/src/core/intelligence/think/DecisionMaker.ts`
**Pregunta:** Extraer todo el bloque de evaluación `else if (currentZ >= effectiveDivineThreshold)`. Ver exactamente qué condiciones se exigen.

### 2.1 Constante DIVINE_THRESHOLD

```ts
@/electron-app/src/core/intelligence/think/DecisionMaker.ts:65-69
/** 
 * Umbral de Z-Score para DIVINE moment (momento de máximo impacto obligatorio) 
 * 🔬 WAVE 2185: Elevado de 3.5 a 4.0 + dual validation con energía efectiva
 */
export const DIVINE_THRESHOLD = 4.0
```

### 2.2 Bloque de evaluación DIVINE (Prioridad -1)

```ts
@/electron-app/src/core/intelligence/think/DecisionMaker.ts:416-505
  // ═══════════════════════════════════════════════════════════════════════
  // 🌩️ PRIORIDAD -1: DIVINE MOMENT (Z > 4.0 + energy gate)
  // WAVE 1010: Movido desde ContextualEffectSelector - EL GENERAL DECIDE
  // 🔒 WAVE 1177: Skip if dictator is active (prevents log spam)
  // 🔬 WAVE 2185: DUAL VALIDATION — Z alto + energía real alta
  //    En minimal techno, Z puede explotar por micro-variaciones estadísticas
  //    pero la energía real de la pista es baja (0.25-0.45).
  //    DIVINE solo se justifica cuando la pista REALMENTE está ardiendo.
  // ═══════════════════════════════════════════════════════════════════════
  const currentZ = zScore ?? 0

  // ═══════════════════════════════════════════════════════════════════════
  // 🔬 WAVE 2201: DIVINE ENERGY GATE — Hard Techno Minimal Calibration
  // ═══════════════════════════════════════════════════════════════════════
  // PROBLEMA DETECTADO (buildupextrema.md + hard-techno-minimal sessions):
  //   Bombos secos tras silencios largos generan Z-Scores masivos (+7.0σ)
  //   porque la stdDev acumulada es casi cero (silencio → un golpe = Z enorme).
  //   Con DIVINE_ENERGY_GATE = 0.65 estos "falsos positivos estadísticos"
  //   pasaban el gate y disparaban MANDATORY FIRE durante versos y transiciones.
  //   En techno-club la energía media es 0.78 y el pico real empieza en 0.92.
  //   0.65 es prácticamente un valle en ese perfil.
  //
  // SOLUCIÓN (2 tramos):
  //   • energy < 0.85 (zone gentle/active pero no hirviendo):
  //       → FALL THROUGH a prioridades inferiores.
  //       El Z estadístico NO justifica el arsenal divino si la pista no está
  //       en zona Intense/Peak. Las prioridades de drop/buildup/hunt siguen activas.
  //   • 0.85 <= energy (zone intense/peak — la pista REALMENTE está ardiendo):
  //       → DIVINE STRIKE. Aquí sí tiene sentido el arsenal nuclear.
  //
  // CAMBIO vs WAVE 2185:
  //   Antes: energy < 0.65 → return 'strike' (disparo garantizado, solo no-DIVINE)
  //   Ahora: energy < 0.85 → fall through (el contexto musical decide, no forzamos)
  //   El tramo 0.65–0.84 ya NO fuerza ningún strike — deja al resto de prioridades
  //   evaluar si corresponde o no. Más musical, menos mecánico.
  // ═══════════════════════════════════════════════════════════════════════
  const DIVINE_ENERGY_GATE = 0.72  // 🔬 WAVE 2494: 0.85→0.72 — rawEnergy necesita gate más bajo para sincronizar con Z-score
  
  // 🔒 WAVE 1177: Si hay dictador activo, no intentar DIVINE
  // (El efecto activo tiene "la palabra", no le interrumpimos)
  const isTechnoVibe = (pattern.vibeId as string) === 'techno-club' || (pattern.vibeId as string) === 'hard-techno' || (pattern.vibeId as string)?.includes('techno') || false
  const effectiveDivineThreshold = isTechnoVibe ? 2.5 : DIVINE_THRESHOLD

  if (activeDictator) {
    // No loggear nada - silencio total para evitar spam
    // El dictador ya fue anunciado cuando se disparó
  } else if (currentZ >= effectiveDivineThreshold) {
    const zone = energyContext?.zone ?? 'gentle'
    // 🔬 WAVE 2494: Usar absolute (rawEnergy) para eliminar desync temporal con Z-score
    // Z se computa sobre rawEnergy → absolute y Z pican en el MISMO frame
    const effectiveEnergy = energyContext?.absolute ?? 0
    
    // Consciencia energética: NO divine en zonas de silencio
    // (No dispares artillería pesada en un funeral)
    if (zone === 'silence' || zone === 'valley') {
      console.log(`[DecisionMaker 🌩️] DIVINE BLOCKED: Z=${currentZ.toFixed(2)}σ but zone=${zone} (protected)`)
      // Fall through a siguiente prioridad
    } else if (!isAbsoluteGateOpen) {
      if (!energyGateOpen) {
        // 🐘 WAVE 4861: Candado físico — energía real insuficiente vs. histórico 30s
        console.log(
          `[DecisionMaker 🐘] DIVINE BLOCKED (AbsGate): E=${rawEnergy.toFixed(2)} < ` +
          `${absoluteGateThreshold.toFixed(2)} (${(ABSOLUTE_ENERGY_GATE_RATIO * 100).toFixed(0)}% of max=${(maxHistoric ?? 0).toFixed(2)}) → HOLD`
        )
      } else {
        // 🌴 WAVE 4865: Bloqueado por Spectral Gate — candado opera en silencio salvo intención real
        const lowBand = pattern.bassPresenceSustained ?? pattern.bassPresence ?? 0
        const midBand = pattern.midPresence ?? 0
        const kickThreshold = (maxHistoric ?? 0) * 0.75
        const hasHeavyKick = lowBand >= kickThreshold
        console.log(
          `[DecisionMaker 🌴] DIVINE BLOCKED (SpectralGate): ${!hasHeavyKick ? 'Low-Band Insufficient' : 'Vocals Eclipse Beat'} | ` +
          `LOW=${lowBand.toFixed(3)} MID=${midBand.toFixed(3)}`
        )
      }
      // Fall through
    } else if (effectiveEnergy < DIVINE_ENERGY_GATE) {
      // 🔬 WAVE 2201: Z estadísticamente masivo pero energía real insuficiente
      // (bombo seco tras silencio, minimal techno transición, verso de baja energía)
      // → NO forzar ningún strike, dejar que el pipeline musical decida
      console.log(
        `[DecisionMaker 🌩️] DIVINE SUPPRESSED: Z=${currentZ.toFixed(2)}σ but rawEnergy=${effectiveEnergy.toFixed(2)} < ${DIVINE_ENERGY_GATE} ` +
        `(WAVE 2494 raw gate) → falling through to musical context priorities`
      )
      // Fall through — NO return aquí. Hunt/drop/buildup evaluarán el frame.
    } else {
      console.log(`[DecisionMaker 🌩️] DIVINE MOMENT: Z=${currentZ.toFixed(2)}σ energy=${effectiveEnergy.toFixed(2)} zone=${zone} → MANDATORY FIRE`)
      return 'divine_strike'  // 🔪 WAVE 1010: Nuevo tipo
    }
  }
```

**Condiciones exactas para `divine_strike` (TODAS deben cumplirse):**

| # | Condición | Valor / Cálculo |
|---|-----------|-----------------|
| 1 | `activeDictator` | Debe ser `false` |
| 2 | `currentZ >= effectiveDivineThreshold` | `2.5` si `techno-club` (was 4.0) |
| 3 | `zone` | NO puede ser `'silence'` ni `'valley'` |
| 4 | `isAbsoluteGateOpen` | `energyGateOpen && spectralGateOpen` |
| 5 | `effectiveEnergy >= DIVINE_ENERGY_GATE` | `rawEnergy >= 0.72` |

### 2.3 Arsenal DIVINE efectivamente usado

```ts
@/electron-app/src/core/intelligence/think/DecisionMaker.ts:810-864
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
    output.source = 'hunt'
    output.debugInfo.reasoning = `DIVINE SUPPRESSED: empty divine registry for ${vibeId}`
    return output
  }
  
  // ⚡ WAVE 4849: TEXTURE FILTER ELIMINADO
  // ... (comentario preservado)

  // 🎲 WAVE 2494: DIVERSITY FIX v3 — pasar arsenal completo RANKEADO por diversity score
  const rankedArsenal = rankArsenalByDiversity(arsenal)
  const suggestedEffect = rankedArsenal[0] || arsenal[0]
  
  output.debugInfo.reasoning = `🌩️ DIVINE MOMENT: Z=${(zScore ?? 0).toFixed(2)}σ | vibe=${vibeId} | texture=${spectralContext?.texture ?? 'unknown'} | suggested=${suggestedEffect}`
  
  output.effectDecision = {
    effectType: suggestedEffect,
    intensity: 1.0,  // DIVINE = máxima intensidad
    zones: ['all'],  // DIVINE afecta todo
    reason: `🌩️ DIVINE: Z=${(zScore ?? 0).toFixed(2)}σ > ${DIVINE_THRESHOLD} | Ranked: ${rankedArsenal.join(' > ')} | Full arsenal: ${arsenal.join(', ')}`,
    confidence: 0.99,
    divineArsenal: rankedArsenal,
  } as any
  
  // ... (color y physics omitidos por brevedad)
  
  return output
}
```

---

## 🔍 BÚSQUEDA 3: El Anti-Fake-Drop Heavy

**Archivo:** `electron-app/src/core/intelligence/think/DecisionMaker.ts`
**Pregunta:** Extraer la lógica del antiFakeThreshold para techno-club. Ver cómo quedó el parche WAVE 5009.

### 3.1 `isHeavyEffect()` — Cognitive Bridge

```ts
@/electron-app/src/core/intelligence/think/DecisionMaker.ts:95-102
/**
 * ⚡ WAVE 4843: ¿Es este efecto de arsenal pesado ("nuclear")?
 * Lee `isHeavyCandidate` directamente del RegistryEntry.
 * Si el efecto no está en el registry, devuelve false (fail-open = no bloquear).
 */
function isHeavyEffect(effectId: string): boolean {
  return getDynamicEffectRegistry().getEntry(effectId)?.simMeta.isHeavyCandidate ?? false
}
```

### 3.2 Anti-Fake-Drop en DROP PREPARATION (generateDropPreparationDecision)

```ts
@/electron-app/src/core/intelligence/think/DecisionMaker.ts:1080-1134
      // ═══════════════════════════════════════════════════════════════════
      // 🛡️ WAVE 2200.2 + WAVE 4860 + WAVE 5000: ANTI-FAKE-DROP — Z-Score Sanity Check
      // ═══════════════════════════════════════════════════════════════════
      const currentZ = zScore ?? 0
      const isLatinoVibe = vibeId === 'fiesta-latina' || (vibeId as string)?.includes('latina') || false
      const isTechnoVibeForDrop = vibeId === 'techno-club' || (vibeId as string) === 'hard-techno' || (vibeId as string)?.includes('techno') || false
      // 🔪 WAVE 5000: Bajar umbral latino de 1.2 a 0.85
      let antiFakeThreshold = isLatinoVibe ? 0.85 : 0.5
      
      if (isTechnoVibeForDrop) {
        const lowBandDrop = inputs.pattern.bassPresenceSustained ?? inputs.pattern.bassPresence ?? 0
        // Si el bombo revienta los subgraves (>0.65), ignorar el Z-Score plano típico del Minimal.
        antiFakeThreshold = lowBandDrop > 0.65 ? -1.0 : 0.2
        
        // ⏳ WAVE 5009 FIX 2: Bajar los escudos de Minimal Techno si el ADN lo aprobó
        // Si estamos en PUNK o BALANCED y el integrador ya aprobó esto, confiamos
        // El Minimal juega con texturas y subidas sutiles (Z muy plano, usualmente < 0.2)
        if (inputs.dreamIntegration?.approved) {
          const profileName = MoodController.getInstance().getCurrentProfile().name.toUpperCase()
          if (profileName === 'PUNK' || profileName === 'BALANCED') {
             // Reducción drástica del umbral para que el efecto "pesado" pero texturizado de DNA pase
             antiFakeThreshold = -0.2 
          }
        }
      }
      // ⚡ WAVE 4843: COGNITIVE BRIDGE — isHeavyEffect() reemplaza HEAVY_ARSENAL_EFFECTS.has()
      if (isHeavyEffect(suggestedEffect) && currentZ < antiFakeThreshold) {
        // ⏳ WAVE 5009 FIX 1: Restaurar log de Anti-Fake-Drop usando Throttle
        throttledLog('anti_fake_drop', 
          `[DecisionMaker 🛡️] ANTI-FAKE-DROP (${isLatinoVibe ? 'LATINO' : 'STANDARD'}): "${suggestedEffect}" ABORTED — ` +
          `Z=${currentZ.toFixed(2)}σ < ${antiFakeThreshold} (energy insufficient for heavy arsenal)`, 
          1000
        )
        // Sin effectDecision — las physics reactivas manejan la transición suavemente
      } else {
        // 🔒 WAVE 5003: THE DROP LOCK — Anti-Esquizofrenia (MOVIDO AQUÍ)
        if (!acquireDropLock()) {
          console.log(`[DecisionMaker 🔒] DROP LOCKED — effect already fired for this drop section. Suppressing.`)
        } else {
          output.effectDecision = {
            effectType: suggestedEffect,
            intensity: 0.8 + prediction.probability * 0.2,
            zones: ['all'],
            reason: `🔴 DROP: prob=${prediction.probability.toFixed(2)} | winner=${suggestedEffect} | full arsenal=${dropArsenal.join(', ')}`,
            confidence: prediction.probability,
            divineArsenal: [suggestedEffect],
          } as any
          
          console.log(
            `[DecisionMaker 🔴] DROP EFFECT: ${suggestedEffect} | prob=${prediction.probability.toFixed(2)} ` +
            `vibe=${vibeId} | Z=${currentZ.toFixed(2)}`
          )
        }
      }
```

**Valores finales de `antiFakeThreshold` para techno-club:**

| Escenario | `antiFakeThreshold` |
|-----------|---------------------|
| `lowBandDrop > 0.65` (bombo fuerte) | `-1.0` |
| `lowBandDrop <= 0.65` y sin DNA aprobado | `0.2` |
| `dreamIntegration?.approved === true` y perfil `PUNK`/`BALANCED` | `-0.2` |
| Fallback (no techno) | `0.5` |

**Condición de bloqueo exacta:**  
`isHeavyEffect(suggestedEffect) && currentZ < antiFakeThreshold` → ABORT.

---

*Fin del informe forense. Sin interpretación, sin recomendación.*
