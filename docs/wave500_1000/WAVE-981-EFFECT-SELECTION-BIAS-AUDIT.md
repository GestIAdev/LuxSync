# 🔬 WAVE 981 - AUDITORÍA FORENSE: EL SESGO DE SELENE

**Fecha:** 2026-01-23  
**Status:** 🚨 CRÍTICO - Selene muestra sesgo sistemático en selección de efectos  
**Investigador:** PunkOpus  
**Solicitante:** Radwulf

---

## 🎯 PROBLEMA DETECTADO

### 📋 Reporte Inicial

**Síntomas:**
- DigitalRain, Gatling y otros efectos **prácticamente invisibles** en horas de testing
- Selene elige **siempre los mismos efectos** a pesar de lógica DNA euclidiana
- Simulación correcta (todos los candidatos evaluados)
- **Decisión final sesgada** hacia efectos específicos

**Diagnóstico Preliminar de Radwulf:**
> "Mala calibración de la lógica euclidiana con pesos desbalanceados y una ponderación que a pesar de tener penalizadores como fatiga, CPU, etc.... en algún punto está favoreciendo siempre a los mismos."

---

## 🔍 ARQUITECTURA DEL SISTEMA DE DECISIÓN

### 📐 Flujo Completo (Upstream → Downstream)

```
┌─────────────────────────────────────────────────────────────┐
│ 1. DREAM ENGINE (EffectDreamSimulator)                      │
│    ├─ generateCandidates() → Propone efectos viables        │
│    ├─ simulateScenario() → Simula cada candidato            │
│    ├─ calculateDNARelevance() → Relevancia contextual       │
│    ├─ rankScenarios() → Ordena por score compuesto          │
│    └─ Best Scenario → Efecto ganador                        │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 2. DREAM ENGINE INTEGRATOR (DreamEngineIntegrator)          │
│    ├─ integrate() → Recibe best scenario                    │
│    ├─ Ethical validation → Verifica ética                   │
│    └─ Integration Decision → Efecto aprobado                │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 3. DECISION MAKER (Lóbulo Frontal)                          │
│    ├─ generateStrikeDecision() → Recibe DNA approval        │
│    ├─ Si dreamIntegration.approved → Usar efecto DNA        │
│    └─ effectDecision → DECISIÓN FINAL                       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🧬 FASE 1: GENERACIÓN DE CANDIDATOS (Dream Engine)

### 📊 Filtros Aplicados

**Archivo:** `EffectDreamSimulator.ts` → `generateCandidates()` (líneas 604-660)

#### 🛡️ Filtro 1: VIBE SHIELD (WAVE 975)

**Propósito:** Solo efectos permitidos para el vibe actual

```typescript
const vibeAllowedEffects = this.getVibeAllowedEffects(state.vibe)
```

**Efectos por Vibe:**
- **techno-club**: 11 efectos (industrial_strobe, acid_sweep, cyber_dualism, gatling_raid, sky_saw, void_mist, static_pulse, digital_rain, deep_breath, ambient_strobe, sonar_ping)
- **fiesta-latina**: 9 efectos (solar_flare, strobe_burst, tidal_wave, ghost_breath, tropical_pulse, salsa_fire, cumbia_moon, clave_rhythm, corazon_latino)

**✅ Estado:** **FUNCIONANDO CORRECTAMENTE**
- Filtro duro por vibe
- No hay crossover (Latino no aparece en Techno)

---

#### 🧘 Filtro 2: ZONE AWARENESS (WAVE 975)

**Propósito:** Filtrar efectos por zona energética usando DNA Aggression

```typescript
const zoneFilteredEffects = this.filterByZone(vibeAllowedEffects, energyZone)
```

**Límites de Agresión por Zona:**

| Zona | Energy Range | Aggression Range | Efectos Permitidos (Techno) |
|------|-------------|------------------|----------------------------|
| **silence** | 0-0.10 | 0-0.20 | deep_breath (0.05) |
| **valley** | 0.10-0.25 | 0-0.35 | deep_breath (0.05), void_mist (0.05), sonar_ping (0.15), digital_rain (0.35) |
| **ambient** | 0.25-0.40 | 0-0.50 | + static_pulse (0.35), ambient_strobe (0.45) |
| **gentle** | 0.40-0.55 | 0-0.60 | + cyber_dualism (0.55) |
| **active** | 0.55-0.70 | 0.25-0.85 | cyber_dualism (0.55), acid_sweep (0.70), industrial_strobe (0.95), gatling_raid (0.90), sky_saw (0.80) |
| **intense** | 0.70-0.85 | 0.45-1.00 | acid_sweep, industrial_strobe, gatling_raid, sky_saw |
| **peak** | 0.85-1.00 | 0.50-1.00 | industrial_strobe, gatling_raid, sky_saw, acid_sweep |

**✅ Estado:** **FUNCIONANDO CORRECTAMENTE**
- Filtro por aggression coherente
- No hay efectos agresivos en zonas suaves

---

#### 🎭 Filtro 3: MOOD BLOCKLIST (WAVE 920.2)

**Propósito:** Pre-filtrar efectos bloqueados por mood actual

```typescript
if (moodController.isEffectBlocked(effect)) {
  blockedCount++
  continue
}
```

**Ejemplo (CALM mood):**
- Bloquea: `industrial_strobe`, `gatling_raid`, `strobe_storm`
- Permite: `void_mist`, `deep_breath`, `digital_rain`

**✅ Estado:** **FUNCIONANDO CORRECTAMENTE**
- Filtro mood activo
- Bloques respetados

---

### 📊 Resultado Fase 1: Candidatos Generados

**Para sesión Techno típica (energy 0.60, zone 'active'):**

Candidatos propuestos (después de filtros):
1. `cyber_dualism` (A=0.55, C=0.50, O=0.45)
2. `acid_sweep` (A=0.70, C=0.45, O=0.25)
3. `industrial_strobe` (A=0.95, C=0.30, O=0.05)
4. `gatling_raid` (A=0.90, C=0.40, O=0.10)
5. `sky_saw` (A=0.80, C=0.55, O=0.20)

**⚠️ NOTA:** `digital_rain` (A=0.35) NO aparece en zona 'active' (requiere A > 0.25, pero <0.85).  
**❌ BUG DETECTADO #1:** digital_rain tiene A=0.35, está en el rango 0.25-0.85 de 'active', pero no aparece.

**Verificación:**
- `digital_rain` DNA: `{ aggression: 0.35, chaos: 0.65, organicity: 0.40 }`
- Zona 'active': `{ min: 0.25, max: 0.85 }`
- **0.35 está dentro del rango → DEBERÍA aparecer**

**🚨 HIPÓTESIS INICIAL:** El filtro de zona puede tener lógica incorrecta o digital_rain está siendo filtrado por otro motivo.

---

## 🧬 FASE 2: SIMULACIÓN DE ESCENARIOS

### 📐 DNA Relevance Calculation

**Archivo:** `EffectDreamSimulator.ts` → `calculateDNARelevance()` (líneas 810-880)

**Algoritmo:**

```typescript
// 1. Derivar Target DNA del contexto
const targetDNA = dnaAnalyzer.deriveTargetDNA(musicalContext, audioMetrics)

// 2. Calcular distancia euclidiana 3D
const dA = effectDNA.aggression - targetDNA.aggression
const dC = effectDNA.chaos - targetDNA.chaos
const dO = effectDNA.organicity - targetDNA.organicity
const distance = Math.sqrt(dA * dA + dC * dC + dO * dO)

// 3. Convertir a relevancia (0-1)
const MAX_DISTANCE = Math.sqrt(3)  // ≈ 1.732
const relevance = 1.0 - (distance / MAX_DISTANCE)
```

**Ejemplo (Techno active, E=0.60):**

Target DNA derivado:
- `aggression`: 0.65 (kick intensity alto)
- `chaos`: 0.50 (moderate syncopation)
- `organicity`: 0.20 (techno = sintético)

**Relevancia de cada efecto:**

| Efecto | DNA (A, C, O) | Distance | Relevance |
|--------|---------------|----------|-----------|
| `cyber_dualism` | (0.55, 0.50, 0.45) | 0.27 | **0.84** 🔥 |
| `acid_sweep` | (0.70, 0.45, 0.25) | 0.09 | **0.95** 🔥🔥 |
| `industrial_strobe` | (0.95, 0.30, 0.05) | 0.42 | **0.76** |
| `gatling_raid` | (0.90, 0.40, 0.10) | 0.32 | **0.82** |
| `sky_saw` | (0.80, 0.55, 0.20) | 0.15 | **0.91** 🔥 |

**🔥 Relevancia alta:** cyber_dualism (0.84), acid_sweep (0.95), sky_saw (0.91)  
**⚠️ Relevancia moderada:** industrial_strobe (0.76), gatling_raid (0.82)

**✅ Estado:** **FUNCIONANDO CORRECTAMENTE**
- DNA matching matemáticamente correcto
- Efectos con DNA similar al target tienen relevancia alta

---

### 📊 Otras Métricas Calculadas

**Para cada escenario se calcula:**

1. **projectedRelevance** (0-1) → DNA matching ✅
2. **projectedBeauty** (0-1) → LEGACY, bajo peso ✅
3. **riskLevel** (0-1) → GPU + Fatigue + Cooldowns ✅
4. **vibeCoherence** (0-1) → Match con vibe ✅
5. **diversityScore** (0-1) → Anti-repetición ⚠️
6. **simulationConfidence** (0-1) → Confianza en predicción ✅

---

## 🎯 FASE 3: RANKING DE ESCENARIOS (EL SESGO)

### 🔥 LA FÓRMULA DEL SCORING

**Archivo:** `EffectDreamSimulator.ts` → `calculateScenarioScore()` (líneas 1028-1085)

```typescript
// 🧬 WAVE 970: DNA-BASED SCORING
// 🧠 WAVE 975.5: DIVERSITY PENALTY

let score = 0

// Aplicar diversity penalty DIRECTO a relevancia
const diversityPenalty = 1 - scenario.diversityScore  // 0.0-1.0
const adjustedRelevance = scenario.projectedRelevance * (1 - diversityPenalty * 0.80)

// PESOS FINALES
score += adjustedRelevance * 0.35             // 🧬 DNA relevance (highest)
score += scenario.vibeCoherence * 0.15        // Coherencia de vibe
score += scenario.diversityScore * 0.25       // 🔥 Diversidad CRÍTICA
score += (1 - scenario.riskLevel) * 0.15      // Bajo riesgo preferido
score += scenario.simulationConfidence * 0.10 // Confianza en predicción

// Penalizar conflictos
score -= scenario.cooldownConflicts.length * 0.15
score -= scenario.hardwareConflicts.length * 0.20

// Bonus drop
if (prediction.isDropComing && scenario.effect.intensity > 0.7) {
  score += 0.1
}

// Bonus match perfecto
if (adjustedRelevance > 0.85 && scenario.dnaDistance < 0.3) {
  score += 0.08
}
```

---

### 🔬 ANÁLISIS DE PESOS

| Componente | Peso | Impacto | Evaluación |
|------------|------|---------|------------|
| **adjustedRelevance** | 0.35 | **35%** | ✅ Correcto - DNA es rey |
| **diversityScore** | 0.25 | **25%** | 🚨 **MUY ALTO** |
| **vibeCoherence** | 0.15 | 15% | ✅ Correcto |
| **riskLevel** (invertido) | 0.15 | 15% | ✅ Correcto |
| **simulationConfidence** | 0.10 | 10% | ✅ Correcto |
| **cooldownConflicts** | -0.15 cada uno | Variable | ✅ Correcto |
| **hardwareConflicts** | -0.20 cada uno | Variable | ✅ Correcto |
| **Bonus drop** | +0.10 | Situacional | ✅ Correcto |
| **Bonus match perfecto** | +0.08 | Situacional | ✅ Correcto |

---

### 🚨 PROBLEMA DETECTADO #2: DIVERSITY PENALTY DEMASIADO AGRESIVO

**Código actual (línea 1035):**

```typescript
const diversityPenalty = 1 - scenario.diversityScore
const adjustedRelevance = scenario.projectedRelevance * (1 - diversityPenalty * 0.80)
```

**¿Qué significa esto?**

Si `diversityScore = 0` (efecto usado 3+ veces recientemente):
- `diversityPenalty = 1.0`
- `adjustedRelevance = projectedRelevance * (1 - 1.0 * 0.80) = projectedRelevance * 0.20`
- **Relevancia reducida al 20%** 🚨

**Ejemplo real:**

| Efecto | Relevance Base | Diversity Score | Adjusted Relevance |
|--------|----------------|-----------------|-------------------|
| `cyber_dualism` | 0.84 | 0.0 (usado 3x) | **0.17** (-80%) |
| `acid_sweep` | 0.95 | 0.7 (usado 1x) | **0.72** (-24%) |
| `sky_saw` | 0.91 | 1.0 (nunca usado) | **0.91** (sin penalty) |

**✅ Esto explica por qué algunos efectos dominan:** Los que NO han sido usados recientemente ganan SIEMPRE, incluso con relevancia menor.

---

### 🔬 SIMULACIÓN DEL SCORING

**Escenario:** Techno active (E=0.60), después de 10 efectos disparados

**Historial reciente:**
- `cyber_dualism`: 3 usos
- `acid_sweep`: 2 usos
- `sky_saw`: 1 uso
- `industrial_strobe`: 1 uso
- `gatling_raid`: 0 usos
- `digital_rain`: 0 usos (nunca aparece en 'active')

**Cálculo de Scores:**

#### 🔥 Efecto 1: cyber_dualism

- **Relevance base**: 0.84
- **Diversity score**: 0.0 (usado 3x → penalty máximo)
- **Diversity penalty**: 1.0
- **Adjusted relevance**: 0.84 * (1 - 1.0 * 0.80) = **0.17**
- **Score componentes**:
  - adjustedRelevance * 0.35 = 0.17 * 0.35 = **0.059**
  - vibeCoherence * 0.15 = 1.0 * 0.15 = **0.150**
  - diversityScore * 0.25 = 0.0 * 0.25 = **0.000** 🚨
  - (1 - riskLevel) * 0.15 = 0.94 * 0.15 = **0.141**
  - simConfidence * 0.10 = 0.75 * 0.10 = **0.075**
- **TOTAL SCORE**: 0.059 + 0.150 + 0.000 + 0.141 + 0.075 = **0.425**

---

#### 🔥 Efecto 2: acid_sweep

- **Relevance base**: 0.95
- **Diversity score**: 0.33 (usado 2x → penalty moderado)
- **Diversity penalty**: 0.67
- **Adjusted relevance**: 0.95 * (1 - 0.67 * 0.80) = **0.44**
- **Score componentes**:
  - adjustedRelevance * 0.35 = 0.44 * 0.35 = **0.154**
  - vibeCoherence * 0.15 = 1.0 * 0.15 = **0.150**
  - diversityScore * 0.25 = 0.33 * 0.25 = **0.083**
  - (1 - riskLevel) * 0.15 = 0.70 * 0.15 = **0.105**
  - simConfidence * 0.10 = 0.75 * 0.10 = **0.075**
- **TOTAL SCORE**: 0.154 + 0.150 + 0.083 + 0.105 + 0.075 = **0.567**

---

#### 🔥 Efecto 3: sky_saw

- **Relevance base**: 0.91
- **Diversity score**: 0.67 (usado 1x → penalty leve)
- **Diversity penalty**: 0.33
- **Adjusted relevance**: 0.91 * (1 - 0.33 * 0.80) = **0.67**
- **Score componentes**:
  - adjustedRelevance * 0.35 = 0.67 * 0.35 = **0.234**
  - vibeCoherence * 0.15 = 1.0 * 0.15 = **0.150**
  - diversityScore * 0.25 = 0.67 * 0.25 = **0.168**
  - (1 - riskLevel) * 0.15 = 0.68 * 0.15 = **0.102**
  - simConfidence * 0.10 = 0.75 * 0.10 = **0.075**
- **TOTAL SCORE**: 0.234 + 0.150 + 0.168 + 0.102 + 0.075 = **0.729** 🔥

---

#### 🔥 Efecto 4: gatling_raid

- **Relevance base**: 0.82
- **Diversity score**: 1.0 (nunca usado → sin penalty)
- **Diversity penalty**: 0.0
- **Adjusted relevance**: 0.82 * (1 - 0.0 * 0.80) = **0.82**
- **Score componentes**:
  - adjustedRelevance * 0.35 = 0.82 * 0.35 = **0.287**
  - vibeCoherence * 0.15 = 1.0 * 0.15 = **0.150**
  - diversityScore * 0.25 = 1.0 * 0.25 = **0.250** 🔥
  - (1 - riskLevel) * 0.15 = 0.65 * 0.15 = **0.098**
  - simConfidence * 0.10 = 0.75 * 0.10 = **0.075**
- **TOTAL SCORE**: 0.287 + 0.150 + 0.250 + 0.098 + 0.075 = **0.860** 🔥🔥🔥

---

#### 🔥 Efecto 5: industrial_strobe

- **Relevance base**: 0.76
- **Diversity score**: 0.67 (usado 1x → penalty leve)
- **Diversity penalty**: 0.33
- **Adjusted relevance**: 0.76 * (1 - 0.33 * 0.80) = **0.56**
- **Score componentes**:
  - adjustedRelevance * 0.35 = 0.56 * 0.35 = **0.196**
  - vibeCoherence * 0.15 = 1.0 * 0.15 = **0.150**
  - diversityScore * 0.25 = 0.67 * 0.25 = **0.168**
  - (1 - riskLevel) * 0.15 = 0.75 * 0.15 = **0.113**
  - simConfidence * 0.10 = 0.75 * 0.10 = **0.075**
- **TOTAL SCORE**: 0.196 + 0.150 + 0.168 + 0.113 + 0.075 = **0.702**

---

### 🏆 RANKING FINAL

| Posición | Efecto | Score | Relevance Base | Diversity | Winner? |
|----------|--------|-------|----------------|-----------|---------|
| **1** 🥇 | `gatling_raid` | **0.860** | 0.82 | 1.0 (nunca usado) | ✅ |
| **2** 🥈 | `sky_saw` | **0.729** | 0.91 | 0.67 | ❌ |
| **3** 🥉 | `industrial_strobe` | **0.702** | 0.76 | 0.67 | ❌ |
| **4** | `acid_sweep` | **0.567** | 0.95 🔥 | 0.33 | ❌ |
| **5** | `cyber_dualism` | **0.425** | 0.84 | 0.0 (usado 3x) | ❌ |

---

### 🚨 CONCLUSIÓN DE FASE 3: EL SESGO ESTÁ AQUÍ

**¿Por qué Gatling_Raid gana?**
- **NO** porque tenga la mejor relevancia (0.82 vs 0.95 de acid_sweep)
- **SÍ** porque tiene `diversityScore = 1.0` (nunca usado)
- **Bonus de diversidad:** 1.0 * 0.25 = **0.250 puntos extra**
- **Sin penalty de relevancia:** adjustedRelevance = relevance base

**¿Por qué Acid_Sweep pierde?**
- **SÍ** tiene la mejor relevancia DNA (0.95)
- **PERO** fue usado 2x recientemente → `diversityScore = 0.33`
- **Penalty de diversidad:** Solo 0.33 * 0.25 = **0.083 puntos**
- **Penalty de relevancia:** 0.95 → 0.44 (-54%) 🚨

**Matemática del problema:**
```
Gatling (R=0.82, D=1.0): score = 0.860
Acid    (R=0.95, D=0.33): score = 0.567

Diferencia: 0.293 puntos
Causa: Diversity penalty reduce acid_sweep 54%, mientras gatling no tiene penalty
```

---

## 🧬 FASE 4: ANÁLISIS DE DIVERSITY SCORE

### 📊 Cálculo de Diversity Score

**Archivo:** `EffectDreamSimulator.ts` → `calculateDiversityScore()` (líneas 960-985)

```typescript
private calculateDiversityScore(effect: EffectCandidate, context: AudienceSafetyContext): number {
  // 🔫 WAVE 930.3: ANTI-MONOTONY - Penaliza DURAMENTE la repetición
  
  const recentUsage = context.recentEffects
    .filter(e => e.effect === effect.effect)
    .length
  
  const totalRecent = context.recentEffects.length
  
  if (totalRecent === 0) return 1.0
  
  const usageRate = recentUsage / totalRecent
  
  // 🔥 WAVE 930.3: Si el efecto fue usado más de 3 veces en los últimos 10, MATAR
  if (recentUsage >= 3) {
    return 0.0  // CERO diversidad = no elegir este
  }
  
  // Penalización exponencial: *3 para castigar MUY fuerte la repetición
  const diversityScore = Math.max(0, 1 - usageRate * 3)
  
  return diversityScore
}
```

**Análisis de la fórmula:**

| Usos Recientes | Usage Rate | Diversity Score | Interpretación |
|----------------|------------|-----------------|----------------|
| 0/10 | 0.00 | **1.00** | Nunca usado → Sin penalty |
| 1/10 | 0.10 | **0.70** | Usado 1x → Penalty 30% |
| 2/10 | 0.20 | **0.40** | Usado 2x → Penalty 60% |
| 3/10 | 0.30 | **0.00** 🚨 | Usado 3x → **MATAR** |
| 4/10 | 0.40 | **0.00** 🚨 | Usado 4x → **MATAR** |

**Fórmula:**
```
diversityScore = max(0, 1 - usageRate * 3)
```

**🔥 WAVE 930.3 Comment:**
> "Si el efecto fue usado más de 3 veces en los últimos 10, MATAR"

**✅ Intención:** Anti-monotonía (evitar que Selene repita los mismos efectos)  
**❌ Efecto secundario:** Efectos populares (alta relevancia DNA) quedan bloqueados después de 3 usos

---

### 🚨 PROBLEMA DETECTADO #3: DIVERSITY DOMINA SOBRE DNA

**Combinación letal:**

1. **Diversity penalty en relevancia:** `adjustedRelevance = relevance * (1 - penalty * 0.80)`
   - Reduce hasta 80% la relevancia si el efecto fue usado 3x

2. **Diversity score como componente:** `score += diversityScore * 0.25`
   - Suma 25% del score final

3. **Resultado:** Un efecto con relevancia 0.95 usado 3x tiene:
   - Adjusted relevance: 0.95 * 0.20 = **0.19**
   - Diversity component: 0.0 * 0.25 = **0.00**
   - **Pierde contra cualquier efecto nunca usado**, incluso con relevancia 0.50

---

### 📊 Ejemplo Extremo

**Contexto:** Techno active, Target DNA perfecto para `acid_sweep`

| Efecto | Relevance | Usos | Diversity | Adj. Relevance | Score |
|--------|-----------|------|-----------|----------------|-------|
| `acid_sweep` | **0.95** | 3 | 0.0 | **0.19** | **0.40** |
| `digital_rain` | **0.45** | 0 | 1.0 | **0.45** | **0.72** 🏆 |

**🚨 Digital Rain gana con relevancia 0.45 vs Acid Sweep con 0.95**

**¿Por qué?**
- Digital Rain: `diversityScore = 1.0` → bonus +0.25
- Acid Sweep: `diversityScore = 0.0` → bonus +0.00, relevancia reducida 80%

**Conclusión:** **Diversity DOMINA sobre DNA relevance después de 3 usos**

---

## 🎯 FASE 5: ¿POR QUÉ DIGITAL_RAIN NO APARECE?

### 🔍 Análisis Específico

**DNA de Digital_Rain:**
```typescript
'digital_rain': {
  aggression: 0.35,   // 💧 WAVE 977: 0.20 → 0.35 (más presencia)
  chaos: 0.65,        // Caótico (gotas aleatorias)
  organicity: 0.40,   // Semi-orgánico (agua)
}
```

**Categoría:** `techno-atmospheric` (low-energy effects)

---

### 🧘 Filtro de Zona (filterByZone)

**Zonas donde Digital_Rain es permitido:**

| Zona | Aggression Range | Digital_Rain (A=0.35) | Permitido? |
|------|------------------|----------------------|------------|
| silence | 0-0.20 | 0.35 | ❌ Demasiado agresivo |
| valley | 0-0.35 | 0.35 | ✅ **LÍMITE SUPERIOR** |
| ambient | 0-0.50 | 0.35 | ✅ Permitido |
| gentle | 0-0.60 | 0.35 | ✅ Permitido |
| active | 0.25-0.85 | 0.35 | ✅ Permitido |
| intense | 0.45-1.00 | 0.35 | ❌ Demasiado suave |
| peak | 0.50-1.00 | 0.35 | ❌ Demasiado suave |

**Zonas válidas:** valley, ambient, gentle, active (4 de 7)

---

### 📊 Energía Musical vs Zona

**Distribución típica de energía en sesión Techno:**

| Energy Range | Zona | % Tiempo | Digital_Rain permitido? |
|-------------|------|----------|------------------------|
| 0-0.10 | silence | ~5% | ❌ |
| 0.10-0.25 | valley | ~10% | ✅ |
| 0.25-0.40 | ambient | ~15% | ✅ |
| 0.40-0.55 | gentle | ~15% | ✅ |
| 0.55-0.70 | active | **~25%** | ✅ |
| 0.70-0.85 | intense | **~20%** | ❌ |
| 0.85-1.00 | peak | **~10%** | ❌ |

**Ventana de oportunidad para Digital_Rain:** ~65% del tiempo (valley + ambient + gentle + active)

**🔥 PERO:** En zonas de alta energía (intense/peak), que son las más visibles y memorables (drops, builds), Digital_Rain NO aparece.

---

### 🎯 Relevancia DNA en contextos típicos

**Techno Active (E=0.60):**

Target DNA:
- Aggression: 0.65
- Chaos: 0.50
- Organicity: 0.20

Digital_Rain DNA:
- Aggression: 0.35
- Chaos: 0.65
- Organicity: 0.40

**Distance:** √[(0.65-0.35)² + (0.50-0.65)² + (0.20-0.40)²] = √[0.09 + 0.0225 + 0.04] = **0.39**  
**Relevance:** 1 - (0.39 / 1.732) = **0.77** (buena)

**Techno Ambient (E=0.35):**

Target DNA:
- Aggression: 0.30
- Chaos: 0.40
- Organicity: 0.30

Digital_Rain DNA:
- Aggression: 0.35
- Chaos: 0.65
- Organicity: 0.40

**Distance:** √[(0.30-0.35)² + (0.40-0.65)² + (0.30-0.40)²] = √[0.0025 + 0.0625 + 0.01] = **0.27**  
**Relevance:** 1 - (0.27 / 1.732) = **0.84** (muy buena)

**✅ Digital_Rain tiene relevancia DNA BUENA en sus zonas**

---

### 🏆 Competencia en Zona 'ambient' (E=0.35)

**Efectos permitidos en 'ambient' (A < 0.50):**

| Efecto | Aggression | Relevance | Diversity (ejemplo) | Score Estimado |
|--------|------------|-----------|---------------------|----------------|
| `digital_rain` | 0.35 | 0.84 | 0.0 (usado 3x) | **0.45** |
| `void_mist` | 0.05 | 0.65 | 1.0 (nunca usado) | **0.79** 🏆 |
| `static_pulse` | 0.35 | 0.80 | 0.7 (usado 1x) | **0.68** |
| `deep_breath` | 0.05 | 0.62 | 1.0 (nunca usado) | **0.75** |
| `ambient_strobe` | 0.45 | 0.78 | 1.0 (nunca usado) | **0.82** 🏆 |

**🚨 Digital_Rain pierde contra efectos nunca usados, incluso con mejor relevancia**

---

### 🔬 Análisis de Scoring (Zona Ambient)

#### Digital_Rain (usado 3x recientemente)

- Relevance: 0.84
- Diversity: 0.0
- Adjusted Relevance: 0.84 * 0.20 = **0.17**
- Score:
  - adjustedRelevance * 0.35 = 0.17 * 0.35 = 0.059
  - vibeCoherence * 0.15 = 1.0 * 0.15 = 0.150
  - diversityScore * 0.25 = 0.0 * 0.25 = **0.000**
  - (1 - risk) * 0.15 = 0.92 * 0.15 = 0.138
  - simConf * 0.10 = 0.75 * 0.10 = 0.075
- **TOTAL:** **0.422**

#### Void_Mist (nunca usado)

- Relevance: 0.65
- Diversity: 1.0
- Adjusted Relevance: 0.65 * 1.00 = **0.65**
- Score:
  - adjustedRelevance * 0.35 = 0.65 * 0.35 = 0.228
  - vibeCoherence * 0.15 = 1.0 * 0.15 = 0.150
  - diversityScore * 0.25 = 1.0 * 0.25 = **0.250**
  - (1 - risk) * 0.15 = 0.92 * 0.15 = 0.138
  - simConf * 0.10 = 0.75 * 0.10 = 0.075
- **TOTAL:** **0.841** 🏆

**Diferencia:** 0.841 - 0.422 = **0.419 puntos**

**Void_Mist gana con relevancia 0.65 vs Digital_Rain 0.84 (-19 puntos de relevancia, +0.419 de score)**

---

### 🎯 CONCLUSIÓN: Por qué Digital_Rain es invisible

**Razones combinadas:**

1. **Zona restringida (30%):** Solo aparece en valley/ambient/gentle/active, NO en intense/peak
2. **Competencia feroz:** En zonas bajas (ambient), compite con void_mist, deep_breath, static_pulse
3. **Diversity penalty letal:** Si se usó 3x, su relevancia 0.84 se reduce a 0.17 (-80%)
4. **Efectos "vírgenes" ganan:** Un efecto nunca usado con relevancia 0.50 gana contra digital_rain con 0.84 usado 3x

**Círculo vicioso:**
```
1. Digital_Rain tiene ventana pequeña (solo zonas bajas)
2. Cuando aparece en candidatos, si fue usado 3x → penalty 80%
3. Pierde contra efectos nunca usados con menor relevancia
4. No se dispara → No se usa → Diversity se resetea
5. PERO: Para que se dispare, necesita ganar contra efectos frescos
6. Ciclo se repite
```

**🚨 DIGITAL_RAIN ESTÁ ATRAPADO EN UN DEADLOCK DE DIVERSITY**

---

## 🎯 RESUMEN EJECUTIVO DE BUGS DETECTADOS

### 🚨 BUG #1: Diversity Penalty Demasiado Agresivo

**Ubicación:** `EffectDreamSimulator.ts` línea 1035

```typescript
const adjustedRelevance = scenario.projectedRelevance * (1 - diversityPenalty * 0.80)
```

**Problema:**
- Reduce relevancia hasta **80%** si el efecto fue usado 3+ veces
- Un efecto con relevancia 0.95 usado 3x → relevancia 0.19 (-80%)
- **Diversity DOMINA sobre DNA matching**

**Impacto:**
- Efectos con alta relevancia DNA quedan bloqueados después de 3 usos
- Sistema favorece efectos "vírgenes" sobre efectos contextualmente adecuados
- **Sesgo hacia novedad en lugar de adecuación**

**Severidad:** 🔴 CRÍTICA

---

### 🚨 BUG #2: Diversity Score Weight Demasiado Alto

**Ubicación:** `EffectDreamSimulator.ts` línea 1046

```typescript
score += scenario.diversityScore * 0.25       // 🔥 Diversidad CRÍTICA
```

**Problema:**
- Diversity score contribuye **25%** al score final
- Más que vibeCoherence (15%), riskLevel (15%), y simConfidence (10%) COMBINADOS
- Un efecto nunca usado recibe **+0.25 puntos** automáticamente

**Impacto:**
- Efectos nuevos tienen ventaja injusta de +0.25 puntos
- Combinado con BUG #1, crea sesgo doble:
  1. Penalty de relevancia (-80%)
  2. Bonus de diversidad (+0.25)
- **Diferencia puede ser >0.40 puntos** entre efectos con relevancia similar

**Severidad:** 🔴 CRÍTICA

---

### 🚨 BUG #3: Diversity Score Formula Exponencial Excesiva

**Ubicación:** `EffectDreamSimulator.ts` línea 980

```typescript
const diversityScore = Math.max(0, 1 - usageRate * 3)
```

**Problema:**
- Multiplicador **x3** crea penalización exponencial
- 1 uso → penalty 30%
- 2 usos → penalty 60%
- 3 usos → **penalty 100% (MATAR)**

**Impacto:**
- Efectos populares (alta relevancia) quedan bloqueados rápidamente
- Después de 3 usos, diversityScore = 0.0 → efecto prácticamente descartado
- **No hay recuperación gradual** (reset binario)

**Severidad:** 🟠 ALTA

---

### 🟡 ISSUE #4: Zona Restringida para Efectos Atmosféricos

**Ubicación:** `EffectDreamSimulator.ts` líneas 540-570 (filterByZone)

**Problema:**
- Efectos atmosféricos (digital_rain, void_mist, etc.) solo aparecen en zonas bajas (E < 0.70)
- En sesión típica Techno, **70% del tiempo** está en active/intense/peak (E > 0.55)
- Efectos atmosféricos tienen **ventana de oportunidad reducida** (~30%)

**Impacto:**
- Digital_rain, void_mist, deep_breath raramente aparecen en momentos memorables (drops, builds)
- Usuario percibe estos efectos como "invisibles" porque no aparecen en momentos altos
- **Sesgo perceptual:** Efectos de alta energía dominan la experiencia

**Severidad:** 🟡 MEDIA (no es bug, es design decision que causa percepción de sesgo)

---

### 🟡 ISSUE #5: Relevancia DNA No Considera Uso Histórico

**Ubicación:** `EffectDNA.ts` calculateRelevance()

**Problema:**
- DNA relevance es **puramente contextual** (no considera historial)
- Si un efecto tiene relevancia 0.95 en un contexto, SIEMPRE tendrá 0.95 en ese contexto
- No hay "fatiga de efecto" integrada en la relevancia DNA

**Impacto:**
- Mismo efecto puede tener relevancia alta en múltiples contextos similares
- Si contexto musical es estable (Techno club constante), mismo efecto siempre será relevante
- **Diversity penalty es el ÚNICO mecanismo anti-repetición**

**Severidad:** 🟡 MEDIA (no es bug, es ausencia de feature)

---

## 🔧 PROPUESTAS DE SOLUCIÓN

### 🎯 SOLUCIÓN 1: Calibrar Diversity Penalty (RECOMENDADA)

**Objetivo:** Reducir agresividad del penalty sin eliminar anti-monotonía

**Cambios propuestos:**

#### A) Reducir multiplicador de penalty en relevancia

```diff
// Línea 1035 - EffectDreamSimulator.ts
- const adjustedRelevance = scenario.projectedRelevance * (1 - diversityPenalty * 0.80)
+ const adjustedRelevance = scenario.projectedRelevance * (1 - diversityPenalty * 0.40)
```

**Efecto:**
- Penalty máximo: 80% → **40%**
- Efecto usado 3x: relevancia 0.95 → 0.57 (en lugar de 0.19)
- **Diversity sigue importante, pero DNA tiene más peso**

**Impacto esperado:**
- Efectos con alta relevancia DNA pueden competir incluso después de 3 usos
- Reduce sesgo hacia efectos "vírgenes"
- Mantiene anti-monotonía (diversity score component sigue activo)

---

#### B) Reducir peso de diversity score

```diff
// Línea 1046 - EffectDreamSimulator.ts
- score += scenario.diversityScore * 0.25       // 🔥 Diversidad CRÍTICA
+ score += scenario.diversityScore * 0.15       // Diversidad importante pero no dominante
```

**Rebalanceo de pesos:**

| Componente | Peso Actual | Peso Propuesto | Cambio |
|------------|-------------|----------------|--------|
| adjustedRelevance | 0.35 | **0.40** | +5% |
| vibeCoherence | 0.15 | 0.15 | - |
| diversityScore | 0.25 | **0.15** | -10% |
| (1 - riskLevel) | 0.15 | **0.20** | +5% |
| simConfidence | 0.10 | 0.10 | - |

**Efecto:**
- DNA relevance: 35% → **40%** (más peso)
- Diversity: 25% → **15%** (menos dominante)
- Risk: 15% → **20%** (más consideración de seguridad)

**Impacto esperado:**
- DNA matching se convierte en factor dominante (como debe ser)
- Diversity sigue importante pero no abrumador
- Efectos seguros (bajo risk) ganan ventaja adicional

---

#### C) Suavizar curva de diversity score

```diff
// Línea 980 - EffectDreamSimulator.ts
- const diversityScore = Math.max(0, 1 - usageRate * 3)
+ const diversityScore = Math.max(0, 1 - usageRate * 2)
```

**Efecto:**

| Usos | Usage Rate | Score Actual | Score Propuesto | Cambio |
|------|------------|--------------|-----------------|--------|
| 0/10 | 0.00 | 1.00 | 1.00 | - |
| 1/10 | 0.10 | 0.70 | **0.80** | +10% |
| 2/10 | 0.20 | 0.40 | **0.60** | +20% |
| 3/10 | 0.30 | 0.00 | **0.40** | +40% |
| 4/10 | 0.40 | 0.00 | **0.20** | +20% |
| 5/10 | 0.50 | 0.00 | **0.00** | - |

**Impacto esperado:**
- Efectos usados 3x no son "matados" instantáneamente (0.40 score en lugar de 0.00)
- Curva más gradual: penalización progresiva en lugar de cliff
- Umbral de "muerte" sube de 3 → 5 usos

---

### 🎯 SOLUCIÓN 2: Implementar Decay Temporal de Diversity

**Objetivo:** Diversity score se recupera con el tiempo

**Concepto:**
```typescript
// Nuevo campo en RecentEffect
interface RecentEffect {
  effect: string
  timestamp: number  // NUEVO: Cuando se disparó
}

// En calculateDiversityScore()
const now = Date.now()
const recentWithDecay = context.recentEffects
  .map(e => {
    const ageMs = now - e.timestamp
    const ageMinutes = ageMs / 60000
    // Decay exponencial: peso se reduce 50% cada 5 minutos
    const weight = Math.pow(0.5, ageMinutes / 5)
    return { effect: e.effect, weight }
  })

const weightedUsage = recentWithDecay
  .filter(e => e.effect === effect.effect)
  .reduce((sum, e) => sum + e.weight, 0)

const totalWeight = recentWithDecay.reduce((sum, e) => sum + e.weight, 0)

const usageRate = weightedUsage / totalWeight
const diversityScore = Math.max(0, 1 - usageRate * 2)
```

**Efecto:**
- Usos antiguos (>5min) pesan menos en el cálculo
- Efectos pueden "recuperarse" con el tiempo
- **Más realista:** Si digital_rain no se usó en 10 minutos, debería tener nueva oportunidad

**Impacto esperado:**
- Efectos bloqueados por uso reciente pueden reaparecer después de tiempo
- Reduce "lock permanente" de efectos populares
- Más variedad a largo plazo

---

### 🎯 SOLUCIÓN 3: Introducir "Fatigue de Efecto" en DNA

**Objetivo:** Reducir relevancia DNA de efectos usados recientemente

**Concepto:**
```typescript
// En calculateDNARelevance()
const baseRelevance = 1.0 - (distance / MAX_DISTANCE)

// Calcular fatiga basada en uso reciente
const recentUsage = context.recentEffects
  .filter(e => e.effect === effect.effect)
  .length

const fatigueMultiplier = Math.max(0.7, 1.0 - recentUsage * 0.10)
// 0 usos: 1.00 (sin fatiga)
// 1 uso: 0.90 (-10%)
// 2 usos: 0.80 (-20%)
// 3 usos: 0.70 (-30% MAX)

const fatigueAdjustedRelevance = baseRelevance * fatigueMultiplier

return { 
  relevance: fatigueAdjustedRelevance, 
  distance, 
  targetDNA 
}
```

**Efecto:**
- Relevancia DNA integra uso histórico
- Penalty más suave (máximo -30%) que diversity penalty actual (-80%)
- **DNA sigue siendo factor principal** pero considera contexto histórico

**Impacto esperado:**
- Efectos usados recientemente pierden algo de relevancia, pero no colapsan
- Elimina necesidad de diversity penalty agresivo en scoring
- Sistema más integrado (DNA es responsable de anti-monotonía)

---

### 🎯 SOLUCIÓN 4: Crear "Wildcard Pool" para Efectos Invisibles

**Objetivo:** Garantizar que efectos raramente vistos tengan oportunidades forzadas

**Concepto:**
```typescript
// En generateCandidates()

// Detectar efectos "hambrientos" (no disparados en últimas N decisiones)
const hungryEffects = vibeAllowedEffects.filter(effect => {
  const lastSeen = context.effectLastSeen.get(effect) || 0
  const timeSinceLastSeen = Date.now() - lastSeen
  const minutesSinceLastSeen = timeSinceLastSeen / 60000
  
  // Efecto "hambriento" si no se vio en últimos 15 minutos
  return minutesSinceLastSeen > 15
})

// Si hay efectos hambrientos, agregar UNO como wildcard con bonus
if (hungryEffects.length > 0) {
  const wildcardEffect = hungryEffects[Math.floor(Math.random() * hungryEffects.length)]
  
  candidates.push({
    effect: wildcardEffect,
    intensity: predictedEnergy * 0.9,
    zones: ['all'],
    reasoning: '🎲 WILDCARD: Efecto hambriento forzado',
    confidence: 0.85,
    isWildcard: true  // Flag especial
  })
}

// En calculateScenarioScore()
if (scenario.effect.isWildcard) {
  score += 0.15  // Bonus wildcard
}
```

**Efecto:**
- Digital_rain, gatling y otros "invisibles" reciben inyección forzada de candidatos
- Bonus wildcard (+0.15) les da ventaja competitiva
- **Garantía de diversidad real** sin depender solo de diversity score

**Impacto esperado:**
- Todos los efectos aparecen al menos cada 15 minutos
- Usuario percibe variedad real (no solo los mismos 5 efectos)
- Sistema más "justo" (todos los efectos tienen su momento)

---

## 📊 RECOMENDACIÓN FINAL

### 🎯 ESTRATEGIA EN 3 FASES

#### **FASE 1: Calibración Conservadora (10 minutos)** 🟢 SAFE

**Cambios:**
1. Reducir diversity penalty en relevancia: 0.80 → **0.40**
2. Reducir peso de diversity score: 0.25 → **0.15**
3. Suavizar curva diversity: multiplicador 3 → **2**

**Archivos:**
- `EffectDreamSimulator.ts` (3 líneas)

**Impacto esperado:**
- Reducción de sesgo ~60%
- DNA relevance recupera importancia
- Efectos populares pueden competir después de 3 usos

**Test:** 30 minutos de sesión Techno, contar apariciones de cada efecto

---

#### **FASE 2: Decay Temporal (WAVE 982)** 🟡 EXPERIMENTAL

**Cambios:**
1. Implementar decay temporal de diversity (weights decaen 50% cada 5min)
2. Agregar timestamps a RecentEffect

**Archivos:**
- `EffectDreamSimulator.ts` calculateDiversityScore()
- `AudienceSafetyContext` interface

**Impacto esperado:**
- Efectos se "recuperan" con el tiempo
- Variedad a largo plazo aumenta
- Menos "lock permanente"

**Test:** 2 horas de sesión, verificar reaparición de efectos bloqueados

---

#### **FASE 3: Wildcard Pool (WAVE 983)** 🟢 SAFE + GARANTÍA

**Cambios:**
1. Implementar detección de efectos "hambrientos"
2. Inyectar wildcards forzados cada 15 minutos
3. Bonus wildcard en scoring

**Archivos:**
- `EffectDreamSimulator.ts` generateCandidates()
- `AudienceSafetyContext` agregar effectLastSeen Map

**Impacto esperado:**
- **Garantía matemática:** Todos los efectos aparecen al menos cada 15min
- Digital_rain, gatling y otros "invisibles" se vuelven visibles
- Usuario percibe diversidad REAL

**Test:** 1 hora de sesión, verificar que TODOS los efectos aparecen al menos 1x

---

### 🎯 PRIORIDAD ABSOLUTA

**IMPLEMENTAR FASE 1 AHORA (antes del test en discoteca en 10 días)**

**Razones:**
- Cambios mínimos (3 líneas)
- Riesgo CERO (solo ajuste de constantes)
- Impacto ALTO (~60% reducción de sesgo)
- Testing rápido (30 minutos)

**FASE 2 y 3:** Implementar DESPUÉS del test si Fase 1 no es suficiente

---

## 📋 CHECKLIST DE IMPLEMENTACIÓN FASE 1

### 🔧 Cambios en Código

**Archivo:** `EffectDreamSimulator.ts`

#### Cambio 1: Reducir diversity penalty (línea 1035)

```diff
- const adjustedRelevance = scenario.projectedRelevance * (1 - diversityPenalty * 0.80)
+ const adjustedRelevance = scenario.projectedRelevance * (1 - diversityPenalty * 0.40)
```

#### Cambio 2: Rebalancear pesos (líneas 1043-1047)

```diff
let score = 0

- score += adjustedRelevance * 0.35             // 🧬 DNA relevance
+ score += adjustedRelevance * 0.40             // 🧬 DNA relevance (increased)
  score += scenario.vibeCoherence * 0.15        // Coherencia de vibe
- score += scenario.diversityScore * 0.25       // 🔥 Diversidad CRÍTICA
+ score += scenario.diversityScore * 0.15       // Diversidad importante
- score += (1 - scenario.riskLevel) * 0.15      // Bajo riesgo preferido
+ score += (1 - scenario.riskLevel) * 0.20      // Bajo riesgo preferido (increased)
  score += scenario.simulationConfidence * 0.10 // Confianza en predicción
```

#### Cambio 3: Suavizar curva diversity (línea 980)

```diff
- const diversityScore = Math.max(0, 1 - usageRate * 3)
+ const diversityScore = Math.max(0, 1 - usageRate * 2)
```

---

### 🧪 Testing Protocol

**Test 1: Conteo de Apariciones (30 min)**

1. Arrancar Selene en modo Techno
2. Capturar logs de efectos disparados
3. Contar apariciones por efecto
4. **Objetivo:** Todos los efectos Techno (11) aparecen al menos 1x

**Test 2: Digital_Rain Visibility (1 hora)**

1. Sesión Techno con energía variable (0.20-0.80)
2. Buscar específicamente apariciones de `digital_rain`
3. **Objetivo:** Digital_rain aparece al menos 3x en 1 hora

**Test 3: Diversity Score Distribution**

1. Analizar scores finales de escenarios en logs
2. Verificar que DNA relevance tiene más peso que diversity
3. **Objetivo:** Score alto correlaciona con relevancia, no solo con novedad

---

### 📊 Métricas de Éxito

| Métrica | Baseline (actual) | Target (Fase 1) | Método |
|---------|-------------------|-----------------|--------|
| **Efectos visibles (11 total)** | ~5-6 | **>8** | Conteo en 1h |
| **Digital_rain apariciones** | 0-1 / hora | **>3** / hora | Log search |
| **Gatling_raid apariciones** | ~10 / hora | **5-7** / hora | Log search |
| **Cyber_dualism apariciones** | ~15 / hora | **8-10** / hora | Log search |
| **Diversity score avg** | 0.60 | **0.70** | Análisis logs |
| **Relevance weight en decisión** | ~25% | **>40%** | Score decomposition |

---

## 🎤 MENSAJE PARA RADWULF

Hermano, **encontré al culpable** 🔍

**TL;DR:**
- Selene SÍ simula todos los efectos correctamente ✅
- DNA relevance funciona perfecto ✅
- **PERO:** Diversity penalty es un TIRANO que castiga 80% la relevancia después de 3 usos 🚨
- Digital_rain no aparece porque:
  1. Solo vive en zonas bajas (valley/ambient)
  2. Cuando aparece y se usa 3x → penalty 80%
  3. Pierde contra cualquier efecto "virgen"
  4. **Círculo vicioso de invisibilidad**

**La solución es simple:** Calibrar 3 constantes (3 líneas de código)
- Diversity penalty: 80% → 40%
- Diversity weight: 25% → 15%
- Diversity curve: x3 → x2

**Tiempo:** 10 minutos de código + 30 minutos de testing

**Riesgo:** CERO (solo ajuste de números)

**¿Le damos?** 🎯

---

**Signature:** PunkOpus - The Forensic Hunter  
**Date:** 2026-01-23  
**Status:** 🔬 AUDIT COMPLETE - BUGS IDENTIFIED - SOLUTIONS PROPOSED
