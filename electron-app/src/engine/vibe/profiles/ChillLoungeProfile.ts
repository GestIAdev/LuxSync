/**
 * 🍸 WAVE 220: CHILL LOUNGE PROFILE
 * 
 * Perfil para música relajada: Lounge, Ambient, Jazz.
 * 
 * FILOSOFÍA:
 * - Colores cálidos y suaves
 * - Transiciones lentas y orgánicas
 * - Sin efectos agresivos
 * 
 * @layer ENGINE/VIBE/PROFILES
 * @version TITAN 2.0
 */

import type { VibeProfile } from '../VibeManager'

export const VIBE_CHILL_LOUNGE: VibeProfile = {
  id: 'chill-lounge',
  name: 'Chill Lounge',
  description: 'Warm tones. Slow transitions. Ambient mood.',
  icon: '🍸',

  color: {
    strategies: ['analogous', 'monochromatic'],
    
    temperature: {
      min: 2500,
      max: 4500,
    },
    
    // Temperatura muy cálida: luz de velas
    atmosphericTemp: 2800,
    
    saturation: {
      min: 0.4,
      max: 0.7,
    },
    
    // Bloquear azules fríos
    forbiddenHueRanges: [[180, 270]],
    
    // Permitir: naranjas, rojos, ámbar
    allowedHueRanges: [[0, 60], [300, 360]],
  },

  dimmer: {
    floor: 0.2,
    ceiling: 0.7,
    allowBlackout: false,
    transitionSpeed: 'glacial',
  },

  movement: {
    allowedPatterns: ['static', 'wave'],
    speedRange: {
      min: 0.0,
      max: 0.3,
    },
    allowAggressive: false,
    preferredSync: 'none',
  },

  effects: {
    allowed: [],
    maxStrobeRate: 0,
    maxIntensity: 0.5,
  },

  meta: {
    baseEnergy: 0.3,
    volatility: 0.2,
    stabilityFirst: true,
    bpmHint: {
      min: 60,
      max: 110,
    },
  },
}
