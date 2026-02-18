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
        type: 'circle' | 'eight' | 'sweep'
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
    // 🔥 WAVE 1219: AUTO-INJECT SPEED FOR MOVEMENT COMMANDS
    // Moving heads require speed channel to be set for pan/tilt to work.
    // If pan or tilt is being controlled but speed is not specified, inject speed=0 (fast)
    // ═══════════════════════════════════════════════════════════════════════════
    const hasMovement = channels.includes('pan') || channels.includes('tilt')
    const hasSpeed = channels.includes('speed')
    
    let finalControls = { ...controls }
    let finalChannels = [...channels]
    
    if (hasMovement && !hasSpeed) {
      finalControls.speed = controls.speed ?? 0  // 0 = fastest movement
      finalChannels.push('speed')
      // Disabled: WAVE 2052 - Too spammy (60 FPS)
      // console.log(`[Arbiter] 🚀 AUTO-INJECT speed=0 for movement command`)
    }
    
    // ═══════════════════════════════════════════════════════════════════════════
    // 🎨 WAVE 2042.32: COLOR TRANSLATION - RGB → Color Wheel
    // Commander sends RGB, but fixtures might have color wheels.
    // Detect and translate automatically using ColorTranslator.
    // ═══════════════════════════════════════════════════════════════════════════
    const hasRGB = channels.includes('red') && channels.includes('green') && channels.includes('blue')
    
    if (hasRGB) {
      // Get first fixture to check profile
      const firstFixture = masterArbiter.getFixture(resolvedFixtureIds[0])
      
      if (firstFixture) {
        const profile = getProfile(firstFixture.profileId || '')
        
        // Check if fixture needs color translation (has color wheel, not RGB)
        if (profile && needsColorTranslation(profile)) {
          const targetRGB = {
            r: controls.red || 0,
            g: controls.green || 0,
            b: controls.blue || 0
          }
          
          const translation = colorTranslator.translate(targetRGB, profile)
          
          console.log(`[Arbiter] 🎨 COLOR TRANSLATION: RGB(${targetRGB.r},${targetRGB.g},${targetRGB.b}) → Wheel=${translation.colorWheelDmx} (${translation.colorName})`)
          
          // Replace RGB controls with color_wheel
          finalControls = { ...finalControls }
          delete finalControls.red
          delete finalControls.green
          delete finalControls.blue
          finalControls.color_wheel = translation.colorWheelDmx || 0
          
          // Replace RGB channels with color_wheel
          finalChannels = finalChannels.filter(ch => !['red', 'green', 'blue'].includes(ch))
          finalChannels.push('color_wheel')
        }
      }
    }
    
    const overrideCount = resolvedFixtureIds.length
    
    for (const fixtureId of resolvedFixtureIds) {
      const override: Layer2_Manual = {
        fixtureId,
        controls: finalControls as any,
        overrideChannels: finalChannels as any,
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
      pattern: string | null  // 'circle', 'eight', 'sweep', 'static', or null
      speed: number
      amplitude: number
    }
  ) => {
    if (!pattern || pattern === 'static' || pattern === 'hold') {
      // Clear pattern from fixtures
      masterArbiter.clearPattern(fixtureIds)
      console.log(`[Arbiter IPC] 🛑 Pattern CLEARED for ${fixtureIds.length} fixtures`)
      return { success: true, cleared: true }
    }

    // Validate pattern type
    const validPatterns = ['circle', 'eight', 'sweep']
    if (!validPatterns.includes(pattern)) {
      console.warn(`[Arbiter IPC] Invalid pattern: ${pattern}, using 'circle'`)
      pattern = 'circle'
    }

    // 🔧 WAVE 2042.24: Get current positions as pattern center (DMX 0-255 scale)
    // Use first fixture's position as the center point
    const firstFixture = masterArbiter.getManualOverride(fixtureIds[0])
    const centerPan = firstFixture?.controls.pan ?? 128   // Default center (50% of 255)
    const centerTilt = firstFixture?.controls.tilt ?? 128

    // Convert UI values (0-100) to engine values (0-1)
    // Speed: 0-100 → 0-0.5 Hz (0.5 = one cycle per 2 seconds)
    // Size: 0-100 → 0-1 (multiplied by 128 DMX units in render)
    const speedNormalized = (speed / 100) * 0.5
    const sizeNormalized = amplitude / 100  // 🔧 Changed: Full range 0-1, scaled in render

    masterArbiter.setPattern(fixtureIds, {
      type: pattern as 'circle' | 'eight' | 'sweep',
      speed: speedNormalized,
      size: sizeNormalized,
      center: { pan: centerPan, tilt: centerTilt },
    })

    console.log(`[Arbiter IPC] 🔄 Pattern ${pattern} applied to ${fixtureIds.length} fixtures (speed=${speed}%, amp=${amplitude}%)`)
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
    
    // Get movement overrides (global - applies to all fixtures)
    const movementOverrides = vibeMovementManager.getManualOverrides()
    
    // Get fixture-specific override for FIRST fixture (Leader strategy)
    const leaderId = fixtureIds[0]
    const fixtureOverride = masterArbiter.getManualOverride(leaderId)
    
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
      
      // === MOVEMENT (global overrides) ===
      pattern: movementOverrides.pattern,  // 'circle', 'hold', etc. or null
      speed: movementOverrides.speed,      // 0-100 or null
      amplitude: movementOverrides.amplitude, // 0-100 or null
      
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
  ipcMain.handle('lux:arbiter:setOutputEnabled', (_event, { enabled }: { enabled: boolean }) => {
    masterArbiter.setOutputEnabled(enabled)
    return { 
      success: true, 
      outputEnabled: masterArbiter.isOutputEnabled(),
      state: masterArbiter.isOutputEnabled() ? 'LIVE' : 'ARMED'
    }
  })
  
  /**
   * Toggle output gate (ARMED ↔ LIVE)
   */
  ipcMain.handle('lux:arbiter:toggleOutput', () => {
    const result = masterArbiter.toggleOutput()
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
    
    console.log(`[ArbiterIPC] 🩸 WAVE 380: Synced ${fixtures.length} fixtures to Arbiter + Orchestrator`)
    
    return { 
      success: true, 
      fixtureCount: fixtures.length,
      message: `Arbiter + Orchestrator synced with ${fixtures.length} fixtures`
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
      blackout: masterArbiter.isBlackoutActive(),
    }
  })
}

export default registerArbiterHandlers
