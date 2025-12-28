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
    
    // 🛡️ WAVE 155: NARANJA DE SEGURIDAD PROHIBIDO + Azul Rey/Índigo
    // El naranja puro (25-45°) es aburrido y corporativo
    // La Gravedad Térmica arrastrará hacia Rojo (0-20°) o Oro (50-60°)
    // Y la física Cumbia inyectará Magenta y Cian
    forbiddenHueRanges: [[25, 45], [230, 260]],
    allowedHueRanges: [[0, 24], [46, 229], [261, 360]],
    
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
    sensitivity: 0.55,        // 🔧 WAVE 152.5: Bajado de 0.8 - evita "Drop Eterno" en cumbia
    energyThreshold: 0.25,    // 🔧 WAVE 152.5: Subido de 0.12 - requiere energía real, no güiro
    curves: {
      attack: 'ease-in',      // Build orgánico
      sustain: 'ease-in-out',
      release: 'linear',
    },
    timing: {
      minAttack: 20,          // Drops rápidos OK
      maxSustain: 240,        // 🔧 WAVE 152.5: Bajado de 480 a 4s - drops más cortos
      releaseFrames: 30,      // 🔧 WAVE 152.5: Release más corto
      cooldownFrames: 180,    // 🔧 WAVE 152.5: 3s entre drops (más selectivo)
    },
    allowMicroDrops: true,    // ✅ Micro-drops para timbales/congas
  },

  // ═══════════════════════════════════════════════════════════════
  // DIMMER CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  dimmer: {
    floor: 0.10,              // 🔫 WAVE 152: 10% mínimo para dinámica (permite metralleta)
    ceiling: 0.90,            // 🔥 WAVE 66.5: Máximo 90% (era 100%) - Drops son abrazos, no flashbangs
    allowBlackout: true,      // ✅ WAVE 152: PERMITIDO (esencial para efecto metralleta)
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
    stopOnDrop: false,        // 🔧 WAVE 152.5: NUNCA parar en drop - movimiento continuo
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
