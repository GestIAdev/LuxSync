# 🧬 WAVE 970: THE CONTEXTUAL DNA

## BLUEPRINT ARQUITECTÓNICO - PunkOpus Edition

---

## 📜 MANIFIESTO

> "Beauty hardcodeada es un insulto a la inteligencia artificial. Es como decir que la Gioconda es un 8.5 y un graffiti es 4.0, sin importar si estamos en el Louvre o en un callejón del Bronx."
> — GeminiPunkArchytect

**El problema actual:**
```typescript
// EffectDreamSimulator.ts - ANTES (CRIMEN CONTRA SELENE)
const EFFECT_BEAUTY_WEIGHTS = {
  'industrial_strobe': { base: 0.75, energyMultiplier: 1.2 },  // ← "Soy bonito porque sí"
  'void_mist': { base: 0.70, energyMultiplier: 0.85 },         // ← "Soy menos bonito porque sí"
}

// REALIDAD:
// - IndustrialStrobe en un DROP de Hard Techno = PERFECTO
// - IndustrialStrobe en un BREAKDOWN ambiental = ABERRACIÓN
// - VoidMist en un DROP = RIDÍCULO
// - VoidMist en un BREAKDOWN = PERFECTO
```

**La solución: Selene no busca "belleza", busca ADECUACIÓN.**

---

## 🧬 PARTE 1: EL ADN DEL EFECTO (Effect DNA)

### Concepto: Tres Genes Fundamentales

Cada efecto tiene un **ADN inmutable** que describe SU NATURALEZA, no su "belleza":

| Gen | Descripción | Rango | Ejemplos |
|-----|-------------|-------|----------|
| **Agresión** (A) | ¿Cuánto "golpea"? ¿Es violento o suave? | 0.0 - 1.0 | Strobe=0.95, Breath=0.10 |
| **Caos** (C) | ¿Es ordenado/predecible o ruidoso/caótico? | 0.0 - 1.0 | Rain=0.80, Radar=0.15 |
| **Organicidad** (O) | ¿Parece vivo/orgánico o mecánico/sintético? | 0.0 - 1.0 | Breath=0.90, Strobe=0.05 |

### DNA Table: Arsenal Techno-Industrial

```typescript
// EFFECT_DNA: La naturaleza inmutable de cada efecto
const EFFECT_DNA: Record<string, EffectDNA> = {
  // ═══════════════════════════════════════════════════════════════
  // 🔪 TECHNO-INDUSTRIAL: Los Martillos
  // ═══════════════════════════════════════════════════════════════
  'industrial_strobe': {
    aggression: 0.95,   // 🔥 El martillo más brutal
    chaos: 0.30,        // Ordenado: flashes predecibles
    organicity: 0.05,   // 100% máquina
  },
  'acid_sweep': {
    aggression: 0.70,   // Agresivo pero más fluido
    chaos: 0.45,        // Semi-caótico (acid wobble)
    organicity: 0.25,   // Algo de "vida" en el movimiento
  },
  'cyber_dualism': {
    aggression: 0.65,   // Los gemelos son tensos, no brutales
    chaos: 0.50,        // Dualidad = cierto caos
    organicity: 0.30,   // Pan/tilt dan sensación de vida
  },
  'gatling_raid': {
    aggression: 0.90,   // 🔫 Ametralladora de PARs
    chaos: 0.70,        // MUY caótico (random burst)
    organicity: 0.10,   // Mecánico puro
  },
  'sky_saw': {
    aggression: 0.80,   // Sierra cortante
    chaos: 0.55,        // Moderado (movimiento agresivo pero direccional)
    organicity: 0.20,   // Mecánico con "swing"
  },
  
  // ═══════════════════════════════════════════════════════════════
  // 🌫️ TECHNO-ATMOSPHERIC: La Neblina
  // ═══════════════════════════════════════════════════════════════
  'void_mist': {
    aggression: 0.05,   // 🌫️ Cero violencia - solo flota
    chaos: 0.20,        // Ordenado pero con pequeñas variaciones
    organicity: 0.85,   // Parece humo VIVO
  },
  'static_pulse': {
    aggression: 0.35,   // ⚡ Glitches tienen "punch" pero suave
    chaos: 0.75,        // MUY caótico (glitch = ruido)
    organicity: 0.15,   // Digital, no orgánico
  },
  'digital_rain': {
    aggression: 0.20,   // 💧 Suave como lluvia
    chaos: 0.65,        // Caótico (gotas aleatorias)
    organicity: 0.40,   // Semi-orgánico (agua)
  },
  'deep_breath': {
    aggression: 0.05,   // 🫁 Cero violencia
    chaos: 0.10,        // MUY ordenado (sinusoidal)
    organicity: 0.95,   // MÁXIMA organicidad - respiración
  },
  
  // ═══════════════════════════════════════════════════════════════
  // 🌴 LATINO-ORGANIC: La Fiesta
  // ═══════════════════════════════════════════════════════════════
  'solar_flare': {
    aggression: 0.75,   // ☀️ Explosión pero festiva
    chaos: 0.50,        // Moderado
    organicity: 0.60,   // Fuego = orgánico
  },
  'tropical_pulse': {
    aggression: 0.60,   // Percusivo pero alegre
    chaos: 0.40,        // Rítmico = ordenado
    organicity: 0.70,   // Muy festivo/humano
  },
  'cumbia_moon': {
    aggression: 0.15,   // 🌙 Suave como la luna
    chaos: 0.20,        // Muy ordenado
    organicity: 0.80,   // Romántico/orgánico
  },
  'corazon_latino': {
    aggression: 0.50,   // 💃 Pasional pero no violento
    chaos: 0.35,        // Rítmico
    organicity: 0.90,   // MÁXIMA - latido del corazón
  },
}
```

---

## 🎯 PARTE 2: LA NECESIDAD MUSICAL (Context Need / Target DNA)

### Concepto: El Contexto Genera un "ADN Objetivo"

En cada frame, analizamos el audio y generamos el **Target DNA** que la música PIDE:

```typescript
interface TargetDNA {
  aggression: number   // ¿Qué tan agresivo debe ser el efecto?
  chaos: number        // ¿Qué tan caótico?
  organicity: number   // ¿Qué tan orgánico/vivo?
  confidence: number   // Confianza en el análisis (0-1)
}
```

### Algoritmo de Derivación del Target DNA

El Target se calcula **proceduralmente** desde datos reales del audio:

```typescript
function deriveTargetDNA(
  context: MusicalContext,
  audioMetrics: AudioMetrics
): TargetDNA {
  // ═══════════════════════════════════════════════════════════════
  // 🔥 AGGRESSION: Derivada de ENERGÍA + PERCUSIÓN + ESPECTRO
  // ═══════════════════════════════════════════════════════════════
  //
  // Fórmula:
  // A = (energy * 0.4) + (kickIntensity * 0.25) + (harshness * 0.2) + (bassRatio * 0.15)
  //
  // JUSTIFICACIÓN:
  // - energy: El indicador primario de "punch" global
  // - kickIntensity: Kicks fuertes = agresión (techno drops)
  // - harshness: Frecuencias 2-5kHz (acid lines, distorsión)
  // - bassRatio: Subidas de bajo = tensión/agresión
  
  const energy = context.energy
  const kickIntensity = context.rhythm?.drums?.kickIntensity ?? 0
  const harshness = audioMetrics.harshness ?? 0
  const bassRatio = audioMetrics.bass / Math.max(0.1, audioMetrics.mid)
  
  const aggression = clamp(
    (energy * 0.40) +
    (kickIntensity * 0.25) +
    (harshness * 0.20) +
    (Math.min(bassRatio - 1, 0.5) * 0.30),  // bassRatio > 1 = más agresión
    0, 1
  )
  
  // ═══════════════════════════════════════════════════════════════
  // 🌀 CHAOS: Derivada de SYNCOPATION + SPECTRAL FLATNESS + FILLS
  // ═══════════════════════════════════════════════════════════════
  //
  // Fórmula:
  // C = (syncopation * 0.35) + (spectralFlatness * 0.30) + (fillBonus * 0.20) + (trendChaos * 0.15)
  //
  // JUSTIFICACIÓN:
  // - syncopation: Ritmos off-beat = caos rítmico
  // - spectralFlatness: 1.0 = ruido puro, 0.0 = tono puro
  // - fillDetected: Los fills rompen el patrón = caos momentáneo
  // - trendChaos: Cambios rápidos de energía = impredecibilidad
  
  const syncopation = context.syncopation ?? 0
  const spectralFlatness = audioMetrics.spectralFlatness ?? 0
  const fillBonus = context.rhythm?.fillDetected ? 0.3 : 0
  const trendChaos = Math.abs(context.energyContext?.trend ?? 0)
  
  const chaos = clamp(
    (syncopation * 0.35) +
    (spectralFlatness * 0.30) +
    (fillBonus) +
    (trendChaos * 0.15),
    0, 1
  )
  
  // ═══════════════════════════════════════════════════════════════
  // 🌱 ORGANICITY: Derivada de MOOD + SECTION + INVERSE HARSHNESS
  // ═══════════════════════════════════════════════════════════════
  //
  // Fórmula:
  // O = (moodOrganicity * 0.30) + (sectionOrganicity * 0.30) + ((1 - harshness) * 0.25) + (grooveBonus * 0.15)
  //
  // JUSTIFICACIÓN:
  // - moodOrganicity: "dreamy", "melancholic" = orgánico; "aggressive" = mecánico
  // - sectionOrganicity: "breakdown", "intro" = orgánico; "drop" = mecánico
  // - inverse harshness: Menos distorsión = más orgánico
  // - groove: Alto groove = "humano" = orgánico
  
  const moodOrganicity = getMoodOrganicity(context.mood)
  const sectionOrganicity = getSectionOrganicity(context.section.type)
  const groove = context.rhythm?.groove ?? 0.5
  
  const organicity = clamp(
    (moodOrganicity * 0.30) +
    (sectionOrganicity * 0.30) +
    ((1 - harshness) * 0.25) +
    (groove * 0.15),
    0, 1
  )
  
  // ═══════════════════════════════════════════════════════════════
  // 📊 CONFIDENCE: Basada en la confianza del análisis
  // ═══════════════════════════════════════════════════════════════
  const confidence = context.confidence * (context.rhythm?.confidence ?? 0.5)
  
  return { aggression, chaos, organicity, confidence }
}

// ═══════════════════════════════════════════════════════════════
// LOOKUP TABLES (NO SON HARDCODE - Son traducciones semánticas)
// ═══════════════════════════════════════════════════════════════

function getMoodOrganicity(mood: Mood): number {
  const MOOD_ORGANICITY: Record<Mood, number> = {
    'dreamy': 0.90,      // Sueños = muy orgánico
    'melancholic': 0.80, // Tristeza = humano
    'neutral': 0.50,     // Neutral
    'mysterious': 0.60,  // Misterio = semi-orgánico
    'euphoric': 0.55,    // Euforia puede ser electrónica o humana
    'triumphant': 0.45,  // Triunfo = algo épico/mecánico
    'aggressive': 0.20,  // Agresión = máquina
  }
  return MOOD_ORGANICITY[mood] ?? 0.50
}

function getSectionOrganicity(section: SectionType): number {
  const SECTION_ORGANICITY: Record<SectionType, number> = {
    'intro': 0.70,       // Intros suelen ser más suaves
    'verse': 0.65,       // Versos = narrativa humana
    'chorus': 0.50,      // Coros pueden ser cualquier cosa
    'bridge': 0.60,      // Bridges = transición
    'breakdown': 0.85,   // Breakdowns = MÁXIMA organicidad
    'buildup': 0.40,     // Buildups = tensión mecánica
    'drop': 0.15,        // Drops = MÍNIMA organicidad (máquina)
    'outro': 0.75,       // Outros = orgánicos
    'unknown': 0.50,     // Default
  }
  return SECTION_ORGANICITY[section] ?? 0.50
}
```

---

## 🔮 PARTE 3: EL MATCHING ALGORITHM (Distancia DNA)

### Concepto: Distancia Euclidiana 3D

El "score" de un efecto ya no es su "belleza", sino **qué tan cerca está su ADN del Target**:

```typescript
/**
 * 🧬 DNA DISTANCE CALCULATOR
 * 
 * Calcula la distancia euclidiana entre el ADN del efecto y el Target.
 * MENOR distancia = MEJOR match = MAYOR relevancia.
 * 
 * Fórmula: d = √[(Ae-At)² + (Ce-Ct)² + (Oe-Ot)²]
 * 
 * Luego convertimos a "relevancia": relevance = 1 - (distance / √3)
 * Donde √3 es la distancia máxima posible (esquina a esquina del cubo unitario).
 */
function calculateDNARelevance(
  effectDNA: EffectDNA,
  targetDNA: TargetDNA
): number {
  // Diferencias por gen
  const dA = effectDNA.aggression - targetDNA.aggression
  const dC = effectDNA.chaos - targetDNA.chaos
  const dO = effectDNA.organicity - targetDNA.organicity
  
  // Distancia euclidiana 3D
  const distance = Math.sqrt(dA * dA + dC * dC + dO * dO)
  
  // Máxima distancia posible = √3 ≈ 1.732
  const maxDistance = Math.sqrt(3)
  
  // Convertir a relevancia (1 = perfecto, 0 = opuesto total)
  const relevance = 1 - (distance / maxDistance)
  
  // Ponderar por confidence del target
  return relevance * targetDNA.confidence + (1 - targetDNA.confidence) * 0.5
}
```

### Ejemplo Visual: DROP vs BREAKDOWN

```
📊 ESCENARIO 1: DROP TECHNO INTENSO
─────────────────────────────────────────────
Audio: energy=0.90, kick=0.85, harshness=0.70, syncopation=0.2

TARGET DNA:
  ├─ Aggression: 0.88  (alta energía + kicks + harshness)
  ├─ Chaos: 0.35       (syncopation bajo, ordenado)
  └─ Organicity: 0.18  (drop = mecánico)

MATCHING:
  industrial_strobe (A=0.95, C=0.30, O=0.05):
    distance = √[(0.95-0.88)² + (0.30-0.35)² + (0.05-0.18)²]
    distance = √[0.0049 + 0.0025 + 0.0169] = √0.0243 = 0.156
    relevance = 1 - (0.156/1.732) = 0.91 ✅ PERFECTO

  void_mist (A=0.05, C=0.20, O=0.85):
    distance = √[(0.05-0.88)² + (0.20-0.35)² + (0.85-0.18)²]
    distance = √[0.6889 + 0.0225 + 0.4489] = √1.1603 = 1.077
    relevance = 1 - (1.077/1.732) = 0.38 ❌ MAL MATCH


📊 ESCENARIO 2: BREAKDOWN AMBIENTAL
─────────────────────────────────────────────
Audio: energy=0.15, kick=0.0, harshness=0.05, syncopation=0.1

TARGET DNA:
  ├─ Aggression: 0.08  (energía mínima)
  ├─ Chaos: 0.18       (muy ordenado)
  └─ Organicity: 0.82  (breakdown = orgánico)

MATCHING:
  industrial_strobe (A=0.95, C=0.30, O=0.05):
    distance = √[(0.95-0.08)² + (0.30-0.18)² + (0.05-0.82)²]
    distance = √[0.7569 + 0.0144 + 0.5929] = √1.3642 = 1.168
    relevance = 1 - (1.168/1.732) = 0.33 ❌ MAL MATCH

  void_mist (A=0.05, C=0.20, O=0.85):
    distance = √[(0.05-0.08)² + (0.20-0.18)² + (0.85-0.82)²]
    distance = √[0.0009 + 0.0004 + 0.0009] = √0.0022 = 0.047
    relevance = 1 - (0.047/1.732) = 0.97 ✅ PERFECTO
```

---

## 🏗️ PARTE 4: IMPLEMENTACIÓN - CÓDIGO REAL

### 4.1 Nuevo archivo: `EffectDNA.ts`

```typescript
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧬 EFFECT DNA - THE CONTEXTUAL GENOME
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * 🔥 WAVE 970: THE CONTEXTUAL DNA
 * 
 * FILOSOFÍA:
 * Selene no busca "belleza" (concepto humano subjetivo).
 * Selene busca ADECUACIÓN (concepto matemático objetivo).
 * 
 * Un IndustrialStrobe NO ES más "bello" que un VoidMist.
 * Un IndustrialStrobe ES más ADECUADO para un DROP que un VoidMist.
 * Un VoidMist ES más ADECUADO para un BREAKDOWN que un IndustrialStrobe.
 * 
 * @module core/intelligence/dna/EffectDNA
 * @version WAVE 970 - THE CONTEXTUAL DNA (PunkOpus)
 */

export interface EffectDNA {
  /** Agresión: ¿Cuánto "golpea"? (0=suave, 1=brutal) */
  aggression: number
  
  /** Caos: ¿Es ordenado o ruidoso? (0=predecible, 1=caótico) */
  chaos: number
  
  /** Organicidad: ¿Parece vivo o máquina? (0=sintético, 1=orgánico) */
  organicity: number
}

export interface TargetDNA extends EffectDNA {
  /** Confianza en el análisis del contexto (0-1) */
  confidence: number
}

// ═══════════════════════════════════════════════════════════════════════════
// DNA REGISTRY - LA NATURALEZA INMUTABLE DE CADA EFECTO
// ═══════════════════════════════════════════════════════════════════════════

export const EFFECT_DNA_REGISTRY: Record<string, EffectDNA> = {
  // [Ver tabla completa en PARTE 1]
}

// ═══════════════════════════════════════════════════════════════════════════
// DNA ANALYZER - DERIVA TARGET DESDE CONTEXTO
// ═══════════════════════════════════════════════════════════════════════════

export class DNAAnalyzer {
  /**
   * Deriva el ADN objetivo desde el contexto musical actual
   */
  deriveTargetDNA(
    context: MusicalContext,
    audioMetrics: AudioMetrics
  ): TargetDNA {
    // [Implementación completa de PARTE 2]
  }
  
  /**
   * Calcula la relevancia de un efecto dado el target
   */
  calculateRelevance(effectId: string, targetDNA: TargetDNA): number {
    const effectDNA = EFFECT_DNA_REGISTRY[effectId]
    if (!effectDNA) return 0.5 // Unknown effect = neutral
    
    // Distancia euclidiana 3D
    const dA = effectDNA.aggression - targetDNA.aggression
    const dC = effectDNA.chaos - targetDNA.chaos
    const dO = effectDNA.organicity - targetDNA.organicity
    
    const distance = Math.sqrt(dA * dA + dC * dC + dO * dO)
    const maxDistance = Math.sqrt(3) // ≈ 1.732
    
    // Relevancia base (1 = perfecto match)
    const baseRelevance = 1 - (distance / maxDistance)
    
    // Ponderar por confidence
    return baseRelevance * targetDNA.confidence + (1 - targetDNA.confidence) * 0.5
  }
  
  /**
   * Rankea todos los efectos por relevancia
   */
  rankEffects(targetDNA: TargetDNA): Array<{ effectId: string; relevance: number }> {
    return Object.keys(EFFECT_DNA_REGISTRY)
      .map(effectId => ({
        effectId,
        relevance: this.calculateRelevance(effectId, targetDNA)
      }))
      .sort((a, b) => b.relevance - a.relevance)
  }
}
```

### 4.2 Modificación: `EffectDreamSimulator.ts`

```typescript
// ELIMINAR:
// - EFFECT_BEAUTY_WEIGHTS (hardcoded beauty scores)
// - projectBeauty() method

// REEMPLAZAR CON:
import { DNAAnalyzer, TargetDNA } from '../dna/EffectDNA'

export class EffectDreamSimulator {
  private dnaAnalyzer: DNAAnalyzer
  
  constructor() {
    this.dnaAnalyzer = new DNAAnalyzer()
  }
  
  /**
   * NUEVO: projectRelevance() reemplaza a projectBeauty()
   */
  private projectRelevance(
    effect: EffectCandidate,
    targetDNA: TargetDNA,
    context: AudienceSafetyContext
  ): number {
    // Relevancia base desde DNA matching
    const baseRelevance = this.dnaAnalyzer.calculateRelevance(effect.effect, targetDNA)
    
    // Modificadores contextuales (NO son "belleza", son ADECUACIÓN)
    let relevance = baseRelevance
    
    // Vibe coherence: Latino effects en vibe latino, techno en techno
    const vibeMatch = this.calculateVibeMatch(effect.effect, context.vibe)
    relevance *= (0.8 + vibeMatch * 0.2) // ±20% por vibe mismatch
    
    // Zone appropriateness: Efectos agresivos NO en silence/valley
    const zoneMatch = this.calculateZoneMatch(effect.effect, context.energyZone)
    relevance *= zoneMatch
    
    // Fatigue penalty: Efectos repetidos pierden relevancia
    const fatiguePenalty = this.calculateFatiguePenalty(effect.effect, context)
    relevance *= (1 - fatiguePenalty * 0.3)
    
    return Math.max(0, Math.min(1, relevance))
  }
  
  /**
   * NUEVO: dreamEffects() ahora usa TargetDNA
   */
  public async dreamEffects(
    currentState: SystemState,
    musicalPrediction: MusicalPrediction,
    context: AudienceSafetyContext,
    audioMetrics: AudioMetrics  // ← NUEVO PARÁMETRO
  ): Promise<EffectDreamResult> {
    // 1. Derivar Target DNA desde el contexto actual
    const targetDNA = this.dnaAnalyzer.deriveTargetDNA(
      currentState as unknown as MusicalContext,  // Adapter
      audioMetrics
    )
    
    console.log(`[DREAM_SIMULATOR] 🧬 Target DNA: A=${targetDNA.aggression.toFixed(2)}, C=${targetDNA.chaos.toFixed(2)}, O=${targetDNA.organicity.toFixed(2)}`)
    
    // 2. Generar candidatos
    const candidates = this.generateCandidates(currentState, musicalPrediction, context)
    
    // 3. Simular cada escenario CON RELEVANCIA (no belleza)
    const scenarios: EffectScenario[] = []
    for (const candidate of candidates) {
      const scenario = this.simulateScenario(candidate, currentState, context, targetDNA)
      scenarios.push(scenario)
    }
    
    // 4. Rankear por RELEVANCIA
    const rankedScenarios = scenarios.sort((a, b) => b.projectedRelevance - a.projectedRelevance)
    
    // 5. Logging con DNA
    if (rankedScenarios[0]) {
      const best = rankedScenarios[0]
      console.log(`[DREAM_SIMULATOR] 🎯 Best: ${best.effect.effect} (relevance: ${best.projectedRelevance.toFixed(2)}, risk: ${best.riskLevel.toFixed(2)})`)
    }
    
    // ... resto igual
  }
}
```

---

## 📊 PARTE 5: LOGGING Y DEBUGGING

### Console Output Esperado

```
[DREAM_SIMULATOR] 🧬 Target DNA: A=0.88, C=0.35, O=0.18
[DREAM_SIMULATOR] 📊 Generated 9 candidates
[DREAM_SIMULATOR] 🔬 industrial_strobe: relevance=0.91 (distance=0.16)
[DREAM_SIMULATOR] 🔬 gatling_raid: relevance=0.85 (distance=0.26)
[DREAM_SIMULATOR] 🔬 acid_sweep: relevance=0.78 (distance=0.38)
[DREAM_SIMULATOR] 🔬 void_mist: relevance=0.38 (distance=1.08) ← LEJOS
[DREAM_SIMULATOR] 🎯 Best: industrial_strobe (relevance: 0.91, risk: 0.12)
```

---

## 🎯 PARTE 6: RESUMEN EJECUTIVO

### Lo que ELIMINAMOS:
- ❌ `EFFECT_BEAUTY_WEIGHTS` (hardcoded scores)
- ❌ `projectBeauty()` (función subjetiva)
- ❌ "base", "energyMultiplier", "technoBonus" (números mágicos)

### Lo que AÑADIMOS:
- ✅ `EFFECT_DNA_REGISTRY` (propiedades inmutables de cada efecto)
- ✅ `deriveTargetDNA()` (deriva el "ADN ideal" desde el audio REAL)
- ✅ `calculateRelevance()` (distancia matemática, NO opinión)
- ✅ Logging con DNA para debugging

### Beneficios:
1. **Transparencia**: Puedes ver EXACTAMENTE por qué Selene eligió un efecto
2. **Predictibilidad**: Mismo input → mismo output (determinista)
3. **Extensibilidad**: Añadir un nuevo efecto = añadir 3 números (su ADN)
4. **Sin Bias**: No hay "efectos favoritos" hardcodeados

---

## 📅 TIMELINE PROPUESTO

| Fase | Descripción | Estimación |
|------|-------------|------------|
| 970.1 | Crear `EffectDNA.ts` + Registry | 1-2h |
| 970.2 | Implementar `deriveTargetDNA()` | 2-3h |
| 970.3 | Refactorizar `EffectDreamSimulator` | 2-3h |
| 970.4 | Tests unitarios de DNA matching | 1-2h |
| 970.5 | Runtime testing + ajustes | 2-4h |

**Total: ~10-14h de desarrollo**

---

## 🔮 EXTENSIONES FUTURAS

### WAVE 975: Weighted DNA Dimensions
```typescript
// Diferentes vibes pueden ponderar los genes diferente:
const VIBE_DNA_WEIGHTS = {
  'techno-club': { aggression: 1.2, chaos: 1.0, organicity: 0.8 },
  'fiesta-latina': { aggression: 0.8, chaos: 0.9, organicity: 1.3 },
}
```

### WAVE 980: Dynamic DNA Learning
```typescript
// Selene APRENDE qué DNA funciona mejor en cada contexto:
class DNALearner {
  recordOutcome(effectId: string, context: MusicalContext, beautyFeedback: number)
  adjustDNA(effectId: string, adjustment: Partial<EffectDNA>)
}
```

---

**WAVE 970: THE CONTEXTUAL DNA**
*"Selene no busca belleza. Selene busca VERDAD."*

— PunkOpus 🧬

