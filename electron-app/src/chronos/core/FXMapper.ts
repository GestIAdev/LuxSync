/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 FX MAPPER - WAVE 2019: THE PULSE
 * 
 * Maps Chronos FX types (timeline clips) to BaseEffect IDs (backend).
 * 
 * TWO MODES:
 * 1. Timeline FX types (strobe, flash, drop) → mapped to BaseEffect IDs
 * 2. Direct BaseEffect IDs (salsa_fire, strobe_burst) → passthrough
 * 
 * AXIOMA ANTI-SIMULACIÓN:
 * Real effects, real mappings. No random selection, no simulation.
 * 
 * @module chronos/core/FXMapper
 * @version WAVE 2019.2
 */

// ═══════════════════════════════════════════════════════════════════════════
// KNOWN BASEEFFECT IDS (passthrough list)
// These are valid BaseEffect IDs that should pass through without mapping
// ═══════════════════════════════════════════════════════════════════════════

const KNOWN_BASEEFFECT_IDS = new Set([
  // Fiesta Latina
  'solar_flare', 'tropical_pulse', 'salsa_fire', 'cumbia_moon', 'clave_rhythm',
  'corazon_latino', 'amazon_mist', 'machete_spark', 'pachanga_flash',
  // Techno
  'strobe_burst', 'acid_sweep', 'industrial_strobe', 'cyber_dualism',
  'circuit_overload', 'bass_cannon', 'strobe_storm', 'gatling_raid', 'sky_saw',
  // Pop-Rock
  'arena_sweep', 'thunder_struck', 'power_chord', 'anthem_rise', 'spotlight_solo',
  'crowd_wave', 'stadium_pulse',
  // Chill-Lounge
  'void_mist', 'deep_breath', 'sonar_ping', 'abyssal_rise', 'tidal_wave',
  'aurora_drift', 'lotus_bloom', 'fiber_optics',
  // Universal
  'core_meltdown', 'prism_split', 'horizon_fade', 'phoenix_rebirth', 'quantum_shift',
])

// ═══════════════════════════════════════════════════════════════════════════
// EFFECT MAPPINGS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Map from Chronos FX type to BaseEffect ID
 * 
 * Keys: FX types as defined in TimelineClip.ts
 * Values: BaseEffect IDs as registered in EffectManager
 */
const FX_MAP: Record<string, string> = {
  // Basic flash effects
  'strobe': 'strobe_burst',
  'flash': 'solar_flare',
  'color-flash': 'strobe_storm',
  
  // Energy/Drop effects
  'drop': 'core_meltdown',
  'build': 'abyssal_rise',
  'intensity-pulse': 'deep_breath',
  
  // Movement/Sweep effects
  'sweep': 'arena_sweep',
  'wave': 'tidal_wave',
  
  // Atmospheric effects
  'ambient': 'void_mist',
  'laser': 'fiber_optics',
  
  // Vibe-specific (these get adjusted based on current vibe)
  'techno-strobe': 'industrial_strobe',
  'latin-fire': 'salsa_fire',
  'rock-thunder': 'thunder_struck',
  'chill-glow': 'sonar_ping',
  
  // Custom placeholder (future editor)
  'custom': 'solar_flare',  // Fallback
}

/**
 * Alternative effect mappings per vibe
 * Some effects have vibe-specific variants for better aesthetic matching
 */
const VIBE_SPECIFIC_FX: Record<string, Record<string, string>> = {
  'techno-club': {
    'strobe': 'industrial_strobe',
    'flash': 'gatling_raid',
    'sweep': 'acid_sweep',
  },
  'fiesta-latina': {
    'strobe': 'strobe_storm',
    'flash': 'salsa_fire',
    'sweep': 'tropical_pulse',
  },
  'pop-rock': {
    'strobe': 'strobe_burst',
    'flash': 'thunder_struck',
    'sweep': 'arena_sweep',
  },
  'chill-lounge': {
    'strobe': 'ambient_strobe',
    'flash': 'deep_breath',
    'sweep': 'void_mist',
  },
  'industrial': {
    'strobe': 'industrial_strobe',
    'flash': 'core_meltdown',
    'sweep': 'sky_saw',
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// PUBLIC API
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🎯 Map Chronos FX type to BaseEffect ID
 * 
 * Handles two cases:
 * 1. If fxType is already a valid BaseEffect ID → return as-is (passthrough)
 * 2. If fxType is a timeline type (strobe, flash) → map to BaseEffect ID
 * 
 * @param fxType - The FX type from the timeline clip (can be timeline type OR baseEffect ID)
 * @param vibeId - Optional current vibe for vibe-specific variants
 * @returns BaseEffect ID to trigger
 */
export function mapChronosFXToBaseEffect(
  fxType: string, 
  vibeId?: string
): string {
  // 🎯 PASSTHROUGH: If it's already a known BaseEffect ID, return as-is
  if (KNOWN_BASEEFFECT_IDS.has(fxType)) {
    return fxType
  }
  
  // Check for vibe-specific variant of timeline type
  if (vibeId && VIBE_SPECIFIC_FX[vibeId]?.[fxType]) {
    return VIBE_SPECIFIC_FX[vibeId][fxType]
  }
  
  // Use default mapping for timeline types
  const mapped = FX_MAP[fxType]
  
  if (!mapped) {
    console.warn(`[FXMapper] ⚠️ Unknown FX type: ${fxType}, using fallback`)
    return 'solar_flare'  // Safe fallback - always exists
  }
  
  return mapped
}

/**
 * 📋 Get all available FX types for the UI
 * Returns human-readable names with their internal IDs
 */
export function getAvailableFXTypes(): Array<{ id: string; label: string; icon: string }> {
  return [
    { id: 'strobe', label: 'Strobe', icon: '⚡' },
    { id: 'flash', label: 'Flash', icon: '💥' },
    { id: 'drop', label: 'Drop', icon: '🔥' },
    { id: 'sweep', label: 'Sweep', icon: '🌊' },
    { id: 'wave', label: 'Wave', icon: '〰️' },
    { id: 'build', label: 'Build', icon: '📈' },
    { id: 'intensity-pulse', label: 'Pulse', icon: '💓' },
    { id: 'ambient', label: 'Ambient', icon: '🌙' },
    { id: 'color-flash', label: 'Color Flash', icon: '🎨' },
    { id: 'laser', label: 'Laser', icon: '🔴' },
  ]
}

/**
 * 🔍 Check if an FX type is valid (either timeline type or BaseEffect ID)
 */
export function isValidFXType(fxType: string): boolean {
  return fxType in FX_MAP || KNOWN_BASEEFFECT_IDS.has(fxType)
}

/**
 * 📊 Get effect info for logging
 */
export function getFXInfo(fxType: string, vibeId?: string): {
  chronosType: string
  backendId: string
  vibeSpecific: boolean
  isPassthrough: boolean
} {
  const isPassthrough = KNOWN_BASEEFFECT_IDS.has(fxType)
  const vibeSpecific = !isPassthrough && !!(vibeId && VIBE_SPECIFIC_FX[vibeId]?.[fxType])
  const backendId = mapChronosFXToBaseEffect(fxType, vibeId)
  
  return {
    chronosType: fxType,
    backendId,
    vibeSpecific,
    isPassthrough,
  }
}

export default mapChronosFXToBaseEffect
