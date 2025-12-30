/**
 * 👻 IDLE VIBE PROFILE - WAVE 64
 * 
 * Estado neutro de espera. Selene está activa pero aguarda órdenes.
 * OSCURIDAD TOTAL - Sin output hasta que el usuario seleccione un Vibe.
 * 
 * Características:
 * - Dimmer al 0% (blackout completo)
 * - Sin movimiento (static)
 * - Sin color (desaturado)
 * - Energía cero
 * 
 * Este perfil es INVISIBLE en la UI - representa "esperando input".
 */

import type { VibeProfile } from '../../../types/VibeProfile';

export const VIBE_IDLE: VibeProfile = {
  // ═══════════════════════════════════════════════════════════════
  // IDENTITY
  // ═══════════════════════════════════════════════════════════════
  id: 'idle',
  name: 'Idle',
  description: 'Standby mode. Waiting for user input.',
  icon: '👻',

  // ═══════════════════════════════════════════════════════════════
  // MOOD CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  mood: {
    allowed: ['calm'],
    fallback: 'calm',
    audioInfluence: 0,  // 0% - ignora audio completamente
  },

  // ═══════════════════════════════════════════════════════════════
  // COLOR CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  color: {
    strategies: ['monochromatic'],
    temperature: {
      min: 5000,
      max: 5000,   // Neutro
    },
    // 🌡️ WAVE 149.6: THERMAL GRAVITY - Sin Gravedad
    // 6500K = Fuerza 0 (zona neutra 5000-7000K)
    // Los hues no se modifican, fluyen según la música pura
    atmosphericTemp: 6500,
    saturation: {
      min: 0,      // Sin saturación
      max: 0,      // Sin saturación
    },
    maxHueShiftPerSecond: 0,  // Sin cambios
    preferredPalettes: [],
  },

  // ═══════════════════════════════════════════════════════════════
  // DROP CONSTRAINTS
  // ═══════════════════════════════════════════════════════════════
  drop: {
    sensitivity: 0,           // Ignora drops
    energyThreshold: 1.0,     // Imposible de activar
    curves: {
      attack: 'linear',
      sustain: 'linear',
      release: 'linear',
    },
    timing: {
      minAttack: 9999,
      maxSustain: 0,
      releaseFrames: 0,
      cooldownFrames: 9999,
    },
    allowMicroDrops: false,
  },

  // ═══════════════════════════════════════════════════════════════
  // DIMMER CONSTRAINTS - OSCURIDAD TOTAL
  // ═══════════════════════════════════════════════════════════════
  dimmer: {
    floor: 0.0,               // 🔴 BLACKOUT
    ceiling: 0.0,             // 🔴 BLACKOUT
    allowBlackout: true,
    transitionSpeed: 'fast',
    breakdownCurve: 'linear',
  },

  // ═══════════════════════════════════════════════════════════════
  // MOVEMENT CONSTRAINTS - SIN MOVIMIENTO
  // ═══════════════════════════════════════════════════════════════
  movement: {
    allowedPatterns: ['static'],  // Solo estático
    speedRange: {
      min: 0,
      max: 0,
    },
    allowAggressive: false,
    preferredSync: 'free',    // Sin sincronización (pero 'free' es válido)
  },

  // ═══════════════════════════════════════════════════════════════
  // EFFECTS CONSTRAINTS - SIN EFECTOS
  // ═══════════════════════════════════════════════════════════════
  effects: {
    allowed: [],              // Sin efectos
    maxStrobeRate: 0,
    autoFog: false,
    maxIntensity: 0,
  },

  // ═══════════════════════════════════════════════════════════════
  // META CONSTRAINTS - CERO ENERGÍA
  // ═══════════════════════════════════════════════════════════════
  meta: {
    baseEnergy: 0,            // Sin energía
    volatility: 0,            // Sin cambios
    stabilityFirst: true,
    bpmHint: {
      min: 0,
      max: 300,               // Acepta cualquier BPM (pero no reacciona)
    },
  },
};
