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

import type { VibeProfile } from '../../../types/VibeProfile'

export const VIBE_FIESTA_LATINA: VibeProfile = {
  id: 'fiesta-latina',
  name: 'Fiesta Latina 3D',
  description: 'High contrast. Neon colors. Dynamic movement.',
  icon: '🎉',

  // ═══════════════════════════════════════════════════════════════
  // MOOD CONSTRAINTS - WAVE 253
  // ═══════════════════════════════════════════════════════════════
  mood: {
    allowed: ['festive', 'playful', 'euphoric', 'energetic'],
    fallback: 'festive',
    audioInfluence: 0.85,
  },

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
    
    // WAVE 253: Límite de cambio de hue
    maxHueShiftPerSecond: 120,  // Moderado-alto para fiesta
    
    // Bloquear azul corporativo triste
    forbiddenHueRanges: [[60, 130], [210, 250]],
    
    // Permitir: fuegos, turquesas, magentas
    allowedHueRanges: [[0, 60], [140, 190], [270, 360]],
  },

  // ═══════════════════════════════════════════════════════════════
  // DROP CONSTRAINTS - WAVE 253
  // ═══════════════════════════════════════════════════════════════
  drop: {
    sensitivity: 0.7,
    energyThreshold: 0.8,  // Alto - solo golpes maestros
    curves: {
      attack: 'ease-in',
      sustain: 'linear',
      release: 'ease-out',
    },
    timing: {
      minAttack: 12,
      maxSustain: 180,
      releaseFrames: 45,
      cooldownFrames: 90,
    },
    allowMicroDrops: false,
  },

  dimmer: {
    // Sin floor = máximo delta para efecto 3D
    floor: 0.0,
    ceiling: 1.0,
    allowBlackout: true,
    transitionSpeed: 'fast',
    breakdownCurve: 'ease-in-out',
  },

  movement: {
    // 🔧 WAVE 340.1: ¡LA CUMBIA NUNCA PARA!
    // 'figure8' primero = Lissajous de caderas
    // Velocidad alta = fiesta de verdad
    allowedPatterns: ['figure8', 'circle', 'wave', 'sweep'],
    speedRange: {
      min: 0.5,    // 🔧 Subido de 0.4 → 0.5 (siempre bailando)
      max: 0.85,   // 🔧 Reducido de 1.0 → 0.85 (fluido, no epiléptico)
    },
    allowAggressive: true,
    preferredSync: 'beat',
  },

  effects: {
    allowed: ['fog', 'beam', 'strobe'],
    // WAVE 3300: Strobe liberado para fiesta-latina.
    // El Latino tiene momentos épicos que merecen tormenta real.
    // 25Hz = techo físico del hardware (mismo que techno-club).
    // El StrobeStorm ya implementa su propio chaos engine determinista
    // que modula dentro de este techo según BPM + beatPhase.
    maxStrobeRate: 25,
    maxIntensity: 1.0,
    autoFog: true,
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
