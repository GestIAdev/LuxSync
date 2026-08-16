/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎬 PLAYBACK IPC HANDLERS - WAVE 7104: DIRECT TICKER
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * IPC bridge between React (frontend) and TimelineEngine (backend).
 *
 * WAVE 7104: The Main Process is now the SOLE owner of clip execution.
 * When clockMode='external', a high-resolution DirectTicker in Main Process
 * ticks TimelineEngine directly from external timecode (Art-Net/MTC/LTC/MIDI).
 * The renderer's lux:playback:tick is only used for internal (audio) mode.
 *
 * CHANNELS:
 *   lux:playback:load           — Load a ChronosProjectV3 into the engine
 *   lux:playback:tick           — Send current timeMs (internal mode only)
 *   lux:playback:stop           — Stop playback + cleanup
 *   lux:playback:state          — Query engine state
 *   lux:playback:set-clock-mode — Switch between 'internal' and 'external' (WAVE 7104)
 *   lux:playback:external-time  — Forward external timecode to Main Process (WAVE 7104)
 *
 * @module ipc/PlaybackIPCHandlers
 * @version WAVE 7104
 */

import { ipcMain } from 'electron'
import { timelineEngine } from '../../src/core/engine/TimelineEngine'
import { getTitanOrchestrator } from '../../src/core/orchestrator/TitanOrchestrator'
import { universalDMX } from '../../src/hal/drivers/UniversalDMXDriver'
import type { ChronosProjectV3 } from '../../src/chronos/core/LuxFileV3'
import type { BrowserWindow } from 'electron'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface FixtureInstance {
  id: string
  name: string
  type: string
  universe: number
  address: number
  channels?: Array<{
    index: number
    name: string
    type: string
    is16bit: boolean
    defaultValue?: number
  }>
  zone?: string
  position?: any
  capabilities?: any
  // 🛡️ WAVE 3110: VIRTUAL FIXTURE FLAG
  isVirtual?: boolean
  [key: string]: any
}

let mainWindow: BrowserWindow | null = null

// ═══════════════════════════════════════════════════════════════════════════
// 🥁 WAVE 7104: DIRECT TICKER — Main Process owns clip execution
// ═══════════════════════════════════════════════════════════════════════════
//
// When clockMode='external', this ticker runs in Main Process and ticks
// TimelineEngine directly from the last known external timecode value.
// The renderer forwards external time via lux:playback:external-time IPC.
// The ticker extrapolates between updates at ~4ms (250fps) for smoothness.
//
// When clockMode='internal', the renderer's lux:playback:tick is used
// as before (rAF-based, ~60fps).
// ═══════════════════════════════════════════════════════════════════════════

type ClockMode = 'internal' | 'external'

const DIRECT_TICKER_INTERVAL_MS = 4 // 250fps extrapolation

class DirectTicker {
  private mode: ClockMode = 'internal'
  private externalTimeMs = 0
  private lastExternalUpdate = 0
  private intervalHandle: ReturnType<typeof setInterval> | null = null
  private ticking = false

  setMode(mode: ClockMode): void {
    if (this.mode === mode) return
    this.mode = mode
    console.log(`[DirectTicker] 🔄 Clock mode → ${mode}`)

    if (mode === 'external') {
      this.start()
    } else {
      this.stop()
    }
  }

  setExternalTime(timeMs: number): void {
    this.externalTimeMs = timeMs
    this.lastExternalUpdate = performance.now()
  }

  isExternalMode(): boolean {
    return this.mode === 'external'
  }

  private start(): void {
    if (this.ticking) return
    this.ticking = true
    this.lastExternalUpdate = performance.now()
    this.intervalHandle = setInterval(() => {
      this.tick()
    }, DIRECT_TICKER_INTERVAL_MS)
    console.log(`[DirectTicker] ▶️ Started (${DIRECT_TICKER_INTERVAL_MS}ms interval)`)
  }

  private stop(): void {
    if (!this.ticking) return
    this.ticking = false
    if (this.intervalHandle) {
      clearInterval(this.intervalHandle)
      this.intervalHandle = null
    }
    console.log('[DirectTicker] ⏹ Stopped')
  }

  private tick(): void {
    if (!timelineEngine.isPlaying) return

    // Extrapolate external time forward since last update
    const now = performance.now()
    const elapsed = now - this.lastExternalUpdate
    const extrapolatedTime = this.externalTimeMs + elapsed

    timelineEngine.tick(extrapolatedTime)
  }

  dispose(): void {
    this.stop()
    this.externalTimeMs = 0
  }
}

const directTicker = new DirectTicker()

// ═══════════════════════════════════════════════════════════════════════════
// SETUP
// ═══════════════════════════════════════════════════════════════════════════

export function setupPlaybackIPCHandlers(window?: BrowserWindow): void {
  if (window) mainWindow = window

  // ─── LOAD PROJECT ───
  ipcMain.handle('lux:playback:load', (_event, project: ChronosProjectV3) => {
    try {
      timelineEngine.loadProject(project)
      return { success: true, state: timelineEngine.getState() }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[PlaybackIPC] ❌ Load failed: ${msg}`)
      return { success: false, error: msg }
    }
  })

  // ─── TICK (internal mode only — renderer rAF clock) ───
  // WAVE 7104: In external mode, DirectTicker owns the tick. This handler
  // is kept for internal mode and as a fallback.
  ipcMain.on('lux:playback:tick', (_event, timeMs: number) => {
    if (directTicker.isExternalMode()) return // DirectTicker owns the tick
    timelineEngine.tick(timeMs)
  })

  // ─── WAVE 7104: SET CLOCK MODE ───
  ipcMain.on('lux:playback:set-clock-mode', (_event, mode: ClockMode) => {
    directTicker.setMode(mode)
  })

  // ─── WAVE 7104: EXTERNAL TIME FORWARD ───
  // Renderer sends external timecode values (from MTC/LTC/Art-Net/MIDI Clock Slave)
  // The DirectTicker extrapolates between these updates.
  ipcMain.on('lux:playback:external-time', (_event, timeMs: number) => {
    directTicker.setExternalTime(timeMs)
  })

  // ─── STOP ───
  ipcMain.handle('lux:playback:stop', () => {
    try {
      directTicker.setMode('internal')
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

  // ─── FIXTURE SYNC (Frontend → Backend) ───
  ipcMain.on('lux:stage:sync', (_event, fixtures: FixtureInstance[]) => {
    try {
      console.log(`[PlaybackIPC] 🎭 Syncing ${fixtures.length} fixtures to TitanOrchestrator...`)
      
      // Map FixtureInstance to ArbiterFixture format
      const arbiterFixtures = fixtures.map(f => {
        const mapped = {
          id: f.id,
          name: f.name,
          type: f.type,
          dmxAddress: f.address, // FixtureInstance.address → ArbiterFixture.dmxAddress
          universe: f.universe,
          zone: f.zone,
          position: f.position,
          capabilities: f.capabilities,
          channels: f.channels, // 🔥 CRITICAL: Include channels array!
        }
        
        // Debug: Verify channels are present
        if (!f.channels || f.channels.length === 0) {
          console.warn(`[PlaybackIPC] ⚠️ Fixture ${f.id} has NO CHANNELS!`)
        } else {
          console.log(`[PlaybackIPC] ✅ Fixture ${f.id}: ${f.channels.length} channels`)
        }
        
        return mapped
      })
      
      getTitanOrchestrator().setFixtures(arbiterFixtures as any)

      // 🧹 WAVE 3080: PURGA DE SHOW — limpiar buffer del worker DMX.
      // Focos no parcheados en el nuevo show no deben recibir valores del show anterior.
      universalDMX.resetAllWorkerBuffers()

      const totalChannels = arbiterFixtures.reduce((sum, f) => sum + (f.channels?.length || 0), 0)
      console.log(`[PlaybackIPC] ✅ ${fixtures.length} fixtures synced (${totalChannels} total channels)`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`[PlaybackIPC] ❌ Fixture sync failed: ${msg}`)
    }
  })

  // ─── ARBITER OUTPUT FEEDBACK (Backend → Frontend) ───
  // � WAVE 2236: KILLED — This broadcast was 60fps of pure waste.
  // Audit (WAVE 2235) confirmed: window.lux.arbiter.onOutput is exposed in
  // preload.ts but ZERO frontend components ever subscribe to it.
  // 60 serializations/sec crossing IPC bridge for nothing = ~900KB/s garbage.
  // Frontend reads fixture physics from selene:truth (via transientStore).
  // If a future feature needs arbiter output, reactivate with a subscriber check.

  // WAVE 2098: Boot silence
}

// ═══════════════════════════════════════════════════════════════════════════
// CLEANUP
// ═══════════════════════════════════════════════════════════════════════════

export function cleanupPlaybackIPC(): void {
  directTicker.dispose()
  timelineEngine.stop()
  ipcMain.removeHandler('lux:playback:load')
  ipcMain.removeAllListeners('lux:playback:tick')
  ipcMain.removeAllListeners('lux:playback:set-clock-mode')
  ipcMain.removeAllListeners('lux:playback:external-time')
  ipcMain.removeHandler('lux:playback:stop')
  ipcMain.removeHandler('lux:playback:state')
  ipcMain.removeAllListeners('lux:stage:sync')
  mainWindow = null
  console.log('[PlaybackIPC] 🧹 Handlers cleaned up')
}
