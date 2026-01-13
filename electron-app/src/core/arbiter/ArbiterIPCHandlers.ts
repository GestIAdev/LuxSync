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
    masterArbiter.setPattern(fixtureIds, pattern)
    return { success: true, patternType: pattern.type, fixtureCount: fixtureIds.length }
  })
  
  /**
   * Clear pattern for fixtures
   */
  ipcMain.handle('lux:arbiter:clearPattern', (
    _event,
    { fixtureIds }: { fixtureIds: string[] }
  ) => {
    masterArbiter.clearPattern(fixtureIds)
    return { success: true, clearedCount: fixtureIds.length }
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
    const overrideCount = fixtureIds.length
    
    for (const fixtureId of fixtureIds) {
      const override: Layer2_Manual = {
        fixtureId,
        controls: controls as any,
        overrideChannels: channels as any,
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
    const releaseCount = fixtureIds.length
    
    for (const fixtureId of fixtureIds) {
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
   */
  ipcMain.handle('lux:arbiter:setFixtures', (
    _event,
    { fixtures }: { fixtures: any[] }
  ) => {
    masterArbiter.setFixtures(fixtures)
    return { 
      success: true, 
      fixtureCount: fixtures.length,
      message: `Arbiter synced with ${fixtures.length} fixtures`
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
