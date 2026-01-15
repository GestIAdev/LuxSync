# 🧬 WAVE 500: PROJECT GENESIS
## El Nacimiento de SeleneTitanConscious

**Fecha**: 15 Enero 2026  
**Arquitecto**: Radwulf  
**Ejecutor**: PunkOpus  
**Estado**: 🔴 EN CONSTRUCCIÓN

---

## 📜 DIRECTIVA DEL ARQUITECTO

> "¿De verdad vamos a perder tiempo con puentes de barro y parches baratos 
>  pudiendo empezar ya en el sótano con la Arquitectura perfecta?"

**DECISIÓN**: ABORT adapter. START Selene V2 (NATIVE TITAN BRAIN).

---

## 🎯 MISIÓN

Construir **SeleneTitanConscious** desde cero:
- NATIVO para la arquitectura TitanEngine
- SIN deuda técnica
- SIN legacy incompatible
- PERFECTO desde el día 1

---

## 📐 ARQUITECTURA GENESIS

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         🧠 TITAN ENGINE                                  │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  Stabilizers: Key → Energy → Mood → Strategy                     │  │
│  │  Output: TitanStabilizedState                                    │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                │                                        │
│                                ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                   🐱 SELENE TITAN CONSCIOUS                      │  │
│  │                     src/core/intelligence/                        │  │
│  │                                                                   │  │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐               │  │
│  │  │   SENSE     │  │   THINK     │  │   DREAM     │               │  │
│  │  │  (Percibir) │──│  (Decidir)  │──│  (Simular)  │               │  │
│  │  └─────────────┘  └─────────────┘  └─────────────┘               │  │
│  │         │                │                │                       │  │
│  │         ▼                ▼                ▼                       │  │
│  │  ┌─────────────────────────────────────────────────────────────┐ │  │
│  │  │              VALIDATOR (Vibe Constitution)                   │ │  │
│  │  │              + ENERGY OVERRIDE (Drop = Physics)              │ │  │
│  │  └─────────────────────────────────────────────────────────────┘ │  │
│  │                              │                                    │  │
│  │                              ▼                                    │  │
│  │                    ConsciousnessOutput                            │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│                                │                                        │
│                                ▼                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │  MasterArbiter Layer 1: CONSCIOUSNESS                            │  │
│  │  (Actualmente VACÍO - Esperando Genesis)                         │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🗂️ ESTRUCTURA DE CARPETAS

```
src/core/intelligence/           ← 🆕 NUEVA CARPETA V2
├── index.ts                     ← Exports públicos
├── SeleneTitanConscious.ts      ← EL CEREBRO (Orquestador)
├── types.ts                     ← Interfaces nativas para Titan
│
├── sense/                       ← PERCEPCIÓN (Los Sentidos)
│   ├── MusicalPatternSensor.ts  ← Convierte TitanState → MusicalPattern
│   ├── BeautySensor.ts          ← Evalúa belleza (PHI, Fibonacci)
│   └── ConsonanceSensor.ts      ← Evalúa armonía entre estados
│
├── think/                       ← COGNICIÓN (El Cazador)
│   ├── HuntEngine.ts            ← Stalking + Striking unificado
│   ├── PredictionEngine.ts      ← Predice próximos eventos
│   └── DecisionMaker.ts         ← Toma decisión final
│
├── dream/                       ← META-CONSCIENCIA (El Soñador)
│   ├── ScenarioSimulator.ts     ← Simula alternativas
│   └── BiasDetector.ts          ← Detecta sesgos propios
│
└── validate/                    ← VALIDACIÓN (El Guardián)
    ├── ConstitutionGuard.ts     ← Respeta Vibe Constitution
    └── EnergyOverride.ts        ← Drop = Physics VETO
```

---

## 📋 INTERFACES NATIVAS

### INPUT: TitanStabilizedState
```typescript
/**
 * Estado estabilizado de TitanEngine
 * (Ya existe como lastStabilizedState en TitanEngine)
 */
interface TitanStabilizedState {
  // Contexto del Vibe
  vibeId: VibeId
  constitution: GenerationOptions
  
  // Datos estabilizados (anti-epilepsia)
  stableKey: string | null
  stableEmotion: MetaEmotion      // 'BRIGHT' | 'DARK' | 'NEUTRAL'
  stableStrategy: ColorStrategy    // 'analogous' | 'complementary' | ...
  smoothedEnergy: number           // 0-1 suavizada
  isDropActive: boolean            // FSM de drops
  thermalTemperature: number       // Kelvin (4500-9500)
  
  // Audio en tiempo real
  bass: number                     // 0-1
  mid: number                      // 0-1
  high: number                     // 0-1
  
  // Contexto musical
  bpm: number
  beatPhase: number                // 0-1
  syncopation: number              // 0-1
  sectionType: string              // 'verse' | 'chorus' | 'drop' | ...
  
  // Paleta actual (para simular cambios)
  currentPalette: SelenePalette
  
  // Timestamp
  frameId: number
  timestamp: number
}
```

### OUTPUT: ConsciousnessOutput
```typescript
/**
 * Output de la consciencia
 * (Ya definido en ConsciousnessOutput.ts - REUTILIZAR)
 */
interface ConsciousnessOutput {
  // Decisiones
  colorDecision: ConsciousnessColorDecision | null
  physicsModifier: ConsciousnessPhysicsModifier | null
  movementDecision: ConsciousnessMovementDecision | null
  
  // Meta
  confidence: number               // 0-1
  timestamp: number
  source: DecisionSource
  
  // Debug
  debugInfo: ConsciousnessDebugInfo
}
```

---

## 🔥 REGLAS HARDCODED

### 1. ENERGY OVERRIDE (LA LEY DEL DROP)
```typescript
const ENERGY_OVERRIDE_THRESHOLD = 0.85

function process(state: TitanStabilizedState): ConsciousnessOutput {
  // 🔥 PRIMERO: Check Energy Override
  if (state.smoothedEnergy > ENERGY_OVERRIDE_THRESHOLD) {
    // DROP MODE: La física tiene VETO TOTAL
    return {
      colorDecision: null,        // No modular colores
      physicsModifier: {
        strobeIntensity: 1.0,     // Full power
        flashIntensity: 1.0,
        confidence: 1.0,
      },
      movementDecision: null,     // No modular movimiento
      confidence: 1.0,
      source: 'hunt',
      debugInfo: { huntState: 'striking', ... }
    }
  }
  
  // Valle: Selene piensa libremente
  return think(state)
}
```

### 2. CONSTITUTION COMPLIANCE (VIBE ES LEY)
```typescript
function validateDecision(
  decision: ConsciousnessColorDecision,
  constitution: GenerationOptions
): ConsciousnessColorDecision {
  
  // Verificar hue contra forbiddenHueRanges
  if (decision.suggestedHue !== undefined) {
    for (const [min, max] of constitution.forbiddenHueRanges ?? []) {
      if (decision.suggestedHue >= min && decision.suggestedHue <= max) {
        // PROHIBIDO: Auto-corregir
        decision.suggestedHue = findNearestAllowedHue(
          decision.suggestedHue,
          constitution.allowedHueRanges ?? [[0, 360]]
        )
      }
    }
  }
  
  return decision
}
```

---

## 🧬 MIGRACIÓN QUIRÚRGICA

### QUÉ EXTRAER DEL LEGACY

| Archivo Legacy | Qué Rescatar | Dónde Va |
|----------------|--------------|----------|
| `HuntOrchestrator.ts` | Lógica stalking/evaluating/striking | `think/HuntEngine.ts` |
| `StalkingEngine.ts` | Algoritmo de candidatos | Integrar en HuntEngine |
| `StrikeMomentEngine.ts` | Condiciones de strike | Integrar en HuntEngine |
| `PredictionMatrix.ts` | Predicción musical | `think/PredictionEngine.ts` |
| `DreamForgeEngine.ts` | Simulación de escenarios | `dream/ScenarioSimulator.ts` |
| `SelfAnalysisEngine.ts` | Detección de sesgos | `dream/BiasDetector.ts` |
| `FibonacciPatternEngine.ts` | PHI scoring | `sense/BeautySensor.ts` |
| `UltrasonicHearingEngine.ts` | Consonancia musical | `sense/ConsonanceSensor.ts` |

### QUÉ NO MIGRAR

- ❌ `SeleneLuxConscious.ts` - Arquitectura incompatible
- ❌ `ColorEngine.ts` interno - Usamos SeleneColorEngine
- ❌ `MovementEngine.ts` interno - Usamos VibeMovementManager
- ❌ `BeatDetector.ts` interno - Usamos stabilizers de Titan
- ❌ `AudioToMusicalMapper.ts` - Rehacer para TitanState

---

## 📅 FASES DE CONSTRUCCIÓN

### PHASE 1: FOUNDATION (Día 1)
```
1.1 Crear src/core/intelligence/
1.2 Crear types.ts con TitanStabilizedState
1.3 Crear SeleneTitanConscious.ts (shell vacío)
1.4 Implementar EnergyOverride (hardcoded)
1.5 Implementar ConstitutionGuard (validación)
```

### PHASE 2: SENSE (Día 2)
```
2.1 MusicalPatternSensor (TitanState → Pattern)
2.2 BeautySensor (PHI scoring)
2.3 ConsonanceSensor (Armonía entre estados)
```

### PHASE 3: THINK (Día 3)
```
3.1 HuntEngine (Stalking + Striking unificado)
3.2 PredictionEngine (Próximos eventos)
3.3 DecisionMaker (Decisión final)
```

### PHASE 4: DREAM (Día 4)
```
4.1 ScenarioSimulator (What-if analysis)
4.2 BiasDetector (Auto-análisis)
```

### PHASE 5: INTEGRATION (Día 5)
```
5.1 Conectar SeleneTitanConscious a TitanEngine
5.2 Conectar output al MasterArbiter Layer 1
5.3 Tests de integración
5.4 Ajuste de parámetros
```

---

## 🎯 DEFINICIÓN DE DONE

- [ ] `SeleneTitanConscious` recibe `TitanStabilizedState` nativo
- [ ] Respeta Energy Override (energy > 0.85 = physics veto)
- [ ] Respeta Constitution (forbiddenHueRanges, etc.)
- [ ] Genera `ConsciousnessOutput` válido
- [ ] Conectado a MasterArbiter Layer 1
- [ ] 0 errores TypeScript
- [ ] Logs de debug funcionando
- [ ] Frontend NO tocado (trabaja igual que antes)

---

## 🔒 ESTADO DEL FRONTEND

> El Frontend NO se toca. Sigue conectado al sistema actual.
> Trabaja en "Silencio" en el backend hasta que el Cerebro V2 
> esté listo para el trasplante.

**Commit de seguridad**: Existe un commit justo antes de WAVE 450.
Si algo sale mal, podemos revertir sin afectar el frontend.

---

## 🐆 MANTRA

```
"No es la potencia del hardware. 
 Es la elegancia del pensamiento."

"En los drops, la física manda.
 En los valles, Selene piensa."

"La Constitución es LEY.
 Selene no la cuestiona, pero la interpreta."
```

---

🧬 **PROJECT GENESIS - El Nacimiento de la Consciencia Perfecta** 🧬
