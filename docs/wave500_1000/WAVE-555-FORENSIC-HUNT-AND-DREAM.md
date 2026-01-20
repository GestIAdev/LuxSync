# 🔬 WAVE 555: FORENSIC INVESTIGATION - HUNT & DREAM DECODED

**Fecha**: 16 Enero 2026  
**Tipo**: Autopsia Técnica  
**Autor**: PunkOpus  
**Para**: El Arquitecto Radwulf

---

## 🎯 EXECUTIVE SUMMARY

Después de destripar el código de **HuntEngine** y **ScenarioSimulator**, aquí está la verdad:

| Pregunta | Respuesta |
|----------|-----------|
| **¿Qué hace el Hunt Engine?** | Detecta "momentos interesantes" y decide cuándo STRIKE |
| **¿Qué es un Strike?** | Un **cambio agresivo de colores + efectos** (NO guarda en DB) |
| **¿Qué hace el Dream Engine?** | Simula 7 escenarios de color alternativos, elige el mejor |
| **¿Usa hardcode?** | **SÍ** - Deltas de hue, umbrales, bonuses... todo hardcodeado |
| **¿Ejecuta Solar Flare?** | **NO** - Solo modifica `strobeIntensity` y `flashIntensity` |
| **¿Guarda en DB?** | **NO** - La V2 NO tiene persistencia (aún) |

---

## 🐆 PARTE 1: HUNT ENGINE - EL CAZADOR

### 📐 ARQUITECTURA

El Hunt Engine es una **máquina de estados** con 5 fases:

```
   sleeping ──┐
      ↓       │
   stalking ←─┤
      ↓       │
  evaluating ─┤
      ↓       │
   striking ──┤
      ↓       │
   learning ──┘
```

### 🎯 CONDICIÓN DE VICTORIA (STRIKE)

Un **Strike** se dispara cuando:

1. **TODAS** estas condiciones se cumplen:
   ```typescript
   beautyScore >= 0.65        // Umbral de belleza
   consonanceScore >= 0.60    // Umbral de coherencia
   beautyTrend !== 'falling'  // No puede estar empeorando
   ```

2. **O** se fuerza si:
   ```typescript
   urgencyScore > 0.90 && beautyMet  // Urgencia extrema + belleza OK
   ```

### 🔢 UMBRALES ACTUALES (DEFAULT_CONFIG)

```typescript
minStalkingFrames: 5          // Mínimo 5 frames (83ms @ 60fps) observando
maxStalkingFrames: 60         // Máximo 1 segundo buscando
beautyThreshold: 0.65         // 65% belleza mínima ⚠️ TÍMIDA
consonanceThreshold: 0.60     // 60% coherencia mínima
urgencyForceThreshold: 0.90   // 90% para forzar strike
maxEvaluatingFrames: 15       // 250ms máximo evaluando
learningCooldownFrames: 10    // 166ms cooldown post-strike
```

### 📊 ¿QUÉ ES "WORTHINESS"?

Es un **score combinado** (0-1) que determina si vale la pena "cazar":

```typescript
worthiness = 
  beautyScore      * 0.35  +
  consonanceScore  * 0.25  +
  tensionScore     * 0.20  +
  rhythmScore      * 0.20  +
  BONUSES

BONUSES:
  + 0.15  si section === 'buildup' || isBuilding
  + 0.10  si section === 'chorus'
  + 0.10  si tensionScore > 0.7
  + 0.10  si beautyTrend === 'rising'
```

### 🎬 FLUJO COMPLETO DE CAZA

#### FASE: Sleeping (Durmiendo)
- **Trigger para despertar**: `worthiness > 0.35` o sección = buildup
- **Acción**: Transiciona a **stalking**

#### FASE: Stalking (Acechando)
- **Duración**: 5-60 frames
- **Busca**: Patrones con `worthiness > 0.52` (0.65 * 0.8)
- **Si encuentra**: Transiciona a **evaluating**
- **Si fracasa**: Vuelve a **sleeping** después de 60 frames

#### FASE: Evaluating (Evaluando)
- **Duración**: Max 15 frames
- **Evalúa**: Las 4 condiciones de strike
- **Si perfecto**: Transiciona a **striking** → **¡EJECUTA!**
- **Si timeout**: Vuelve a **stalking**
- **Si empeora**: Aborta → **stalking**

#### FASE: Striking (Disparando)
- **Duración**: 1 frame instantáneo
- **Acción**: Marca strike ejecutado
- **Transiciona**: Inmediatamente a **learning**
- **Stats**: `strikesThisSession++`

#### FASE: Learning (Aprendiendo)
- **Duración**: 10 frames (cooldown)
- **Acción**: **NADA** - solo espera
- **Transiciona**: De vuelta a **stalking**

---

## 💭 PARTE 2: DREAM ENGINE - EL SIMULADOR

### 📐 ARQUITECTURA

El Dream Engine **NO ejecuta nada**. Solo **recomienda**.

```
Input: TitanStabilizedState
  ↓
Determinar Contexto (low_energy | building | recovering | stable)
  ↓
Generar 7 Escenarios (según prioridades del contexto)
  ↓
Simular belleza de cada escenario
  ↓
Ordenar por Score Combinado
  ↓
Output: DreamResult con recomendación
```

### 🎨 TIPOS DE ESCENARIOS (11 Total)

| Tipo | Qué Hace | Hardcode |
|------|----------|----------|
| `hue_shift` | Cambiar hue principal | Deltas: [0, ±13, ±21, ±34, ±55, ±89, 144, 180] (Fibonacci) |
| `saturation_boost` | +15% saturación | `saturationMod = 1.15` |
| `saturation_reduce` | -10% saturación | `saturationMod = 0.9` |
| `temperature_warm` | Shift hacia amarillos | `hue ± 15°` |
| `temperature_cool` | Shift hacia azules | `hue ± 20°` |
| `contrast_increase` | +15% contraste | `sat=1.1, bright=1.1` |
| `contrast_decrease` | -10% contraste | `sat=0.95, bright=0.95` |
| `harmony_shift` | Cambio triádico | `hue + 120°` |
| `energy_prepare` | Preparar para drop | `sat=1.1, bright=0.95` |
| `energy_recover` | Recuperar post-drop | `sat=0.9, bright=1.05` |
| `hold_steady` | No hacer nada | `sat=1.0, bright=1.0` |

### 🔢 CONFIGURACIÓN (DEFAULT_CONFIG)

```typescript
maxScenarios: 7                 // Simula 7 escenarios máximo
minBeautyImprovement: 0.05      // 5% mejora mínima para ejecutar
maxAcceptableRisk: 0.6          // 60% riesgo máximo
beautyWeight: 1.618             // PHI - Belleza es lo MÁS importante
riskWeight: -1.0                // Riesgo resta 1:1
consonanceWeight: 0.618         // Inverso de PHI
```

### 🧮 SCORE DE ESCENARIO

Cada escenario se puntúa así:

```typescript
score = 
  (beautyDelta    * PHI)    +   // La mejora de belleza es clave
  (riskLevel      * -1.0)   +   // El riesgo resta
  (consonance     * 0.618)      // La coherencia suma
```

Luego se ordenan de **mayor a menor** score.

### 🎯 RECOMENDACIÓN FINAL

```typescript
if (bestScenario === null) {
  return 'abort'
}

if (beautyDelta < minBeautyImprovement) {
  return 'abort'  // No vale la pena el cambio
}

if (riskLevel > maxAcceptableRisk) {
  return 'modify'  // Demasiado arriesgado, ajustar
}

return 'execute'  // ¡Adelante!
```

### 📊 PRIORIDADES POR CONTEXTO

```typescript
SCENARIO_PRIORITIES = {
  'low_energy': [
    'hue_shift', 'harmony_shift', 'temperature_warm',
    'saturation_boost', 'contrast_increase'
  ],
  
  'building': [
    'energy_prepare', 'saturation_boost', 'contrast_increase',
    'temperature_cool', 'hue_shift'
  ],
  
  'recovering': [
    'energy_recover', 'saturation_reduce', 'temperature_warm',
    'contrast_decrease', 'hold_steady'
  ],
  
  'stable': [
    'hold_steady', 'hue_shift', 'harmony_shift',
    'saturation_boost', 'temperature_warm'
  ]
}
```

---

## ⚡ PARTE 3: ¿QUÉ EJECUTA UN STRIKE?

### 📝 DecisionMaker.generateStrikeDecision()

Cuando se ejecuta un Strike, esto es lo que **REALMENTE** pasa:

```typescript
// 1. COLOR DECISION
colorDecision = {
  suggestedStrategy: emotionalTension > 0.6 
    ? 'complementary'   // Colores opuestos (dramático)
    : 'triadic',        // Triángulo armónico

  saturationMod: 1.0 + (beautyScore * 0.15),  // +0% a +15%
  brightnessMod: 1.0 + (rhythmIntensity * 0.10),  // +0% a +10%
  
  confidence: huntConfidence,
  reasoning: "Strike (beauty=0.XX)"
}

// 2. PHYSICS MODIFIER
physicsModifier = {
  strobeIntensity: 0.7 + (rhythmIntensity * 0.3),  // 70%-100%
  flashIntensity: 0.8 + (beautyScore * 0.2),       // 80%-100%
  confidence: huntConfidence
}
```

### ⚠️ LO QUE **NO** HACE:

- ❌ NO dispara Solar Flare (eso es del SeleneLux / física)
- ❌ NO guarda nada en DB
- ❌ NO ejecuta efectos especiales hardcodeados
- ❌ NO cambia el vibe
- ❌ NO cambia la estrategia de movimiento

### ✅ LO QUE **SÍ** HACE:

- ✅ Sugiere cambio de estrategia de color (complementary/triadic)
- ✅ Modifica saturación +0-15%
- ✅ Modifica brillo +0-10%
- ✅ Aumenta intensidad de strobe al 70-100%
- ✅ Aumenta intensidad de flash al 80-100%

---

## 🚀 PARTE 4: COMPARACIÓN V1 vs V2

| Aspecto | V1 (Legacy) | V2 (Genesis) |
|---------|-------------|--------------|
| **Caza** | 5 métricas + DB | 4 condiciones (beauty, consonance, trend, urgency) |
| **Strike** | Guarda patrón + efecto en DB | Ejecuta cambio agresivo (NO guarda) |
| **Persistencia** | Sí (DB con feedback evolutivo) | **NO** (stateless cada frame) |
| **Dream** | ??? | Simula 7 escenarios alternativos |
| **Feedback** | Evolución cada X tiempo | **NO HAY FEEDBACK** (aún) |
| **Solar Flare** | ??? | NO conectado (aún) |

---

## 🔴 DIAGNÓSTICO: ¿POR QUÉ ESTÁ "TÍMIDA"?

### PROBLEMA 1: Umbrales Conservadores

```typescript
beautyThreshold: 0.65   // 65% es ALTO
consonanceThreshold: 0.60  // Requiere mucha coherencia
```

**Solución**: Bajar a `0.55` y `0.50` respectivamente.

### PROBLEMA 2: Cooldown Muy Corto

```typescript
learningCooldownFrames: 10  // Solo 166ms de pausa
```

Pero el problema es que después vuelve a **stalking**, que necesita mínimo 5 frames más.

**Total cooldown real**: ~15 frames = 250ms entre strikes.

**Solución**: Aumentar `minStalkingFrames` a 15-30 para strikes menos frecuentes.

### PROBLEMA 3: No Hay Persistencia

La V2 **NO APRENDE** entre sesiones. Cada vez que arranca, vuelve a cero.

### PROBLEMA 4: No Fuerza Solar Flare

El `physicsModifier` solo ajusta intensidades, **NO dispara eventos**.

---

## 💡 PARTE 5: RESPUESTAS A TUS PREGUNTAS

### 1. ¿Cuál es la Condición de Victoria (Strike)?

```
beautyScore >= 0.65 &&
consonanceScore >= 0.60 &&
beautyTrend !== 'falling'
```

**O** forzado si `urgencyScore > 0.90 && beautyScore >= 0.65`.

---

### 2. ¿El Strike ejecuta cambio drástico o guarda en DB?

**Ejecuta cambio drástico** de:
- Estrategia de color (complementary/triadic)
- Saturación (+0-15%)
- Brillo (+0-10%)
- Strobe (70-100%)
- Flash (80-100%)

**NO guarda en DB**. La V2 no tiene persistencia.

---

### 3. ¿Cuáles son los umbrales actuales?

```typescript
beautyThreshold: 0.65        // ⚠️ MUY ALTO
consonanceThreshold: 0.60    // ⚠️ MUY ALTO
urgencyForceThreshold: 0.90  // OK
minStalkingFrames: 5         // ⚠️ MUY RÁPIDO
```

---

### 4. ¿Podemos forzar Solar Flare desde un Strike?

**ACTUALMENTE NO.**

El Strike solo modifica `strobeIntensity` y `flashIntensity`.

El **Solar Flare** está en `SeleneLux` (el sistema nervioso) y se dispara por:
- Drops físicos (FSM de energía)
- Comandos manuales

**PERO PODRÍAMOS:**

Añadir en `ConsciousnessOutput`:

```typescript
interface ConsciousnessPhysicsModifier {
  strobeIntensity?: number
  flashIntensity?: number
  triggerThresholdMod?: number
  forceSolarFlare?: boolean  // ← NUEVO
  confidence: number
}
```

Y en `SeleneLux`:

```typescript
if (consciousnessOutput.physicsModifier?.forceSolarFlare) {
  this.triggerSolarFlare('consciousness_strike')
}
```

---

### 5. ¿El Dream Engine usa valores hardcodeados?

**SÍ, TODO ES HARDCODE:**

- Deltas de hue: Fibonacci [13, 21, 34, 55, 89, 144, 180]
- Modificadores de saturación: 1.15, 0.9, 1.1, 0.95
- Modificadores de brillo: 1.05, 0.95, 1.1
- Shifts de temperatura: ±15°, ±20°
- Shift triádico: +120°

**NO HAY** ML, NO HAY learning, NO HAY adaptación.

Es **determinista** pero **NO estúpido** - usa Fibonacci para armonía natural.

---

### 6. ¿Qué nos está mostrando exactamente el HUD?

| Campo HUD | Fuente | Qué Es |
|-----------|--------|--------|
| **Hunt State** | `HuntEngine.state.phase` | sleeping/stalking/evaluating/striking/learning |
| **Confidence** | `ConsciousnessOutput.confidence` | Confianza combinada (hunt + prediction + beauty) |
| **Prediction** | `PredictionEngine.prediction.type` | "DROP_INCOMING - 71%" si hay predicción activa |
| **PHI** | `BeautySensor.totalBeauty * 1.618` | Belleza como ratio Fibonacci |
| **Consonance** | `ConsonanceSensor.totalConsonance` | Coherencia con estado anterior |
| **VETO** | `smoothedEnergy >= 0.85` | Energy Override activo (física manda) |

---

## 🔧 PARTE 6: RECOMENDACIONES DEL ARQUITECTO

### 🎯 Para Hacer el Hunt Más Agresivo

```typescript
const DEFAULT_CONFIG: HuntConfig = {
  minStalkingFrames: 15,       // ← Cambiar de 5 a 15 (más paciente)
  maxStalkingFrames: 90,       // ← Cambiar de 60 a 90 (busca más tiempo)
  beautyThreshold: 0.55,       // ← BAJAR de 0.65 a 0.55
  consonanceThreshold: 0.50,   // ← BAJAR de 0.60 a 0.50
  urgencyForceThreshold: 0.85, // ← BAJAR de 0.90 a 0.85
  maxEvaluatingFrames: 20,     // ← Cambiar de 15 a 20 (evalúa más)
  learningCooldownFrames: 20,  // ← DOBLAR de 10 a 20 (cooldown más largo)
}
```

### ⚡ Para Conectar Solar Flare

1. Añadir `forceSolarFlare?: boolean` a `ConsciousnessPhysicsModifier`
2. En `DecisionMaker.generateStrikeDecision()`:
   ```typescript
   physicsModifier: {
     strobeIntensity: 0.7 + pattern.rhythmicIntensity * 0.3,
     flashIntensity: 0.8 + beauty.totalBeauty * 0.2,
     forceSolarFlare: true,  // ← NUEVO
     confidence: confidence
   }
   ```
3. En `SeleneLux.update()`:
   ```typescript
   if (this.consciousnessEnabled && 
       consciousnessOutput.physicsModifier?.forceSolarFlare) {
     this.solarFlare.trigger('consciousness_strike')
   }
   ```

### 💾 Para Añadir Persistencia (Futuro)

Crear `src/core/memory/`:
- `PatternMemory.ts` - Guarda strikes exitosos
- `EvolutionEngine.ts` - Aprende de aciertos/errores
- `FeedbackCollector.ts` - Pregunta al usuario cada X strikes

---

## 📊 ESTADÍSTICAS ACTUALES

Según `getHuntStats()` y `getDreamStats()`:

```typescript
huntStats = {
  strikes: 0,                    // Strikes ejecutados esta sesión
  lastStrike: 0                  // Timestamp del último strike
}

dreamStats = {
  totalDreams: N,                // Total de simulaciones
  lastDream: DreamResult | null  // Último sueño
}
```

**Nota**: En tu HUD muestra `EVALUATING` con `65%` confidence, lo que significa:

- ✅ Hunt encontró un candidato
- ✅ Está en evaluating (evaluando condiciones)
- ⚠️ Confidence 65% < 70% requerida para strike
- ⚠️ Alguna condición no se cumple (probablemente consonance o trend)

---

## 🎬 CONCLUSIÓN

### LO QUE HACE BIEN:

✅ Arquitectura limpia (sense → think → dream → validate)  
✅ Usa Fibonacci para armonía natural  
✅ Energy Override funciona perfecto  
✅ Simula futuros antes de actuar  
✅ No rompe la Constitución  

### LO QUE FALTA:

❌ Persistencia (DB)  
❌ Aprendizaje entre sesiones  
❌ Conexión con Solar Flare  
❌ Feedback del usuario  
❌ Ajuste dinámico de umbrales  

### EL VEREDICTO:

La V2 es **ARQUITECTÓNICAMENTE SUPERIOR** a la V1.  
Pero está configurada **DEMASIADO CONSERVADORA** y le falta **PERSISTENCIA**.

Con los ajustes de umbrales y la conexión de Solar Flare, **será una bestia**.

---

🔬 **WAVE 555: FORENSIC COMPLETE** 🔬

*"Ahora sabes exactamente qué hace cada neurona del cerebro de Selene."*

---

## 📎 ANEXO: CÓDIGO PARA COPIAR/PEGAR

### Umbrales Agresivos (HuntEngine.ts línea 112)

```typescript
const DEFAULT_CONFIG: HuntConfig = {
  minStalkingFrames: 15,
  maxStalkingFrames: 90,
  beautyThreshold: 0.55,        // ← CAMBIO
  consonanceThreshold: 0.50,    // ← CAMBIO
  urgencyForceThreshold: 0.85,  // ← CAMBIO
  maxEvaluatingFrames: 20,
  learningCooldownFrames: 20,
}
```

### Solar Flare Strike (ConsciousnessOutput.ts)

```typescript
export interface ConsciousnessPhysicsModifier {
  strobeIntensity?: number
  flashIntensity?: number
  triggerThresholdMod?: number
  forceSolarFlare?: boolean  // ← AÑADIR ESTO
  confidence: number
}
```
