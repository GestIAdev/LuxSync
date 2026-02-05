# 🧠 WAVE 1167 CONSCIOUSNESS AUDIT
## "El Mapeo de la Mente de Selene"

**Fecha:** Auditoría profunda post-UI rebuild
**Objetivo:** Mapear el flujo cognitivo COMPLETO desde backend hasta frontend

---

## 📊 ARQUITECTURA CEREBRAL REAL

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        🧠 SELENE TITAN CONSCIOUS                            │
│                (electron-app/src/core/intelligence/)                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐    ┌──────────────────────┐    ┌──────────────────────┐   │
│  │ HuntEngine  │───>│ EffectDreamSimulator │───>│  FuzzyDecisionMaker  │   │
│  │             │    │  (THE DREAMER 🔮)    │    │                      │   │
│  │ huntState   │    │                      │    │ zScore, fuzzyAction  │   │
│  │ confidence  │    │ dreamEffects()       │    │ dropBridgeAlert      │   │
│  │ beautyScore │    │ simulateScenario()   │    │                      │   │
│  └─────────────┘    │                      │    └──────────────────────┘   │
│                     │ 🧬 DNA Matching      │                               │
│                     │ 🎨 Texture Affinity  │                               │
│                     │ 📊 projectedRelevance│                               │
│                     │ 📊 projectedBeauty   │                               │
│                     │ ⚠️ riskLevel         │                               │
│                     └──────────────────────┘                               │
│                              │                                              │
│                              ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │              DreamEngineIntegrator (ORCHESTRATOR)                │      │
│  │ Pipeline: Hunt → Dream → Decide → Filter → Execute              │      │
│  │                                                                   │      │
│  │ getDreamOutput() → EffectDreamResult {                           │      │
│  │   scenarios: EffectScenario[]                                    │      │
│  │   bestScenario: { effect, projectedBeauty, riskLevel ... }       │      │
│  │   recommendation: 'execute' | 'modify' | 'abort'                 │      │
│  │   reason: string (TEXTURE REJECT, DNA mismatch, etc.)            │      │
│  │   warnings: string[]                                              │      │
│  │ }                                                                 │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│                              │                                              │
│                              ▼                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                   VisualConscienceEngine                            │   │
│  │ evaluateAction() → APPROVED | REJECTED | DEFERRED                   │   │
│  │                                                                     │   │
│  │ Checks: strobe_risk, harsh_override, intensity_abuse, bass_flooding │   │
│  │         color_chaos, overdrive_abuse, seizure_pattern               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│         │                                                                   │
│         ▼                                                                   │
│  ┌──────────────────────────────────────────────────────────────────┐      │
│  │                     MoodController (SINGLETON)                    │      │
│  │ currentMood: 'calm' | 'balanced' | 'punk'                        │      │
│  │                                                                   │      │
│  │ calm:     threshold × 2.0, cooldown × 1.5 (conservador)          │      │
│  │ balanced: threshold × 1.2, cooldown × 1.0 (normal)               │      │
│  │ punk:     threshold × 0.8, cooldown × 0.5 (agresivo)             │      │
│  └──────────────────────────────────────────────────────────────────┘      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🔴 GAPS CRÍTICOS IDENTIFICADOS

### 1. **MoodController NO está expuesto a la UI**

**Estado actual:**
- MoodController es un SINGLETON en el backend
- Tiene 3 modos: calm, balanced, punk
- Afecta TODOS los umbrales de decisión
- **NUNCA se envía al frontend**

**Ubicación:** `TitanEngine.ts` → Singleton privado
```typescript
// Existe pero no se propaga:
MoodController.getInstance().currentMood // 'calm' | 'balanced' | 'punk'
```

**Impacto:** La UI no sabe en qué "personalidad" está operando Selene.

---

### 2. **ConsciousnessOutput.debugInfo tiene data rica NO propagada**

**En `ConsciousnessOutput.ts` existe:**
```typescript
export interface ConsciousnessDebugInfo {
  huntState: AIHuntState
  beautyScore: number
  consonance: number
  beautyTrend: 'rising' | 'falling' | 'stable'
  biasesDetected: string[]
  reasoning: string | null
  activePrediction: {
    type: string
    probability: number
    timeToEventMs: number
  } | null
  
  // 🔥 ESTOS NO LLEGAN A LA UI:
  lastDream: {
    type: DreamType
    thought: string
    projectedBeauty: number
    recommendation: 'execute' | 'modify' | 'abort'
  } | null
  fuzzyAction: string | null
  zScore: number
  dropBridgeAlert: boolean
}
```

**Lo que llega al frontend (AITelemetry):**
```typescript
interface AITelemetry {
  huntState, confidence, prediction, predictionProbability, predictionTimeMs,
  beautyScore, beautyTrend, consonance, lastDecision, decisionSource,
  reasoning, biasesDetected, energyOverrideActive
}
```

**FALTAN en AITelemetry:**
- `lastDream` (parcial en cognitive.dream pero incompleto)
- `fuzzyAction`
- `zScore`
- `dropBridgeAlert`

---

### 3. **VisualConscienceEngine evaluations NO expuestas**

**El engine tiene 7 evaluaciones éticas:**
1. `strobe_risk` - Riesgo de estrobos epilépticos
2. `harsh_override` - Override manual agresivo
3. `intensity_abuse` - Intensidad excesiva prolongada
4. `bass_flooding` - Saturación de bajos
5. `color_chaos` - Cambios de color caóticos
6. `overdrive_abuse` - Abuso de overdrive
7. `seizure_pattern` - Patrones tipo seizure

**Lo que la UI muestra:**
- Solo `biasesDetected[]` como lista de strings
- `energyOverrideActive` como boolean
- NO muestra el breakdown individual de cada check

**La EthicsCard actual:**
```tsx
// Hardcodeados:
<span>Strobe: SAFE</span>    // ❌ No refleja strobe_risk real
<span>Override: NONE</span>  // ✓ Usa energyOverrideActive
<span>Intensity: OK</span>   // ❌ No refleja intensity_abuse real
```

---

### 4. **EffectDreamSimulator output parcialmente conectado**

**El VERDADERO Dream Engine** (`EffectDreamSimulator.ts`) devuelve:

```typescript
interface EffectDreamResult {
  scenarios: EffectScenario[]        // Todos los escenarios simulados
  bestScenario: EffectScenario | null
  recommendation: 'execute' | 'modify' | 'abort'
  reason: string                     // "TEXTURE REJECT: glitch_guaguanco - Dirty effect REJECTED"
  warnings: string[]
  simulationTimeMs: number
}

interface EffectScenario {
  effect: EffectCandidate
  projectedBeauty: number            // Legacy
  projectedRelevance: number         // 🧬 DNA-based relevance
  beautyDelta: number
  riskLevel: number
  dnaDistance: number                // 🧬 Euclidean distance to target DNA
  targetDNA?: TargetDNA              // 🧬 For debugging
  projectedConsonance: number
  gpuLoadImpact: number
  audienceFatigueImpact: number
  cooldownConflicts: string[]
  hardwareConflicts: string[]
  vibeCoherence: number
  diversityScore: number
  simulationConfidence: number
}
```

**Lo que llega al frontend:**
- `cognitive.dream.isActive` (boolean)
- `cognitive.dream.currentType` (DreamType | null)
- `cognitive.dream.currentThought` (string)
- `cognitive.dream.projectedBeauty` (number)
- `cognitive.dream.lastRecommendation` (DreamRecommendation | null)

**FALTAN:**
- `reason` - El motivo del rechazo ("TEXTURE REJECT", "DNA mismatch")
- `warnings[]` - Advertencias del simulador
- `bestScenario.dnaDistance` - Qué tan lejos del DNA target
- `bestScenario.riskLevel` - Nivel de riesgo GPU/fatiga
- `bestScenario.vibeCoherence` - Coherencia con vibe actual

**Logs que ves en consola pero NO en UI:**
```
[DREAM_SIMULATOR] 🎨 TEXTURE REJECT: glitch_guaguanco - Dirty effect REJECTED - context is warm (clarity=0.50)
[INTEGRATOR] 📊 Pipeline: ❌ REJECTED | Dream: 1ms | Filter: 0ms | Total: 1ms
```

---

### 5. **EnergyConsciousnessEngine zone NO expuesto**

**Existe en `EnergyConsciousnessEngine.ts`:**
```typescript
getZone(): 'calm' | 'rising' | 'peak' | 'falling'
shouldBurstNow(): boolean
getBurstProbability(): number
```

**NO está en SeleneTruth.** La UI no sabe:
- En qué zona de energía estamos (calm/rising/peak/falling)
- Si se va a hacer burst pronto

---

### 6. **Vibe en ContextMatrix funciona pero hay doble fuente**

**Existe vibe en:**
- `truth.system.vibe` (string: 'idle', 'techno-club', etc.)
- `truth.consciousness.vibe.active` (VibeId)

**La ContextMatrixPanel usa:**
```typescript
const vibe = cognitive.vibe?.active || 'idle'
```

**Esto FUNCIONA**, pero `cognitive.vibe.transitioning` no se muestra.

---

## 🟢 LO QUE SÍ FUNCIONA

| Componente | Data Source | Estado |
|------------|-------------|--------|
| AI State - huntState | ai.huntState | ✅ |
| AI State - confidence | ai.confidence | ✅ |
| AI State - beautyScore | ai.beautyScore | ✅ |
| AI State - beautyTrend | ai.beautyTrend | ✅ |
| AI State - reasoning | ai.reasoning | ✅ |
| Prediction - prediction | ai.prediction | ✅ |
| Prediction - probability | ai.predictionProbability | ✅ |
| Prediction - timeMs | ai.predictionTimeMs | ✅ |
| Context - key | context.key | ✅ |
| Context - mode | context.mode | ✅ |
| Context - section | context.section | ✅ |
| Context - mood | context.mood | ✅ |
| Context - vibe | cognitive.vibe.active | ✅ |

---

## 🛠️ PLAN DE ACCIÓN

### FASE 1: Exponer MoodController a SeleneTruth

**Archivo:** `TitanOrchestrator.ts`

Agregar a `consciousness`:
```typescript
consciousness: {
  ...createDefaultCognitive(),
  // ... existing
  moodMode: MoodController.getInstance().currentMood, // 'calm'|'balanced'|'punk'
}
```

**Interfaz:** Agregar a `CognitiveData`:
```typescript
moodMode: 'calm' | 'balanced' | 'punk'
```

---

### FASE 2: Exponer EffectDreamSimulator output completo

**Archivo:** `TitanEngine.ts` - `getConsciousnessTelemetry()`

Agregar campos del **EffectDreamResult**:
```typescript
return {
  // ... existing
  lastDream: {
    type: debugInfo.lastDream?.type ?? null,
    thought: debugInfo.lastDream?.thought ?? '',
    projectedBeauty: debugInfo.lastDream?.projectedBeauty ?? 0,
    recommendation: debugInfo.lastDream?.recommendation ?? null,
    // 🔮 NUEVOS CAMPOS DEL DREAM SIMULATOR:
    reason: dreamResult.reason,              // "TEXTURE REJECT: glitch_guaguanco..."
    warnings: dreamResult.warnings,          // Advertencias del simulador
    dnaDistance: dreamResult.bestScenario?.dnaDistance ?? 0,
    riskLevel: dreamResult.bestScenario?.riskLevel ?? 0,
    vibeCoherence: dreamResult.bestScenario?.vibeCoherence ?? 0,
    simulationTimeMs: dreamResult.simulationTimeMs
  },
  fuzzyAction: debugInfo.fuzzyAction,
  zScore: debugInfo.zScore,
  dropBridgeAlert: debugInfo.dropBridgeAlert,
}
```

**Interfaz:** Expandir `AITelemetry`:
```typescript
interface AITelemetry {
  // ... existing
  lastDream: {
    type: DreamType | null
    thought: string
    projectedBeauty: number
    recommendation: DreamRecommendation | null
    reason: string                    // 🔮 Por qué se rechazó/aceptó
    warnings: string[]                // 🔮 Advertencias del simulador
    dnaDistance: number               // 🧬 Distancia al target DNA
    riskLevel: number                 // ⚠️ Nivel de riesgo
    vibeCoherence: number             // 🎭 Coherencia con vibe
    simulationTimeMs: number          // ⏱️ Tiempo de simulación
  } | null
  fuzzyAction: string | null
  zScore: number
  dropBridgeAlert: boolean
}
```

---

### FASE 3: Exponer ethics checks individuales

**Opción A:** Exponer cada check como boolean
```typescript
interface AITelemetry {
  ethicsChecks: {
    strobeRisk: boolean
    harshOverride: boolean
    intensityAbuse: boolean
    bassFlooding: boolean
    colorChaos: boolean
    overdriveAbuse: boolean
    seizurePattern: boolean
  }
}
```

**Opción B:** Exponer solo los que fallan (más eficiente)
```typescript
// Ya existe: biasesDetected: string[]
// Podría incluir: ['strobe_risk', 'intensity_abuse', ...]
```

---

### FASE 4: Exponer EnergyConsciousness zone

**Agregar a SystemState:**
```typescript
energyZone: 'calm' | 'rising' | 'peak' | 'falling'
```

---

## 📋 RESUMEN DE CAMBIOS REQUERIDOS

| Archivo | Cambio | Prioridad |
|---------|--------|-----------|
| `SeleneProtocol.ts` | Expandir `AITelemetry` + `CognitiveData` | ALTA |
| `TitanEngine.ts` | Exponer más campos de debugInfo | ALTA |
| `TitanOrchestrator.ts` | Agregar moodMode a consciousness | ALTA |
| `ConsciousnessHUD/` | Usar nuevos campos en cards | MEDIA |
| `EthicsCard.tsx` | Reflejar ethics reales, no hardcoded | MEDIA |

---

## 🎯 MÉTRICAS DE ÉXITO POST-FIX

- [ ] UI muestra MoodController mode (calm/balanced/punk)
- [ ] DreamForge muestra lastDream aunque isActive=false
- [ ] DreamForge muestra rejection reasons ("TEXTURE REJECT: glitch_guaguanco - Dirty effect REJECTED")
- [ ] DreamForge muestra DNA distance, risk level, vibe coherence
- [ ] Ethics muestra los 7 checks reales del VisualConscienceEngine
- [ ] AI State muestra zScore y dropBridgeAlert
- [ ] Prediction muestra countdown real en beats

---

## 💡 EJEMPLO DE UI MEJORADA

### DreamForgeCard ANTES (actual):
```
💭 SIMULATING
Type: effect_activation
Thought: "Activating cyber_dualism"
Projected: 78%
✅ EXECUTE
```

### DreamForgeCard DESPUÉS (con EffectDreamSimulator completo):
```
💭 SIMULATING
Type: effect_activation
Effect: glitch_guaguanco
DNA Distance: 0.42 (❌ too far)
Risk Level: 35%
Vibe Coherence: 22% (❌ mismatch)

Simulation: 1ms
⏭️ REJECTED

Reason: "TEXTURE REJECT - Dirty effect 
        REJECTED - context is warm 
        (clarity=0.50)"

Warnings:
• DNA mismatch with warm context
• Texture affinity too low
```

---

*"La mente de Selene es profunda. La UI debe reflejar esa profundidad."*
