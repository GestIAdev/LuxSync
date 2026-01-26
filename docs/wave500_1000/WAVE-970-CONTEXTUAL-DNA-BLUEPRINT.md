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
    aggression: 0.55,   // 🎯 WAVE 970.1: Ajustado al centro (was 0.65)
    chaos: 0.50,        // Centro perfecto ✓
    organicity: 0.45,   // 🎯 WAVE 970.1: Ajustado al centro (was 0.30)
  },
  // ⭐ Cyber Dualism = WILDCARD para zonas 'active' moderadas
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

## ⚠️ TRAMPAS DEL ADN (Edge Cases Críticos)

### 🚨 TRAMPA #1: Parkinson Digital (Jitter en el Target)

**PROBLEMA:**
El audio cambia cada 16ms. Si calculas Target DNA directamente desde `AudioMetrics`:

```
Frame 1: { Aggression: 0.81 } → industrial_strobe gana
Frame 2: { Aggression: 0.79 } → sky_saw gana
Frame 3: { Aggression: 0.82 } → industrial_strobe gana
```

**RESULTADO:** Las luces parpadean entre efectos cada frame = EPILEPSIA DIGITAL.

**SOLUCIÓN: Exponential Moving Average (EMA)**

El Target DNA NO debe usar valores crudos del frame. Debe tener **INERCIA**.

```typescript
class DNAAnalyzer {
  // Estado persistente: Target DNA suavizado
  private smoothedTarget: TargetDNA = { aggression: 0.5, chaos: 0.5, organicity: 0.5, confidence: 0.5 }
  
  // Alpha para EMA (0.15 = cambio lento, 0.5 = cambio rápido)
  private readonly SMOOTHING_ALPHA = 0.20  // 20% frame actual, 80% histórico
  
  deriveTargetDNA(context: MusicalContext, audioMetrics: AudioMetrics): TargetDNA {
    // 1. Calcular Target "crudo" del frame actual
    const rawTarget = this.calculateRawTarget(context, audioMetrics)
    
    // 2. Aplicar EMA para suavizar
    this.smoothedTarget.aggression = 
      this.SMOOTHING_ALPHA * rawTarget.aggression + 
      (1 - this.SMOOTHING_ALPHA) * this.smoothedTarget.aggression
    
    this.smoothedTarget.chaos = 
      this.SMOOTHING_ALPHA * rawTarget.chaos + 
      (1 - this.SMOOTHING_ALPHA) * this.smoothedTarget.chaos
    
    this.smoothedTarget.organicity = 
      this.SMOOTHING_ALPHA * rawTarget.organicity + 
      (1 - this.SMOOTHING_ALPHA) * this.smoothedTarget.organicity
    
    this.smoothedTarget.confidence = 
      this.SMOOTHING_ALPHA * rawTarget.confidence + 
      (1 - this.SMOOTHING_ALPHA) * this.smoothedTarget.confidence
    
    // 3. EXCEPCIÓN: Drops y Breakdowns resetean inercia
    if (context.section.type === 'drop' && context.section.confidence > 0.7) {
      // Drop detectado con confianza → SNAP inmediato a alta agresión
      this.smoothedTarget.aggression = Math.max(this.smoothedTarget.aggression, 0.80)
    }
    if (context.section.type === 'breakdown' && context.section.confidence > 0.7) {
      // Breakdown detectado → SNAP inmediato a baja agresión
      this.smoothedTarget.aggression = Math.min(this.smoothedTarget.aggression, 0.25)
    }
    
    return { ...this.smoothedTarget }
  }
}
```

**EFECTO:**
```
Frame 1: Raw=0.81, Smoothed=0.5  → Smoothed=0.56  (↑ lento)
Frame 2: Raw=0.79, Smoothed=0.56 → Smoothed=0.61  (↑ lento)
Frame 3: Raw=0.82, Smoothed=0.61 → Smoothed=0.65  (↑ lento)
...
Frame 15: Raw=0.80, Smoothed=0.78 → Smoothed=0.78 (ESTABLE)

✅ industrial_strobe SE MANTIENE, no hay jitter
```

---

### 🚨 TRAMPA #2: El Vacío del Medio (The Middle Void)

**PROBLEMA:**
Todos los efectos tienen ADN extremo:
- `industrial_strobe`: A=0.95 (EXTREMO)
- `void_mist`: A=0.05 (EXTREMO)

¿Qué pasa si Target DNA es **MODERADO**?
```
Target: { Aggression: 0.50, Chaos: 0.50, Organicity: 0.50 }
```

**RESULTADO:** Todos los efectos están "igual de lejos". Selene elige casi al azar.

**SOLUCIÓN 1: Efecto Comodín Central**

Añadir/ajustar efectos para cubrir el espacio central del cubo DNA:

```typescript
// ANTES (WAVE 970.0 - problema):
'cyber_dualism': {
  aggression: 0.65,   // Cerca del centro pero no suficiente
  chaos: 0.50,        // Centro ✓
  organicity: 0.30,   // Lejos del centro
}

// DESPUÉS (WAVE 970.1 - solución):
'cyber_dualism': {
  aggression: 0.55,   // ← AJUSTE: Más central (was 0.65)
  chaos: 0.50,        // Centro ✓
  organicity: 0.45,   // ← AJUSTE: Más central (was 0.30)
}
// Cyber Dualism ahora es el "COMODÍN" para zonas 'active' moderadas
```

**SOLUCIÓN 2: Fallback Threshold**

Si la **mejor** relevancia es muy baja, usar un efecto "seguro":

```typescript
calculateRelevance(effectId: string, targetDNA: TargetDNA): number {
  // ... cálculo normal de relevancia ...
  
  return relevance
}

rankEffects(targetDNA: TargetDNA): Array<{ effectId: string; relevance: number }> {
  const ranked = Object.keys(EFFECT_DNA_REGISTRY)
    .map(effectId => ({
      effectId,
      relevance: this.calculateRelevance(effectId, targetDNA)
    }))
    .sort((a, b) => b.relevance - a.relevance)
  
  // 🚨 TRAMPA DEL VACÍO: Si el mejor match es mediocre, forzar comodín
  const bestRelevance = ranked[0]?.relevance ?? 0
  
  if (bestRelevance < 0.60) {
    console.warn(`[DNA_ANALYZER] ⚠️ Middle Void detected! Best relevance=${bestRelevance.toFixed(2)} < 0.60`)
    console.warn(`[DNA_ANALYZER] 🎯 Forcing WILDCARD effect: cyber_dualism`)
    
    // Forzar cyber_dualism al top si existe
    const wildcardIndex = ranked.findIndex(r => r.effectId === 'cyber_dualism')
    if (wildcardIndex > 0) {
      const wildcard = ranked.splice(wildcardIndex, 1)[0]
      ranked.unshift(wildcard)
    }
  }
  
  return ranked
}
```

**CONFIGURACIÓN DE WILDCARDS:**

```typescript
// Lista de efectos "comodín" por categoría
const WILDCARD_EFFECTS: Record<string, string> = {
  'techno-industrial': 'cyber_dualism',   // Moderado: A=0.55, C=0.50, O=0.45
  'techno-atmospheric': 'digital_rain',   // Moderado: A=0.20, C=0.65, O=0.40
  'latino-organic': 'clave_rhythm',       // Moderado: A=0.50, C=0.35, O=0.70
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
  // ═══════════════════════════════════════════════════════════════════════
  // 🧬 WAVE 970.1: PERSISTENT STATE (anti-jitter)
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Target DNA suavizado (EMA) para prevenir Parkinson Digital */
  private smoothedTarget: TargetDNA = { 
    aggression: 0.5, 
    chaos: 0.5, 
    organicity: 0.5, 
    confidence: 0.5 
  }
  
  /** Alpha para EMA (0.15=lento, 0.5=rápido) */
  private readonly SMOOTHING_ALPHA = 0.20  // 20% frame actual, 80% histórico
  
  /** Threshold para detectar "Middle Void" */
  private readonly MIDDLE_VOID_THRESHOLD = 0.60
  
  // ═══════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Deriva el ADN objetivo desde el contexto musical actual
   * 
   * 🚨 TRAMPA #1: Usa EMA para suavizar y evitar jitter frame-a-frame
   */
  deriveTargetDNA(
    context: MusicalContext,
    audioMetrics: AudioMetrics
  ): TargetDNA {
    // 1. Calcular Target "crudo" del frame actual
    const rawTarget = this.calculateRawTarget(context, audioMetrics)
    
    // 2. Aplicar EMA para suavizar (anti-Parkinson)
    this.smoothedTarget.aggression = 
      this.SMOOTHING_ALPHA * rawTarget.aggression + 
      (1 - this.SMOOTHING_ALPHA) * this.smoothedTarget.aggression
    
    this.smoothedTarget.chaos = 
      this.SMOOTHING_ALPHA * rawTarget.chaos + 
      (1 - this.SMOOTHING_ALPHA) * this.smoothedTarget.chaos
    
    this.smoothedTarget.organicity = 
      this.SMOOTHING_ALPHA * rawTarget.organicity + 
      (1 - this.SMOOTHING_ALPHA) * this.smoothedTarget.organicity
    
    this.smoothedTarget.confidence = 
      this.SMOOTHING_ALPHA * rawTarget.confidence + 
      (1 - this.SMOOTHING_ALPHA) * this.smoothedTarget.confidence
    
    // 3. EXCEPCIÓN: Drops y Breakdowns resetean inercia (snap instantáneo)
    if (context.section.type === 'drop' && context.section.confidence > 0.7) {
      // Drop detectado → SNAP a alta agresión
      this.smoothedTarget.aggression = Math.max(this.smoothedTarget.aggression, 0.80)
      console.log(`[DNA_ANALYZER] 🔴 DROP SNAP: Aggression forced to ${this.smoothedTarget.aggression.toFixed(2)}`)
    }
    if (context.section.type === 'breakdown' && context.section.confidence > 0.7) {
      // Breakdown detectado → SNAP a baja agresión
      this.smoothedTarget.aggression = Math.min(this.smoothedTarget.aggression, 0.25)
      console.log(`[DNA_ANALYZER] 🌊 BREAKDOWN SNAP: Aggression forced to ${this.smoothedTarget.aggression.toFixed(2)}`)
    }
    
    return { ...this.smoothedTarget }
  }
  
  /**
   * Calcula el Target DNA "crudo" del frame (sin suavizar)
   * PRIVADO - Solo usado internamente por deriveTargetDNA()
   */
  private calculateRawTarget(
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
   * 
   * 🚨 TRAMPA #2: Detecta "Middle Void" y fuerza wildcard si necesario
   */
  rankEffects(targetDNA: TargetDNA): Array<{ effectId: string; relevance: number }> {
    // Calcular relevancia de todos los efectos
    const ranked = Object.keys(EFFECT_DNA_REGISTRY)
      .map(effectId => ({
        effectId,
        relevance: this.calculateRelevance(effectId, targetDNA)
      }))
      .sort((a, b) => b.relevance - a.relevance)
    
    // 🚨 TRAMPA #2: Middle Void detection
    const bestRelevance = ranked[0]?.relevance ?? 0
    
    if (bestRelevance < this.MIDDLE_VOID_THRESHOLD) {
      console.warn(`[DNA_ANALYZER] ⚠️ MIDDLE VOID: Best relevance=${bestRelevance.toFixed(2)} < ${this.MIDDLE_VOID_THRESHOLD}`)
      console.warn(`[DNA_ANALYZER] 🎯 Target: A=${targetDNA.aggression.toFixed(2)}, C=${targetDNA.chaos.toFixed(2)}, O=${targetDNA.organicity.toFixed(2)}`)
      console.warn(`[DNA_ANALYZER] 🃏 Forcing WILDCARD: cyber_dualism`)
      
      // Forzar cyber_dualism (wildcard) al top
      const wildcardIndex = ranked.findIndex(r => r.effectId === 'cyber_dualism')
      if (wildcardIndex > 0) {
        const wildcard = ranked.splice(wildcardIndex, 1)[0]
        ranked.unshift(wildcard)
      }
    }
    
    return ranked
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
- ✅ **🚨 EMA Smoothing** (anti-Parkinson Digital, previene jitter frame-a-frame)
- ✅ **🚨 Middle Void Detection** (wildcard fallback cuando todos los efectos están lejos)
- ✅ **🚨 Snap Conditions** (drops/breakdowns resetean inercia para respuesta inmediata)
- ✅ Logging con DNA para debugging

### Beneficios:
1. **Transparencia**: Puedes ver EXACTAMENTE por qué Selene eligió un efecto
2. **Predictibilidad**: Mismo input → mismo output (determinista)
3. **Extensibilidad**: Añadir un nuevo efecto = añadir 3 números (su ADN)
4. **Sin Bias**: No hay "efectos favoritos" hardcodeados
5. **🔥 Estabilidad**: EMA previene epilepsia digital (WAVE 970.1)
6. **🔥 Robustez**: Middle Void detection previene indecisión random (WAVE 970.1)

### Edge Cases Resueltos:
| Trampa | Síntoma | Solución |
|--------|---------|----------|
| **Parkinson Digital** | Luces cambian de efecto cada frame (16ms) | EMA con α=0.20 + Snap conditions |
| **Middle Void** | Target moderado = todos los efectos igual de lejos | Wildcard fallback (cyber_dualism) + Threshold 0.60 |

---

## 📅 TIMELINE PROPUESTO

| Fase | Descripción | Estimación |
|------|-------------|------------|
| 970.1 | Crear `EffectDNA.ts` + Registry | 1-2h |
| 970.2 | Implementar `deriveTargetDNA()` + EMA | 2-3h |
| 970.3 | Refactorizar `EffectDreamSimulator` | 2-3h |
| 970.4 | Implementar Middle Void detection | 1h |
| 970.5 | Tests unitarios de DNA matching | 1-2h |
| 970.6 | Runtime testing + ajustes | 2-4h |

**Total: ~10-15h de desarrollo**

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

