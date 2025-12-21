# 🎛️ WAVE 58: THE VIBE ENGINE - PART 1
## Architecture Blueprint: Bounded Context System

**Autor:** Claude (Opus) - Master Punk Architect Mode  
**Fecha:** 2025-12-21  
**Estado:** 📐 BLUEPRINT - Pre-Implementation  
**Filosofía:** RESTRINGIR, NO FORZAR

---

## 📋 EXECUTIVE SUMMARY

### El Problema
La detección automática de género (SimpleBinaryBias, GenreClassifier) es **inestable, reactiva y amateur**. Un techno minimalista de Boris Brejcha se detecta como "LATINO_TRADICIONAL" por picos de sincopación. El sistema **reacciona** al caos en lugar de **operar** dentro de un marco definido.

### La Solución
**VIBE ENGINE**: Sistema de presets contextuales inyectados manualmente por el DJ. Selene opera dentro de **Bounded Contexts** (rangos dinámicos acotados), no valores estáticos.

### Principio Fundamental
```
┌─────────────────────────────────────────────────────────────────┐
│  RESTRINGIR ≠ FORZAR                                            │
│                                                                 │
│  ❌ FORZAR:    mood = 'dark'           (valor estático)        │
│  ✅ RESTRINGIR: mood ∈ ['dark', 'calm', 'dramatic']            │
│                 (Selene elige DENTRO del conjunto permitido)   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. 📐 ESTRUCTURA DE DATOS

### 1.1 VibeProfile Interface (Core)

```typescript
/**
 * 🎛️ WAVE 58: VIBE PROFILE
 * 
 * Define un "Bounded Context" para Selene.
 * El DJ selecciona el Vibe, Selene opera DENTRO de sus restricciones.
 * 
 * FILOSOFÍA: Rangos dinámicos, no valores estáticos.
 */
export interface VibeProfile {
  // ═══════════════════════════════════════════════════════════════
  // IDENTIDAD
  // ═══════════════════════════════════════════════════════════════
  id: VibeId;
  name: string;
  description: string;
  icon: string;  // Emoji para UI
  
  // ═══════════════════════════════════════════════════════════════
  // MOOD CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  mood: {
    /** Moods permitidos - Selene SOLO puede elegir de este array */
    allowed: MoodType[];
    
    /** Mood por defecto cuando no hay análisis confiable */
    fallback: MoodType;
    
    /** Peso del análisis de audio vs preset (0=ignora audio, 1=100% audio) */
    audioInfluence: number;  // 0.0 - 1.0
  };
  
  // ═══════════════════════════════════════════════════════════════
  // COLOR CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  color: {
    /** Estrategias de color permitidas */
    strategies: ColorStrategy[];
    
    /** Rango de temperatura (Kelvin conceptual: 2000K=cálido, 10000K=frío) */
    temperature: {
      min: number;  // 2000-10000
      max: number;  // 2000-10000
    };
    
    /** Rango de saturación permitido */
    saturation: {
      min: number;  // 0.0 - 1.0
      max: number;  // 0.0 - 1.0
    };
    
    /** Hue shift máximo por frame (anti-epilepsia) */
    maxHueShiftPerSecond: number;  // degrees/second
    
    /** Paletas preferidas (hint, no restricción dura) */
    preferredPalettes?: string[];
  };
  
  // ═══════════════════════════════════════════════════════════════
  // DROP PHYSICS
  // ═══════════════════════════════════════════════════════════════
  drop: {
    /** Sensibilidad de detección (0=nunca, 1=muy sensible) */
    sensitivity: number;  // 0.0 - 1.0
    
    /** Umbral de energía relativa para trigger */
    energyThreshold: number;  // 0.0 - 0.5 (diferencia con smoothed)
    
    /** Curvas de transición */
    curves: {
      attack: CurveType;      // 'instant' | 'linear' | 'ease-in' | 'exponential'
      sustain: CurveType;
      release: CurveType;
    };
    
    /** Tiempos en frames (60fps) */
    timing: {
      minAttack: number;      // frames mínimos en attack
      maxSustain: number;     // frames máximos en sustain
      releaseFrames: number;  // frames de release
      cooldownFrames: number; // frames entre drops
    };
    
    /** ¿Permitir micro-drops? (drops <2s) */
    allowMicroDrops: boolean;
  };
  
  // ═══════════════════════════════════════════════════════════════
  // DIMMER RULES
  // ═══════════════════════════════════════════════════════════════
  dimmer: {
    /** Suelo mínimo de intensidad (blackout protection) */
    floor: number;  // 0.0 - 1.0
    
    /** Techo máximo de intensidad */
    ceiling: number;  // 0.0 - 1.0
    
    /** ¿Permitir blackout total? */
    allowBlackout: boolean;
    
    /** Velocidad de transición de dimmer */
    transitionSpeed: 'instant' | 'fast' | 'medium' | 'slow' | 'glacial';
    
    /** Curva de dimmer en breakdowns */
    breakdownCurve: CurveType;
  };
  
  // ═══════════════════════════════════════════════════════════════
  // MOVEMENT CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  movement: {
    /** Patrones de movimiento permitidos */
    allowedPatterns: MovementPattern[];
    
    /** Rango de velocidad */
    speedRange: {
      min: number;  // 0.0 - 1.0
      max: number;  // 0.0 - 1.0
    };
    
    /** ¿Permitir movimientos agresivos/rápidos? */
    allowAggressive: boolean;
    
    /** Sincronización preferida */
    preferredSync: 'beat' | 'phrase' | 'free';
  };
  
  // ═══════════════════════════════════════════════════════════════
  // EFFECTS CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  effects: {
    /** Efectos permitidos */
    allowed: EffectType[];
    
    /** Strobe: máxima frecuencia permitida (Hz) */
    maxStrobeRate: number;
    
    /** ¿Permitir fog automático? */
    autoFog: boolean;
    
    /** Intensidad máxima de efectos */
    maxIntensity: number;  // 0.0 - 1.0
  };
  
  // ═══════════════════════════════════════════════════════════════
  // META CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  meta: {
    /** Energía base del vibe (afecta todos los cálculos) */
    baseEnergy: number;  // 0.0 - 1.0
    
    /** Volatilidad permitida (cuánto puede variar frame a frame) */
    volatility: number;  // 0.0 - 1.0
    
    /** ¿Priorizar estabilidad sobre reactividad? */
    stabilityFirst: boolean;
    
    /** Override de BPM (para ignorar detección errónea) */
    bpmHint?: {
      min: number;
      max: number;
    };
  };
}

// ═══════════════════════════════════════════════════════════════════
// TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════

export type VibeId = 'techno-club' | 'fiesta-latina' | 'pop-rock' | 'chill-lounge';

export type MoodType = 
  | 'peaceful' | 'calm' | 'dreamy'      // Low energy
  | 'playful' | 'festive' | 'euphoric'  // High energy positive
  | 'dark' | 'dramatic' | 'aggressive'  // High energy negative
  | 'energetic' | 'tense';              // Neutral high energy

export type ColorStrategy = 'analogous' | 'complementary' | 'triadic' | 'monochromatic';

export type CurveType = 'instant' | 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'exponential';

export type MovementPattern = 
  | 'static' | 'sweep' | 'circle' | 'figure8' 
  | 'random' | 'mirror' | 'chase' | 'wave';

export type EffectType = 'strobe' | 'fog' | 'laser' | 'beam' | 'prism' | 'blinder';
```

---

## 2. 🎨 DEFINICIÓN DE LOS 4 PRESETS

### 2.1 TECHNO CLUB 🏭

```typescript
export const VIBE_TECHNO_CLUB: VibeProfile = {
  id: 'techno-club',
  name: 'Techno Club',
  description: 'Industrial precision. Dark atmospheres. Hypnotic repetition.',
  icon: '🏭',
  
  mood: {
    allowed: ['dark', 'dramatic', 'tense', 'calm', 'energetic'],
    // ❌ PROHIBIDO: 'festive', 'playful', 'peaceful', 'euphoric'
    fallback: 'dark',
    audioInfluence: 0.7,  // 70% audio, 30% preset bias
  },
  
  color: {
    strategies: ['monochromatic', 'analogous', 'complementary'],
    // ❌ PROHIBIDO: 'triadic' (demasiado festivo)
    temperature: {
      min: 4000,   // Neutro-frío
      max: 9000,   // Muy frío permitido
    },
    saturation: {
      min: 0.3,    // Puede ser desaturado
      max: 0.85,   // Nunca híper-saturado
    },
    maxHueShiftPerSecond: 30,  // Cambios lentos
    preferredPalettes: ['industrial', 'neon-cold', 'monochrome'],
  },
  
  drop: {
    sensitivity: 0.6,         // Sensibilidad media-alta
    energyThreshold: 0.18,    // Requiere spike real
    curves: {
      attack: 'exponential',  // Build tension
      sustain: 'linear',
      release: 'ease-out',    // Fade gradual
    },
    timing: {
      minAttack: 45,          // 0.75s mínimo de build
      maxSustain: 600,        // 10s máximo
      releaseFrames: 90,      // 1.5s release
      cooldownFrames: 240,    // 4s entre drops
    },
    allowMicroDrops: false,   // No micro-drops
  },
  
  dimmer: {
    floor: 0.05,              // Casi blackout permitido
    ceiling: 1.0,             // Full power
    allowBlackout: true,      // Blackout dramático OK
    transitionSpeed: 'medium',
    breakdownCurve: 'ease-out',
  },
  
  movement: {
    allowedPatterns: ['sweep', 'circle', 'static', 'mirror'],
    // ❌ PROHIBIDO: 'random', 'chase' (demasiado caótico)
    speedRange: { min: 0.2, max: 0.7 },  // Movimientos controlados
    allowAggressive: true,
    preferredSync: 'beat',
  },
  
  effects: {
    allowed: ['strobe', 'fog', 'beam', 'laser'],
    maxStrobeRate: 12,        // Max 12Hz
    autoFog: true,
    maxIntensity: 0.9,
  },
  
  meta: {
    baseEnergy: 0.7,          // Energía alta por defecto
    volatility: 0.3,          // Cambios controlados
    stabilityFirst: true,     // Priorizar coherencia
    bpmHint: { min: 120, max: 150 },
  },
};
```

### 2.2 FIESTA LATINA 🎉

```typescript
export const VIBE_FIESTA_LATINA: VibeProfile = {
  id: 'fiesta-latina',
  name: 'Fiesta Latina',
  description: 'Organic warmth. Festive colors. High saturation celebration.',
  icon: '🎉',
  
  mood: {
    allowed: ['festive', 'playful', 'euphoric', 'energetic', 'dramatic'],
    // ❌ PROHIBIDO: 'dark', 'tense', 'calm' (mata la fiesta)
    fallback: 'festive',
    audioInfluence: 0.8,      // Muy reactivo al audio
  },
  
  color: {
    strategies: ['triadic', 'complementary', 'analogous'],
    // Todas permitidas, triadic preferida
    temperature: {
      min: 2500,   // Siempre cálido
      max: 5500,   // Nunca frío
      // ❌ PROHIBIDO: temperaturas >6000K
    },
    saturation: {
      min: 0.65,   // Siempre saturado
      max: 1.0,    // Full color permitido
    },
    maxHueShiftPerSecond: 60,  // Cambios más rápidos OK
    preferredPalettes: ['fiesta', 'tropical', 'sunset'],
  },
  
  drop: {
    sensitivity: 0.8,         // Muy sensible
    energyThreshold: 0.12,    // Trigger fácil
    curves: {
      attack: 'ease-in',      // Build orgánico
      sustain: 'ease-in-out',
      release: 'linear',
    },
    timing: {
      minAttack: 20,          // Drops rápidos OK
      maxSustain: 480,        // 8s máximo
      releaseFrames: 45,      // Release corto
      cooldownFrames: 120,    // 2s entre drops (permite más)
    },
    allowMicroDrops: true,    // Micro-drops para percusión
  },
  
  dimmer: {
    floor: 0.25,              // Nunca oscuro total
    ceiling: 1.0,
    allowBlackout: false,     // ❌ Sin blackout (mata energía)
    transitionSpeed: 'fast',
    breakdownCurve: 'ease-in-out',
  },
  
  movement: {
    allowedPatterns: ['sweep', 'circle', 'figure8', 'chase', 'wave'],
    // Todo permitido excepto static prolongado
    speedRange: { min: 0.4, max: 1.0 },  // Movimientos enérgicos
    allowAggressive: true,
    preferredSync: 'beat',
  },
  
  effects: {
    allowed: ['strobe', 'fog', 'beam'],  // Sin laser (orgánico)
    maxStrobeRate: 8,         // Strobe moderado
    autoFog: false,           // Fog manual
    maxIntensity: 1.0,
  },
  
  meta: {
    baseEnergy: 0.75,
    volatility: 0.6,          // Permite variación alta
    stabilityFirst: false,    // Reactividad > estabilidad
    bpmHint: { min: 85, max: 130 },
  },
};
```

### 2.3 POP ROCK 🎸

```typescript
export const VIBE_POP_ROCK: VibeProfile = {
  id: 'pop-rock',
  name: 'Pop Rock',
  description: 'Balanced dynamics. Vocal-centric. Verse-Chorus awareness.',
  icon: '🎸',
  
  mood: {
    allowed: ['energetic', 'playful', 'dramatic', 'euphoric', 'calm'],
    // Espectro amplio, excepto extremos
    // ❌ PROHIBIDO: 'dark' (demasiado), 'tense' (incómodo)
    fallback: 'energetic',
    audioInfluence: 0.75,
  },
  
  color: {
    strategies: ['analogous', 'complementary', 'triadic'],
    temperature: {
      min: 3500,   // Ligeramente cálido
      max: 7000,   // Hasta neutro-frío
    },
    saturation: {
      min: 0.5,    // Siempre con color
      max: 0.95,
    },
    maxHueShiftPerSecond: 45,
    preferredPalettes: ['rock-stage', 'arena', 'concert'],
  },
  
  drop: {
    sensitivity: 0.5,         // Sensibilidad media
    energyThreshold: 0.20,    // Solo para chorus/climax
    curves: {
      attack: 'ease-in',
      sustain: 'linear',
      release: 'ease-out',
    },
    timing: {
      minAttack: 30,
      maxSustain: 360,        // 6s (duración típica de chorus)
      releaseFrames: 60,
      cooldownFrames: 180,    // 3s
    },
    allowMicroDrops: false,
  },
  
  dimmer: {
    floor: 0.15,
    ceiling: 1.0,
    allowBlackout: true,      // Para drama en baladas
    transitionSpeed: 'medium',
    breakdownCurve: 'ease-in-out',
  },
  
  movement: {
    allowedPatterns: ['sweep', 'static', 'mirror', 'chase'],
    speedRange: { min: 0.3, max: 0.8 },
    allowAggressive: false,   // No agresivo
    preferredSync: 'phrase',  // Sincroniza con frases, no beats
  },
  
  effects: {
    allowed: ['strobe', 'fog', 'beam'],
    maxStrobeRate: 6,         // Strobe suave
    autoFog: true,
    maxIntensity: 0.85,
  },
  
  meta: {
    baseEnergy: 0.6,
    volatility: 0.45,
    stabilityFirst: true,
    bpmHint: { min: 90, max: 140 },
  },
};
```

### 2.4 CHILL LOUNGE 🍸

```typescript
export const VIBE_CHILL_LOUNGE: VibeProfile = {
  id: 'chill-lounge',
  name: 'Chill Lounge',
  description: 'Low energy ambience. Liquid transitions. Comfort first.',
  icon: '🍸',
  
  mood: {
    allowed: ['peaceful', 'calm', 'dreamy', 'playful'],
    // ❌ PROHIBIDO: 'dark', 'dramatic', 'aggressive', 'tense', 'energetic'
    fallback: 'calm',
    audioInfluence: 0.5,      // 50/50 audio y preset
  },
  
  color: {
    strategies: ['analogous', 'monochromatic'],
    // ❌ PROHIBIDO: 'complementary', 'triadic' (demasiado contraste)
    temperature: {
      min: 2800,   // Siempre cálido
      max: 5000,   // Máximo neutro
    },
    saturation: {
      min: 0.2,    // Desaturado OK
      max: 0.7,    // Nunca híper-saturado
    },
    maxHueShiftPerSecond: 15,  // Cambios muy lentos
    preferredPalettes: ['sunset', 'ambient', 'lounge'],
  },
  
  drop: {
    sensitivity: 0.2,         // Muy baja - casi sin drops
    energyThreshold: 0.30,    // Solo para climax reales
    curves: {
      attack: 'ease-in-out',  // Todo suave
      sustain: 'ease-in-out',
      release: 'ease-out',
    },
    timing: {
      minAttack: 90,          // 1.5s mínimo
      maxSustain: 240,        // 4s máximo
      releaseFrames: 180,     // 3s release largo
      cooldownFrames: 600,    // 10s entre drops
    },
    allowMicroDrops: false,
  },
  
  dimmer: {
    floor: 0.30,              // NUNCA oscuro
    ceiling: 0.75,            // Nunca cegador
    allowBlackout: false,     // ❌ PROHIBIDO
    transitionSpeed: 'glacial',  // Transiciones muy lentas
    breakdownCurve: 'ease-in-out',
  },
  
  movement: {
    allowedPatterns: ['static', 'sweep', 'circle'],
    // ❌ PROHIBIDO: 'random', 'chase', 'figure8' (demasiado activo)
    speedRange: { min: 0.05, max: 0.35 },  // Muy lento
    allowAggressive: false,
    preferredSync: 'free',    // No sincronizado estricto
  },
  
  effects: {
    allowed: ['fog'],         // Solo fog ambiental
    // ❌ PROHIBIDO: strobe, laser, blinder
    maxStrobeRate: 0,         // Sin strobe
    autoFog: true,
    maxIntensity: 0.5,
  },
  
  meta: {
    baseEnergy: 0.35,
    volatility: 0.15,         // Muy estable
    stabilityFirst: true,     // Máxima estabilidad
    bpmHint: { min: 70, max: 115 },
  },
};
```

---

## 3. 📊 TABLA COMPARATIVA DE RESTRICCIONES

| Parámetro | TechnoClub 🏭 | FiestaLatina 🎉 | PopRock 🎸 | ChillLounge 🍸 |
|-----------|--------------|-----------------|------------|----------------|
| **Moods Prohibidos** | festive, playful | dark, tense, calm | dark, tense | dark, dramatic, aggressive, tense, energetic |
| **Mood Default** | dark | festive | energetic | calm |
| **Temp. Min (K)** | 4000 | 2500 | 3500 | 2800 |
| **Temp. Max (K)** | 9000 | 5500 | 7000 | 5000 |
| **Sat. Min** | 0.30 | 0.65 | 0.50 | 0.20 |
| **Sat. Max** | 0.85 | 1.00 | 0.95 | 0.70 |
| **Dimmer Floor** | 5% | 25% | 15% | 30% |
| **Blackout OK** | ✅ | ❌ | ✅ | ❌ |
| **Drop Sensitivity** | 0.6 | 0.8 | 0.5 | 0.2 |
| **Cooldown (s)** | 4s | 2s | 3s | 10s |
| **Micro-Drops** | ❌ | ✅ | ❌ | ❌ |
| **Max Strobe (Hz)** | 12 | 8 | 6 | 0 |
| **Movement Speed** | 0.2-0.7 | 0.4-1.0 | 0.3-0.8 | 0.05-0.35 |
| **Volatility** | 0.3 | 0.6 | 0.45 | 0.15 |
| **Stability Priority** | ✅ | ❌ | ✅ | ✅ |

---

**→ CONTINÚA EN PART 2: Arquitectura VibeManager, Integración y Plan de Limpieza**
