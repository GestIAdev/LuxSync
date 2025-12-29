/**
 * 🎉 WAVE 220: FIESTA LATINA PROFILE
 * 
 * Perfil para música latina: Cumbia, Reggaeton, Salsa.
 * 
 * FILOSOFÍA:
 * - Solar Flare CARO: Solo golpes maestros (bass > 0.80)
 * - Colores neón vibrantes, nunca blanco aburrido
 * - Movimiento constante (la cumbia nunca para)
 * 
 * @layer ENGINE/VIBE/PROFILES
 * @version TITAN 2.0
 */

import type { VibeProfile } from '../VibeManager'

export const VIBE_FIESTA_LATINA: VibeProfile = {
  id: 'fiesta-latina',
  name: 'Fiesta Latina 3D',
  description: 'High contrast. Neon colors. Dynamic movement.',
  icon: '🎉',

  color: {
    // Estrategias de alta energía - sin analogous (muy aburrido)
    strategies: ['triadic', 'split-complementary', 'complementary'],
    
    temperature: {
      min: 2000,
      max: 7500,
    },
    
    // Temperatura atmosférica: Atardecer cálido
    atmosphericTemp: 3200,
    
    saturation: {
      min: 0.85,
      max: 1.0,
    },
    
    // Bloquear azul corporativo triste
    forbiddenHueRanges: [[60, 130], [210, 250]],
    
    // Permitir: fuegos, turquesas, magentas
    allowedHueRanges: [[0, 60], [140, 190], [270, 360]],
  },

  dimmer: {
    // Sin floor = máximo delta para efecto 3D
    floor: 0.0,
    ceiling: 1.0,
    allowBlackout: true,
    transitionSpeed: 'fast',
  },

  movement: {
    allowedPatterns: ['figure8', 'circle', 'wave', 'sweep'],
    speedRange: {
      min: 0.4,
      max: 1.0,
    },
    allowAggressive: true,
    preferredSync: 'beat',
  },

  effects: {
    allowed: ['fog', 'beam'],
    maxStrobeRate: 0,  // Sin strobe para latino
    maxIntensity: 1.0,
  },

  meta: {
    baseEnergy: 0.8,
    volatility: 0.9,  // Máxima volatilidad
    stabilityFirst: false,
    bpmHint: {
      min: 85,
      max: 175,
    },
  },
}
