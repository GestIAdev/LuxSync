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
 * @version WAVE 2019.3
 */

import { getEffectCategories } from './EffectRegistry'

// ═══════════════════════════════════════════════════════════════════════════
// KNOWN BASEEFFECT IDS - Dynamically generated from EffectRegistry
// ═══════════════════════════════════════════════════════════════════════════

// Build the set lazily on first access
let _knownBaseEffectIds: Set<string> | null = null

function getKnownBaseEffectIds(): Set<string> {
  if (!_knownBaseEffectIds) {
    _knownBaseEffectIds = new Set<string>()
    try {
      const registry = getEffectCategories()
      for (const category of registry) {
        for (const effect of category.effects) {
          _knownBaseEffectIds.add(effect.id)
        }
      }
      console.log(`[FXMapper] 📋 Loaded ${_knownBaseEffectIds.size} known BaseEffect IDs from registry`)
    } catch (err) {
      console.warn('[FXMapper] ⚠️ Could not load EffectRegistry, using fallback set')
      // Comprehensive fallback set
      _knownBaseEffectIds = new Set([
        // Fiesta Latina
        'solar_flare', 'tropical_pulse', 'salsa_fire', 'cumbia_moon', 'clave_rhythm',
        'corazon_latino', 'amazon_mist', 'machete_spark', 'glitch_guaguanco', 'latina_meltdown',
        // Techno
        'strobe_burst', 'acid_sweep', 'industrial_strobe', 'cyber_dualism', 'gatling_raid',
        'sky_saw', 'strobe_storm', 'abyssal_rise',
        // Chill/Ambient
        'void_mist', 'digital_rain', 'deep_breath', 'ambient_strobe', 'sonar_ping',
        'binary_glitch', 'seismic_snap', 'fiber_optics',
        // Pop-Rock
        'core_meltdown', 'thunder_struck', 'liquid_solo', 'amp_heat', 'arena_sweep',
        'feedback_storm', 'power_chord', 'stage_wash', 'spotlight_pulse',
        // Ocean/Chill
        'tidal_wave', 'ghost_breath', 'solar_caustics', 'school_of_fish', 'whale_song',
        'abyssal_jellyfish', 'surface_shimmer', 'plankton_drift', 'deep_current_pulse',
        'bioluminescent_spore',
      ])
    }
  }
  return _knownBaseEffectIds
}

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
  if (getKnownBaseEffectIds().has(fxType)) {
    return fxType
  }
  
  // ⚒️ WAVE 2040.22: Heph custom clips live outside the Core FX taxonomy
  // They should never reach here (Bridge handles them), but defense in depth.
  if (fxType === 'heph-custom') {
    return 'heph-custom'
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
  return fxType in FX_MAP || getKnownBaseEffectIds().has(fxType)
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
  const isPassthrough = getKnownBaseEffectIds().has(fxType)
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
