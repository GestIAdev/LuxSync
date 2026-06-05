# WAVE 5013-ALPHA (THE TEMPORAL PARADOX)

**Auditoría Forense: Cassandra ignora arsenal pesado/divino — evalúa condiciones del presente para eventos futuros**
**Fecha:** 2026-06-04  
**Solicitante:** Arquitecto  
**Auditor:** Kimi  
**Mandato:** EXTRAER únicamente los fragmentos exactos. Sin resúmenes, sin interpretación.

---

## 🔍 BÚSQUEDA 1: Evaluación de Z-Guards en la Simulación

**Archivo:** `electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts`
**Pregunta:** ¿Se está usando el `currentZ` de la pista en el momento del buildup para descartar candidatos? ¿Existe alguna excepción si la simulación es un evento predictivo (`timeToEvent > 0`)?

### 1.1 Aplicación de Z-Guards en `generateCandidates()` (líneas 690-736)

```ts
@/electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts:690-736
      // ═══════════════════════════════════════════════════════════════════════════
      // ⚡ WAVE 4843: COGNITIVE BRIDGE — STROBE Z-GUARD + ZSCORE GUARDS
      // ═══════════════════════════════════════════════════════════════════════════
      // WAVE 1179/1180 usaban una lista hardcodeada STROBE_EFFECTS y un nombre
      // hardcodeado ('gatling_raid'). Ambos destruidos en WAVE 4843.
      //
      // NUEVO COMPORTAMIENTO (lee directamente del .lfx):
      //   1. Si entry.simMeta.isStrobe === true y zScore <= 0 → skip
      //      (los efectos strobe se auto-declaran strobe en su JSON)
      //
      //   2. Si entry.simMeta.zScoreGuards.minimumZ existe y zScore < minimumZ → skip
      //      (cualquier efecto puede declarar su guard mínimo de Z-Score)
      //
      //   3. Si entry.simMeta.zScoreGuards.minimumEnergy existe y energy < minimumEnergy → skip
      //      (idem para energía)
      //
      // Esto convierte los guards en metadatos del efecto, no del motor.
      // ═══════════════════════════════════════════════════════════════════════════
      const registry = getDynamicEffectRegistry()
      const entry = registry.getEntry(effect)
      if (entry) {
        const { isStrobe, zScoreGuards } = entry.simMeta
        const { energy } = context

        // Guard 1: Strobe en energía descendente
        if (isStrobe && zScore <= 0) {
          continue
        }

        // Guard 2: minimumZ declarado en el .lfx
        if (zScoreGuards.minimumZ !== null && zScore < zScoreGuards.minimumZ) {
          continue
        }

        // Guard 3: minimumEnergy declarado en el .lfx
        if (zScoreGuards.minimumEnergy !== null && energy < zScoreGuards.minimumEnergy) {
          continue
        }

        // Guard 4: Hardware Compatibility — fixtureTargeting vs active manifest
        // ⚡ WAVE 4846: Si el .lfx exige un hardware específico (movers, strobes, pars…)
        // que no está presente en el rig actual, el candidato se descarta aquí.
        // 'all' = universal, siempre pasa. Fail-open: targeting desconocido → no bloquea.
        if (!this._isTargetingAvailable(entry.execHints.fixtureTargeting, activeZoneSet)) {
          continue
        }
      }
```

**Fuente de `zScore` y `energy`:**

```ts
@/electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts:637-638
    // 🛡️ WAVE 1178: ZONE PROTECTION - Obtener Z-Score para protección de valles
    const zScore = context.zScore ?? 0
```

```ts
@/electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts:711-712
      if (entry) {
        const { isStrobe, zScoreGuards } = entry.simMeta
        const { energy } = context
```

**NO hay referencia a `prediction.timeToEventMs` ni a `prediction.predictedEnergy` en el bloque de guards.** Los guards consumen `context.zScore` y `context.energy`, que son los valores actuales del frame (pasados desde `SeleneTitanConscious`).

### 1.2 Minimal Rescue (bypass parcial tras bloqueo total)

```ts
@/electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts:774-806
    // ⏳ WAVE 5009 FIX 4: THE MINIMAL RESCUE
    // Si todos los efectos fueron bloqueados por guards (como pasa en Techno Minimal
    // donde Z-Score es muy bajo < 1.0 pero la zona es Peak/Intense).
    if (candidates.length === 0 && zoneFilteredEffects.length > 0) {
      console.log(`[DREAM_SIMULATOR] ⚠️ All effects blocked by Z-guards! (Z=${zScore.toFixed(2)}). Attempting Minimal Rescue...`)
      
      const registry = getDynamicEffectRegistry()
      for (const effect of zoneFilteredEffects) {
        if (moodController.isEffectBlocked(effect)) continue
        const entry = registry.getEntry(effect)
        if (!entry) continue
        
        if (!this._isTargetingAvailable(entry.execHints.fixtureTargeting, activeZoneSet)) continue
        
        // Mantenemos strobe block si Z <= 0, pero ignoramos minimumZ y minimumEnergy
        if (entry.simMeta.isStrobe && zScore <= 0) continue
        
        const intensity = this.calculateIntensity(prediction.predictedEnergy, effect)
        const isSuggestedByOracle = prediction.suggestedEffects?.some(
          suggested => effect.includes(suggested) || suggested.includes(effect)
        ) ?? false
        
        const finalConfidence = Math.min(1, prediction.confidence * 0.9 + (isSuggestedByOracle ? 0.08 : 0))
        
        candidates.push({
          effect,
          intensity,
          zones: ['all'],
          reasoning: `⚠️ MINIMAL RESCUE (Guards bypassed) | vibe=${state.vibe}`,
          confidence: finalConfidence
        })
      }
    }
```

**Observación forense:** El Minimal Rescue ignora `minimumZ` y `minimumEnergy`, pero **mantiene el strobe guard** (`isStrobe && zScore <= 0`). Sigue sin usar energía/Z predicha del evento futuro.

### 1.3 Z-Guards declarados en efectos pesados relevantes

| Efecto | `isStrobe` | `minimumZ` | `minimumEnergy` | `isHeavy` | `isDivine` |
|--------|-----------|-----------|-----------------|-----------|------------|
| `gatling_raid` | `true` | `2.0` | `0.7` | `true` | `true` (recién cambiado) |
| `core_meltdown` | `true` | `2.0` | `0.7` | `true` | `true` |
| `seismic_snap` | `true` | `2.0` | `null` | `true` | `false` |
| `abyssal_rise` | `true` | `1.0` | `0.6` | `true` | `false` |
| `void_mist` | `false` | `null` | `null` | `false` | `false` |

---

## 🔍 BÚSQUEDA 2: Exclusión de Secciones

**Archivo:** `electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts`
**Pregunta:** ¿Existe un filtro de tipo `isEffectAllowedInSection` dentro de `generateCandidates()` o `simulateScenario()`?

### 2.1 Resultado de la búsqueda

**NO EXISTE.** Ni `generateCandidates` ni `simulateScenario` contienen ninguna llamada a `isEffectAllowedInSection`, ni ningún filtro por `section`, `validSections`, o derivación de sección musical dentro del simulador.

**El único lugar donde existe `isEffectAllowedInSection` es `DecisionMaker.ts`:**

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

```ts
@/electron-app/src/core/intelligence/think/DecisionMaker.ts:80-94
function isEffectAllowedInSection(effectId: string, section: string): boolean {
  const entry = getDynamicEffectRegistry().getEntry(effectId)
  if (!entry || entry.validSections.length === 0) return true
  return entry.validSections.includes(section)
}
```

**Observación forense:** Cassandra (`EffectDreamSimulator`) no sabe de secciones. El filtro de sección se aplica **más tarde**, en `DecisionMaker.ts`, cuando el efecto ya ha sido pre-seleccionado por el simulador. El `.lfx` declara `validSections` (ej. `gatling_raid`: `["drop","peak"]`), pero esto no afecta la generación de candidatos del simulador.

---

## 🔍 BÚSQUEDA 3: Efectos Soft Desaparecidos y Causas del Ghost Arsenal

**Archivo:** `electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts`
**Pregunta:** ¿Por qué solo aparecen `void_mist` y `abyssal_rise`? ¿Qué está bloqueando los demás efectos ambientales y pesados?

### 3.1 Causa Raíz A: `filterByZone` evalúa energía ACTUAL, no predicha

```ts
@/electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts:535-572
  private filterByZone(effects: string[], zone: string): string[] {
    // 🎚️ WAVE 996: THE LADDER OVERRIDES - Rangos ampliados para no competir con ContextualEffectSelector
    // THE LADDER ya hace la clasificación correcta en ContextualEffectSelector.
    // Aquí solo filtramos extremos obvios (no poner strobe pesado en silence).
    const aggressionLimits: Record<string, { min: number; max: number }> = {
      'silence': { min: 0, max: 0.30 },    // Solo efectos muy suaves
      'valley':  { min: 0, max: 0.50 },    // Suaves + algo de respiración
      'ambient': { min: 0, max: 0.70 },    // Moderados (ampliar para digital_rain + acid_sweep)
      'gentle':  { min: 0, max: 0.85 },    // Transición amplia (incluir ambient_strobe, binary_glitch)
      'active':  { min: 0.40, max: 0.80 }, // 🔬 WAVE 5003: Separar soft de hard
      'intense': { min: 0.60, max: 1.00 }, // 🔬 WAVE 5003: Solo hard, medios a active
      'peak':    { min: 0.70, max: 1.00 }, // Solo los más brutales (gatling, core_meltdown, industrial)
    }
    
    const limits = aggressionLimits[zone] || { min: 0, max: 1 }
    
    const registry = getDynamicEffectRegistry()
    const filtered = effects.filter(effect => {
      const entry = registry.getEntry(effect)
      if (!entry) {
        console.warn(`[DREAM_SIMULATOR] ⚠️ No Registry entry for effect: ${effect}`)
        return false
      }
      return entry.dna.aggression >= limits.min && entry.dna.aggression <= limits.max
    })
```

**La `zone` proviene de `context.energy` actual (línea 643):**

```ts
@/electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts:643-653
    const energyZone = context.energyZone ?? this.deriveEnergyZone(context.energy)
    
    if ((energyZone === 'valley' || energyZone === 'silence') && zScore < 0) {
      // 🧹 WAVE 1178.1: Log SILENCIADO - spam innecesario
      // console.log(`[DREAM_SIMULATOR] 🛡️ VALLEY PROTECTION: zone=${energyZone} Z=${zScore.toFixed(2)} → NO CANDIDATES`)
      return [] // No generar candidatos - la música está muriendo
    }
    
    const zoneSource = context.energyZone ? 'SeleneTitanConscious' : 'local-fallback'
    
    const zoneFilteredEffects = this.filterByZone(vibeAllowedEffects, energyZone)
```

**Consecuencia:** Si Cassandra predice un drop en 4 segundos pero la energía actual está en `active` (E ≈ 0.55–0.70), `filterByZone` aplica `active: {min: 0.40, max: 0.80}`. Los efectos con `aggression > 0.80` son descartados **antes** de que los Z-Guards sean evaluados:

| Efecto | `dna.aggression` | ¿Pasa `active` (max 0.80)? | ¿Pasa `intense` (max 1.00)? |
|--------|------------------|---------------------------|----------------------------|
| `core_meltdown` | `1.00` | ❌ NO | ✅ SÍ |
| `gatling_raid` | `0.93` | ❌ NO | ✅ SÍ |
| `seismic_snap` | `0.87` | ❌ NO | ✅ SÍ |
| `industrial_strobe` | ~0.90+ | ❌ NO | ✅ SÍ |
| `abyssal_rise` | `0.70` | ✅ SÍ | ✅ SÍ |
| `void_mist` | `0.60` | ✅ SÍ | ✅ SÍ |
| `deep_breath` | `0.40` | ✅ SÍ (límite) | ❌ NO |

### 3.2 Causa Raíz B: `calculateVibeCoherence` hardcodea `TECHNO_FAMILY` con lista incompleta

```ts
@/electron-app/src/core/intelligence/dream/EffectDreamSimulator.ts:1140-1159
    // TECHNO: Todos los efectos techno registrados son igualmente de casa
    if (context.vibe.includes('techno')) {
      const TECHNO_FAMILY = [
        'industrial_strobe', 'gatling_raid', 'core_meltdown',
        'sky_saw', 'abyssal_rise',
        'cyber_dualism', 'seismic_snap',
        'ambient_strobe', 'binary_glitch',
        'acid_sweep', 'digital_rain',
        'void_mist', 'fiber_optics',
        'deep_breath', 'sonar_ping'
      ]
      if (TECHNO_FAMILY.includes(effect.effect)) {
        return 0.85  // Todos son familia — nadie es más techno que otro
      }
      // Herejía inter-género
      if (['solar_flare', 'tropical_pulse', 'salsa_fire', 'corazon_latino'].includes(effect.effect)) {
        return 0.0
      }
      return 0.4  // Desconocido
    }
```

**Efectos existentes en disco (23 archivos `.lfx`) que NO están en `TECHNO_FAMILY`:**

- `cascade_strike`
- `ghost_chase`
- `lateral_frag`
- `machine_gun`
- `neon_blinder`
- `red_surge`
- `static_pulse`
- `strobe_burst`
- `strobe_storm`
- `void_collapse`
- `wraht_of_the_titans`

**Efectos en `TECHNO_FAMILY` que NO existen en disco (fantasmas):**

- `fiber_optics`
- `sonar_ping`

**Puntaje de coherencia:**
- En familia: `0.85`
- Desconocido: `0.4`
- Penalización en scoring: `scenario.vibeCoherence * 0.15` → efectos fuera de la lista reciben `+0.06` vs `+0.1275`.

### 3.3 Causa Raíz C: Efectos fantasmas en `TECHNO_FAMILY`

Los efectos `fiber_optics` y `sonar_ping` están hardcodeados en `calculateVibeCoherence` pero **no tienen archivo `.lfx`** en `builtins/techno/`. Si el `DynamicEffectRegistry` los indexa (por ejemplo, desde otra ruta de carga), recibirían `0.85`; si no están registrados, `calculateVibeCoherence` devuelve `0.4`.

---

## 📊 DIAGRAMA DE FILTRADO (Secuencia exacta en `generateCandidates`)

1. `getVibeAllowedEffects(state.vibe)` → Filtra por `compatibleVibes` (alias `techno` → `techno-club`)
2. `filterByZone(vibeAllowedEffects, energyZone)` → Filtra por `dna.aggression` vs **energía ACTUAL**
3. Loop por `zoneFilteredEffects`:
   - `moodController.isEffectBlocked(effect)` → Mood block
   - `isStrobe && zScore <= 0` → Strobe guard (Z actual)
   - `minimumZ !== null && zScore < minimumZ` → Z-Guard (Z actual)
   - `minimumEnergy !== null && energy < minimumEnergy` → Energy guard (E actual)
   - `_isTargetingAvailable(...)` → Hardware guard
4. Si `candidates.length === 0` → Minimal Rescue (repite paso 3 omitiendo Z/energy guards, pero mantiene strobe guard)
5. `rankScenarios()` → `calculateScenarioScore()` aplica `vibeCoherence` (lista hardcodeada `TECHNO_FAMILY`)

**En ningún punto se usa `prediction.predictedEnergy` o `prediction.timeToEventMs` para relajar filtros de zona o Z-Score.**

---

*Fin del informe forense. Sin interpretación, sin recomendación.*
