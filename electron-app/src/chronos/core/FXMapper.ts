/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎯 FX MAPPER - WAVE 2019: THE PULSE
 * 
 * Maps Chronos FX types (timeline clips) to BaseEffect IDs (backend).
 * 
 * Chronos uses simplified FX names for the timeline.
 * The backend uses specific BaseEffect IDs from the effect library.
 * This module translates between them.
 * 
 * AXIOMA ANTI-SIMULACIÓN:
 * Real effects, real mappings. No random selection, no simulation.
 * 
 * @module chronos/core/FXMapper
 * @version WAVE 2019
 */

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
 * @param fxType - The FX type from the timeline clip
 * @param vibeId - Optional current vibe for vibe-specific variants
 * @returns BaseEffect ID to trigger
 */
export function mapChronosFXToBaseEffect(
  fxType: string, 
  vibeId?: string
): string {
  // Check for vibe-specific variant first
  if (vibeId && VIBE_SPECIFIC_FX[vibeId]?.[fxType]) {
    return VIBE_SPECIFIC_FX[vibeId][fxType]
  }
  
  // Use default mapping
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
 * 🔍 Check if an FX type is valid
 */
export function isValidFXType(fxType: string): boolean {
  return fxType in FX_MAP
}

/**
 * 📊 Get effect info for logging
 */
export function getFXInfo(fxType: string, vibeId?: string): {
  chronosType: string
  backendId: string
  vibeSpecific: boolean
} {
  const vibeSpecific = !!(vibeId && VIBE_SPECIFIC_FX[vibeId]?.[fxType])
  const backendId = mapChronosFXToBaseEffect(fxType, vibeId)
  
  return {
    chronosType: fxType,
    backendId,
    vibeSpecific,
  }
}

export default mapChronosFXToBaseEffect
