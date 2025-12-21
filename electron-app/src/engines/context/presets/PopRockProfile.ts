/**
 * 🎸 POP ROCK VIBE PROFILE
 * 
 * Balanced dynamics. Vocal-centric. Verse-Chorus awareness.
 * 
 * Características:
 * - Espectro amplio de moods (excepto extremos)
 * - Temperaturas balanceadas (3500K-7000K)
 * - Blackout permitido para drama en baladas
 * - Sincronización por frase, no por beat
 */

import type { VibeProfile } from '../../../types/VibeProfile';

export const VIBE_POP_ROCK: VibeProfile = {
  // ═══════════════════════════════════════════════════════════════
  // IDENTITY
  // ═══════════════════════════════════════════════════════════════
  id: 'pop-rock',
  name: 'Pop Rock',
  description: 'Balanced dynamics. Vocal-centric. Verse-Chorus awareness.',
  icon: '🎸',

  // ═══════════════════════════════════════════════════════════════
  // MOOD CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  mood: {
    // Espectro amplio, excepto extremos
    allowed: ['energetic', 'playful', 'dramatic', 'euphoric', 'calm'],
    // ❌ PROHIBIDOS implícitos: 'dark' (demasiado), 'tense' (incómodo), 'aggressive'
    fallback: 'energetic',
    audioInfluence: 0.75,
  },

  // ═══════════════════════════════════════════════════════════════
  // COLOR CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  color: {
    // Todas las estrategias disponibles
    strategies: ['analogous', 'complementary', 'triadic'],
    temperature: {
      min: 3500,   // Ligeramente cálido
      max: 7000,   // Hasta neutro-frío
    },
    saturation: {
      min: 0.5,    // Siempre con color visible
      max: 0.95,
    },
    maxHueShiftPerSecond: 45,
    preferredPalettes: ['rock-stage', 'arena', 'concert'],
  },

  // ═══════════════════════════════════════════════════════════════
  // DROP CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  drop: {
    sensitivity: 0.5,         // Sensibilidad media
    energyThreshold: 0.20,    // Solo para chorus/climax
    curves: {
      attack: 'ease-in',
      sustain: 'linear',
      release: 'ease-out',
    },
    timing: {
      minAttack: 30,
      maxSustain: 360,        // 6s (duración típica de chorus)
      releaseFrames: 60,
      cooldownFrames: 180,    // 3s
    },
    allowMicroDrops: false,
  },

  // ═══════════════════════════════════════════════════════════════
  // DIMMER CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  dimmer: {
    floor: 0.15,              // 15% mínimo
    ceiling: 1.0,
    allowBlackout: true,      // ✅ Para drama en baladas/bridge
    transitionSpeed: 'medium',
    breakdownCurve: 'ease-in-out',
  },

  // ═══════════════════════════════════════════════════════════════
  // MOVEMENT CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  movement: {
    allowedPatterns: ['sweep', 'static', 'mirror', 'chase'],
    speedRange: {
      min: 0.3,
      max: 0.8,
    },
    allowAggressive: false,   // ❌ No agresivo (mainstream friendly)
    preferredSync: 'phrase',  // ⚠️ Sincroniza con frases, no beats
  },

  // ═══════════════════════════════════════════════════════════════
  // EFFECTS CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  effects: {
    allowed: ['strobe', 'fog', 'beam'],
    maxStrobeRate: 6,         // Strobe suave
    autoFog: true,
    maxIntensity: 0.85,
  },

  // ═══════════════════════════════════════════════════════════════
  // META CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  meta: {
    baseEnergy: 0.6,          // Energía media
    volatility: 0.45,         // Variación moderada
    stabilityFirst: true,     // Coherencia visual
    bpmHint: {
      min: 90,
      max: 140,
    },
  },
};
