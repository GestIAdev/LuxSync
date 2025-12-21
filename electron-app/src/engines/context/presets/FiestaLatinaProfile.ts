/**
 * 🎉 FIESTA LATINA VIBE PROFILE
 * 
 * Organic warmth. Festive colors. High saturation celebration.
 * 
 * Características:
 * - Moods festivos y alegres
 * - Temperaturas siempre cálidas (2500K-5500K)
 * - ❌ Blackout PROHIBIDO (mata la energía)
 * - Micro-drops permitidos para percusión
 * - Dimmer floor alto (25%)
 */

import type { VibeProfile } from '../../../types/VibeProfile';

export const VIBE_FIESTA_LATINA: VibeProfile = {
  // ═══════════════════════════════════════════════════════════════
  // IDENTITY
  // ═══════════════════════════════════════════════════════════════
  id: 'fiesta-latina',
  name: 'Fiesta Latina',
  description: 'Organic warmth. Festive colors. High saturation celebration.',
  icon: '🎉',

  // ═══════════════════════════════════════════════════════════════
  // MOOD CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  mood: {
    // ✅ PERMITIDOS: Solo estados festivos/alegres
    allowed: ['festive', 'playful', 'euphoric', 'energetic', 'dramatic'],
    // ❌ PROHIBIDOS implícitos: 'dark', 'tense', 'calm', 'peaceful', 'dreamy', 'aggressive'
    fallback: 'festive',
    audioInfluence: 0.8,      // Muy reactivo al audio
  },

  // ═══════════════════════════════════════════════════════════════
  // COLOR CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  color: {
    // Todas las estrategias coloridas permitidas, triadic preferida
    strategies: ['triadic', 'complementary', 'analogous'],
    temperature: {
      min: 2500,   // ⚠️ Siempre cálido
      max: 5500,   // ⚠️ NUNCA frío (max 5500K)
    },
    saturation: {
      min: 0.65,   // ⚠️ Siempre saturado
      max: 1.0,    // Full color permitido
    },
    maxHueShiftPerSecond: 60,  // Cambios más rápidos OK
    preferredPalettes: ['fiesta', 'tropical', 'sunset'],
  },

  // ═══════════════════════════════════════════════════════════════
  // DROP CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  drop: {
    sensitivity: 0.8,         // Muy sensible
    energyThreshold: 0.12,    // Trigger fácil (percusión latina)
    curves: {
      attack: 'ease-in',      // Build orgánico
      sustain: 'ease-in-out',
      release: 'linear',
    },
    timing: {
      minAttack: 20,          // Drops rápidos OK
      maxSustain: 480,        // 8s máximo
      releaseFrames: 45,      // Release corto
      cooldownFrames: 120,    // 2s entre drops (permite más drops)
    },
    allowMicroDrops: true,    // ✅ Micro-drops para timbales/congas
  },

  // ═══════════════════════════════════════════════════════════════
  // DIMMER CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  dimmer: {
    floor: 0.25,              // ⚠️ NUNCA oscuro total (25% mínimo)
    ceiling: 1.0,
    allowBlackout: false,     // ❌ PROHIBIDO (mata la energía de fiesta)
    transitionSpeed: 'fast',  // Transiciones rápidas
    breakdownCurve: 'ease-in-out',
  },

  // ═══════════════════════════════════════════════════════════════
  // MOVEMENT CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  movement: {
    // Todo permitido excepto static prolongado
    allowedPatterns: ['sweep', 'circle', 'figure8', 'chase', 'wave'],
    speedRange: {
      min: 0.4,   // Siempre en movimiento
      max: 1.0,   // Full speed permitido
    },
    allowAggressive: true,
    preferredSync: 'beat',    // Sincronizado al ritmo
  },

  // ═══════════════════════════════════════════════════════════════
  // EFFECTS CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  effects: {
    // Sin laser (mantener orgánico)
    allowed: ['strobe', 'fog', 'beam'],
    maxStrobeRate: 8,         // Strobe moderado
    autoFog: false,           // Fog manual (no siempre apropiado)
    maxIntensity: 1.0,
  },

  // ═══════════════════════════════════════════════════════════════
  // META CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  meta: {
    baseEnergy: 0.75,
    volatility: 0.6,          // ⚠️ Permite variación alta (música dinámica)
    stabilityFirst: false,    // Reactividad > estabilidad
    bpmHint: {
      min: 85,
      max: 130,               // Rango salsa/reggaeton/cumbia
    },
  },
};
