/**
 * � LUXSYNC CONSTANTS
 * 
 * Core constants for the LuxSync lighting system.
 * Selene AI adapted for DMX control and music synchronization.
 * 
 * Created: November 2025
 * Status: Development
 */

// ═══════════════════════════════════════════════════════════════════════════
// MUSICAL NOTES - The 7 nodes of Selene's lighting consciousness
// ═══════════════════════════════════════════════════════════════════════════

export const MUSICAL_NOTES = {
  DO: { frequency: 261.63, color: '#FF0000', role: 'bass', element: 'fire' },
  RE: { frequency: 293.66, color: '#FF7F00', role: 'rhythm', element: 'fire' },
  MI: { frequency: 329.63, color: '#FFFF00', role: 'melody', element: 'air' },
  FA: { frequency: 349.23, color: '#00FF00', role: 'harmony', element: 'earth' },
  SOL: { frequency: 392.00, color: '#00FFFF', role: 'atmosphere', element: 'water' },
  LA: { frequency: 440.00, color: '#0000FF', role: 'treble', element: 'water' },
  SI: { frequency: 493.88, color: '#FF00FF', role: 'chaos', element: 'air' },
} as const;

export type MusicalNote = keyof typeof MUSICAL_NOTES;

// ═══════════════════════════════════════════════════════════════════════════
// FIXTURE ZONES - Professional disco layout
// ═══════════════════════════════════════════════════════════════════════════

export const ZONE_TYPES = {
  FRONT_PARS: {
    role: 'rhythm',
    frequency: 'bass',
    colors: 'warm',
    description: 'Front audience - responds to kick/bass',
  },
  BACK_PARS: {
    role: 'rhythm',
    frequency: 'bass+mid',
    colors: 'cold',
    description: 'Back stage - responds to snare/claps with delay',
  },
  MOVING_LEFT: {
    role: 'melody',
    frequency: 'mid+treble',
    colors: 'cold-complementary',
    description: 'Left moving heads - follows melody',
  },
  MOVING_RIGHT: {
    role: 'melody',
    frequency: 'mid+treble',
    colors: 'warm-complementary',
    description: 'Right moving heads - mirrors left',
  },
} as const;

export type ZoneType = keyof typeof ZONE_TYPES;

// ═══════════════════════════════════════════════════════════════════════════
// DMX CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

export const DMX = {
  CHANNELS_PER_UNIVERSE: 512,
  MAX_UNIVERSES: 16,
  REFRESH_RATE_HZ: 30,
  FRAME_TIME_MS: 33, // ~30 FPS
  
  // Start code
  START_CODE: 0x00,
  
  // Value ranges
  MIN_VALUE: 0,
  MAX_VALUE: 255,
  CENTER_VALUE: 127,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// AUDIO ANALYSIS CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

export const AUDIO = {
  // Frequency bands (Hz)
  BASS_MIN: 20,
  BASS_MAX: 250,
  MID_MIN: 250,
  MID_MAX: 4000,
  TREBLE_MIN: 4000,
  TREBLE_MAX: 20000,
  
  // FFT settings
  FFT_SIZE: 2048,
  SMOOTHING: 0.8,
  
  // Thresholds (to ignore ambient noise)
  NOISE_THRESHOLD: 0.08,
  PARS_THRESHOLD: 0.22,
  BACK_THRESHOLD: 0.18,
  MELODY_THRESHOLD: 0.12,
  
  // Smoothing factors
  COLOR_SMOOTHING: 0.08,
  POSITION_SMOOTHING: 0.08,
  BEAT_SMOOTHING: 0.3,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// SAFETY LIMITS (Ethics Layer)
// ═══════════════════════════════════════════════════════════════════════════

export const SAFETY = {
  // Epilepsy prevention
  MAX_STROBE_HZ: 15, // Must be < 20 Hz
  
  // Power limits
  MAX_SIMULTANEOUS_STROBES: 4,
  
  // Brightness change limits
  MAX_BRIGHTNESS_CHANGE_PER_FRAME: 50, // Out of 255
  
  // DMX health
  MAX_DMX_ERRORS_BEFORE_RESET: 10,
  DMX_TIMEOUT_MS: 1000,
} as const;

// ═══════════════════════════════════════════════════════════════════════════
// SELENE AI STATES
// ═══════════════════════════════════════════════════════════════════════════

export const CONSCIOUSNESS_STATES = {
  AWAKENING: { minPatterns: 0, description: 'Learning basics' },
  LEARNING: { minPatterns: 100, description: 'Building pattern library' },
  WISE: { minPatterns: 1000, description: 'Reliable predictions' },
  ENLIGHTENED: { minPatterns: 5000, description: 'Advanced anticipation' },
  TRANSCENDENT: { minPatterns: 10000, description: 'Musical mastery' },
} as const;

export type ConsciousnessState = keyof typeof CONSCIOUSNESS_STATES;

// ═══════════════════════════════════════════════════════════════════════════
// ENTROPY MODES (for scene evolution)
// ═══════════════════════════════════════════════════════════════════════════

export const ENTROPY_MODES = {
  DETERMINISTIC: { mutationRate: 0.05, description: 'Stable, predictable' },
  BALANCED: { mutationRate: 0.15, description: 'Normal operation' },
  CHAOTIC: { mutationRate: 0.40, description: 'Drops, buildups, peaks' },
} as const;

export type EntropyMode = keyof typeof ENTROPY_MODES;

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get note info by name
 */
export const getNoteInfo = (note: MusicalNote) => MUSICAL_NOTES[note];

/**
 * Get zone info by type
 */
export const getZoneInfo = (zone: ZoneType) => ZONE_TYPES[zone];

/**
 * Check if a consciousness has reached a certain state
 */
export const hasReachedState = (
  patterns: number, 
  state: ConsciousnessState
): boolean => {
  return patterns >= CONSCIOUSNESS_STATES[state].minPatterns;
};

/**
 * Get current consciousness state based on pattern count
 */
export const getCurrentState = (patterns: number): ConsciousnessState => {
  if (patterns >= CONSCIOUSNESS_STATES.TRANSCENDENT.minPatterns) return 'TRANSCENDENT';
  if (patterns >= CONSCIOUSNESS_STATES.ENLIGHTENED.minPatterns) return 'ENLIGHTENED';
  if (patterns >= CONSCIOUSNESS_STATES.WISE.minPatterns) return 'WISE';
  if (patterns >= CONSCIOUSNESS_STATES.LEARNING.minPatterns) return 'LEARNING';
  return 'AWAKENING';
};

