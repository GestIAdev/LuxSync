/**
 * 🍸 CHILL LOUNGE VIBE PROFILE
 * 
 * Low energy ambience. Liquid transitions. Comfort first.
 * 
 * Características:
 * - Solo moods tranquilos/relajados
 * - Temperaturas siempre cálidas (2800K-5000K)
 * - ❌ Blackout PROHIBIDO
 * - ⚠️ Dimmer floor 30% (nunca oscuro)
 * - Sin strobe (0 Hz)
 * - Transiciones muy lentas (glacial)
 */

import type { VibeProfile } from '../../../types/VibeProfile';

export const VIBE_CHILL_LOUNGE: VibeProfile = {
  // ═══════════════════════════════════════════════════════════════
  // IDENTITY
  // ═══════════════════════════════════════════════════════════════
  id: 'chill-lounge',
  name: 'Chill Lounge',
  description: 'Low energy ambience. Liquid transitions. Comfort first.',
  icon: '🍸',

  // ═══════════════════════════════════════════════════════════════
  // MOOD CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  mood: {
    // ✅ PERMITIDOS: Solo estados relajados
    allowed: ['peaceful', 'calm', 'dreamy', 'playful'],
    // ❌ PROHIBIDOS implícitos: 'dark', 'dramatic', 'aggressive', 'tense', 'energetic', 'festive', 'euphoric'
    fallback: 'calm',
    audioInfluence: 0.5,      // 50/50 audio y preset
  },

  // ═══════════════════════════════════════════════════════════════
  // COLOR CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  color: {
    // ❌ PROHIBIDO: 'complementary', 'triadic' (demasiado contraste)
    strategies: ['analogous', 'monochromatic'],
    temperature: {
      min: 2800,   // Siempre cálido
      max: 5000,   // Máximo neutro (nunca frío)
    },
    saturation: {
      min: 0.2,    // Desaturado OK (ambiente)
      max: 0.7,    // ⚠️ Nunca híper-saturado
    },
    maxHueShiftPerSecond: 15,  // ⚠️ Cambios MUY lentos
    preferredPalettes: ['sunset', 'ambient', 'lounge'],
  },

  // ═══════════════════════════════════════════════════════════════
  // DROP CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  drop: {
    sensitivity: 0.2,         // ⚠️ Muy baja - casi sin drops
    energyThreshold: 0.30,    // Solo para climax reales
    curves: {
      attack: 'ease-in-out',  // Todo suave
      sustain: 'ease-in-out',
      release: 'ease-out',
    },
    timing: {
      minAttack: 90,          // 1.5s mínimo (lento)
      maxSustain: 240,        // 4s máximo
      releaseFrames: 180,     // 3s release largo
      cooldownFrames: 600,    // ⚠️ 10s entre drops
    },
    allowMicroDrops: false,
  },

  // ═══════════════════════════════════════════════════════════════
  // DIMMER CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  dimmer: {
    floor: 0.30,              // ⚠️⚠️⚠️ CRÍTICO: NUNCA bajo 30%
    ceiling: 0.75,            // ⚠️ Nunca cegador
    allowBlackout: false,     // ❌ PROHIBIDO
    transitionSpeed: 'glacial', // Transiciones muy lentas
    breakdownCurve: 'ease-in-out',
  },

  // ═══════════════════════════════════════════════════════════════
  // MOVEMENT CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  movement: {
    // ❌ PROHIBIDO: 'random', 'chase', 'figure8' (demasiado activo)
    allowedPatterns: ['static', 'sweep', 'circle'],
    speedRange: {
      min: 0.05,   // Casi estático
      max: 0.35,   // ⚠️ Muy lento siempre
    },
    allowAggressive: false,
    preferredSync: 'free',    // No sincronizado estricto
  },

  // ═══════════════════════════════════════════════════════════════
  // EFFECTS CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  effects: {
    // ❌ PROHIBIDO: strobe, laser, blinder
    allowed: ['fog'],         // Solo fog ambiental
    maxStrobeRate: 0,         // ⚠️⚠️⚠️ SIN STROBE
    autoFog: true,
    maxIntensity: 0.5,        // Efectos suaves
  },

  // ═══════════════════════════════════════════════════════════════
  // META CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  meta: {
    baseEnergy: 0.35,         // Energía baja
    volatility: 0.15,         // ⚠️ Muy estable
    stabilityFirst: true,     // Máxima estabilidad
    bpmHint: {
      min: 70,
      max: 115,               // Downtempo/chillout
    },
  },
};
