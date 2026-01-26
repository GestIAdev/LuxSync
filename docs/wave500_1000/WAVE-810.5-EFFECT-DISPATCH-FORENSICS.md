# 🔬 WAVE 810.5 - EFFECT DISPATCH FORENSICS

**Estado:** ARQUITECTURA ROTA - REQUIRES IMMEDIATE SURGERY  
**Fecha:** 2026-01-19  
**Autor:** PunkOpus + Radwulf  
**Severity:** CRÍTICO - Doble arquitectura de disparo + SolarFlare en limbo

---

## 🚨 EXECUTIVE SUMMARY

**PROBLEMA CRÍTICO DETECTADO:**
Tenemos **DOS CAMINOS DE DISPARO** completamente independientes, causando:
1. SolarFlare atrapado en arquitectura legacy (HuntEngine directo)
2. Otros efectos usando arquitectura moderna (ContextualEffectSelector)
3. Sistema de cooldowns saboteándose entre sí
4. Logs contradictorios: `[SOLAR FLARE] FIRED!` pero `[EffectSelector] all effects in cooldown`

---

## 📊 ARQUITECTURA ACTUAL (DUAL PATH - BROKEN)

```
┌─────────────────────────────────────────────────────────────┐
│                   AUDIO FRAME INPUT                         │
└─────────────┬───────────────────────────────────────────────┘
              │
              v
┌─────────────────────────────────────────────────────────────┐
│         TitanEngine.update()                                │
│         - Audio analysis                                    │
│         - Vibe detection                                    │
└─────────────┬───────────────────────────────────────────────┘
              │
              v
┌─────────────────────────────────────────────────────────────┐
│    SeleneTitanConscious.think()                             │
│    - Sense (Beauty, Consonance)                             │
│    - Think (Hunt, Prediction, Fuzzy)                        │
└─────────────┬───────────────────────────────────────────────┘
              │
              v
    ┌─────────┴─────────┐
    │                   │
    v                   v
┌───────────────┐   ┌────────────────────────────────┐
│ HuntEngine    │   │ DecisionMaker                  │
│ (LEGACY PATH) │   │ (MODERN PATH)                  │
└───────┬───────┘   └──────────┬─────────────────────┘
        │                      │
        │ shouldStrike=true    │ consciousnessOutput
        │                      │
        v                      v
┌───────────────────────────────────────────────────────────┐
│           SeleneTitanConscious Output                     │
│  - huntDecision: { shouldStrike, confidence }             │
│  - consciousnessOutput: { colorDecision, physicsModifier }│
└─────────────┬─────────────────────────────────────────────┘
              │
              v
┌─────────────────────────────────────────────────────────────┐
│         ContextualEffectSelector.select()                   │
│                                                             │
│  ❌ PROBLEMA: Recibe huntDecision pero:                     │
│     1. Solo revisa shouldStrike para bypassing             │
│     2. Luego llama selectEffectForContext() que ignora     │
│        huntDecision y aplica cooldowns                     │
│     3. Si todo en cooldown → devuelve 'none'               │
│     4. HuntEngine dice "FIRE!" pero nada dispara           │
└─────────────┬───────────────────────────────────────────────┘
              │
              v
┌─────────────────────────────────────────────────────────────┐
│              TitanEngine Dispatch                           │
│                                                             │
│  if (effectSelection.effectType) {                          │
│    effectManager.trigger({                                 │
│      effectType: effectSelection.effectType,               │
│      intensity,                                            │
│      source: 'hunt_strike',  // ❌ MENTIRA!                │
│      ...                                                   │
│    })                                                      │
│  }                                                         │
└─────────────┬───────────────────────────────────────────────┘
              │
              v
┌─────────────────────────────────────────────────────────────┐
│              EffectManager.trigger()                        │
│  - Traffic Control check                                   │
│  - Vibe Shield check                                       │
│  - effect.trigger(config)                                  │
│  - emit('effectTriggered', { effectType })                 │
└─────────────┬───────────────────────────────────────────────┘
              │
              v
┌─────────────────────────────────────────────────────────────┐
│     SeleneTitanConscious Event Listener (WAVE 810.5)       │
│  effectManager.on('effectTriggered', (event) => {           │
│    effectSelector.registerEffectFired(event.effectType)    │
│  })                                                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔥 EL CASO DE SOLAR FLARE

### Historia del Efecto Piloto

**SolarFlare** fue el PRIMER efecto implementado (WAVE 600) y tiene una arquitectura especial:

```typescript
// HuntEngine.ts - LÍNEA 349
if (conditions.allMet) {
  transitionTo('striking')
  
  // ❌ SOLO LOG - NO DISPARO REAL
  console.log(`[SOLAR FLARE] 🚀 FIRED! Score: ${conditions.strikeScore.toFixed(2)}`)
  
  return {
    suggestedPhase: 'striking',
    shouldStrike: true,  // ⚠️ FLAG que nadie respeta correctamente
    confidence: conditions.strikeScore,
    ...
  }
}
```

**PROBLEMA:**
1. HuntEngine detecta momento perfecto → `shouldStrike: true`
2. DecisionMaker ve `shouldStrike` y confirma → genera `consciousnessOutput`
3. **PERO** DecisionMaker NO menciona "solar_flare" explícitamente
4. ContextualEffectSelector recibe `huntDecision.shouldStrike: true`
5. **ANTES DE WAVE 810.5:** Selector ignoraba completamente este flag
6. **DESPUÉS DE WAVE 810.5:** Selector hace bypass y devuelve 'solar_flare'
7. **PERO** si todos los efectos están en cooldown, devolvía 'none' antes del bypass

### El Flujo Real de SolarFlare

```
HuntEngine: "¡MOMENTO PERFECTO! shouldStrike=true"
     ↓
DecisionMaker: "Confirmo, genero consciousnessOutput"
     ↓
ContextualEffectSelector: "Veo shouldStrike... pero ¿qué efecto?"
     ↓
❌ ANTES: Ignora shouldStrike → selectEffectForContext() → 'none' (cooldowns)
✅ AHORA (WAVE 810.5): Bypass cooldowns → return 'solar_flare'
```

**INCONSISTENCIA ARQUITECTÓNICA:**
- **SolarFlare:** Decisión en HuntEngine → Flag shouldStrike → Bypass en Selector
- **Otros efectos:** Decisión en ContextualEffectSelector → Reglas por vibe/sección

---

## 🔄 COOLDOWN CHAOS

### Sistema de Cooldowns (Fragmentado)

**3 MECANISMOS DIFERENTES:**

#### 1. EffectManager Cooldowns (Traffic Control)
```typescript
// EffectManager.ts
private checkTraffic(effectType: string): { allowed: boolean, reason: string } {
  // Evita duplicados del mismo tipo
  const hasSameType = Array.from(this.activeEffects.values())
    .some(e => e.type === effectType)
  
  if (hasSameType) {
    return { allowed: false, reason: 'Same type already active' }
  }
  
  // ⚠️ Cooldown NO gestionado aquí
  return { allowed: true, reason: 'Traffic clear' }
}
```

#### 2. ContextualEffectSelector Cooldowns (Per-Effect)
```typescript
// ContextualEffectSelector.ts
private effectTypeCooldowns: Record<string, number> = {
  'solar_flare': 30000,      // 30s base
  'strobe_burst': 8000,      // 8s
  'cyber_dualism': 20000,    // 20s
  'acid_sweep': 15000,       // 15s
  ...
}

private effectTypeLastFired: Map<string, number> = new Map()

private isEffectInCooldown(effectType: string, vibe?: string): boolean {
  const lastFired = this.effectTypeLastFired.get(effectType)
  if (!lastFired) return false
  
  let baseCooldown = this.config.effectTypeCooldowns[effectType] || 5000
  
  // 🔥 WAVE 790.2: Vibe-specific adjustments
  baseCooldown = this.applyVibeCooldownAdjustment(effectType, baseCooldown, vibe)
  
  // 🎭 WAVE 700.1: Mood multipliers
  const effectiveCooldown = this.moodController.applyCooldown(baseCooldown)
  
  return (Date.now() - lastFired) < effectiveCooldown
}
```

**MULTIPLICADORES DE MOOD:**
- **PUNK:** 0.7x (más agresivo)
- **BALANCED:** 1.5x (estándar)
- **CALM:** 3.0x (muy espaciado)

**AJUSTES POR VIBE:**
- **SolarFlare en Techno:** 12s base (PUNK: 8.4s, CALM: 36s)
- **SolarFlare en Fiesta Latina:** 30s base (PUNK: 21s, CALM: 90s)
- **Otros efectos:** Sin ajuste vibe-specific

#### 3. HuntEngine Internal Cooldown (Legacy)
```typescript
// HuntEngine.ts
const DEFAULT_CONFIG: HuntConfig = {
  minStalkingFrames: 10,      // ~167ms @ 60fps
  maxStalkingFrames: 120,     // 2s
  minCooldownFrames: 180,     // 3s después de strike
  maxEvaluatingFrames: 60,    // 1s evaluando
  ...
}

// ⚠️ Cooldown INTERNO del FSM, NO coordinado con ContextualEffectSelector
```

### El Bug del Cooldown Preventivo (FIXED in WAVE 810.5)

**ANTES:**
```typescript
// ContextualEffectSelector.select() - LÍNEA 397 (OLD)
this.registerEffectFired(effectType)  // ❌ Registro ANTES de disparar

// TitanEngine.update() - LÍNEA 560
effectManager.trigger(config)  // Disparo DESPUÉS
```

**CONSECUENCIA:**
1. Selector elige 'solar_flare' → registra cooldown
2. EffectManager.trigger() → Shield lo bloquea
3. **Efecto NO dispara** pero cooldown ya está activo
4. Próximo frame: Todos los efectos en cooldown → 'none'

**DESPUÉS (WAVE 810.5):**
```typescript
// SeleneTitanConscious constructor
effectManager.on('effectTriggered', (event) => {
  this.effectSelector.registerEffectFired(event.effectType)
})
```

**Ahora:** Cooldown se registra solo cuando EffectManager confirma disparo exitoso.

---

## 🎯 ANALYSIS: ¿QUÉ HACE CADA MÓDULO?

### HuntEngine
**ROL DISEÑADO:** Cazador estético - detecta "presas" (momentos bellos/consonantes)  
**ROL ACTUAL:** ~~Detector~~ + ~~Decisor~~ de SolarFlare (SOBREEXTENDIDO)

**FSM:**
```
stalking → evaluating → striking → cooldown → stalking
```

**OUTPUT:**
```typescript
{
  suggestedPhase: 'striking',
  shouldStrike: true,      // ⚠️ Mandato directo
  confidence: 0.73,
  conditions: { beautyMet, consonanceMet, urgencyMet, ... },
  reasoning: "Strike perfecto..."
}
```

**PROBLEMA:** `shouldStrike: true` es una **DECISIÓN EJECUTIVA**, no una recomendación.

---

### DecisionMaker
**ROL DISEÑADO:** Lóbulo frontal - sintetiza Hunt + Prediction + Context  
**ROL ACTUAL:** Validador de HuntEngine + Generador de consciousnessOutput

**CÓDIGO CLAVE:**
```typescript
// DecisionMaker.ts - LÍNEA 142
function determineDecisionType(inputs: DecisionInputs): DecisionType {
  const { huntDecision, prediction, pattern, beauty } = inputs
  
  // ⚠️ Prioridad 1: Strike del hunt engine
  if (huntDecision.shouldStrike && huntDecision.confidence > 0.50) {
    return 'strike'  // → generateStrikeDecision()
  }
  
  // Otras decisiones: prepare_for_drop, buildup_enhance, subtle_shift...
}
```

**GENERA:**
```typescript
{
  colorDecision: { suggestedStrategy, saturationMod, ... },
  physicsModifier: { strobeIntensity, flashIntensity },
  // ❌ NO genera effectDecision explícita para SolarFlare
}
```

**PROBLEMA:** DecisionMaker confirma strike pero **NO** comunica "disparar solar_flare" explícitamente.

---

### ContextualEffectSelector
**ROL DISEÑADO:** DJ inteligente - elige efecto según contexto musical  
**ROL ACTUAL:** DJ + Gatekeeper de SolarFlare + Gestor de cooldowns

**LÓGICA:**
```typescript
// 1. Evaluar si Hunt/Fuzzy dicen disparar
const shouldStrike = this.evaluateHuntFuzzy(input)

// 🔥 WAVE 810.5: Bypass para HuntEngine
if (input.huntDecision?.shouldStrike && shouldStrike.should) {
  return 'solar_flare'  // ⚠️ HARDCODED!
}

// 2. Si no hay override, seleccionar por contexto
const effectType = this.selectEffectForContext(
  sectionType,   // verse, chorus, drop, buildup...
  zLevel,        // normal, elevated, epic, divine
  energyTrend,   // rising, stable, falling
  lastEffectType,
  musicalContext,
  vibe           // techno-club, fiesta-latina
)
```

**PROBLEMA:** Responsabilidades mezcladas:
- Intérprete de `shouldStrike` (debería ser DecisionMaker)
- Selector contextual (correcto)
- Gestor de cooldowns (correcto)

---

### EffectManager
**ROL:** Registry + Factory + Lifecycle + Traffic Control  
**ESTADO:** ✅ CORRECTO (no toca decisiones)

**RESPONSABILIDADES:**
- Instanciar efectos desde factories
- Validar con Vibe Shield
- Traffic Control (evitar duplicados)
- Update effects cada frame
- Combinar outputs (HTP/LTP)
- Emitir eventos ('effectTriggered', 'effectBlocked')

---

## 💊 PRESCRIPTION: ARQUITECTURA UNIFICADA

### Principio UNIX: "Do One Thing Well"

```
┌─────────────────────────────────────────────────────────────┐
│                    UNIFIED DISPATCH FLOW                    │
└─────────────────────────────────────────────────────────────┘

SENSE (Detección)
  ↓
  HuntEngine        → Detecta "momento digno de strike"
  BeautySensor      → Analiza armonía visual
  ConsonanceSensor  → Analiza coherencia musical
  PredictionEngine  → Anticipa cambios

THINK (Decisión)
  ↓
  DecisionMaker     → **ÚNICA FUENTE DE VERDAD**
                      Decide: ¿Qué efecto? ¿Cuándo? ¿Intensidad?
                      
                      Output:
                      - effectDecision: { 
                          effectType: 'solar_flare' | 'cyber_dualism' | ...,
                          intensity: 0.0-1.0,
                          reason: string
                        }
                      - colorDecision: { ... }
                      - physicsModifier: { ... }

SELECT (Validación)
  ↓
  ContextualEffectSelector → **SOLO** valida disponibilidad
                             - ¿En cooldown?
                             - ¿Bloqueado por Mood?
                             - ¿Permitido por Vibe Shield?
                             
                             NO decide qué efecto, solo filtra.

ACT (Ejecución)
  ↓
  EffectManager     → Dispara el efecto validado
                      - Traffic Control
                      - Vibe Shield
                      - Lifecycle management
                      - emit('effectTriggered')
```

---

## 🔧 REFACTOR PLAN

### FASE 1: DecisionMaker Owns Effect Decisions

**CAMBIO:**
```typescript
// DecisionMaker.ts
function generateStrikeDecision(...): ConsciousnessOutput {
  // ...
  
  // ✅ NUEVO: Decisión explícita de efecto
  output.effectDecision = {
    effectType: 'solar_flare',  // Explícito
    intensity: Math.max(0.85, huntDecision.confidence),
    zones: ['all'],
    reason: `Hunt strike: ${huntDecision.reasoning}`,
    confidence: confidence,
  }
  
  return output
}
```

**OTRAS FUNCIONES:**
- `generateBuildupEnhanceDecision()` → 'tidal_wave', 'acid_sweep'
- `generateDropPreparationDecision()` → 'industrial_strobe'
- `generateSubtleShiftDecision()` → 'cyber_dualism', 'tropical_pulse'

---

### FASE 2: ContextualEffectSelector Becomes Filter

**RENAME:** `ContextualEffectSelector` → `EffectAvailabilityFilter`

**NUEVO ROL:**
```typescript
class EffectAvailabilityFilter {
  /**
   * Valida si un efecto está disponible para disparar
   * 
   * @param effectType - Efecto solicitado por DecisionMaker
   * @param context - Contexto musical
   * @returns { available: boolean, reason: string }
   */
  isAvailable(
    effectType: string, 
    context: MusicalContext
  ): { available: boolean; reason: string } {
    
    // 1. ¿Bloqueado por Mood?
    if (this.moodController.isEffectBlocked(effectType)) {
      return { 
        available: false, 
        reason: `Blocked by ${this.moodController.getCurrentMood()} mood` 
      }
    }
    
    // 2. ¿En cooldown?
    if (this.isEffectInCooldown(effectType, context.vibeId)) {
      const remaining = this.getCooldownRemaining(effectType, context.vibeId)
      return { 
        available: false, 
        reason: `Cooldown: ${(remaining/1000).toFixed(1)}s remaining` 
      }
    }
    
    // 3. ¿Force unlock por Mood?
    if (this.moodController.isEffectForceUnlocked(effectType)) {
      return { 
        available: true, 
        reason: 'Force unlocked by mood' 
      }
    }
    
    return { available: true, reason: 'Available' }
  }
}
```

**USO:**
```typescript
// SeleneTitanConscious.think()
const consciousnessOutput = makeDecision(inputs)

if (consciousnessOutput.effectDecision) {
  const availability = this.effectFilter.isAvailable(
    consciousnessOutput.effectDecision.effectType,
    musicalContext
  )
  
  if (availability.available) {
    // OK, pasar al TitanEngine
    output.effectDecision = consciousnessOutput.effectDecision
  } else {
    // Bloqueado, omitir
    console.log(`[Effect Filter ⛔] ${consciousnessOutput.effectDecision.effectType} blocked: ${availability.reason}`)
    output.effectDecision = undefined
  }
}
```

---

### FASE 3: Remove Legacy shouldStrike Flag

**ELIMINAR:**
```typescript
// HuntEngine.ts - Output
{
  shouldStrike: boolean,  // ❌ DELETE
}
```

**NUEVO OUTPUT:**
```typescript
{
  phase: 'striking' | 'stalking' | 'evaluating' | 'cooldown',
  worthiness: number,     // 0-1, qué tan "valioso" es este momento
  candidate: HuntCandidate | null,
  conditions: StrikeConditions,
  reasoning: string
}
```

**DecisionMaker usa:**
```typescript
// Si worthiness > threshold y condiciones cumplen → solar_flare
if (huntDecision.worthiness > 0.70 && huntDecision.conditions.allMet) {
  output.effectDecision = {
    effectType: 'solar_flare',
    intensity: huntDecision.worthiness,
    ...
  }
}
```

---

### FASE 4: Unified Cooldown Management

**UN SOLO LUGAR:** `EffectAvailabilityFilter`

**CONFIGURACIÓN:**
```typescript
const EFFECT_COOLDOWNS: Record<string, EffectCooldownConfig> = {
  'solar_flare': {
    base: 30000,  // 30s
    vibeAdjustments: {
      'techno-club': 0.4,      // 12s en Techno
      'fiesta-latina': 1.0,    // 30s en Fiesta
    },
    moodMultipliers: {
      'punk': 0.7,    // Más agresivo
      'balanced': 1.5,
      'calm': 3.0,    // Muy espaciado
    },
  },
  'cyber_dualism': {
    base: 20000,  // 20s
    vibeAdjustments: {
      'techno-club': 1.0,  // Sin ajuste
    },
    moodMultipliers: { ... },
  },
  // ...
}
```

**CÁLCULO:**
```typescript
effectiveCooldown = base 
  * vibeAdjustments[vibe] 
  * moodMultipliers[mood]
```

---

## 📋 MIGRATION CHECKLIST

### Pre-Migration
- [ ] Backup de HuntEngine.ts, DecisionMaker.ts, ContextualEffectSelector.ts
- [ ] Documentar todos los efectos y sus cooldowns actuales
- [ ] Test coverage: capturar comportamiento actual como baseline

### Phase 1: DecisionMaker Effect Decisions
- [ ] Añadir `effectDecision` a `generateStrikeDecision()`
- [ ] Implementar lógica de selección contextual en DecisionMaker
- [ ] Migrar reglas de vibe/sección desde ContextualEffectSelector
- [ ] Tests: DecisionMaker genera effectType correcto

### Phase 2: Rename & Simplify Selector
- [ ] Rename `ContextualEffectSelector` → `EffectAvailabilityFilter`
- [ ] Eliminar `selectEffectForContext()` method
- [ ] Implementar `isAvailable(effectType, context)` method
- [ ] Migrar cooldown logic (mantener intacto)
- [ ] Tests: Filter permite/bloquea correctamente

### Phase 3: Remove shouldStrike Flag
- [ ] Cambiar HuntDecision output (eliminar shouldStrike)
- [ ] Actualizar DecisionMaker para usar worthiness
- [ ] Eliminar bypass en EffectAvailabilityFilter
- [ ] Tests: HuntEngine + DecisionMaker sin shouldStrike

### Phase 4: Unified Cooldowns
- [ ] Centralizar config en EffectAvailabilityFilter
- [ ] Eliminar cooldown interno de HuntEngine FSM
- [ ] Event-based registration mantener (WAVE 810.5)
- [ ] Tests: Cooldowns funcionan igual pre/post refactor

### Validation
- [ ] Smoke test: 10 min de Techno sin freezes
- [ ] Smoke test: 10 min de Fiesta Latina
- [ ] Logs coherentes: `[DecisionMaker]` decide, `[Filter]` valida, `[EffectManager]` dispara
- [ ] Cooldowns específicos por vibe funcionan
- [ ] SolarFlare dispara correctamente
- [ ] Otros efectos (CyberDualism, AcidSweep) no bloqueados

---

## 🎯 SUCCESS CRITERIA

### Arquitectura
- ✅ **UN SOLO CAMINO** de disparo de efectos
- ✅ Separación clara: Detect → Decide → Validate → Execute
- ✅ SolarFlare tratado igual que otros efectos
- ✅ HuntEngine es sensor, NO decisor

### Logs Coherentes
```
[HuntEngine 🐆] Worthy moment detected: worthiness=0.78
[DecisionMaker 🎯] STRIKE decision: solar_flare (intensity=0.85)
[EffectFilter ✅] solar_flare available (cooldown cleared)
[EffectManager 🧨] solar_flare triggered (intensity=0.85)
[EffectFilter 🔥] Cooldown registered: solar_flare
```

### Performance
- ❌ NO más: `all effects in cooldown` durante minutos
- ✅ Efectos disparan cada 15-30s dependiendo de mood/vibe
- ✅ CyberDualism independiente de SolarFlare cooldown
- ✅ Mood PUNK más agresivo que CALM (verificable en logs)

---

## 📊 CURRENT ISSUES SUMMARY

| Issue | Severity | Impact | Caused By |
|-------|----------|--------|-----------|
| Dual dispatch paths | 🔴 CRITICAL | SolarFlare en limbo | HuntEngine legacy |
| Cooldown sabotaje | 🔴 CRITICAL | All effects blocked | Preventive registration |
| shouldStrike ignored | 🟡 HIGH | Hunt decisions lost | Selector logic bug |
| Cooldown fragmentation | 🟡 HIGH | Inconsistent timing | 3 different systems |
| Vibe cooldowns incomplete | 🟢 MEDIUM | Only SolarFlare adjusted | Partial implementation |
| Decision responsibility unclear | 🟢 MEDIUM | Architecture confusion | Module overload |

---

## 🔮 POST-REFACTOR VISION

```typescript
// Flujo limpio y unificado
const sensorData = sense(pattern, state)           // HuntEngine, Beauty, Consonance
const decision = decide(sensorData, context)       // DecisionMaker (ÚNICO DECISOR)
const validated = filter(decision, context)        // EffectAvailabilityFilter
const executed = execute(validated)                // EffectManager

// Cada módulo hace UNA cosa bien
// Sin bypasses, sin hacks, sin flags mágicos
```

---

## 📝 NOTES FOR ARCHITECT

1. **SolarFlare es especial solo históricamente**, no debe tener tratamiento especial en código
2. **HuntEngine** debe ser puramente analítico (como BeautySensor)
3. **DecisionMaker** es el cerebro ejecutivo - TODAS las decisiones de efectos van ahí
4. **Cooldowns** deben ser completamente independientes entre efectos
5. **Vibe-specific cooldowns** deben aplicarse a TODOS los efectos, no solo SolarFlare
6. Considerar: ¿Necesitamos FSM en HuntEngine o es over-engineering?

---

**FIN DEL REPORTE**  
**Acción Inmediata:** PAUSAR desarrollo de nuevos efectos hasta refactor completo  
**Prioridad:** Cirugía arquitectónica antes de añadir más features
