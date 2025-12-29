/**
 * 🎛️ WAVE 220: TECHNO CLUB PROFILE
 * 
 * Perfil para música electrónica: Techno, House, Trance.
 * 
 * FILOSOFÍA:
 * - Colores fríos dominantes (azules, cyans, blancos)
 * - Strobe permitido en peaks
 * - Movimiento preciso y mecánico
 * 
 * @layer ENGINE/VIBE/PROFILES
 * @version TITAN 2.0
 */

import type { VibeProfile } from '../VibeManager'

export const VIBE_TECHNO_CLUB: VibeProfile = {
  id: 'techno-club',
  name: 'Techno Club',
  description: 'Cold tones. Precise movement. Strobe-ready.',
  icon: '🎛️',

  color: {
    strategies: ['complementary', 'monochromatic', 'split-complementary'],
    
    temperature: {
      min: 6000,
      max: 10000,
    },
    
    // Temperatura fría: azul hielo
    atmosphericTemp: 8000,
    
    saturation: {
      min: 0.7,
      max: 1.0,
    },
    
    // Bloquear tonos cálidos tropicales
    forbiddenHueRanges: [[20, 60]],
    
    // Permitir: azules, magentas, cyans
    allowedHueRanges: [[180, 300], [0, 20]],
  },

  dimmer: {
    floor: 0.05,
    ceiling: 1.0,
    allowBlackout: true,
    transitionSpeed: 'instant',
  },

  movement: {
    allowedPatterns: ['sweep', 'chase', 'static', 'mirror'],
    speedRange: {
      min: 0.6,
      max: 1.0,
    },
    allowAggressive: true,
    preferredSync: 'beat',
  },

  effects: {
    allowed: ['strobe', 'beam', 'laser'],
    maxStrobeRate: 15,  // 15 Hz máximo
    maxIntensity: 1.0,
  },

  meta: {
    baseEnergy: 0.7,
    volatility: 0.7,
    stabilityFirst: false,
    bpmHint: {
      min: 120,
      max: 150,
    },
  },
}
