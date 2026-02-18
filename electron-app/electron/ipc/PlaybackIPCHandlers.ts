/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎬 PLAYBACK IPC HANDLERS - WAVE 2053.1
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * IPC bridge between React (frontend) and TimelineEngine (backend).
 *
 * The frontend is DUMB: it manages audio playback and sends the current
 * playhead position. ALL lighting physics run in the TimelineEngine.
 *
 * CHANNELS:
 *   lux:playback:load   — Load a LuxProject into the engine
 *   lux:playback:tick   — Send current timeMs (called every frame)
 *   lux:playback:stop   — Stop playback + cleanup
 *   lux:playback:state  — Query engine state
 *
 * @module ipc/PlaybackIPCHandlers
 * @version WAVE 2053.1
 */

import { ipcMain } from 'electron'
import { timelineEngine } from '../../src/core/engine/TimelineEngine'
import type { LuxProject } from '../../src/chronos/core/ChronosProject'

// ═══════════════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════════════

export function setupPlaybackIPCHandlers(): void {

  // ─── LOAD PROJECT ───
  ipcMain.handle('lux:playback:load', (_event, project: LuxProject) => {
    try {
      timelineEngine.loadProject(project)
      return { success: true, state: timelineEngine.getState() }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[PlaybackIPC] ❌ Load failed: ${msg}`)
      return { success: false, error: msg }
    }
  })

  // ─── TICK (called every rAF from frontend) ───
  ipcMain.on('lux:playback:tick', (_event, timeMs: number) => {
    // Fire-and-forget — no response needed for 60fps ticks
    timelineEngine.tick(timeMs)
  })

  // ─── STOP ───
  ipcMain.handle('lux:playback:stop', () => {
    try {
      timelineEngine.stop()
      return { success: true }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[PlaybackIPC] ❌ Stop failed: ${msg}`)
      return { success: false, error: msg }
    }
  })

  // ─── STATE QUERY ───
  ipcMain.handle('lux:playback:state', () => {
    return timelineEngine.getState()
  })

  console.log('[PlaybackIPC] 🎬 Playback handlers registered (WAVE 2053.1)')
}

// ═══════════════════════════════════════════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════════════════════════════════════════

export function cleanupPlaybackIPC(): void {
  timelineEngine.stop()
  ipcMain.removeHandler('lux:playback:load')
  ipcMain.removeAllListeners('lux:playback:tick')
  ipcMain.removeHandler('lux:playback:stop')
  ipcMain.removeHandler('lux:playback:state')
  console.log('[PlaybackIPC] 🧹 Handlers cleaned up')
}
