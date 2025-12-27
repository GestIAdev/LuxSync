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
    // 🔥 WAVE 74: Eliminado 'dramatic' - era Caballo de Troya que permitía DARK
    allowed: ['festive', 'playful', 'euphoric', 'energetic'],
    // ❌ PROHIBIDOS implícitos: 'dark', 'tense', 'calm', 'peaceful', 'dreamy', 'aggressive', 'dramatic'
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
      min: 2000,   // 🔥 WAVE 67: Más cálido (era 2500K)
      max: 4500,   // 🔥 WAVE 67: NUNCA frío - clamp a 4500K (era 5500K)
    },
    // 🌡️ WAVE 149.6: THERMAL GRAVITY - Polo Oro Máximo
    // 3000K = Fuerza 0.7 hacia 40° (Oro/Fuego)
    // Los hues fríos serán arrastrados hacia el espectro solar
    atmosphericTemp: 3000,
    saturation: {
      min: 0.80,   // 🔥 WAVE 66.5: Aumentado a 80% (era 65%) - Evita lavado a blanco en drops
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
    ceiling: 0.90,            // 🔥 WAVE 66.5: Máximo 90% (era 100%) - Drops son abrazos, no flashbangs
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
    // 🔥 WAVE 66.5: Sin strobe - el latino es calor, no epilepsia
    allowed: ['fog', 'beam'],  // ❌ STROBE ELIMINADO de allowed
    maxStrobeRate: 0,          // 🔥 WAVE 66.5: 0Hz = STROBE PROHIBIDO (era 8Hz)
    autoFog: false,            // Fog manual (no siempre apropiado)
    maxIntensity: 0.9,         // 🔥 WAVE 66.5: Tope 90% (era 100%)
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
