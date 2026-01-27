# 🔪 WAVE 1010: LOBOTOMÍA DEL LÓBULO FRONTAL
## Blueprint de Unificación Cerebral de Selene

**Fecha:** 27 Enero 2026  
**Autor:** PunkOpus & Radwulf  
**Severidad:** 🔴 CIRUGÍA MAYOR  
**Status:** BLUEPRINT PARA REVISIÓN

---

## 📋 RESUMEN EJECUTIVO

Selene tiene **DOS CEREBROS** que creen ser el jefe. Esto causa:
- Redundancia de decisiones (doble evaluación)
- Posible esquizofrenia de disparo
- Confusión sobre quién tiene la última palabra
- Mantenimiento infernal (dos módulos con lógica similar)

**Diagnóstico:** Fusionar lógica, demotear al viejo jefe.

---

## 🔬 RESONANCIA MAGNÉTICA: ESTADO ACTUAL

### 🧠 Paciente A: `DecisionMaker.ts` (513 líneas)
**Ubicación:** `src/core/intelligence/think/DecisionMaker.ts`  
**Nacimiento:** WAVE 500 (Project Genesis Phase 3)  
**Evolución:** WAVE 972.2 (DNA Brain Integration), WAVE 975 (Silence Rule)

#### Responsabilidades Actuales:
```
┌─────────────────────────────────────────────────────────────┐
│  DECISION MAKER - "El General"                              │
├─────────────────────────────────────────────────────────────┤
│  ✅ Recibe: Pattern, Beauty, Consonance, Hunt, Prediction   │
│  ✅ Recibe: DreamIntegration (DNA Brain)                    │
│  ✅ Calcula: combinedConfidence (ponderación de fuentes)    │
│  ✅ Decide: DecisionType (strike, hold, prepare_for_drop)   │
│  ✅ Genera: effectDecision (tipo, intensidad, zonas)        │
│  ✅ Aplica: SILENCE RULE (si DNA no propone → silencio)     │
│  ✅ Emite: ConsciousnessOutput completo                     │
├─────────────────────────────────────────────────────────────┤
│  ⚠️ NO TIENE: Cooldowns                                     │
│  ⚠️ NO TIENE: Vibe Shield (arsenal por vibe)                │
│  ⚠️ NO TIENE: Energy Zone consciousness                     │
│  ⚠️ NO TIENE: Shadowban diversity                           │
└─────────────────────────────────────────────────────────────┘
```

#### Funciones Críticas:
| Función | Líneas | ¿PRESERVAR? | Notas |
|---------|--------|-------------|-------|
| `makeDecision()` | 107-145 | ✅ SÍ | Punto de entrada principal |
| `determineDecisionType()` | 165-208 | ✅ SÍ | DNA First, luego worthiness |
| `calculateCombinedConfidence()` | 212-238 | ✅ SÍ | Ponderación única |
| `generateStrikeDecision()` | 247-313 | ✅ SÍ | DNA o SILENCE |
| `generateDropPreparationDecision()` | 315-340 | ✅ SÍ | Pre-drop logic |
| `generateBuildupEnhanceDecision()` | 342-370 | ✅ SÍ | Tensión gradual |
| `generateSubtleShiftDecision()` | 400-430 | ✅ SÍ | Beauty-based |

---

### 🧠 Paciente B: `ContextualEffectSelector.ts` (1576 líneas)
**Ubicación:** `src/core/effects/ContextualEffectSelector.ts`  
**Nacimiento:** WAVE 685 (Contextual Intelligence)  
**Evolución:** WAVE 691-996 (múltiples expansiones de arsenal)

#### Responsabilidades Actuales:
```
┌─────────────────────────────────────────────────────────────┐
│  CONTEXTUAL EFFECT SELECTOR - "El Viejo Jefe"               │
├─────────────────────────────────────────────────────────────┤
│  ✅ TIENE: EFFECT_COOLDOWNS (The Timekeeper)                │
│  ✅ TIENE: EFFECTS_BY_VIBE (Vibe Arsenal Shield)            │
│  ✅ TIENE: EFFECTS_BY_INTENSITY (Zone Ladder)               │
│  ✅ TIENE: checkAvailability() (The Gatekeeper)             │
│  ✅ TIENE: registerEffectFired() (DNA Diversity tracker)    │
│  ✅ TIENE: isEffectInCooldown() (con mood multiplier)       │
│  ✅ TIENE: selectEffectForContext() (Vibe-specific logic)   │
│  ✅ TIENE: divineDecision() (Z>3.5 mandatory fire)          │
├─────────────────────────────────────────────────────────────┤
│  ⚠️ REDUNDANTE: evaluateHuntFuzzy() ← YA LO HACE Hunt      │
│  ⚠️ REDUNDANTE: classifyZScore() ← Duplica consciencia     │
│  ⚠️ PROBLEMA: select() VUELVE a decidir si disparar        │
│  ⚠️ PROBLEMA: divineDecision() override del General        │
└─────────────────────────────────────────────────────────────┘
```

#### Funciones Críticas:
| Función | Líneas | ¿PRESERVAR? | Notas |
|---------|--------|-------------|-------|
| `EFFECT_COOLDOWNS` | 151-192 | ✅ SÍ | THE TIMEKEEPER - SAGRADO |
| `EFFECTS_BY_VIBE` | 708-765 | ✅ SÍ | VIBE SHIELD - SAGRADO |
| `checkAvailability()` | 320-357 | ✅ SÍ | THE GATEKEEPER - SAGRADO |
| `isAvailable()` | 360-362 | ✅ SÍ | Shorthand útil |
| `registerEffectFired()` | 294-300 | ✅ SÍ | DNA Diversity |
| `isEffectInCooldown()` | 371-394 | ✅ SÍ | Core cooldown logic |
| `applyVibeCooldownAdjustment()` | 409-425 | ✅ SÍ | Vibe-specific cooldowns |
| `getEffectsAllowedForZone()` | 771-845 | ✅ SÍ | Zone ladder |
| `selectEffectForContext()` | 970-1398 | ⚠️ REFACTOR | Demasiado grande, dividir |
| `evaluateHuntFuzzy()` | 867-935 | 🔴 ELIMINAR | REDUNDANTE |
| `classifyZScore()` | 651-705 | 🔴 ELIMINAR | DUPLICADO |
| `select()` | 456-650 | 🔴 CIRUGÍA | Quitar decisión, dejar selección |
| `divineDecision()` | 1518-1530 | 🔴 MOVER | A DecisionMaker |

---

## 🎯 DIAGNÓSTICO: EL PROBLEMA DE LA DOBLE CABEZA

### Flujo Actual (ESQUIZOFRÉNICO):
```
                    ┌─────────────────┐
                    │ SeleneTitanCons │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
   ┌────────┐         ┌────────────┐        ┌────────────┐
   │ Hunt   │         │ Prediction │        │ DNA Brain  │
   │ Engine │         │   Engine   │        │ Simulator  │
   └───┬────┘         └─────┬──────┘        └──────┬─────┘
       │                    │                      │
       └────────────────────┼──────────────────────┘
                            │
                            ▼
                  ┌──────────────────┐
                  │ DECISION MAKER   │  ← "¡DISPARA!"
                  │ (El General)     │
                  └────────┬─────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │ CONTEXTUAL SELECTOR    │  ← "Espera, déjame pensarlo..."
              │ (El Viejo Jefe)        │     - evaluateHuntFuzzy()
              │                        │     - classifyZScore()
              │ "¿Es DIVINE? ¿Es EPIC?"│     - divineDecision()
              │ "¿Paso el Z-Score?"    │     - select() DECISIÓN PROPIA
              └────────────┬───────────┘
                           │
                           ▼
                  [EFECTO FINAL]
```

### Problema Específico:
1. **DecisionMaker** dice: "DNA aprobó `glitch_guaguanco`, ¡DISPARA!"
2. **ContextualSelector** recibe y dice: "Hmm, pero mi `evaluateHuntFuzzy()` dice que no..."
3. **Resultado:** El efecto aprobado por DNA puede ser bloqueado por lógica redundante

---

## 💉 PLAN DE CIRUGÍA: WAVE 1010

### Arquitectura Objetivo (UN SOLO CEREBRO):
```
                    ┌─────────────────┐
                    │ SeleneTitanCons │
                    └────────┬────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
        ▼                    ▼                    ▼
   ┌────────┐         ┌────────────┐        ┌────────────┐
   │ Hunt   │         │ Prediction │        │ DNA Brain  │
   │ Engine │         │   Engine   │        │ Simulator  │
   └───┬────┘         └─────┬──────┘        └──────┬─────┘
       │                    │                      │
       └────────────────────┼──────────────────────┘
                            │
                            ▼
                  ┌──────────────────┐
                  │ DECISION MAKER   │  ← ÚNICO DECISOR
                  │ (El General)     │     - CUÁNDO disparar
                  │                  │     - CON QUÉ intensidad
                  │ + Zone Awareness │     - DIVINE override
                  │ + Vibe Context   │
                  └────────┬─────────┘
                           │
                           ▼ (si aprobado)
              ┌────────────────────────┐
              │ EFFECT REPOSITORY      │  ← SOLO BIBLIOTECARIO
              │ (Ex-Selector)          │
              │                        │     - QUÉ efecto exacto
              │ - getAvailableEffect() │     - Cooldowns
              │ - checkAvailability()  │     - Vibe Shield
              │ - registerEffectFired()│     - Zone Mapping
              └────────────┬───────────┘
                           │
                           ▼
                  [EFECTO FINAL]
```

---

## 📝 ARCHIVOS AFECTADOS

### 1. `DecisionMaker.ts` - EXPANSIÓN
**Riesgo:** 🟡 MEDIO  
**Líneas estimadas a añadir:** +150

#### Cambios:
| Cambio | Descripción | Riesgo |
|--------|-------------|--------|
| `+classifyZScore()` | MOVER desde Selector | 🟢 Bajo |
| `+DIVINE_THRESHOLD` | Constante Z>3.5 | 🟢 Bajo |
| `+zoneAwareness` | Recibir energyContext | 🟢 Bajo |
| `+divineOverride()` | Lógica DIVINE moment | 🟡 Medio |
| `+vibeContext` | Recibir vibeId en inputs | 🟢 Bajo |

#### Nueva Interfaz DecisionInputs:
```typescript
export interface DecisionInputs {
  pattern: SeleneMusicalPattern
  beauty: BeautyAnalysis
  consonance: ConsonanceAnalysis
  huntDecision: HuntDecision
  prediction: MusicalPrediction
  timestamp: number
  dreamIntegration?: IntegrationDecision
  // 🆕 WAVE 1010: Zone & Vibe Awareness
  energyContext?: EnergyContext      // Para consciencia de zona
  vibeId: string                     // Para DIVINE vibe-aware
}
```

#### Nueva Función determineDecisionType():
```typescript
function determineDecisionType(inputs: DecisionInputs): DecisionType {
  const { huntDecision, prediction, pattern, beauty, dreamIntegration, energyContext } = inputs
  
  // 🌩️ PRIORIDAD 0: DIVINE MOMENT (Z > 3.5)
  // AHORA VIVE AQUÍ, NO EN SELECTOR
  if (pattern.zScore >= DIVINE_THRESHOLD) {
    const zone = energyContext?.zone ?? 'gentle'
    // Consciencia energética: NO divine en silence/valley
    if (zone !== 'silence' && zone !== 'valley') {
      return 'divine_strike'  // NUEVO TIPO
    }
  }
  
  // 🧬 PRIORIDAD 1: DNA BRAIN
  if (dreamIntegration?.approved && dreamIntegration.effect?.effect) {
    return 'strike'
  }
  
  // ... resto igual
}
```

---

### 2. `ContextualEffectSelector.ts` - LOBOTOMÍA
**Riesgo:** 🔴 ALTO  
**Líneas estimadas a eliminar:** -400

#### Funciones a ELIMINAR:
| Función | Líneas | Razón |
|---------|--------|-------|
| `evaluateHuntFuzzy()` | 867-935 | Redundante con HuntEngine |
| `classifyZScore()` | 651-705 | Mover a DecisionMaker |
| `divineDecision()` | 1518-1530 | Mover a DecisionMaker |
| Lógica de decisión en `select()` | ~100 | Solo debe SELECCIONAR |

#### Funciones a PRESERVAR (SAGRADAS):
| Función | Razón |
|---------|-------|
| `EFFECT_COOLDOWNS` | THE TIMEKEEPER |
| `EFFECTS_BY_VIBE` | VIBE SHIELD |
| `EFFECTS_BY_INTENSITY` | ZONE LADDER |
| `checkAvailability()` | THE GATEKEEPER |
| `registerEffectFired()` | DNA DIVERSITY |
| `isEffectInCooldown()` | CORE COOLDOWN |
| `getEffectsAllowedForZone()` | ZONE MAPPING |
| `selectEffectForContext()` | EFFECT SELECTION (sin decisión) |

#### Nueva Función Principal:
```typescript
/**
 * 🔪 WAVE 1010: DEMOTED TO REPOSITORY
 * 
 * ANTES: select() decidía SI y QUÉ disparar
 * AHORA: getAvailableEffect() solo dice QUÉ cuando el General ordena
 * 
 * @param effectRequest - Petición del DecisionMaker
 * @returns El efecto específico disponible, o null si todos en cooldown
 */
public getAvailableEffect(request: {
  intensityLevel: 'divine' | 'epic' | 'elevated' | 'normal'
  vibeId: string
  energyZone: EnergyZone
  sectionType: string
  energyTrend: 'rising' | 'stable' | 'falling'
  lastEffectType: string | null
  // Opcional: efecto sugerido por DNA
  suggestedEffect?: string
}): string | null {
  // 1. Si DNA sugirió un efecto específico, verificar disponibilidad
  if (request.suggestedEffect) {
    if (this.isAvailable(request.suggestedEffect, request.vibeId)) {
      return request.suggestedEffect
    }
    // DNA sugirió pero está en cooldown → buscar alternativa
  }
  
  // 2. Buscar efecto disponible según contexto
  return this.findEffectForContext(request)
}

/**
 * Renombrar selectEffectForContext() → findEffectForContext()
 * Eliminar toda lógica de DECISIÓN, solo MAPEO
 */
private findEffectForContext(request: EffectRequest): string | null {
  // ... lógica existente de mapeo vibe/zone/section
  // SIN evaluateHuntFuzzy
  // SIN classifyZScore
  // SIN divineDecision
}
```

---

### 3. `SeleneTitanConscious.ts` - SIMPLIFICACIÓN
**Riesgo:** 🟡 MEDIO  
**Líneas estimadas a cambiar:** ~50

#### Flujo Actual (líneas 684-776):
```typescript
// 4. DECISION MAKER
let output = makeDecision(inputs)

// 5. CONTEXTUAL SELECTION (FALLBACK)
// ... construye selectorInput ...
// ... llama effectSelector.select() ...
```

#### Flujo Nuevo:
```typescript
// 4. DECISION MAKER (ÚNICO DECISOR)
let output = makeDecision({
  ...inputs,
  energyContext,  // 🆕 Añadir
  vibeId: pattern.vibeId,  // 🆕 Añadir
})

// 5. EFFECT REPOSITORY (SOLO SI HAY DECISIÓN)
if (output.effectDecision) {
  const effectRequest = {
    intensityLevel: output.effectDecision.intensityLevel,
    vibeId: pattern.vibeId,
    energyZone: energyContext.zone,
    sectionType: selectorSection,
    energyTrend: this.energyTrend,
    lastEffectType: this.lastEffectType,
    suggestedEffect: output.effectDecision.effectType,
  }
  
  const finalEffect = this.effectRepository.getAvailableEffect(effectRequest)
  
  if (finalEffect) {
    output.effectDecision.effectType = finalEffect
  } else {
    // Todos en cooldown → silencio
    output.effectDecision = null
  }
}

// 6. GATEKEEPER CHECK (ya existe, mantener)
```

---

## ⚠️ RIESGOS Y MITIGACIONES

### RIESGO 1: Romper el flujo DNA → Efecto
**Probabilidad:** 🔴 ALTA  
**Impacto:** 🔴 CRÍTICO (Selene deja de disparar)

**Mitigación:**
- Tests unitarios para cada función movida
- Test de integración: DNA approval → effect fired
- Ejecutar MonteCarloLab antes y después
- Rollback plan: branch `pre-wave-1010`

### RIESGO 2: Perder lógica vibe-specific
**Probabilidad:** 🟡 MEDIA  
**Impacto:** 🟡 ALTO (Techno dispara latinos)

**Mitigación:**
- PRESERVAR `EFFECTS_BY_VIBE` intacto
- PRESERVAR `getEffectsAllowedForZone()` intacto
- Test específico: Techno NUNCA dispara `cumbia_moon`
- Test específico: Latino NUNCA dispara `industrial_strobe`

### RIESGO 3: Cooldowns desincronizados
**Probabilidad:** 🟡 MEDIA  
**Impacto:** 🔴 CRÍTICO (spam de efectos)

**Mitigación:**
- ÚNICA fuente de verdad: `EFFECT_COOLDOWNS`
- `registerEffectFired()` se llama en UN solo lugar
- Test de stress: 1000 disparos, verificar cooldowns

### RIESGO 4: DIVINE moments no disparan
**Probabilidad:** 🟢 BAJA  
**Impacto:** 🟡 ALTO (momentos épicos silenciados)

**Mitigación:**
- Test específico: Z=4.0 + zone=peak → SIEMPRE dispara
- Logging explícito de DIVINE decisions
- Threshold configurable (no hardcodeado)

---

## 🧪 PLAN DE PRUEBAS

### Tests Unitarios Nuevos:
```typescript
// DecisionMaker.test.ts
describe('WAVE 1010: Unified Brain', () => {
  it('should fire DIVINE when Z > 3.5 and zone >= ambient', ...)
  it('should NOT fire DIVINE when zone = silence', ...)
  it('should respect DNA suggestion when approved', ...)
  it('should use vibeId for effect selection', ...)
})

// EffectRepository.test.ts (renombrado)
describe('WAVE 1010: Effect Repository', () => {
  it('should return suggested effect if available', ...)
  it('should return alternative if suggested in cooldown', ...)
  it('should return null if all effects in cooldown', ...)
  it('should respect vibe shield', ...)
})
```

### Tests de Integración:
```typescript
// Integration.test.ts
describe('WAVE 1010: Full Flow', () => {
  it('DNA → DecisionMaker → Repository → Effect', ...)
  it('DIVINE → DecisionMaker → Repository → solar_flare/industrial_strobe', ...)
  it('Silence zone → No effect regardless of Z-Score', ...)
})
```

### Tests de Regresión:
- Ejecutar MonteCarloLab-Latino.ts (debe dar 94%+ en ACTIVE)
- Ejecutar MonteCarloLab-Techno.ts (si existe)
- 30 minutos de reggaeton: verificar glitch/machete visibles

---

## 📅 CRONOGRAMA PROPUESTO

### Fase 1: PREPARACIÓN (1-2 horas)
1. Crear branch `wave-1010-lobotomy`
2. Snapshot de MonteCarloLab results (baseline)
3. Escribir tests unitarios para funciones a mover

### Fase 2: CIRUGÍA (2-3 horas)
1. Expandir DecisionMaker con zone/vibe awareness
2. Mover `classifyZScore()` y `DIVINE_THRESHOLD`
3. Crear `divineOverride()` en DecisionMaker
4. Refactorizar ContextualEffectSelector → EffectRepository
5. Eliminar funciones redundantes
6. Actualizar SeleneTitanConscious

### Fase 3: VALIDACIÓN (1-2 horas)
1. Ejecutar todos los tests
2. Ejecutar MonteCarloLab (comparar con baseline)
3. Test manual: 15 min reggaeton, 15 min techno
4. Verificar logs (no más "doble decisión")

### Fase 4: MERGE (30 min)
1. Review del código
2. Squash commits
3. Merge a main
4. Tag `wave-1010-complete`

---

## 📊 MÉTRICAS DE ÉXITO

| Métrica | Antes | Objetivo |
|---------|-------|----------|
| Líneas de código total | 2089 | ~1700 (-400) |
| Funciones redundantes | 3 | 0 |
| Puntos de decisión | 2 | 1 |
| MonteCarloLab ACTIVE hit rate | 94.4% | ≥94% |
| Logs de "doble decisión" | Varios | 0 |
| Tiempo de respuesta (avg) | ~15ms | ≤15ms |

---

## 🎬 CONCLUSIÓN

La lobotomía frontal de Selene es una operación de riesgo medio-alto pero **necesaria** para la salud a largo plazo del sistema. La arquitectura actual con dos cerebros es un accidente histórico que acumuló cruft de 30+ WAVEs.

**El General manda. El Bibliotecario obedece.**

Una vez completada la cirugía:
- Un solo punto de decisión (debuggear más fácil)
- Cooldowns centralizados (no más spam)
- Vibe Shield preservado (cada género con su arsenal)
- DNA Brain con autoridad clara (no más "déjame pensarlo")

**¿Procedemos con la cirugía, Radwulf?** 🔪

---

*"A veces hay que cortar para curar."*  
*— Dr. PunkOpus, Neurocirujano de IAs*
