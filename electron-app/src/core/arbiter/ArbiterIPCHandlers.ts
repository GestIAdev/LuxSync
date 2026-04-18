/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎛️ ARBITER IPC HANDLERS - WAVE 376
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * IPC bridges for MasterArbiter operations:
 * - Grand Master (global dimmer control)
 * - Pattern Engine (Circle, Eight, Sweep)
 * - Group Formations (Radar control)
 * - Manual Overrides (UI controls)
 * 
 * @module core/arbiter/ArbiterIPCHandlers
 * @version WAVE 376
 */

import { ipcMain } from 'electron'
import type { MasterArbiter } from './MasterArbiter'
import type { Layer2_Manual } from './types'
import { getTitanOrchestrator } from '../orchestrator/TitanOrchestrator'
import { vibeMovementManager } from '../../engine/movement/VibeMovementManager'
import { ColorTranslator } from '../../hal/translation/ColorTranslator'
import { getProfile, needsColorTranslation } from '../../hal/translation/FixtureProfiles'

// 🎨 WAVE 2042.32: ColorTranslator instance for RGB → Color Wheel translation
const colorTranslator = new ColorTranslator()
// 🔧 WAVE 2775: Throttle BabelFish logs to prevent colorpicker drag spam
let _babelFishLogThrottle = 0

/**
 * Register all Arbiter IPC handlers
 * Call this from main.ts during initialization
 */
export function registerArbiterHandlers(masterArbiter: MasterArbiter): void {
  
  // ═══════════════════════════════════════════════════════════════════════
  // GRAND MASTER
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Set Grand Master level (0-1)
   * Multiplies dimmer for ALL fixtures globally.
   */
  ipcMain.handle('lux:arbiter:setGrandMaster', (_event, { value }: { value: number }) => {
    masterArbiter.setGrandMaster(value)
    return { success: true, grandMaster: masterArbiter.getGrandMaster() }
  })
  
  /**
   * Get current Grand Master level
   */
  ipcMain.handle('lux:arbiter:getGrandMaster', () => {
    return { grandMaster: masterArbiter.getGrandMaster() }
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎚️ WAVE 2495: GRANDMASTER SPEED (UNIVERSAL)
  // Multiplies BOTH the AI's generative phase flow (Layer 0 via VibeMovementManager)
  // AND manual pattern speed (Layer 2 via MasterArbiter.calculatePatternOffset).
  // This makes the Master Speed slider in CommandDeck a TRUE global control.
  // ═══════════════════════════════════════════════════════════════════════
  
  ipcMain.handle('lux:arbiter:setGrandMasterSpeed', (_event, { value }: { value: number }) => {
    vibeMovementManager.setGlobalSpeedMultiplier(value)
    masterArbiter.setGrandMasterSpeed(value)
    return { success: true, grandMasterSpeed: vibeMovementManager.getGlobalSpeedMultiplier() }
  })
  
  ipcMain.handle('lux:arbiter:getGrandMasterSpeed', () => {
    return { grandMasterSpeed: vibeMovementManager.getGlobalSpeedMultiplier() }
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🔒 WAVE 3270: INHIBIT LIMIT — Per-fixture proportional ceiling
  // Scales dimmer output proportionally. AI dynamics preserved, just scaled.
  // ═══════════════════════════════════════════════════════════════════════

  ipcMain.handle('lux:arbiter:setInhibitLimit', (
    _event,
    { fixtureIds, value }: { fixtureIds: string[], value: number }
  ) => {
    if (!fixtureIds || !Array.isArray(fixtureIds) || fixtureIds.length === 0) {
      return { success: false, error: 'Invalid fixtureIds' }
    }
    masterArbiter.setInhibitLimit(fixtureIds, value)
    return { success: true, value: Math.max(0, Math.min(1, value)) }
  })

  ipcMain.handle('lux:arbiter:clearInhibitLimit', (
    _event,
    { fixtureIds }: { fixtureIds: string[] }
  ) => {
    if (!fixtureIds || !Array.isArray(fixtureIds) || fixtureIds.length === 0) {
      return { success: false, error: 'Invalid fixtureIds' }
    }
    masterArbiter.clearInhibitLimit(fixtureIds)
    return { success: true }
  })

  ipcMain.handle('lux:arbiter:getInhibitLimits', () => {
    return { inhibitLimits: Object.fromEntries(masterArbiter.getInhibitLimits()) }
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // PATTERN ENGINE
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Set pattern for fixtures (Circle, Eight, Sweep)
   */
  ipcMain.handle('lux:arbiter:setPattern', (
    _event,
    {
      fixtureIds,
      pattern,
    }: {
      fixtureIds: string[]
      pattern: {
        type: 'circle' | 'eight' | 'sweep' | 'tornado' | 'gravity_bounce' | 'butterfly' | 'heartbeat'
        speed: number
        size: number
        center: { pan: number; tilt: number }
      }
    }
  ) => {
    // WAVE 2050.2: Wildcard expansion for setPattern
    const resolvedIds = fixtureIds.includes('*')
      ? masterArbiter.getFixtureIds()
      : fixtureIds
    
    masterArbiter.setPattern(resolvedIds, pattern)
    return { success: true, patternType: pattern.type, fixtureCount: resolvedIds.length }
  })
  
  /**
   * Clear pattern for fixtures
   */
  ipcMain.handle('lux:arbiter:clearPattern', (
    _event,
    { fixtureIds }: { fixtureIds: string[] }
  ) => {
    // WAVE 2050.2: Wildcard expansion for clearPattern
    const resolvedIds = fixtureIds.includes('*')
      ? masterArbiter.getFixtureIds()
      : fixtureIds
    
    masterArbiter.clearPattern(resolvedIds)
    return { success: true, clearedCount: resolvedIds.length }
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // GROUP FORMATIONS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Set group formation (Radar control)
   * Moves group center while maintaining relative spacing.
   */
  ipcMain.handle('lux:arbiter:setGroupFormation', (
    _event,
    {
      groupId,
      fixtureIds,
      center,
      fan,
    }: {
      groupId: string
      fixtureIds: string[]
      center: { pan: number; tilt: number }
      fan: number
    }
  ) => {
    masterArbiter.setGroupFormation(groupId, fixtureIds, center, fan)
    return { success: true, groupId, fixtureCount: fixtureIds.length }
  })
  
  /**
   * Clear group formation
   */
  ipcMain.handle('lux:arbiter:clearGroupFormation', (
    _event,
    { groupId }: { groupId: string }
  ) => {
    masterArbiter.clearGroupFormation(groupId)
    return { success: true, groupId }
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // MANUAL OVERRIDES
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Set manual override for fixtures
   * Example from UI Programmer panel
   */
  ipcMain.handle('lux:arbiter:setManual', (
    _event,
    {
      fixtureIds,
      controls,
      channels,
    }: {
      fixtureIds: string[]
      controls: Record<string, number>
      channels: string[]
    }
  ) => {
    // 🔥 WAVE 1008.4: Debug log BEFORE validation
    // Disabled: WAVE 2052 - Too spammy (60 FPS × 12 fixtures per frame)
    // console.log(`[Arbiter] 📥 setManual RAW:`, { fixtureIds, controls, channels, speed: controls?.speed })
    
    // Validate required parameters
    if (!fixtureIds || !Array.isArray(fixtureIds) || fixtureIds.length === 0) {
      console.error('[Arbiter] setManual: Invalid or empty fixtureIds', { fixtureIds, controls, channels })
      return { success: false, error: 'Invalid or empty fixtureIds' }
    }
    
    if (!controls || typeof controls !== 'object') {
      console.error('[Arbiter] setManual: Invalid controls', { fixtureIds, controls, channels })
      return { success: false, error: 'Invalid controls' }
    }
    
    if (!channels || !Array.isArray(channels) || channels.length === 0) {
      console.error('[Arbiter] setManual: Invalid or empty channels', { fixtureIds, controls, channels })
      return { success: false, error: 'Invalid or empty channels' }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 🌐 WAVE 2050.2: WILDCARD EXPANSION
    // Scene player sends fixtureIds: ['*'] for global events.
    // Expand '*' to ALL registered fixture IDs in the arbiter.
    // ═══════════════════════════════════════════════════════════════════════════
    const resolvedFixtureIds = fixtureIds.includes('*')
      ? masterArbiter.getFixtureIds()
      : fixtureIds
    
    // Disabled: WAVE 2052 - Too spammy (once per frame)
    // if (fixtureIds.includes('*')) {
    //   console.log(`[Arbiter] 🌐 Wildcard '*' expanded → ${resolvedFixtureIds.length} fixtures`)
    // }
    
    if (resolvedFixtureIds.length === 0) {
      console.warn('[Arbiter] setManual: Wildcard expanded to 0 fixtures (no fixtures registered)')
      return { success: false, error: 'No fixtures registered for wildcard' }
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 🔥 WAVE 2495: SPEED AUTO-INJECT REMOVED (was WAVE 1219)
    // 
    // OLD: Injected speed=0 (DMX fastest, NO interpolation) into every pan/tilt
    //      override. This killed motor interpolation — steppers jumped brutally
    //      between positions because speed=0 = "move instantly, no acceleration".
    //
    // NEW: Do NOT inject speed. mergeChannelForFixture falls through to
    //      getTitanValuesForFixture which reads the fixture's defaultValue
    //      (typically 128 = smooth interpolation with acceleration curves).
    //      The fixture's internal MCU handles motor ramping when speed > 0.
    //
    // The UI (PositionSection) already stopped sending speed:0 in WAVE 2190,
    // but this handler was re-injecting it — making the UI fix useless.
    // ═══════════════════════════════════════════════════════════════════════════
    
    let finalControls = { ...controls }
    let finalChannels = [...channels]
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 🎨 WAVE 2042.32: COLOR TRANSLATION - RGB → Color Wheel
    // Commander sends RGB, but fixtures might have color wheels.
    // Detect and translate automatically using ColorTranslator.
    //
    // 🔧 WAVE 2770: FIX — Multi-profile translation.
    // Old code checked only the FIRST fixture's profile and applied the same
    // translation to ALL fixtures. If the selection mixes color-wheel fixtures
    // with RGB fixtures, half of them got wrong controls. Now translation
    // happens per-fixture inside the loop.
    // ═══════════════════════════════════════════════════════════════════════════
    const hasRGB = channels.includes('red') && channels.includes('green') && channels.includes('blue')
    
    const overrideCount = resolvedFixtureIds.length
    
    for (const fixtureId of resolvedFixtureIds) {
      let perFixtureControls = { ...finalControls }
      let perFixtureChannels = [...finalChannels]
      
      if (hasRGB) {
        const fixtureData = masterArbiter.getFixture(fixtureId)
        if (fixtureData) {
          const profile = getProfile(fixtureData.profileId || '')
          if (profile && needsColorTranslation(profile)) {
            const targetRGB = {
              r: controls.red || 0,
              g: controls.green || 0,
              b: controls.blue || 0
            }
            const translation = colorTranslator.translate(targetRGB, profile)
            
            // 🔧 WAVE 2772: BABELFISH RESTORATION — Defensive guard.
            // Only replace RGB with color_wheel if translation actually produced
            // a valid wheel DMX value. If colorWheelDmx is undefined (e.g. RGB
            // fixture with hybrid profile, or translation fallback), keep RGB
            // intact to avoid destroying the operator's color intent.
            if (translation.wasTranslated && translation.colorWheelDmx !== undefined) {
              // 🔧 WAVE 2775: Log gated to 1 per fixture per 2s to prevent colorpicker drag spam
              if (!_babelFishLogThrottle || Date.now() - _babelFishLogThrottle > 2000) {
                console.log(`[Arbiter] 🎨 COLOR TRANSLATION (${fixtureId}): RGB(${targetRGB.r},${targetRGB.g},${targetRGB.b}) → Wheel=${translation.colorWheelDmx} (${translation.colorName})`)
                _babelFishLogThrottle = Date.now()
              }
              
              perFixtureControls = { ...perFixtureControls }
              delete perFixtureControls.red
              delete perFixtureControls.green
              delete perFixtureControls.blue
              perFixtureControls.color_wheel = translation.colorWheelDmx
              
              perFixtureChannels = perFixtureChannels.filter(ch => !['red', 'green', 'blue'].includes(ch))
              perFixtureChannels.push('color_wheel')
            } else {
              // Translation returned no wheel DMX — fixture keeps RGB as-is
              if (!_babelFishLogThrottle || Date.now() - _babelFishLogThrottle > 2000) {
                console.log(`[Arbiter] 🎨 BABELFISH SKIP (${fixtureId}): needsColorTranslation=true but translate() returned no colorWheelDmx. Keeping RGB.`)
                _babelFishLogThrottle = Date.now()
              }
            }
          }
        }
      }
      
      const override: Layer2_Manual = {
        fixtureId,
        controls: perFixtureControls as any,
        overrideChannels: perFixtureChannels as any,
        mode: 'absolute',
        source: 'ui_programmer',
        priority: 100,
        autoReleaseMs: 0,  // Don't auto-release
        releaseTransitionMs: 500,  // 500ms crossfade on release
        timestamp: performance.now(),
      }
      
      masterArbiter.setManualOverride(override)
    }
    
    return { success: true, overrideCount }
  })
  
  /**
   * Release manual override for fixtures
   * Starts crossfade back to AI control
   */
  ipcMain.handle('lux:arbiter:clearManual', (
    _event,
    {
      fixtureIds,
      channels,
    }: {
      fixtureIds: string[]
      channels?: string[]
    }
  ) => {
    // WAVE 2050.2: Wildcard expansion for clearManual
    const resolvedIds = fixtureIds.includes('*')
      ? masterArbiter.getFixtureIds()
      : fixtureIds
    
    // Disabled: WAVE 2052 - Too spammy
    // if (fixtureIds.includes('*')) {
    //   console.log(`[Arbiter] 🌐 clearManual: Wildcard '*' expanded → ${resolvedIds.length} fixtures`)
    // }
    
    const releaseCount = resolvedIds.length
    
    for (const fixtureId of resolvedIds) {
      masterArbiter.releaseManualOverride(fixtureId, channels as any)
    }
    
    return { success: true, releaseCount }
  })
  
  /**
   * Release ALL manual overrides (panic button - ESC key)
   */
  ipcMain.handle('lux:arbiter:releaseAll', () => {
    masterArbiter.releaseAllManualOverrides()
    return { success: true }
  })
  
  /**
   * WAVE 2050.3: Alias for releaseAll — Scene Player uses this name
   */
  ipcMain.handle('lux:arbiter:clearAllManual', () => {
    console.log('[Arbiter] 🧹 clearAllManual → releasing all overrides')
    masterArbiter.releaseAllManualOverrides()
    return { success: true }
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎚️ WAVE 999: MOVEMENT PARAMETERS (Speed & Amplitude)
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Set movement parameter (speed or amplitude)
   * Called from PositionSection.tsx when user moves tactical sliders
   */
  ipcMain.handle('lux:arbiter:setMovementParameter', (
    _event,
    {
      parameter,
      value,
    }: {
      parameter: 'speed' | 'amplitude'
      value: number | null  // 0-100 scale, or null to release
    }
  ) => {
    if (parameter === 'speed') {
      vibeMovementManager.setManualSpeed(value)
      console.log(`[Arbiter IPC] 🚀 Movement SPEED: ${value === null ? 'RELEASED' : value + '%'}`)
    } else if (parameter === 'amplitude') {
      vibeMovementManager.setManualAmplitude(value)
      console.log(`[Arbiter IPC] 📏 Movement AMPLITUDE: ${value === null ? 'RELEASED' : value + '%'}`)
    }
    
    return { success: true, parameter, value }
  })
  
  /**
   * Clear all movement parameter overrides
   */
  ipcMain.handle('lux:arbiter:clearMovementOverrides', () => {
    vibeMovementManager.clearManualOverrides()
    return { success: true }
  })
  
  /**
   * 🎯 WAVE 999.4: Set manual movement pattern
   * Called from PatternSelector when user clicks a pattern button
   */
  ipcMain.handle('lux:arbiter:setMovementPattern', (
    _event,
    {
      pattern,
    }: {
      pattern: string | null  // Pattern name or null to release to AI
    }
  ) => {
    vibeMovementManager.setManualPattern(pattern)
    console.log(`[Arbiter IPC] 🎯 Movement PATTERN: ${pattern === null ? 'RELEASED → AI' : pattern}`)
    return { success: true, pattern }
  })

  /**
   * 🔄 WAVE 2042.22: Apply manual pattern to specific fixtures
   * This injects the pattern into MasterArbiter.activePatterns
   * so it gets applied in getAdjustedPosition() during render loop
   * 
   * 🔧 WAVE 2071: THE ANCHOR — Every pattern/hold command now:
   *   1. Snapshots current position (Titan or existing override)
   *   2. Creates a manualOverride for pan/tilt with that snapshot
   *   3. THEN sets the pattern (which orbits around the anchored center)
   *   Without step 2, the pattern orbits around a moving Titan = chaos.
   */
  ipcMain.handle('lux:arbiter:setManualFixturePattern', (
    _event,
    {
      fixtureIds,
      pattern,
      speed,      // 0-100
      amplitude,  // 0-100
    }: {
      fixtureIds: string[]
      pattern: string | null  // 'circle', 'eight', 'sweep', 'hold', or null
      speed: number
      amplitude: number
    }
  ) => {
    // ═══════════════════════════════════════════════════════════════════════
    // NULL = DESTROY — Full cleanup, pattern + override removed by clearManual
    // This is called from handleRelease, right before clearManual
    // ═══════════════════════════════════════════════════════════════════════
    if (pattern === null || pattern === 'static') {
      masterArbiter.clearPattern(fixtureIds)
      console.log(`[Arbiter IPC] 🛑 Pattern DESTROYED for ${fixtureIds.length} fixtures`)
      return { success: true, cleared: true }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // 🔧 WAVE 2071 + WAVE 2185: THE ANCHOR
    // Snapshot current position and create override.
    // Without this, the pattern center is Titan's position which moves
    // every frame with the music = parasitic chaos.
    //
    // 🔥 WAVE 2185: ANCHOR PRESERVATION ON PATTERN SWITCH
    // When switching patterns (e.g. circle → tornado), we must:
    //   1. KEEP the existing anchor position (don't re-snapshot mid-orbit)
    //   2. NOT override the speed channel (speed=0 kills motor interpolation
    //      → stepper motors vibrate because they receive raw positions at 60fps
    //      with no acceleration curve from the fixture's internal MCU)
    //   3. Only create a NEW anchor if none exists yet
    // ═══════════════════════════════════════════════════════════════════════
    for (const fixtureId of fixtureIds) {
      const existingOverride = masterArbiter.getManualOverride(fixtureId)
      const hasAnchor = existingOverride?.controls?.pan !== undefined 
                     && existingOverride?.controls?.tilt !== undefined
      
      if (!hasAnchor) {
        // First time anchoring — snapshot current position
        const currentPos = masterArbiter.getCurrentPosition(fixtureId)
        
        const anchorOverride: Layer2_Manual = {
          fixtureId,
          controls: {
            pan: currentPos.pan,
            tilt: currentPos.tilt,
            // 🔥 WAVE 2185: Do NOT include speed in the override.
            // Let the fixture use its profile defaultValue (typically 127-128)
            // which enables the internal motor interpolation = smooth movement.
          } as any,
          overrideChannels: ['pan', 'tilt'] as any,
          mode: 'absolute',
          source: 'ui_programmer',
          priority: 100,
          autoReleaseMs: 0,
          releaseTransitionMs: 500,
          timestamp: performance.now(),
        }
        
        masterArbiter.setManualOverride(anchorOverride)
      }
      // If anchor already exists → reuse it. The pattern switch only changes
      // the PatternConfig type, not the anchor point.
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // HOLD = FREEZE — Override anchored, no pattern. Fixture stays put.
    // Titan can't move it because manualOverride for pan/tilt wins.
    // ═══════════════════════════════════════════════════════════════════════
    if (pattern === 'hold') {
      masterArbiter.clearPattern(fixtureIds)
      const pos = masterArbiter.getCurrentPosition(fixtureIds[0])
      console.log(`[Arbiter IPC] 🧊 HOLD ANCHORED at P${pos.pan.toFixed(0)}/T${pos.tilt.toFixed(0)} for ${fixtureIds.length} fixtures — Titan BLOCKED`)
      return { success: true, hold: true }
    }
    
    // ═══════════════════════════════════════════════════════════════════════
    // PATTERN = ORBIT — Override anchored + pattern running around it
    // ═══════════════════════════════════════════════════════════════════════
    
    // Validate pattern type
    const validPatterns = ['circle', 'eight', 'sweep', 'tornado', 'gravity_bounce', 'butterfly', 'heartbeat']
    if (!validPatterns.includes(pattern)) {
      console.warn(`[Arbiter IPC] Invalid pattern: ${pattern}, using 'circle'`)
      pattern = 'circle'
    }

    // Convert UI values (0-100) to engine values
    // 🔥 WAVE 2498: FIXED RANGE FOR MANUAL PATTERNS (Layer 2)
    // OLD (WAVE 2471): Used vibe's speedRange → BROKEN in idle because
    // idle has speedRange {min:0, max:0}. The ?? fallbacks never triggered
    // because 0 is a real value (not null/undefined). Result: speed=0 Hz always.
    //
    // Manual patterns are PROGRAMMER controls (Layer 2), not AI (Layer 0).
    // They must work identically regardless of which vibe is active.
    // Fixed range: 0.05-0.5 Hz. Hard cap at 0.5 Hz (BETA_MAX_SPEED) enforced
    // in calculatePatternOffset as motor-safety defense-in-depth.
    // Speed ceiling matches the AI layer maximum (techno-club baseFrequency 0.25 Hz,
    // manualSpeedOverride ceiling 0.5 Hz). GrandMasterSpeed handles show-time scaling.
    //
    // 🔥 WAVE 2652: AMPLITUDE UNLOCK — size now maps 0-100% UI → 0-1.0 engine;
    // MANUAL_MAX_MOVEMENT in MasterArbiter enforces the real DMX ceiling (128 units).
    // At 0.5 Hz + 128 DMX: max velocity ≈ 128 * π * 0.5 ≈ 201 DMX/s ≈ 425°/s peak
    // (instantaneous peak of cosine derivative, RMS ~300°/s — within stepper tolerance).
    const MANUAL_SPEED_MIN = 0.05  // Hz — minimum perceptible movement
    const MANUAL_SPEED_MAX = 0.5   // Hz — mirrors AI layer ceiling (WAVE 2652 confirmed)
    const speedNormalized = MANUAL_SPEED_MIN + (speed / 100) * (MANUAL_SPEED_MAX - MANUAL_SPEED_MIN)
    const sizeNormalized = (amplitude / 100) * 1.0  // 🔥 WAVE 2652: full range (128 DMX ceiling in Arbiter)

    // If pattern already exists with same type → hot-update (no phase reset)
    const existingPattern = masterArbiter.getPattern(fixtureIds[0])
    if (existingPattern && existingPattern.type === pattern) {
      masterArbiter.updatePatternParams(fixtureIds, speedNormalized, sizeNormalized)
      console.log(`[Arbiter IPC] 🔧 Pattern ${pattern} UPDATED (speed=${speed}%, amp=${amplitude}%) — NO phase reset`)
      return { success: true, pattern, updated: true }
    }

    // 🔥 WAVE 2185: PATTERN SWITCH — If switching types (e.g. circle → tornado),
    // use the EXISTING anchor position, not a re-snapshot.
    // Re-snapshotting mid-orbit would capture an intermediate position = jump.
    const anchorPos = existingPattern
      ? existingPattern.center  // Reuse the original anchor from the previous pattern
      : masterArbiter.getCurrentPosition(fixtureIds[0])  // First pattern → snapshot now
    
    masterArbiter.setPattern(fixtureIds, {
      type: pattern as 'circle' | 'eight' | 'sweep' | 'tornado' | 'gravity_bounce' | 'butterfly' | 'heartbeat',
      speed: speedNormalized,
      size: sizeNormalized,
      center: { pan: anchorPos.pan, tilt: anchorPos.tilt },
    })

    const switchNote = existingPattern ? ` (switched from ${existingPattern.type})` : ''
    console.log(`[Arbiter IPC] 🔄 Pattern ${pattern} ANCHORED at P${anchorPos.pan.toFixed(0)}/T${anchorPos.tilt.toFixed(0)} (speed=${speed}%, amp=${amplitude}%) for ${fixtureIds.length} fixtures${switchNote}`)
    return { success: true, pattern, fixtureIds: fixtureIds.length }
  })

  // ═══════════════════════════════════════════════════════════════════════
  // 🧠 WAVE 999.6: STATE HYDRATION - Get current fixture state for UI sync
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Get unified state snapshot for fixtures (for UI hydration)
   * Strategy: "Follow the Leader" - returns state of FIRST fixture
   * 
   * Returns null for channels controlled by AI (not manually overridden)
   */
  ipcMain.handle('lux:arbiter:getFixturesState', (
    _event,
    { fixtureIds }: { fixtureIds: string[] }
  ) => {
    if (fixtureIds.length === 0) {
      return { success: false, error: 'No fixture IDs provided' }
    }
    
    // Get fixture-specific override for FIRST fixture (Leader strategy)
    const leaderId = fixtureIds[0]
    const fixtureOverride = masterArbiter.getManualOverride(leaderId)
    
    // 🔧 WAVE 2182: Read pattern from Layer 2 (MasterArbiter.activePatterns)
    // NOT from Layer 0 (VibeMovementManager/CHOREO) — the Programmer stores
    // patterns in Layer 2 via setManualFixturePattern, not in CHOREO.
    // Reading from CHOREO always returned null → UI lost pattern state on fixture switch.
    const layer2Pattern = masterArbiter.getPattern(leaderId)
    
    // If fixture has a manual override for pan/tilt but NO active pattern,
    // it's in HOLD mode (frozen position). If it has an active pattern,
    // return the pattern type.
    const hasManualPosition = fixtureOverride?.overrideChannels?.includes('pan' as any) ||
                              fixtureOverride?.overrideChannels?.includes('tilt' as any)
    
    // Determine effective pattern state for UI:
    // - Layer 2 pattern active → return pattern type (circle/eight/sweep)
    // - Manual position override but no pattern → 'hold' (frozen)
    // - Neither → null (AI control)
    let effectivePattern: string | null = null
    let effectiveSpeed: number | null = null
    let effectiveAmplitude: number | null = null
    
    if (layer2Pattern) {
      effectivePattern = layer2Pattern.type
      // 🔥 WAVE 2498: Convert engine Hz back to UI 0-100 using FIXED range.
      // Must use the SAME constants as setManualFixturePattern normalization.
      const HYDRATE_SPEED_MIN = 0.05
      const HYDRATE_SPEED_MAX = 0.5
      const hydrateRange = HYDRATE_SPEED_MAX - HYDRATE_SPEED_MIN
      effectiveSpeed = Math.round(Math.max(0, Math.min(100, ((layer2Pattern.speed - HYDRATE_SPEED_MIN) / hydrateRange) * 100)))
      // size 0-0.5 → 0-100 (inverse of: amplitude / 100 * 0.5)
      effectiveAmplitude = Math.round(Math.min(100, (layer2Pattern.size / 0.5) * 100))
    } else if (hasManualPosition) {
      effectivePattern = 'hold'
      effectiveSpeed = null
      effectiveAmplitude = null
    }
    
    // Build unified state snapshot
    const state = {
      // === INTENSITY ===
      // dimmer: null = AI control, 0-100 = manual override
      dimmer: fixtureOverride?.controls?.dimmer !== undefined 
        ? Math.round(fixtureOverride.controls.dimmer / 2.55) // 0-255 → 0-100
        : null,
      
      // === COLOR ===
      // color: null = AI control, hex string = manual override
      color: (fixtureOverride?.controls?.red !== undefined &&
              fixtureOverride?.controls?.green !== undefined &&
              fixtureOverride?.controls?.blue !== undefined)
        ? `#${fixtureOverride.controls.red!.toString(16).padStart(2, '0')}${fixtureOverride.controls.green!.toString(16).padStart(2, '0')}${fixtureOverride.controls.blue!.toString(16).padStart(2, '0')}`
        : null,
      
      // === POSITION (from fixture override) ===
      pan: fixtureOverride?.controls?.pan !== undefined
        ? Math.round((fixtureOverride.controls.pan / 255) * 540)  // 0-255 → 0-540
        : null,
      tilt: fixtureOverride?.controls?.tilt !== undefined
        ? Math.round((fixtureOverride.controls.tilt / 255) * 270) // 0-255 → 0-270
        : null,
      
      // === MOVEMENT (Layer 2 — MasterArbiter patterns) ===
      pattern: effectivePattern,   // 'circle', 'eight', 'sweep', 'hold', or null
      speed: effectiveSpeed,       // 0-100 or null
      amplitude: effectiveAmplitude, // 0-100 or null
      
      // === BEAM (from fixture override) ===
      zoom: fixtureOverride?.controls?.zoom !== undefined
        ? Math.round(fixtureOverride.controls.zoom / 2.55)
        : null,
      focus: fixtureOverride?.controls?.focus !== undefined
        ? Math.round(fixtureOverride.controls.focus / 2.55)
        : null,
    }
    
    console.log(`[Arbiter IPC] 🧠 State Hydration for ${fixtureIds.length} fixtures (Leader: ${leaderId})`)
    return { success: true, state }
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // EFFECTS
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Add effect (Strobe, Blinder, Smoke, etc.)
   */
  ipcMain.handle('lux:arbiter:addEffect', (
    _event,
    {
      type,
      intensity,
      durationMs,
      fixtureIds,
      params,
    }: {
      type: string
      intensity: number
      durationMs: number
      fixtureIds: string[]
      params: Record<string, number | boolean | string>
    }
  ) => {
    masterArbiter.addEffect({
      type: type as any,
      intensity,
      durationMs,
      startTime: 0,  // Will be set by arbiter
      fixtureIds,
      params,
    })
    return { success: true, type }
  })
  
  /**
   * Remove effect
   */
  ipcMain.handle('lux:arbiter:removeEffect', (_event, { type }: { type: string }) => {
    masterArbiter.removeEffect(type)
    return { success: true, type }
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // BLACKOUT
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Set blackout state
   */
  ipcMain.handle('lux:arbiter:setBlackout', (_event, { active }: { active: boolean }) => {
    masterArbiter.setBlackout(active)
    return { success: true, blackoutActive: masterArbiter.isBlackoutActive() }
  })
  
  /**
   * Toggle blackout
   */
  ipcMain.handle('lux:arbiter:toggleBlackout', () => {
    const result = masterArbiter.toggleBlackout()
    return { success: true, blackoutActive: result }
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🚦 WAVE 1132: OUTPUT GATE - THE COLD START PROTOCOL
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Set output enabled state (THE GATE)
   * When false: System is ARMED - engine runs, calculates, but DMX stays at safe values
   * When true: System is LIVE - DMX flows to fixtures
   */
  ipcMain.handle(
    'lux:arbiter:setOutputEnabled',
    (
      _event,
      {
        enabled,
        label,
      }: {
        enabled: boolean
        label?: string
      }
    ) => {
    // 🔎 TRACE: Last-mile visibility for gate flips (IPC callers can be many)
    try {
      const stack = new Error().stack
      const trimmed = stack ? stack.split('\n').slice(0, 6).join('\n') : undefined
      const senderUrl = _event?.senderFrame?.url ?? _event?.sender?.getURL?.() ?? 'unknown'
      const senderFrame = _event?.senderFrame
        ? {
            url: _event.senderFrame.url,
            name: _event.senderFrame.name,
            routingId: _event.senderFrame.routingId,
          }
        : undefined
      console.log('[IPC 📡] lux:arbiter:setOutputEnabled', {
        enabled,
        label,
        senderUrl,
        senderFrame,
        stack: trimmed,
      })
    } catch {
      // ignore
    }

    const sanitizedLabel =
      typeof label === 'string' && label.trim().length > 0
        ? label.trim().slice(0, 160)
        : undefined

    // Prefer tagged call if available (keeps compatibility with older builds)
    const anyArbiter = masterArbiter as unknown as {
      setOutputEnabledTagged?: (enabled: boolean, label: string) => void
    }
    if (typeof anyArbiter.setOutputEnabledTagged === 'function') {
      // Include enabled in label so a single glance shows intent
      anyArbiter.setOutputEnabledTagged(
        enabled,
        sanitizedLabel ?? `IPC:lux:arbiter:setOutputEnabled:${enabled ? 'LIVE' : 'ARMED'}`
      )
    } else {
      masterArbiter.setOutputEnabled(enabled)
    }
    return { 
      success: true, 
      outputEnabled: masterArbiter.isOutputEnabled(),
      state: masterArbiter.isOutputEnabled() ? 'LIVE' : 'ARMED'
    }
  })
  
  /**
   * Toggle output gate (ARMED ↔ LIVE)
   */
  ipcMain.handle('lux:arbiter:toggleOutput', (_event, { label }: { label?: string } = {}) => {
    // 🔎 TRACE: who toggled the output gate
    try {
      const stack = new Error().stack
      const trimmed = stack ? stack.split('\n').slice(0, 6).join('\n') : undefined
      console.log('[IPC 📡] lux:arbiter:toggleOutput', { label, stack: trimmed })
    } catch {
      // ignore
    }
    const result = masterArbiter.toggleOutput()

    // If tagged API exists, stamp the origin label for forensics
    try {
      const anyArbiter = masterArbiter as unknown as {
        setOutputEnabledTagged?: (enabled: boolean, label: string) => void
      }
      if (typeof anyArbiter.setOutputEnabledTagged === 'function') {
        const sanitizedLabel =
          typeof label === 'string' && label.trim().length > 0
            ? label.trim().slice(0, 160)
            : undefined
        anyArbiter.setOutputEnabledTagged(
          result,
          sanitizedLabel ?? `IPC:lux:arbiter:toggleOutput:${result ? 'LIVE' : 'ARMED'}`
        )
      }
    } catch {
      // ignore
    }

    return { 
      success: true, 
      outputEnabled: result,
      state: result ? 'LIVE' : 'ARMED'
    }
  })
  
  /**
   * Get output enabled state
   */
  ipcMain.handle('lux:arbiter:getOutputEnabled', () => {
    return { 
      outputEnabled: masterArbiter.isOutputEnabled(),
      state: masterArbiter.isOutputEnabled() ? 'LIVE' : 'ARMED'
    }
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // CALIBRATION MODE - WAVE 377
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Enter calibration mode for a fixture
   * This sets a special manual override that only affects pan/tilt
   * and marks the fixture as being calibrated (UI indicator)
   */
  ipcMain.handle('lux:arbiter:enterCalibrationMode', (
    _event,
    { fixtureId }: { fixtureId: string }
  ) => {
    console.log(`[Arbiter] 🎯 Entering calibration mode for ${fixtureId}`)
    
    // Set manual override for position channels only
    const override: Layer2_Manual = {
      fixtureId,
      controls: {}, // Values will be set by user via setManual
      overrideChannels: ['pan', 'tilt'],
      mode: 'absolute',
      source: 'calibration', // Special source for calibration
      priority: 200, // Higher than normal manual (100)
      autoReleaseMs: 0, // Never auto-release during calibration
      releaseTransitionMs: 1000, // 1s smooth return on exit
      timestamp: performance.now(),
    }
    
    masterArbiter.setManualOverride(override)
    
    return { 
      success: true, 
      fixtureId, 
      mode: 'calibration',
      message: 'Calibration mode active - pan/tilt under manual control'
    }
  })
  
  /**
   * Exit calibration mode for a fixture
   * Smoothly transitions back to AI control
   */
  ipcMain.handle('lux:arbiter:exitCalibrationMode', (
    _event,
    { fixtureId }: { fixtureId: string }
  ) => {
    console.log(`[Arbiter] 🎯 Exiting calibration mode for ${fixtureId}`)
    
    masterArbiter.releaseManualOverride(fixtureId, ['pan', 'tilt'])
    
    return { 
      success: true, 
      fixtureId,
      message: 'Calibration complete - returning to AI control'
    }
  })
  
  /**
   * Check if fixture is in calibration mode
   */
  ipcMain.handle('lux:arbiter:isCalibrating', (
    _event,
    { fixtureId }: { fixtureId: string }
  ) => {
    const override = masterArbiter.getManualOverride(fixtureId)
    return {
      isCalibrating: override?.source === 'calibration',
      channels: override?.overrideChannels || []
    }
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // FIXTURE SYNC - WAVE 377 (TitanSyncBridge)
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Update fixtures from frontend stageStore
   * Called by TitanSyncBridge when patch changes
   * WAVE 380: Now also updates TitanOrchestrator.fixtures for the render loop
   */
  ipcMain.handle('lux:arbiter:setFixtures', (
    _event,
    { fixtures }: { fixtures: any[] }
  ) => {
    // Update MasterArbiter (for arbitration)
    masterArbiter.setFixtures(fixtures)
    
    // WAVE 380 FIX: ALSO update TitanOrchestrator (for the render loop)
    // Without this, the orchestrator loop runs with 0 fixtures!
    const orchestrator = getTitanOrchestrator()
    orchestrator.setFixtures(fixtures)
    
    return { 
      success: true, 
      fixtureCount: fixtures.length,
      message: `Arbiter + Orchestrator synced with ${fixtures.length} fixtures`
    }
  })
  
  // ═══════════════════════════════════════════════════════════════════════
  // 🎯 WAVE 2613: SPATIAL IK TARGET — IPC BRIDGE
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * Apply a spatial target (3D point) to a group of fixtures via IK engine.
   * Each fixture independently calculates its pan/tilt to point at the target.
   * Returns per-fixture IKResult (for reachability feedback in UI).
   */
  ipcMain.handle('lux:arbiter:applySpatialTarget', (
    _event,
    { target, fixtureIds, fanMode, fanAmplitude }: {
      target: { x: number; y: number; z: number }
      fixtureIds: string[]
      fanMode?: 'converge' | 'line' | 'circle'
      fanAmplitude?: number
    }
  ) => {
    try {
      const results = masterArbiter.applySpatialTarget(
        target,
        fixtureIds,
        fanMode ?? 'converge',
        fanAmplitude ?? 0
      )
      
      // Serialize Map to plain object for IPC transport
      const serialized: Record<string, {
        pan: number; tilt: number; reachable: boolean; antiFlipApplied: boolean
        subTarget: { x: number; y: number; z: number }
      }> = {}
      results.forEach((result, id) => {
        serialized[id] = result
      })
      
      return { success: true, results: serialized }
    } catch (err) {
      console.error('[ArbiterIPC] 🎯 applySpatialTarget error:', err)
      return { success: false, error: String(err) }
    }
  })

  /**
   * Release spatial target control — return fixtures to AI/mechanical control.
   */
  ipcMain.handle('lux:arbiter:releaseSpatialTarget', (
    _event,
    { fixtureIds }: { fixtureIds: string[] }
  ) => {
    try {
      masterArbiter.releaseSpatialTarget(fixtureIds)
      return { success: true }
    } catch (err) {
      console.error('[ArbiterIPC] 🎯 releaseSpatialTarget error:', err)
      return { success: false, error: String(err) }
    }
  })

  // ═══════════════════════════════════════════════════════════════════════
  // STATUS & DEBUG
  // ═══════════════════════════════════════════════════════════════════════
  
  /**
   * Get arbiter status for UI (layer activity, overrides count, etc.)
   */
  ipcMain.handle('lux:arbiter:status', () => {
    return {
      status: masterArbiter.getStatus(),
      grandMaster: masterArbiter.getGrandMaster(),
      grandMasterSpeed: vibeMovementManager.getGlobalSpeedMultiplier(),
      blackout: masterArbiter.isBlackoutActive(),
    }
  })
}

export default registerArbiterHandlers
