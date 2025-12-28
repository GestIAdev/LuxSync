/**
 * FIESTA LATINA VIBE PROFILE
 * 
 * WAVE 158: ECOLOGICAL FIX - La Via Natural
 * "Cambiemos las reglas del juego, no el marcador"
 * 
 * Filosofia: Cambiar el ECOSISTEMA para que los colores nazcan naturalmente.
 * NO forzamos colores - dejamos que el algoritmo Triadic/Complementary 
 * elija libremente sin gravedad termica que lo tire hacia el naranja.
 * 
 * Caracteristicas:
 * - Moods festivos y alegres
 * - atmosphericTemp = 5000K (neutro, sin gravedad de color)
 * - Blackout PROHIBIDO en normal (excepto Machine Gun)
 * - drop.sensitivity = 0.20 (Selene menos asustadiza)
 * - dimmer.floor = 0.40 (beams siempre visibles)
 * - Sin forbiddenHueRanges (libre eleccion de color)
 */

import type { VibeProfile } from '../../../types/VibeProfile';

export const VIBE_FIESTA_LATINA: VibeProfile = {
  id: 'fiesta-latina',
  name: 'Fiesta Latina',
  description: 'Organic warmth. Festive colors. High saturation celebration.',
  icon: '',

  mood: {
    allowed: ['festive', 'playful', 'euphoric', 'energetic'],
    fallback: 'festive',
    audioInfluence: 0.8,
  },

  color: {
    strategies: ['triadic', 'complementary', 'analogous'],
    temperature: {
      min: 2000,
      max: 4500,
    },
    // WAVE 158: ECOLOGICAL FIX - Clima Neutro/Solar
    // 5000K = Luz Neutra - Gravedad CERO hacia ningun color
    atmosphericTemp: 5000,
    
    saturation: {
      min: 0.80,
      max: 1.0,
    },
    maxHueShiftPerSecond: 60,
    preferredPalettes: ['fiesta', 'tropical', 'sunset'],
  },

  drop: {
    // WAVE 158: ECOLOGICAL FIX - Selene menos asustadiza
    sensitivity: 0.20,
    energyThreshold: 0.45,
    curves: {
      attack: 'ease-in',
      sustain: 'ease-in-out',
      release: 'linear',
    },
    timing: {
      minAttack: 20,
      maxSustain: 120,
      releaseFrames: 15,
      cooldownFrames: 360,
    },
    allowMicroDrops: true,
  },

  dimmer: {
    // WAVE 158: ECOLOGICAL FIX - Beams siempre visibles
    floor: 0.40,
    ceiling: 0.90,
    allowBlackout: true,
    transitionSpeed: 'fast',
    breakdownCurve: 'ease-in-out',
  },

  movement: {
    allowedPatterns: ['sweep', 'circle', 'figure8', 'chase', 'wave'],
    speedRange: {
      min: 0.4,
      max: 1.0,
    },
    allowAggressive: true,
    preferredSync: 'beat',
    stopOnDrop: false,
  },

  effects: {
    allowed: ['fog', 'beam'],
    maxStrobeRate: 0,
    autoFog: false,
    maxIntensity: 0.9,
  },

  meta: {
    baseEnergy: 0.75,
    volatility: 0.6,
    stabilityFirst: false,
    bpmHint: {
      min: 85,
      max: 175,
    },
  },
};
