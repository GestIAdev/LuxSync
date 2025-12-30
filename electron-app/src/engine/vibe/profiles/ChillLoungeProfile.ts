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

import type { VibeProfile } from '../../../types/VibeProfile'

export const VIBE_CHILL_LOUNGE: VibeProfile = {
  id: 'chill-lounge',
  name: 'Chill Lounge',
  description: 'Warm tones. Slow transitions. Ambient mood.',
  icon: '🍸',

  // ═══════════════════════════════════════════════════════════════
  // MOOD CONSTRAINTS - WAVE 253
  // ═══════════════════════════════════════════════════════════════
  mood: {
    allowed: ['peaceful', 'calm', 'dreamy'],
    fallback: 'calm',
    audioInfluence: 0.4,  // Bajo - más estabilidad
  },

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
    
    // WAVE 253: Cambios muy lentos para chill
    maxHueShiftPerSecond: 30,
    
    // Bloquear azules fríos
    forbiddenHueRanges: [[180, 270]],
    
    // Permitir: naranjas, rojos, ámbar
    allowedHueRanges: [[0, 60], [300, 360]],
  },

  // ═══════════════════════════════════════════════════════════════
  // DROP CONSTRAINTS - WAVE 253
  // ═══════════════════════════════════════════════════════════════
  drop: {
    sensitivity: 0.2,           // Muy baja sensibilidad
    energyThreshold: 0.9,       // Casi imposible de activar
    curves: {
      attack: 'ease-in',
      sustain: 'linear',
      release: 'ease-out',
    },
    timing: {
      minAttack: 120,           // 2s mínimo
      maxSustain: 300,          // 5s máximo
      releaseFrames: 180,       // 3s release suave
      cooldownFrames: 600,      // 10s entre drops
    },
    allowMicroDrops: false,
  },

  dimmer: {
    floor: 0.2,
    ceiling: 0.7,
    allowBlackout: false,
    transitionSpeed: 'glacial',
    breakdownCurve: 'linear',
  },

  movement: {
    allowedPatterns: ['static', 'wave'],
    speedRange: {
      min: 0.0,
      max: 0.3,
    },
    allowAggressive: false,
    preferredSync: 'free',  // Changed from 'none' to valid value
  },

  effects: {
    allowed: [],
    maxStrobeRate: 0,
    maxIntensity: 0.5,
    autoFog: false,
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
