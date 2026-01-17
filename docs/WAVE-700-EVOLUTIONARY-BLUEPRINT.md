# 🧬 WAVE 700: PROJECT ENTROPY - EVOLUTIONARY BLUEPRINT (v2.0)

**FECHA:** Enero 17, 2026  
**ESTADO:** 📋 BLUEPRINT (Pre-Implementación)  
**RESPONSABLE:** PunkOpus + Radwulf (Horizontalidad Total)  
**ORIGEN:** Núcleo Evolutivo de Selene Song (Dentiagest) → LuxSync  
**REVISION:** v2.0 - Mood Threshold Multipliers (descartado Random Noise)

---

## 📋 EXECUTIVE SUMMARY

Selene Lux está lista para su siguiente evolución: **MOOD-AWARE DECISION MAKING**.

### 🎯 EL PROBLEMA RESUELTO

La canción tiene un "Drop" técnico (la energía sube). El Z-Score dice "¡Acción!". 
**PERO** el contexto humano (gente bailando suave con cubata en mano) dice: "Relaja, fiera".

**SOLUCIÓN:** El sistema de **MOOD MODIFIERS** que ajusta los umbrales de disparo:

- **CALM:** "Para disparar aquí, tráeme un drop de nivel DIOS. Si es normalito, me lo guardo."
- **BALANCED:** "Disparo cuando la música lo pide. Ni más, ni menos."
- **PUNK:** "¿Ha estornudado el DJ? ¡SOLAR FLARE!" 😂

### 🚫 LO QUE NO ES

- ❌ NO es random noise
- ❌ NO es "efectos por minuto" arbitrarios
- ❌ NO es chaos sin sentido

### ✅ LO QUE SÍ ES

- ✅ Multiplicadores de umbral DETERMINISTAS
- ✅ Ajuste de cooldowns proporcional
- ✅ Respeto absoluto a la Constitución de Vibes (The Shield)
- ✅ Lógica matemática clara y auditable

---

## 🔬 ANÁLISIS DEL MOTOR ORIGEN (Selene Song)

### Componentes Clave Identificados

```
docs/ideas/evolutionary/
├── selene-evolution-engine.ts          # Core: Ciclo evolutivo principal
├── evolutionary-auto-optimization-engine.ts  # Bridge: Auto-optimización
├── engines/
│   ├── evolutionary-decision-generator.ts    # Generador de decisiones novedosas
│   ├── fibonacci-pattern-engine.ts           # Patrones matemáticos
│   ├── musical-harmony-validator.ts          # Validación harmónica
│   └── zodiac-affinity-calculator.ts         # Afinidad zodiacal (dato user)
├── modes/
│   └── mode-manager.ts                 # 🔀 THE SWITCH - Control de entropía
├── interfaces/
│   └── evolutionary-engine-interfaces.ts     # Tipos/Interfaces
└── security/
    ├── evolutionary-safety-validator.ts      # Validación de seguridad
    ├── pattern-sanity-checker.ts             # Cordura de patrones
    ├── decision-containment-system.ts        # Contención de impacto
    └── evolutionary-rollback-engine.ts       # Rollback automático
```

### Concepto Central: THE SWITCH (ModeManager)

El corazón del sistema es el **ModeManager**, que define 3 modos de entropía:

| Mode | Entropy | Risk | Punk | Feedback | Uso |
|------|---------|------|------|----------|-----|
| **DETERMINISTIC** | 0% | 10% | 0% | 0% | Reproducibilidad (auditoría) |
| **BALANCED** | 50% | 40% | 30% | 50% | Default (general SaaS) |
| **PUNK** | 100% | 70% | 80% | 100% | Creatividad máxima (arte) |

**Opción D - Dualidad Adaptativa:** El modo se auto-ajusta basándose en feedback:
- Rating > 7 → +10% entropy, +10% punk
- Rating < 4 → -10% entropy, -10% punk
- Rating 4-7 → Sin cambios

---

## 🎨 DISEÑO PARA LUXSYNC: THE LIGHT GENE

### 1. Mapeo de Conceptos: SongGene → LightGene

| Selene Song | Selene Lux | Descripción |
|-------------|------------|-------------|
| `EvolutionaryDecisionType` | `LightGene` | Una decisión de iluminación evolutiva |
| `EvolutionarySuggestion` | `LightMutation` | Propuesta de cambio en parámetros |
| `EvolutionContext` | `LightContext` | Estado actual del sistema de luces |
| `FeedbackEntry` | `DJFeedback` | Feedback implícito/explícito del DJ |
| `ModeManager` | `EntropyController` | Control del nivel de "locura" |

### 2. Estructura de LightGene

```typescript
interface LightGene {
  geneId: string;
  
  // Parámetros que este gen controla
  targetParameter: 
    | 'effect_frequency'      // Qué tan seguido disparar efectos
    | 'effect_intensity'      // Qué tan intensos son
    | 'color_variance'        // Variación en paleta de colores
    | 'strobe_aggression'     // Agresividad de strobes
    | 'transition_speed'      // Velocidad de transiciones
    | 'ambient_ratio';        // Ratio efectos épicos vs ambient
  
  // Valor actual del gen
  currentValue: number;  // 0-100
  
  // Historial de mutaciones
  mutations: LightMutation[];
  
  // Fitness score (calculado de feedback)
  fitnessScore: number;  // 0-1
  
  // Metadata evolutiva
  generation: number;
  parentGeneId?: string;
  birthTimestamp: number;
  lastMutationTimestamp: number;
}

interface LightMutation {
  mutationId: string;
  geneId: string;
  
  // Qué cambió
  oldValue: number;
  newValue: number;
  delta: number;  // +/- change
  
  // Por qué mutó
  trigger: 'feedback_positive' | 'feedback_negative' | 'entropy' | 'time_decay' | 'manual';
  
  // Resultado
  applied: boolean;
  timestamp: number;
  feedbackReceived?: DJFeedback;
}
```

### 3. Estructura de DJFeedback

```typescript
interface DJFeedback {
  feedbackId: string;
  timestamp: number;
  
  // Tipo de feedback
  feedbackType: 
    | 'explicit_like'      // DJ presionó botón Like
    | 'explicit_dislike'   // DJ presionó botón Dislike
    | 'implicit_stay'      // DJ no cambió vibe en X segundos (positivo)
    | 'implicit_change'    // DJ cambió vibe rápidamente (negativo)
    | 'manual_override';   // DJ tomó control manual (muy negativo)
  
  // Contexto cuando ocurrió
  context: {
    vibe: string;
    energy: number;
    bpm: number;
    activeEffects: string[];
    sectionType: string;
  };
  
  // Genes afectados (calculado)
  affectedGenes: string[];
  
  // Valor del feedback (-1 a +1)
  value: number;
}
```

---

## 🔀 DISEÑO: THE MOOD CORE (Threshold Multipliers)

### Concepto Central: Multiplicadores de Umbral

En lugar de añadir "ruido" o limitar efectos por minuto, el Mood Core **MODIFICA LOS UMBRALES** de disparo:

```
┌─────────────────────────────────────────────────────────────────────┐
│                         THE MOOD CORE                                │
│                    (Threshold Multipliers)                           │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   Raw Score (Fuzzy/Hunt) ───► MOOD MODIFIER ───► Final Score        │
│                                    │                                 │
│                          ┌─────────┴─────────┐                       │
│                          │  Score / ThreshMult │                     │
│                          └───────────────────┘                       │
│                                                                      │
│   CALM:     0.8 / 1.5 = 0.53  →  NO DISPARA (threshold 0.7)         │
│   BALANCED: 0.8 / 1.0 = 0.80  →  DISPARA ✓                          │
│   PUNK:     0.5 / 0.6 = 0.83  →  DISPARA ✓                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### MoodProfile: La Configuración de los 3 Modos

```typescript
/**
 * 🎭 MOOD PROFILE
 * Define cómo cada modo modifica el comportamiento del sistema
 */
interface MoodProfile {
  name: 'calm' | 'balanced' | 'punk';
  
  // ═══════════════════════════════════════════════════════════════
  // THRESHOLD MULTIPLIERS - El corazón del sistema
  // ═══════════════════════════════════════════════════════════════
  
  /** 
   * Multiplica el UMBRAL de disparo
   * > 1.0 = más difícil disparar (necesitas score más alto)
   * < 1.0 = más fácil disparar (scores bajos ya disparan)
   * 
   * Fórmula: effectiveScore = rawScore / thresholdMultiplier
   */
  thresholdMultiplier: number;
  
  /**
   * Multiplica los COOLDOWNS de efectos
   * > 1.0 = espera más entre efectos
   * < 1.0 = repite efectos más rápido
   */
  cooldownMultiplier: number;
  
  // ═══════════════════════════════════════════════════════════════
  // INTENSITY LIMITS - Techo y suelo de intensidad
  // ═══════════════════════════════════════════════════════════════
  
  /** Intensidad máxima permitida (0-1) */
  maxIntensity: number;
  
  /** Intensidad mínima forzada (0-1) - Solo para PUNK */
  minIntensity?: number;
  
  // ═══════════════════════════════════════════════════════════════
  // EFFECT RESTRICTIONS - Bloqueos y desbloqueos
  // ═══════════════════════════════════════════════════════════════
  
  /** Efectos PROHIBIDOS en este modo */
  blockList: string[];
  
  /** Efectos SIEMPRE disponibles (ignora cooldown) - Solo PUNK */
  forceUnlock?: string[];
}

/**
 * 🎭 MOOD PROFILES - Configuración de los 3 modos
 */
const MOOD_PROFILES: Record<string, MoodProfile> = {
  
  // ═══════════════════════════════════════════════════════════════
  // 😌 CALM - "Tráeme un drop de nivel DIOS o me lo guardo"
  // ═══════════════════════════════════════════════════════════════
  calm: {
    name: 'calm',
    thresholdMultiplier: 1.5,    // 50% más difícil disparar
    cooldownMultiplier: 2.0,     // Doble espera entre efectos
    maxIntensity: 0.6,           // Max 60% intensidad
    minIntensity: undefined,
    blockList: [
      'strobe_storm',            // Strobes agresivos PROHIBIDOS
      'strobe_burst',            // Mini-strobes también
    ],
    forceUnlock: undefined,
  },
  
  // ═══════════════════════════════════════════════════════════════
  // ⚖️ BALANCED - "Disparo cuando la música lo pide"
  // ═══════════════════════════════════════════════════════════════
  balanced: {
    name: 'balanced',
    thresholdMultiplier: 1.0,    // Sin modificación
    cooldownMultiplier: 1.0,     // Cooldowns normales
    maxIntensity: 1.0,           // Sin límite
    minIntensity: undefined,
    blockList: [],               // Nada bloqueado
    forceUnlock: undefined,
  },
  
  // ═══════════════════════════════════════════════════════════════
  // 🔥 PUNK - "¿Ha estornudado el DJ? ¡SOLAR FLARE!"
  // ═══════════════════════════════════════════════════════════════
  punk: {
    name: 'punk',
    thresholdMultiplier: 0.6,    // 40% más fácil disparar
    cooldownMultiplier: 0.3,     // Cooldowns x0.3 (3x más rápido)
    maxIntensity: 1.0,           // Sin límite
    minIntensity: 0.5,           // MÍNIMO 50% intensidad siempre
    blockList: [],               // Nada bloqueado
    forceUnlock: [
      'strobe_burst',            // Strobes SIEMPRE disponibles
      'solar_flare',             // Flares ignoran cooldown
    ],
  },
};
```

### Ejemplos Numéricos Concretos

```
┌────────────────────────────────────────────────────────────────────────┐
│  EJEMPLO 1: Drop "normalito" (Raw Score = 0.75, Trigger Threshold = 0.7)
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  CALM:     0.75 / 1.5 = 0.50  →  0.50 < 0.70  →  ❌ NO DISPARA        │
│  BALANCED: 0.75 / 1.0 = 0.75  →  0.75 > 0.70  →  ✅ DISPARA           │
│  PUNK:     0.75 / 0.6 = 1.25  →  1.25 > 0.70  →  ✅ DISPARA (capped)  │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│  EJEMPLO 2: Drop ÉPICO (Raw Score = 0.95, Trigger Threshold = 0.7)
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  CALM:     0.95 / 1.5 = 0.63  →  0.63 < 0.70  →  ❌ AÚN NO (casi!)    │
│  BALANCED: 0.95 / 1.0 = 0.95  →  0.95 > 0.70  →  ✅ DISPARA           │
│  PUNK:     0.95 / 0.6 = 1.58  →  1.58 > 0.70  →  ✅ DISPARA NUCLEAR   │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│  EJEMPLO 3: Drop de nivel DIOS (Raw Score = 1.0+, Trigger = 0.7)
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  CALM:     1.10 / 1.5 = 0.73  →  0.73 > 0.70  →  ✅ AHORA SÍ!         │
│  (Solo los momentos REALMENTE épicos disparan en CALM)                 │
│                                                                        │
└────────────────────────────────────────────────────────────────────────┘
```

### Cooldown Adjustment

```typescript
// Antes (sin mood):
const baseCooldown = EFFECT_COOLDOWNS['solar_flare']; // 25000ms

// Con mood:
const moodProfile = MoodController.getCurrentProfile();
const effectiveCooldown = baseCooldown * moodProfile.cooldownMultiplier;

// CALM:     25000 * 2.0 = 50000ms (50 segundos entre flares)
// BALANCED: 25000 * 1.0 = 25000ms (25 segundos - normal)
// PUNK:     25000 * 0.3 = 7500ms  (7.5 segundos - CAOS)
```

---

## 🧠 THE MOOD CONTROLLER (Singleton)

### Arquitectura Simple y Elegante

```
┌─────────────────────────────────────────────────────────────────────┐
│                    MOOD CONTROLLER                                   │
│                    (The Switch - Simple State)                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌────────────────────────────────────────────────────────────┐    │
│   │                                                             │    │
│   │  currentMood: 'calm' | 'balanced' | 'punk'                 │    │
│   │                                                             │    │
│   │  getCurrentProfile(): MoodProfile                          │    │
│   │  setMood(mood: MoodId): void                              │    │
│   │  applyThreshold(rawScore: number): number                  │    │
│   │  applyCooldown(baseCooldown: number): number               │    │
│   │  applyIntensity(baseIntensity: number): number            │    │
│   │  isEffectBlocked(effectId: string): boolean               │    │
│   │  isEffectForceUnlocked(effectId: string): boolean         │    │
│   │                                                             │    │
│   └────────────────────────────────────────────────────────────┘    │
│                                                                      │
│   NO BASE DE DATOS.                                                  │
│   NO GENES.                                                          │
│   NO MUTACIONES.                                                     │
│   SOLO UN SWITCH CON 3 POSICIONES.                                   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Implementación del Singleton

```typescript
/**
 * 🎭 MOOD CONTROLLER
 * The Switch - Un singleton que controla EL HUMOR de Selene
 * 
 * NO ES MACHINE LEARNING.
 * NO ES FUZZY LOGIC.
 * ES UN PUTO SWITCH CON 3 POSICIONES.
 */
export class MoodController {
  private static instance: MoodController | null = null;
  private currentMood: MoodId = 'balanced';
  
  private constructor() {}
  
  static getInstance(): MoodController {
    if (!MoodController.instance) {
      MoodController.instance = new MoodController();
    }
    return MoodController.instance;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // GETTERS
  // ═══════════════════════════════════════════════════════════════
  
  getCurrentMood(): MoodId {
    return this.currentMood;
  }
  
  getCurrentProfile(): MoodProfile {
    return MOOD_PROFILES[this.currentMood];
  }
  
  // ═══════════════════════════════════════════════════════════════
  // SETTER
  // ═══════════════════════════════════════════════════════════════
  
  setMood(mood: MoodId): void {
    this.currentMood = mood;
    console.log(`[MoodController] 🎭 Mood changed to: ${mood.toUpperCase()}`);
  }
  
  // ═══════════════════════════════════════════════════════════════
  // THRESHOLD MODIFIER
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Aplica el modificador de umbral al score crudo
   * @param rawScore Score de 0-1+ del FuzzyDecisionMaker o HuntEngine
   * @returns Effective score (modificado por el mood)
   */
  applyThreshold(rawScore: number): number {
    const profile = this.getCurrentProfile();
    // Dividimos el score por el multiplicador
    // Mayor multiplicador = score efectivo MÁS BAJO = MÁS DIFÍCIL disparar
    return rawScore / profile.thresholdMultiplier;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // COOLDOWN MODIFIER
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Aplica el modificador de cooldown
   * @param baseCooldown Cooldown base en ms
   * @returns Cooldown modificado
   */
  applyCooldown(baseCooldown: number): number {
    const profile = this.getCurrentProfile();
    return Math.round(baseCooldown * profile.cooldownMultiplier);
  }
  
  // ═══════════════════════════════════════════════════════════════
  // INTENSITY MODIFIER
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * Aplica límites de intensidad
   * @param baseIntensity Intensidad base 0-1
   * @returns Intensidad clampeada por el mood
   */
  applyIntensity(baseIntensity: number): number {
    const profile = this.getCurrentProfile();
    let intensity = baseIntensity;
    
    // Aplicar máximo
    intensity = Math.min(intensity, profile.maxIntensity);
    
    // Aplicar mínimo (solo PUNK tiene esto)
    if (profile.minIntensity !== undefined) {
      intensity = Math.max(intensity, profile.minIntensity);
    }
    
    return intensity;
  }
  
  // ═══════════════════════════════════════════════════════════════
  // EFFECT RESTRICTIONS
  // ═══════════════════════════════════════════════════════════════
  
  /**
   * ¿Está este efecto bloqueado en el mood actual?
   */
  isEffectBlocked(effectId: string): boolean {
    const profile = this.getCurrentProfile();
    return profile.blockList.includes(effectId);
  }
  
  /**
   * ¿Está este efecto desbloqueado forzosamente? (ignora cooldown)
   */
  isEffectForceUnlocked(effectId: string): boolean {
    const profile = this.getCurrentProfile();
    return profile.forceUnlock?.includes(effectId) ?? false;
  }
}
```

---

## 📊 FLUJO DE DECISIÓN COMPLETO (v2 - Simplified)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SELENE LUX DECISION FLOW                             │
│                         (con Mood Multipliers - WAVE 700)                    │
└─────────────────────────────────────────────────────────────────────────────┘

                          ┌─────────────────┐
                          │   AUDIO INPUT   │
                          │   (FFT, BPM)    │
                          └────────┬────────┘
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │   MUSICAL CONTEXT        │
                    │   (Z-Score, Section,     │
                    │    Energy, Key)          │
                    └────────────┬─────────────┘
                                 │
              ┌──────────────────┴──────────────────┐
              │                                     │
              ▼                                     ▼
    ┌─────────────────────┐             ┌─────────────────────┐
    │   FUZZY DECISION    │             │   HUNT ENGINE       │
    │   MAKER             │             │   (Strike/Stalk)    │
    │   (Prepare/Hold)    │             │                     │
    │                     │             │                     │
    │   ► rawScore        │             │   ► rawScore        │
    └──────────┬──────────┘             └──────────┬──────────┘
               │                                   │
               └─────────────┬─────────────────────┘
                             │
                             │  Raw Score (0-1+)
                             │
    ╔════════════════════════▼════════════════════════════════════╗
    ║          🎭 MOOD MODIFIER (NEW - WAVE 700)                  ║
    ║                                                              ║
    ║  ┌─────────────────────────────────────────────────────┐    ║
    ║  │                                                      │    ║
    ║  │   effectiveScore = rawScore / thresholdMultiplier   │    ║
    ║  │                                                      │    ║
    ║  │   CALM:     rawScore / 1.5  (harder to trigger)     │    ║
    ║  │   BALANCED: rawScore / 1.0  (normal)                │    ║
    ║  │   PUNK:     rawScore / 0.6  (easier to trigger)     │    ║
    ║  │                                                      │    ║
    ║  └─────────────────────────────────────────────────────┘    ║
    ║                                                              ║
    ╚════════════════════════╤════════════════════════════════════╝
                             │
                             │  Effective Score (modified)
                             │
                             ▼
              ┌──────────────────────────┐
              │   VIBE SHIELD            │
              │   (The Constitution)     │
              │   ══════════════════     │
              │   SUPREME AUTHORITY      │
              │   Cannot be overridden   │
              └────────────┬─────────────┘
                           │
                           │  If effectiveScore > threshold
                           │
                           ▼
              ┌──────────────────────────┐
              │   CONTEXTUAL EFFECT      │
              │   SELECTOR               │
              │   (con Mood Modifiers)   │
              │                          │
              │   • isEffectBlocked?     │
              │   • isInCooldown?        │
              │     (cooldown * mult)    │
              │   • forceUnlock?         │
              └────────────┬─────────────┘
                           │
                           │ Selected Effect
                           │
                           ▼
              ┌──────────────────────────┐
              │   EFFECT MANAGER         │
              │   (Trigger Effect)       │
              │                          │
              │   intensity *= moodMod   │
              │   clamp(min, max)        │
              └────────────┬─────────────┘
                           │
                           ▼
              ┌──────────────────────────┐
              │   TITAN ORCHESTRATOR     │
              │   (Render to Fixtures)   │
              └────────────┬─────────────┘
                           │
                           ▼
              ┌──────────────────────────┐
              │   DMX OUTPUT             │
              └──────────────────────────┘
```

### Jerarquía de Autoridad (Inmutable)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     JERARQUÍA DE AUTORIDAD                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   1. 📜 VIBE SHIELD (The Constitution)                              │
│      └──► AUTORIDAD SUPREMA                                          │
│          └──► Qué efectos son LEGALES para cada vibe                │
│          └──► NADIE puede violar esto                               │
│                                                                      │
│   2. 🎭 MOOD MODIFIER                                                │
│      └──► MODIFICA UMBRALES dentro de lo legal                      │
│          └──► CALM eleva el listón (más difícil disparar)           │
│          └──► PUNK baja el listón (más fácil disparar)              │
│          └──► NO puede hacer legal lo ilegal                        │
│                                                                      │
│   3. 🎯 CONTEXTUAL EFFECT SELECTOR                                   │
│      └──► Elige el efecto ESPECÍFICO                                │
│          └──► Dentro de lo legal (Vibe)                             │
│          └──► Con umbrales modificados (Mood)                       │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

EJEMPLO:

  Vibe = "chill_lounge" (Strobes PROHIBIDOS por Constitution)
  Mood = "punk" (quiere strobes)
  
  → PUNK NO PUEDE hacer que dispare un strobe
  → PUNK SÍ PUEDE hacer que dispare cumbia_moon con score bajo
  → La Constitución SIEMPRE gana
```

---

## 🏗️ PLAN DE INTEGRACIÓN SIMPLIFICADO

### Fase 1: Crear MoodController (WAVE 700.1)

**Archivos a crear:**

```
electron-app/src/core/mood/
├── index.ts                    # Exports públicos
├── types.ts                    # MoodId, MoodProfile interfaces
└── MoodController.ts           # THE SWITCH singleton
```

**Sin dependencias nuevas** - Es puro TypeScript

### Fase 2: Integrar en ContextualEffectSelector (WAVE 700.2)

**Modificaciones:**

```typescript
// ContextualEffectSelector.ts - MODIFICACIÓN

import { MoodController } from '../mood/MoodController';

// En selectEffect(), ANTES de verificar cooldown:
private isOnCooldown(effectId: string): boolean {
  const baseCooldown = this.effectCooldowns[effectId];
  const lastUse = this.lastEffectUse.get(effectId) ?? 0;
  
  // 🎭 WAVE 700: Mood modifica el cooldown
  const moodController = MoodController.getInstance();
  
  // Si está force-unlocked (PUNK mode), ignorar cooldown
  if (moodController.isEffectForceUnlocked(effectId)) {
    return false;
  }
  
  const effectiveCooldown = moodController.applyCooldown(baseCooldown);
  return Date.now() - lastUse < effectiveCooldown;
}

// ANTES de seleccionar efecto, verificar blockList:
private filterByMood(candidates: string[]): string[] {
  const moodController = MoodController.getInstance();
  return candidates.filter(e => !moodController.isEffectBlocked(e));
}
```

### Fase 3: Integrar en FuzzyDecisionMaker (WAVE 700.3)

**Modificaciones:**

```typescript
// FuzzyDecisionMaker.ts - MODIFICACIÓN

import { MoodController } from '../mood/MoodController';

// En la función principal de decisión:
public decide(rawScore: number): DecisionResult {
  // 🎭 WAVE 700: Aplicar modificador de mood
  const moodController = MoodController.getInstance();
  const effectiveScore = moodController.applyThreshold(rawScore);
  
  // Ahora usar effectiveScore en lugar de rawScore
  if (effectiveScore < THRESHOLD) {
    return { action: 'hold' };
  }
  // ...
}
```

### Fase 4: UI Toggle Simple (WAVE 700.4)

**Componente React:**

```tsx
// MoodToggle.tsx
const MoodToggle: React.FC = () => {
  const [mood, setMood] = useState<MoodId>('balanced');
  
  const handleChange = (newMood: MoodId) => {
    setMood(newMood);
    // IPC al backend
    window.electronAPI.setMood(newMood);
  };
  
  return (
    <div className="mood-toggle">
      <button 
        className={mood === 'calm' ? 'active' : ''}
        onClick={() => handleChange('calm')}
      >
        😌 CALM
      </button>
      <button 
        className={mood === 'balanced' ? 'active' : ''}
        onClick={() => handleChange('balanced')}
      >
        ⚖️ BALANCED
      </button>
      <button 
        className={mood === 'punk' ? 'active' : ''}
        onClick={() => handleChange('punk')}
      >
        🔥 PUNK
      </button>
    </div>
  );
};
```

---

## 📅 TIMELINE ESTIMADO (v2 - Simplificado)

| Wave | Descripción | Esfuerzo | Prioridad |
|------|-------------|----------|-----------|
| 700.1 | Crear módulo `mood/` con tipos + MoodController | 1 hora | 🔴 ALTA |
| 700.2 | Integrar en `ContextualEffectSelector` | 1 hora | 🔴 ALTA |
| 700.3 | Integrar en `FuzzyDecisionMaker` | 30 min | 🔴 ALTA |
| 700.4 | UI: MoodToggle component + IPC | 1-2 horas | 🟡 MEDIA |
| 700.5 | Testing + calibración de multiplicadores | 1-2 horas | 🟡 MEDIA |

**TOTAL ESTIMADO:** 4-6 horas de desarrollo (vs 15-17 horas del diseño v1)

### Comparación v1 vs v2

```
┌────────────────────────────────────────────────────────────────────────┐
│                    DISEÑO v1 (Descartado)                              │
├────────────────────────────────────────────────────────────────────────┤
│ ❌ SQLite para genes                                                   │
│ ❌ GenePool + GeneMutator + FitnessEngine                             │
│ ❌ FeedbackProcessor + EvolutionaryMemory                             │
│ ❌ "Effects per minute" limits                                         │
│ ❌ Random noise injection                                              │
│ ❌ 15-17 horas de desarrollo                                          │
│ ❌ Complejidad innecesaria                                            │
└────────────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────────────┐
│                    DISEÑO v2 (Aprobado)                                │
├────────────────────────────────────────────────────────────────────────┤
│ ✅ Solo TypeScript puro                                                │
│ ✅ Un singleton con 3 posiciones                                       │
│ ✅ Threshold Multipliers (matemáticas simples)                         │
│ ✅ Cooldown Multipliers                                                │
│ ✅ BlockList / ForceUnlock                                             │
│ ✅ 4-6 horas de desarrollo                                             │
│ ✅ Elegante y determinista                                             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 MÉTRICAS DE ÉXITO (v2)

| Métrica | Modo | Expectativa |
|---------|------|-------------|
| Triggers por drop normalito | CALM | 0 de 10 |
| Triggers por drop normalito | BALANCED | 5-6 de 10 |
| Triggers por drop normalito | PUNK | 10 de 10 |
| Cooldown efectivo solar_flare | CALM | 50 segundos |
| Cooldown efectivo solar_flare | BALANCED | 25 segundos |
| Cooldown efectivo solar_flare | PUNK | 7.5 segundos |
| Intensidad máxima | CALM | 60% |
| Intensidad máxima | PUNK | 100% (min 50%) |

---

## ⚠️ RIESGOS Y MITIGACIONES (v2)

| Riesgo | Impacto | Mitigación |
|--------|---------|------------|
| PUNK mode es demasiado caótico | BAJO | Ajustar multipliers (0.6 → 0.7) |
| CALM mode es aburrido | BAJO | Añadir efectos ambient a whitelist |
| Conflicto con Vibe Shield | **NINGUNO** | Jerarquía clara: Constitution > Mood |
| DJ confundido con el toggle | BAJO | UI clara con iconos + nombres |

---

## 🔥 SIGUIENTE PASO RECOMENDADO

**EJECUTAR WAVE 700.1:** Crear el módulo `mood/`

```
electron-app/src/core/mood/
├── index.ts        # export { MoodController, MoodProfile, MoodId }
├── types.ts        # interface MoodProfile, type MoodId
└── MoodController.ts   # class MoodController (singleton)
```

**Tiempo estimado:** 1 hora

Una vez tengamos el MoodController funcionando, la integración es trivial:
1. Import en ContextualEffectSelector
2. Import en FuzzyDecisionMaker  
3. Llamar a los métodos en los puntos correctos

---

## 💀 NOTA PUNK (v2)

> *"No necesitamos Machine Learning para ser evolutivos.*  
> *No necesitamos SQLite para tener memoria.*  
> *No necesitamos 15 horas para hacer un switch de 3 posiciones.*  
>
> *A veces la solución más PUNK es la más simple:*  
> ***UN PUTO SWITCH.***"*
>
> — PunkOpus, Wave 700 Blueprint v2

---

**WAVE 700: THE MOOD SWITCH - BLUEPRINT v2 COMPLETE** 🎭

*"El Modo CALM entra como un caballero: eleva el listón."*  
*"El Modo PUNK baja la valla: ¿Ha estornudado el DJ? ¡SOLAR FLARE!"*

*No MVPs. Solo Full App. Con un switch elegante.*
