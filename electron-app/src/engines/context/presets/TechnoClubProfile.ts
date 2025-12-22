/**
 * 🏭 TECHNO CLUB VIBE PROFILE
 * 
 * Industrial precision. Dark atmospheres. Hypnotic repetition.
 * 
 * Características:
 * - Moods oscuros y tensos
 * - Temperaturas frías (4000K-9000K)
 * - Blackout permitido
 * - Drops con alta precisión y cooldown largo
 */

import type { VibeProfile } from '../../../types/VibeProfile';

export const VIBE_TECHNO_CLUB: VibeProfile = {
  // ═══════════════════════════════════════════════════════════════
  // IDENTITY
  // ═══════════════════════════════════════════════════════════════
  id: 'techno-club',
  name: 'Techno Club',
  description: 'Industrial precision. Dark atmospheres. Hypnotic repetition.',
  icon: '🏭',

  // ═══════════════════════════════════════════════════════════════
  // MOOD CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  mood: {
    // ✅ PERMITIDOS: Solo estados oscuros/tensos/neutros
    allowed: ['dark', 'dramatic', 'tense', 'calm', 'energetic'],
    // ❌ PROHIBIDOS implícitos: 'festive', 'playful', 'peaceful', 'euphoric', 'dreamy', 'aggressive'
    fallback: 'dark',
    audioInfluence: 0.7,  // 70% audio, 30% preset bias
  },

  // ═══════════════════════════════════════════════════════════════
  // COLOR CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  color: {
    // ❌ PROHIBIDO: 'triadic' (demasiado festivo para techno)
    strategies: ['monochromatic', 'analogous', 'complementary'],
    temperature: {
      min: 4000,   // Neutro-frío (no cálido)
      max: 9000,   // Muy frío permitido
    },
    saturation: {
      min: 0.3,    // Puede ser desaturado (industrial)
      max: 0.85,   // Nunca híper-saturado
    },
    maxHueShiftPerSecond: 30,  // Cambios lentos y controlados
    preferredPalettes: ['industrial', 'neon-cold', 'monochrome'],
  },

  // ═══════════════════════════════════════════════════════════════
  // DROP CONSTRAINTS
  // 🎛️ WAVE 63: Tuning para reducir "drop constante"
  // - energyThreshold: 0.18 → 0.25 (requiere spike más significativo)
  // - cooldownFrames: 240 → 300 (5s entre drops en lugar de 4s)
  // ═══════════════════════════════════════════════════════════════
  drop: {
    sensitivity: 0.6,         // Sensibilidad media-alta
    energyThreshold: 0.25,    // 🎛️ WAVE 63: Subido de 0.18 → 0.25 (requiere spike real)
    curves: {
      attack: 'exponential',  // Build de tensión
      sustain: 'linear',
      release: 'ease-out',    // Fade gradual
    },
    timing: {
      minAttack: 45,          // 0.75s mínimo de build (precisión)
      maxSustain: 600,        // 10s máximo
      releaseFrames: 90,      // 1.5s release
      cooldownFrames: 300,    // 🎛️ WAVE 63: Subido de 240 → 300 (5s entre drops)
    },
    allowMicroDrops: false,   // ❌ No micro-drops (control total)
  },

  // ═══════════════════════════════════════════════════════════════
  // DIMMER CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  dimmer: {
    floor: 0.05,              // ⚠️ Casi blackout permitido (5%)
    ceiling: 1.0,             // Full power
    allowBlackout: true,      // ✅ Blackout dramático OK
    transitionSpeed: 'medium',
    breakdownCurve: 'ease-out',
  },

  // ═══════════════════════════════════════════════════════════════
  // MOVEMENT CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  movement: {
    // ❌ PROHIBIDO: 'random', 'chase' (demasiado caótico)
    allowedPatterns: ['sweep', 'circle', 'static', 'mirror'],
    speedRange: {
      min: 0.2,
      max: 0.7,  // Movimientos controlados, no frenéticos
    },
    allowAggressive: true,    // Movimientos intensos OK en drops
    preferredSync: 'beat',    // Sincronizado al beat
  },

  // ═══════════════════════════════════════════════════════════════
  // EFFECTS CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  effects: {
    allowed: ['strobe', 'fog', 'beam', 'laser'],  // Industrial FX
    maxStrobeRate: 12,        // Max 12Hz (seguro para epilepsia)
    autoFog: true,            // Fog automático para atmósfera
    maxIntensity: 0.9,
  },

  // ═══════════════════════════════════════════════════════════════
  // META CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  meta: {
    baseEnergy: 0.7,          // Energía alta por defecto
    volatility: 0.3,          // Cambios controlados (estable)
    stabilityFirst: true,     // ✅ Priorizar coherencia visual
    bpmHint: {
      min: 120,
      max: 150,               // Rango típico techno
    },
  },
};
