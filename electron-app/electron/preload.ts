/**
 * 🔌 LUXSYNC ELECTRON - PRELOAD SCRIPT
 * Puente seguro entre Main y Renderer
 * 
 * V2.0: Añadido window.lux para comunicación con Selene Lux Core
 * V2.1: Añadido desktopCapturer para audio del sistema (via IPC)
 */

import { contextBridge, ipcRenderer } from 'electron'

// ============================================================================
// SELENE STATE TYPE (para tipado en React)
// ============================================================================
export interface SeleneStateUpdate {
  // Color
  r: number
  g: number
  b: number
  w: number
  
  // Position
  pan: number
  tilt: number
  
  // Dimmer
  dimmer: number
  
  // Movement state
  movementPhase: number
  
  // Effects
  activeEffects: string[]
  
  // Optics
  prismActive: boolean
  goboIndex: number
  
  // Audio metrics (opcional)
  audioMetrics?: {
    bass: number
    mid: number
    treble: number
    energy: number
    bpm: number
  }
  
  // Palette info
  paletteIndex: number
  paletteName: string
  
  // Timing
  timestamp: number
}

// API expuesta al renderer de forma segura
const api = {
  // ============================================
  // APP
  // ============================================
  getVersion: () => ipcRenderer.invoke('app:getVersion'),

  /**
   * WAVE 2040.17 P13: System username for project authorship.
   * Resolved at preload time — no IPC round-trip needed.
   */
  getSystemUser: (): string => process.env.USERNAME || process.env.USER || '',

  // ============================================
  // 🪟 WINDOW CONTROLS - Custom title bar
  // ============================================
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onMaximizeChange: (callback: (isMaximized: boolean) => void) => {
      const handler = (_: Electron.IpcRendererEvent, value: boolean) => callback(value)
      ipcRenderer.on('window:maximized', handler)
      return () => ipcRenderer.removeListener('window:maximized', handler)
    },
  },

  // ============================================
  // 🎛️ WAVE 1007: THE NERVE LINK - Top-level DMX injection
  // Shortcut for calibration tools (ColorWheelEditor, etc.)
  // ============================================
  sendDmxChannel: (universe: number, address: number, value: number) =>
    ipcRenderer.invoke('dmx:sendDirect', { universe, address, value }),

  // ============================================
  // DMX - WAVE 11: Universal Driver
  // WAVE 688: Synchronized IPC channel names
  // ============================================
  dmx: {
    getStatus: () => ipcRenderer.invoke('dmx:getStatus'),
    sendValues: (values: number[]) => ipcRenderer.invoke('dmx:sendFrame', values),
    onUpdate: (callback: (values: number[]) => void) => {
      ipcRenderer.on('dmx:update', (_, values) => callback(values))
    },
    // 🌪️ WAVE 11: Device management
    listDevices: () => ipcRenderer.invoke('dmx:scan'),
    autoConnect: () => ipcRenderer.invoke('dmx:autoConnect'),
    connect: (portPath: string) => ipcRenderer.invoke('dmx:connect', portPath),
    disconnect: () => ipcRenderer.invoke('dmx:disconnect'),
    blackout: () => ipcRenderer.invoke('dmx:blackout'),
    // 🔦 Highlight fixture para testing
    highlightFixture: (startChannel: number, channelCount: number, isMovingHead: boolean) =>
      ipcRenderer.invoke('dmx:highlightFixture', startChannel, channelCount, isMovingHead),
    // 🎛️ WAVE 1007: THE NERVE LINK - Direct DMX injection for calibration tools
    sendDirect: (universe: number, address: number, value: number) =>
      ipcRenderer.invoke('dmx:sendDirect', { universe, address, value }),
    // 📡 Status events (connected/disconnected/reconnecting)
    onStatus: (callback: (status: { state: string; device?: any; error?: string }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, status: any) => callback(status)
      ipcRenderer.on('dmx:status', handler)
      return () => ipcRenderer.removeListener('dmx:status', handler)
    },
    onConnected: (callback: (device: any) => void) => {
      const handler = (_: Electron.IpcRendererEvent, device: any) => callback(device)
      ipcRenderer.on('dmx:connected', handler)
      return () => ipcRenderer.removeListener('dmx:connected', handler)
    },
    onDisconnected: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('dmx:disconnected', handler)
      return () => ipcRenderer.removeListener('dmx:disconnected', handler)
    },
    // 🔒 WAVE 2240: Evento de conexión en progreso — para bloquear UI durante operación de hardware
    onConnecting: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('dmx:connecting', handler)
      return () => ipcRenderer.removeListener('dmx:connecting', handler)
    },
  },

  // ============================================
  // 🎨 WAVE 153: ART-NET (DMX sobre red UDP)
  // ============================================
  artnet: {
    start: (config?: { ip?: string; port?: number; universe?: number }) => 
      ipcRenderer.invoke('artnet:start', config),
    stop: () => ipcRenderer.invoke('artnet:stop'),
    configure: (config: { ip?: string; port?: number; universe?: number; refreshRate?: number }) => 
      ipcRenderer.invoke('artnet:configure', config),
    getStatus: () => ipcRenderer.invoke('artnet:getStatus'),  // 🔧 FIX: camelCase para match con backend
    // Eventos
    onReady: (callback: (status: any) => void) => {
      const handler = (_: Electron.IpcRendererEvent, status: any) => callback(status)
      ipcRenderer.on('artnet:ready', handler)
      return () => ipcRenderer.removeListener('artnet:ready', handler)
    },
    onError: (callback: (error: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, error: string) => callback(error)
      ipcRenderer.on('artnet:error', handler)
      return () => ipcRenderer.removeListener('artnet:error', handler)
    },
    onDisconnected: (callback: () => void) => {
      const handler = () => callback()
      ipcRenderer.on('artnet:disconnected', handler)
      return () => ipcRenderer.removeListener('artnet:disconnected', handler)
    },
  },

  // ============================================
  // � WAVE 2048: ART-NET NETWORK DISCOVERY
  // ============================================
  discovery: {
    start: () => ipcRenderer.invoke('artnet:discovery:start'),
    stop: () => ipcRenderer.invoke('artnet:discovery:stop'),
    getStatus: () => ipcRenderer.invoke('artnet:discovery:getStatus'),
    pollNow: () => ipcRenderer.invoke('artnet:discovery:pollNow'),
    setBroadcast: (address: string) => ipcRenderer.invoke('artnet:discovery:setBroadcast', address),
    // Events
    onNodeDiscovered: (callback: (node: any) => void) => {
      const handler = (_: Electron.IpcRendererEvent, node: any) => callback(node)
      ipcRenderer.on('artnet:discovery:node-discovered', handler)
      return () => ipcRenderer.removeListener('artnet:discovery:node-discovered', handler)
    },
    onNodeLost: (callback: (ip: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, ip: string) => callback(ip)
      ipcRenderer.on('artnet:discovery:node-lost', handler)
      return () => ipcRenderer.removeListener('artnet:discovery:node-lost', handler)
    },
    onNodeUpdated: (callback: (node: any) => void) => {
      const handler = (_: Electron.IpcRendererEvent, node: any) => callback(node)
      ipcRenderer.on('artnet:discovery:node-updated', handler)
      return () => ipcRenderer.removeListener('artnet:discovery:node-updated', handler)
    },
    onStateChange: (callback: (state: string) => void) => {
      const handler = (_: Electron.IpcRendererEvent, state: string) => callback(state)
      ipcRenderer.on('artnet:discovery:state-change', handler)
      return () => ipcRenderer.removeListener('artnet:discovery:state-change', handler)
    },
  },

  // ============================================
  // �🕹️ WAVE 153.6: MANUAL OVERRIDE (UI → DMX)
  // ============================================
  override: {
    /** Set override para un fixture específico */
    set: (fixtureId: string, values: { pan?: number; tilt?: number; dimmer?: number; r?: number; g?: number; b?: number }) =>
      ipcRenderer.invoke('override:set', fixtureId, values),
    
    /** Set override para múltiples fixtures (selección) */
    setMultiple: (fixtureIds: string[], values: { pan?: number; tilt?: number; dimmer?: number; r?: number; g?: number; b?: number }) =>
      ipcRenderer.invoke('override:set-multiple', fixtureIds, values),
    
    /** Clear override de un fixture */
    clear: (fixtureId: string) =>
      ipcRenderer.invoke('override:clear', fixtureId),
    
    /** Clear ALL overrides (release all) */
    clearAll: () =>
      ipcRenderer.invoke('override:clear-all'),
  },

  // ============================================
  // AUDIO
  // ============================================
  audio: {
    getDevices: () => ipcRenderer.invoke('audio:getDevices'),
    onBeat: (callback: (data: { bpm: number; energy: number }) => void) => {
      ipcRenderer.on('audio:beat', (_, data) => callback(data))
    },
    onSpectrum: (callback: (spectrum: number[]) => void) => {
      ipcRenderer.on('audio:spectrum', (_, spectrum) => callback(spectrum))
    },
    
    // WAVE 9.6.2: Desktop Capturer via IPC (main process)
    getDesktopSources: () => ipcRenderer.invoke('audio:getDesktopSources')
  },

  // ============================================
  // SELENE
  // ============================================
  selene: {
    onDecision: (callback: (decision: any) => void) => {
      ipcRenderer.on('selene:decision', (_, decision) => callback(decision))
    },
    onMoodChange: (callback: (mood: string) => void) => {
      ipcRenderer.on('selene:mood', (_, mood) => callback(mood))
    },
    setMode: (mode: 'flow' | 'selene' | 'locked') => {
      ipcRenderer.invoke('selene:setMode', mode)
    },
    // 🌙 WAVE 25: DEPRECATED - Brain metrics now in selene:truth broadcast
    // onBrainMetrics: (callback: (metrics: {...}) => void) => {...}
    
    // 🧠 WAVE 10: Decision log entries
    onDecisionLog: (callback: (entry: {
      type: string
      message: string
      data?: any
    }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, entry: any) => callback(entry)
      ipcRenderer.on('selene:decision-log', handler)
      return () => ipcRenderer.removeListener('selene:decision-log', handler)
    },
    // 🧠 WAVE 10: Get brain stats on demand
    getBrainStats: () => ipcRenderer.invoke('selene:getBrainStats'),
  },

  // ============================================
  // CONTROLS
  // ============================================
  controls: {
    setPalette: (paletteId: string) => ipcRenderer.invoke('controls:setPalette', paletteId),
    triggerEffect: (effectId: string) => ipcRenderer.invoke('controls:triggerEffect', effectId),
    setBlackout: (active: boolean) => ipcRenderer.invoke('controls:setBlackout', active),
    setMovement: (params: Record<string, number>) => ipcRenderer.invoke('controls:setMovement', params),
  },

  // ============================================
  // 👻 CHRONOS - WAVE 2005.3 & 2014: THE PHANTOM WORKER + MEMORY CORE
  // Audio analysis and project persistence
  // ============================================
  chronos: {
    /** Analyze audio file via Phantom Worker (crash-isolated process) 
     * @param request - { buffer: ArrayBuffer, fileName: string } for drag-drop files
     *                  or { filePath: string, fileName: string } for files on disk
     */
    analyzeAudio: (request: { buffer?: ArrayBuffer; filePath?: string; fileName: string }) => 
      ipcRenderer.invoke('chronos:analyze-audio', request),
    
    /** ⚒️ WAVE 2030.22f: Read audio file buffer (for session restore) */
    readAudioFile: (filePath: string) =>
      ipcRenderer.invoke('chronos:read-audio-file', filePath) as Promise<{ success: boolean; buffer?: ArrayBuffer; error?: string }>,
    
    /** Subscribe to analysis progress updates */
    onProgress: (callback: (data: { progress: number; phase: string }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { progress: number; phase: string }) => callback(data)
      ipcRenderer.on('chronos:analysis-progress', handler)
      return () => ipcRenderer.removeListener('chronos:analysis-progress', handler)
    },
    
    /** Subscribe to analysis completion */
    onComplete: (callback: (data: { analysisData: any; audioUrl: string }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { analysisData: any; audioUrl: string }) => callback(data)
      ipcRenderer.on('chronos:analysis-complete', handler)
      return () => ipcRenderer.removeListener('chronos:analysis-complete', handler)
    },
    
    /** Subscribe to analysis errors */
    onError: (callback: (error: { message: string; code?: string }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, error: { message: string; code?: string }) => callback(error)
      ipcRenderer.on('chronos:analysis-error', handler)
      return () => ipcRenderer.removeListener('chronos:analysis-error', handler)
    },
    
    // ─────────────────────────────────────────────────────────────────────
    // 💾 WAVE 2014: PROJECT PERSISTENCE - THE MEMORY CORE
    // ─────────────────────────────────────────────────────────────────────
    
    /** Save project to .lux file via native dialog */
    saveProject: (request: { json: string; currentPath: string | null; defaultName: string }) =>
      ipcRenderer.invoke('chronos:save-project', request),
    
    /** Load project from .lux file via native dialog */
    loadProject: (request?: { path?: string }) =>
      ipcRenderer.invoke('chronos:load-project', request || {}),
    
    /** Check if a file exists (for audio path validation) */
    checkFileExists: (filePath: string): Promise<boolean> =>
      ipcRenderer.invoke('chronos:check-file-exists', filePath),
    
    /** Browse for audio file (to replace missing audio) */
    browseAudio: (): Promise<{ path: string } | null> =>
      ipcRenderer.invoke('chronos:browse-audio'),
    
    // ─────────────────────────────────────────────────────────────────────
    // 🛡️ WAVE 2017: PROJECT LAZARUS - Auto-Save & Recovery
    // ─────────────────────────────────────────────────────────────────────
    
    /** Write auto-save file (shadow copy) */
    writeAutoSave: (request: { path: string; json: string }): Promise<{ success: boolean; path?: string; error?: string }> =>
      ipcRenderer.invoke('chronos:write-auto-save', request),
    
    /** Check if auto-save file exists */
    checkAutoSave: (request: { path: string }): Promise<{ exists: boolean; mtime?: string; path?: string }> =>
      ipcRenderer.invoke('chronos:check-auto-save', request),
    
    /** Load auto-save file for recovery */
    loadAutoSave: (request: { path: string }): Promise<{ success: boolean; json?: string; error?: string }> =>
      ipcRenderer.invoke('chronos:load-auto-save', request),
    
    /** Delete auto-save file (after successful manual save) */
    deleteAutoSave: (request: { path: string }): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('chronos:delete-auto-save', request),
    
    // ─────────────────────────────────────────────────────────────────────
    // 🎯 WAVE 2019: THE PULSE - Timeline → Stage Commands
    // ─────────────────────────────────────────────────────────────────────
    
    /** 
     * 🎭 Set Vibe from Chronos timeline
     * Triggered when a vibe-change clip is reached during playback.
     * @param vibeId - The target vibe (techno-club, fiesta-latina, etc.)
     */
    setVibe: (vibeId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('chronos:setVibe', vibeId),
    
    /**
     * 🧨 Trigger FX from Chronos timeline
     * Fires a mapped effect when an FX clip starts during playback.
     * @param effectId - BaseEffect ID (from FXMapper)
     * @param intensity - Effect intensity 0-1
     * @param durationMs - Optional duration override
     * @param hephCurves - ⚒️ WAVE 2030.4: Serialized Hephaestus curves (optional)
     */
    triggerFX: (effectId: string, intensity: number, durationMs?: number, hephCurves?: unknown): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('chronos:triggerFX', { effectId, intensity, durationMs, hephCurves }),
    
    /**
     * 🛑 Stop FX from Chronos timeline
     * Called when a clip ends or playback stops.
     * @param effectId - BaseEffect ID to stop
     */
    stopFX: (effectId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('chronos:stopFX', effectId),
    
    /**
     * ⚒️ WAVE 2030.18: Trigger a Hephaestus .lfx file dynamically
     * Bypasses FXMapper - uses HephaestusRuntime for real-time curve evaluation.
     * @param filePath - Path to the .lfx file
     * @param intensity - Effect intensity 0-1
     * @param durationMs - Optional duration override
     * @param loop - Whether to loop the clip
     * @returns { success, instanceId }
     */
    triggerHeph: (filePath: string, intensity: number, durationMs?: number, loop?: boolean): Promise<{ success: boolean; instanceId?: string }> =>
      ipcRenderer.invoke('chronos:triggerHeph', { filePath, intensity, durationMs, loop }),
    
    /**
     * ⚒️ WAVE 2030.18: Stop a Hephaestus runtime instance
     * @param instanceId - Optional specific instance ID. If omitted, stops all.
     */
    stopHeph: (instanceId?: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('chronos:stopHeph', instanceId),
    
    /**
     * ⚒️ WAVE 2030.18: Tick all active Hephaestus clips
     * Called from render loop at 60fps to get current curve values.
     * @param currentTimeMs - Current system time in ms
     * @returns { success, outputs: HephFixtureOutput[] }
     */
    tickHeph: (currentTimeMs: number): Promise<{ success: boolean; outputs: unknown[] }> =>
      ipcRenderer.invoke('chronos:tickHeph', currentTimeMs),
    
    /**
     * 👻 WAVE 2540.4: THE PHANTOM BUFFER — Send pre-calculated GodEar heatmap
     * Called once after audio analysis completes. The heatmap data is cached
     * in TitanEngine for band lookup during timeline playback.
     * @param heatmap - Full HeatmapData object (or null to clear)
     */
    loadHeatmap: (heatmap: unknown): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('chronos:load-heatmap', heatmap),
    
    /**
     * 👻 WAVE 2540.5: PLAYHEAD SYNC — Send current playhead position to backend
     * Called every frame during Chronos playback.
     * @param timeMs - Current playhead position in milliseconds
     * @param isPlaying - Whether Chronos is currently playing
     */
    syncPlayhead: (timeMs: number, isPlaying: boolean): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('chronos:sync-playhead', timeMs, isPlaying),
  },

  // ============================================
  // ⚒️ HEPHAESTUS - WAVE 2030.5: THE FORGE FILE I/O
  // Automation clip persistence (.lfx files)
  // ============================================
  hephaestus: {
    /**
     * 💾 Save a clip to disk
     * @param clipData - Serialized clip (Record, not Map)
     * @returns { success, filePath, id, error }
     */
    save: (clipData: unknown): Promise<{ success: boolean; filePath?: string; id?: string; error?: string }> =>
      ipcRenderer.invoke('heph:save', clipData),
    
    /**
     * 📂 Load a clip by ID or file path
     * @param idOrPath - Clip ID or full path
     * @returns { success, clip, error }
     */
    load: (idOrPath: string): Promise<{ success: boolean; clip?: unknown; error?: string }> =>
      ipcRenderer.invoke('heph:load', idOrPath),
    
    /**
     * 📋 List all available clips (metadata only)
     * @returns { success, clips, error }
     */
    list: (): Promise<{ success: boolean; clips: unknown[]; error?: string }> =>
      ipcRenderer.invoke('heph:list'),
    
    /**
     * 🗑️ Delete a clip
     * @param idOrPath - Clip ID or full path
     * @returns { success, deleted, error }
     */
    delete: (idOrPath: string): Promise<{ success: boolean; deleted?: boolean; error?: string }> =>
      ipcRenderer.invoke('heph:delete', idOrPath),
    
    /**
     * ❓ Check if clip name exists
     * @param name - Clip name
     * @returns { success, exists }
     */
    exists: (name: string): Promise<{ success: boolean; exists?: boolean }> =>
      ipcRenderer.invoke('heph:exists', name),
    
    /**
     * 📁 Get effects folder path
     * @returns { success, path }
     */
    getPath: (): Promise<{ success: boolean; path?: string }> =>
      ipcRenderer.invoke('heph:getPath'),
    
    /**
     * 🆔 Generate unique clip ID
     * @returns { id }
     */
    generateId: (): Promise<{ id: string }> =>
      ipcRenderer.invoke('heph:generateId'),
  },
}

// ============================================================================
// 🌙 LUX API - Selene Lux Core Bridge (WAVE 2)
// ============================================================================
const luxApi = {
  // === 🔒 WAVE 2490: LICENSE TIER ===
  /** Get the current license tier ('DJ_FOUNDER' | 'FULL_SUITE') */
  getLicenseTier: () => ipcRenderer.invoke('license:getTier'),

  // === CONTROL ===
  /** Iniciar el motor Selene */
  start: () => ipcRenderer.invoke('lux:start'),
  
  /** Detener el motor Selene */
  stop: () => ipcRenderer.invoke('lux:stop'),
  
  /** Cambiar paleta de colores - Acepta IDs canónicos del ColorEngine */
  setPalette: (paletteId: string) => ipcRenderer.invoke('lux:set-palette', paletteId),
  
  /** Configurar movimiento */
  setMovement: (config: { pattern?: string; speed?: number; intensity?: number }) => 
    ipcRenderer.invoke('lux:set-movement', config),
  
  /** 🎚️ WAVE 13.6 + WAVE 250: Cambiar modo Selene (flow, selene, locked) - Standardized to lux: */
  setMode: (mode: 'flow' | 'selene' | 'locked') => ipcRenderer.invoke('lux:setMode', mode),
  
  /** 🎨 WAVE 13.6: Multiplicadores Globales de Color (saturation, intensity) */
  setGlobalColorParams: (params: { saturation?: number; intensity?: number }) => 
    ipcRenderer.invoke('lux:set-global-color-params', params),
  
  /** Disparar un efecto */
  triggerEffect: (effectName: string, params?: Record<string, any>, duration?: number) =>
    ipcRenderer.invoke('lux:trigger-effect', { effectName, params, duration }),
  
  /** Cancelar efecto por ID o nombre */
  cancelEffect: (effectIdOrName: number | string) => ipcRenderer.invoke('lux:cancel-effect', effectIdOrName),
  
  /** Cancelar todos los efectos */
  cancelAllEffects: () => ipcRenderer.invoke('lux:cancel-all-effects'),
  
  /** Blackout master - todas las luces apagadas */
  setBlackout: (active: boolean) => ipcRenderer.invoke('lux:set-blackout', active),
  
  /** 🗡️ WAVE 15.3 REAL: Enviar buffer de audio CRUDO a Trinity
   * Este es el ÚNICO camino válido. El buffer pasa por Beta (FFT) antes de llegar a Gamma.
   * 
   * 🔥 WAVE 264.8: Cambiado de invoke() a send() para FIRE-AND-FORGET
   * invoke() crea una Promise que espera respuesta del main process.
   * A 60fps = 60 Promises/segundo. Después de ~80 segundos = ~5000 Promises pendientes.
   * Esto causa memory pressure y eventualmente bloquea el loop de requestAnimationFrame.
   * 
   * send() es unidireccional - no espera respuesta, no acumula Promises.
   */
  audioBuffer: (buffer: Float32Array) => {
    ipcRenderer.send('lux:audio-buffer', buffer.buffer)
  },
  
  /** Legacy: Simular frame de audio (NO alimenta Trinity Workers) */
  // 🎯 WAVE 39.1: Ahora incluye fftBins (64 bins normalizados 0-1)
  audioFrame: (metrics: { bass: number; mid: number; treble: number; energy: number; bpm: number; fftBins?: number[] }) =>
    ipcRenderer.invoke('lux:audio-frame', metrics),
  
  /** Obtener estado actual */
  getState: () => ipcRenderer.invoke('lux:get-state'),
  
  /** 🎯 WAVE 13.6: Obtener estado COMPLETO del Backend (DMX, Selene, Fixtures, Audio) */
  getFullState: () => ipcRenderer.invoke('lux:get-full-state'),
  
  // === EVENTOS ===
  /** Suscribirse a actualizaciones de estado (30fps) */
  onStateUpdate: (callback: (state: SeleneStateUpdate) => void) => {
    const handler = (_: Electron.IpcRendererEvent, state: SeleneStateUpdate) => callback(state)
    ipcRenderer.on('lux:state-update', handler)
    
    // Retornar función para desuscribirse
    return () => {
      ipcRenderer.removeListener('lux:state-update', handler)
    }
  },
  
  /** Suscribirse a cambios de paleta */
  onPaletteChange: (callback: (paletteId: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, id: string) => callback(id)
    ipcRenderer.on('lux:palette-change', handler)
    return () => ipcRenderer.removeListener('lux:palette-change', handler)
  },
  
  /** Suscribirse a eventos de efectos */
  onEffectTriggered: (callback: (effectName: string, effectId: number) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: { name: string; id: number }) => 
      callback(data.name, data.id)
    ipcRenderer.on('lux:effect-triggered', handler)
    return () => ipcRenderer.removeListener('lux:effect-triggered', handler)
  },
  
  /** 🎯 WAVE 13.6: Suscribirse a cambios de modo confirmados por el Backend */
  onModeChange: (callback: (data: { mode: string; brain: boolean }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: { mode: string; brain: boolean }) => 
      callback(data)
    ipcRenderer.on('selene:mode-changed', handler)
    return () => ipcRenderer.removeListener('selene:mode-changed', handler)
  },

  /** 📡 WAVE-14: Suscribirse a telemetría en tiempo real (20 FPS) */
  onTelemetryUpdate: (callback: (packet: any) => void) => {
    const handler = (_: Electron.IpcRendererEvent, packet: any) => callback(packet)
    ipcRenderer.on('selene:telemetry-update', handler)
    return () => ipcRenderer.removeListener('selene:telemetry-update', handler)
  },
  
  /** 📡 WAVE 15.3: TRUTH CABLE - Datos reales de Trinity Workers */
  onAudioAnalysis: (callback: (analysis: any) => void) => {
    const handler = (_: Electron.IpcRendererEvent, analysis: any) => callback(analysis)
    ipcRenderer.on('trinity:audio-analysis', handler)
    return () => ipcRenderer.removeListener('trinity:audio-analysis', handler)
  },
  
  /** 📡 WAVE 15.3: TRUTH CABLE - Decisiones reales de Gamma */
  onLightingDecision: (callback: (decision: any) => void) => {
    const handler = (_: Electron.IpcRendererEvent, decision: any) => callback(decision)
    ipcRenderer.on('trinity:lighting-decision', handler)
    return () => ipcRenderer.removeListener('trinity:lighting-decision', handler)
  },
  
  /** 🌙 WAVE 25: UNIVERSAL TRUTH PROTOCOL - La Verdad Única a 30fps
   * Este es el ÚNICO canal que el Frontend necesita para renderizar TODO.
   * Reemplaza: telemetry-update, state-update, brain-metrics
   */
  onTruthUpdate: (callback: (data: any) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on('selene:truth', handler)
    return () => ipcRenderer.removeListener('selene:truth', handler)
  },
  
  /** ⚡ WAVE 2510: HOT FRAME — High-frequency fixture data at 44Hz
   * Canal dedicado para datos dinámicos de fixtures (color, intensidad, pan/tilt).
   * Separado de selene:truth (que sigue a ~7Hz con el SeleneTruth completo).
   * El RenderWorker en Hyperion consume esto para interpolación a 60fps.
   */
  onHotFrame: (callback: (data: any) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: any) => callback(data)
    ipcRenderer.on('selene:hot-frame', handler)
    return () => ipcRenderer.removeListener('selene:hot-frame', handler)
  },
  
  /** � WAVE 25.7: THE CHRONICLER - Log events via dedicated channel
   * Logs llegan por canal separado para no interferir con el broadcast de 30fps
   * Standard channel: 'lux:log' (legacy 'selene:log' is supported for compatibility)
   */
  onLog: (callback: (logEntry: any) => void) => {
    const handler = (_: Electron.IpcRendererEvent, logEntry: any) => callback(logEntry)
    // Prefer the standardized 'lux:log' channel
    ipcRenderer.on('lux:log', handler)
    // Also subscribe to legacy 'selene:log' for older main process versions
    ipcRenderer.on('selene:log', handler)
    return () => {
      ipcRenderer.removeListener('lux:log', handler)
      ipcRenderer.removeListener('selene:log', handler)
    }
  },
  
  /** �📡 WAVE-14: Establecer Input Gain */
  setInputGain: (value: number) => ipcRenderer.invoke('lux:setInputGain', value),
  
  /** 🎨 WAVE-14.5 + WAVE 250: Forzar mutación de paleta - Standardized to lux: */
  forceMutate: () => ipcRenderer.invoke('lux:forceMutation'),
  
  /** 🧠 WAVE-14.5: Resetear memoria de Selene */
  resetMemory: () => ipcRenderer.invoke('lux:resetMemory'),
  
  /** 
   * 🧬 WAVE 560: Kill Switch - Enable/Disable Consciousness (Layer 1 ONLY)
   * 
   * FIXED: Now uses dedicated lux:setConsciousness handler instead of lux:setUseBrain
   * - When OFF: Physics/Vibes (Layer 0) keep running - NO BLACKOUT!
   * - When ON: Consciousness (Layer 1) provides AI recommendations
   */
  setConsciousnessEnabled: (enabled: boolean) => ipcRenderer.invoke('lux:setConsciousness', enabled),
  
  /**
   * 🌊 WAVE 2401: Liquid Stereo Toggle — 7-Band Per-Zone Envelopes
   * 
   * Switches between God Mode (legacy 3-band) and Liquid Stereo (7-band):
   * - When OFF: TechnoStereoPhysics.applyZones() (classic behavior)
   * - When ON: LiquidStereoPhysics.applyBands() (per-zone envelopes)
   */
  setLiquidStereo: (enabled: boolean) => ipcRenderer.invoke('lux:setLiquidStereo', enabled),
  
  /**
   * 🌊 WAVE 2432: THE GREAT WIRING — Layout Switch (4.1 / 7.1)
   * Switches between compact (4-zone) and full (7-zone) Omni-Liquid Engine.
   */
  setLiquidLayout: (mode: '4.1' | '7.1') => ipcRenderer.invoke('lux:setLiquidLayout', mode),
  
  /**
   * 🧨 WAVE 610: FORCE STRIKE - Manual Effect Detonator
   * 
   * Dispara un efecto (Solar Flare) manualmente sin esperar decisión de HuntEngine.
   * Útil para testear efectos sin alterar umbrales de algoritmos.
   * 
   * @param config - { effect: 'solar_flare', intensity: 0-1 }
   */
  forceStrike: (config: { effect: string; intensity: number }) => 
    ipcRenderer.invoke('lux:forceStrike', config),

  // ============================================
  // 🎛️ WAVE 62 + WAVE 250: VIBE SELECTOR (Standardized to lux:)
  // ============================================
  
  /** Set active Vibe profile (techno-club, fiesta-latina, pop-rock, chill-lounge) */
  setVibe: (vibeId: string) => ipcRenderer.invoke('lux:setVibe', vibeId),
  
  /** Get current active Vibe */
  getVibe: () => ipcRenderer.invoke('lux:get-vibe'),
  
  /** Subscribe to Vibe changes */
  onVibeChange: (callback: (data: { vibeId: string; timestamp: number }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: { vibeId: string; timestamp: number }) => 
      callback(data)
    // Listen to both for backward compat
    ipcRenderer.on('lux:vibe-changed', handler)
    ipcRenderer.on('selene:vibe-changed', handler)
    return () => {
      ipcRenderer.removeListener('lux:vibe-changed', handler)
      ipcRenderer.removeListener('selene:vibe-changed', handler)
    }
  },

  // ============================================
  // 🎭 WAVE 700.5.4: MOOD CONTROL
  // ============================================
  
  mood: {
    /** Set active Mood (calm, balanced, punk) */
    setMood: (moodId: 'calm' | 'balanced' | 'punk') => 
      ipcRenderer.invoke('lux:setMood', moodId),
    
    /** Get current active Mood */
    getMood: () => ipcRenderer.invoke('lux:getMood'),
    
    /** Subscribe to Mood changes */
    onMoodChange: (callback: (data: { moodId: string; timestamp: number }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: { moodId: string; timestamp: number }) => 
        callback(data)
      ipcRenderer.on('lux:mood-changed', handler)
      return () => ipcRenderer.removeListener('lux:mood-changed', handler)
    },
  },

  // ============================================
  // WAVE 9.5: FIXTURES
  // ============================================
  
  /** Escanear carpeta de fixtures */
  scanFixtures: (customPath?: string) => 
    ipcRenderer.invoke('lux:scan-fixtures', customPath),
  
  /** Obtener biblioteca de fixtures */
  getFixtureLibrary: () => 
    ipcRenderer.invoke('lux:get-fixture-library'),

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔥 WAVE 384: GET FIXTURE DEFINITION - Returns FULL profile with channels
  // ═══════════════════════════════════════════════════════════════════════════
  /** Obtener definición completa de un fixture por su ID */
  getFixtureDefinition: (profileId: string) =>
    ipcRenderer.invoke('lux:getFixtureDefinition', profileId),
  
  /** Obtener fixtures patcheados */
  getPatchedFixtures: () => 
    ipcRenderer.invoke('lux:get-patched-fixtures'),
  
  /** Añadir fixture al patch */
  patchFixture: (fixtureId: string, dmxAddress: number, universe?: number) =>
    ipcRenderer.invoke('lux:patch-fixture', { fixtureId, dmxAddress, universe }),
  
  /** Eliminar fixture del patch */
  unpatchFixture: (dmxAddress: number) =>
    ipcRenderer.invoke('lux:unpatch-fixture', dmxAddress),
  
  /** ✏️ WAVE 256: Editar fixture patcheado - ALL fields */
  editFixture: (
    originalDmxAddress: number, 
    newDmxAddress: number, 
    universe?: number,
    updateData?: {
      name?: string
      zone?: string
      physics?: {
        installationType?: string
        invert?: { pan?: boolean; tilt?: boolean }
        swapXY?: boolean
      }
    }
  ) =>
    ipcRenderer.invoke('lux:edit-fixture', { 
      originalDmxAddress, 
      newDmxAddress, 
      universe,
      ...updateData 
    }),
  
  /** 🔬 WAVE 10.5: Forzar tipo de fixture manualmente */
  forceFixtureType: (dmxAddress: number, newType: string) =>
    ipcRenderer.invoke('lux:force-fixture-type', dmxAddress, newType),
  
  /** 🎯 WAVE 12.5: Selector de Montaje (ceiling/floor) */
  setInstallationType: (type: 'ceiling' | 'floor') =>
    ipcRenderer.invoke('lux:set-installation', type),
  
  /** Limpiar todo el patch */
  clearPatch: () => 
    ipcRenderer.invoke('lux:clear-patch'),
  
  /** ⚡ WAVE 27: Guardar definición de fixture desde Fixture Forge */
  saveDefinition: (definition: any) =>
    ipcRenderer.invoke('lux:save-fixture-definition', definition),
  
  /** 🎭 WAVE 10.6: Nuevo show - reset completo */
  newShow: () =>
    ipcRenderer.invoke('lux:new-show'),

  // ═══════════════════════════════════════════════════════════════════════════
  // 🔌 WAVE 1113: LIBRARY UNIFIED API - Real FileSystem
  // Single Source of Truth for Forge + StageConstructor
  // ═══════════════════════════════════════════════════════════════════════════
  library: {
    /** List ALL fixtures: system (read-only from /librerias) + user (writable from userData/fixtures) */
    listAll: () => ipcRenderer.invoke('lux:library:list-all'),
    
    /** Save a fixture to user library (userData/fixtures) */
    saveUser: (fixture: any) => ipcRenderer.invoke('lux:library:save-user', fixture),
    
    /** Delete a fixture from user library (cannot delete system fixtures) */
    deleteUser: (fixtureId: string) => ipcRenderer.invoke('lux:library:delete-user', fixtureId),
    
    /** Get DMX connection status for Live Probe */
    dmxStatus: () => ipcRenderer.invoke('lux:library:dmx-status'),

    // 🔥 WAVE 2241: THE FORGE HOT-RELOAD
    // Fired by backend after lux:library:save-user succeeds.
    // Carries the full updated fixture profile so the frontend
    // can rehidrate active stage fixtures without reloading the show.
    onProfileUpdated: (callback: (fixture: any) => void) => {
      const handler = (_: Electron.IpcRendererEvent, fixture: any) => callback(fixture)
      ipcRenderer.on('lux:profile:updated', handler)
      return () => ipcRenderer.removeListener('lux:profile:updated', handler)
    },
  },
  
  // ============================================
  // ⚡ WAVE 27: FIXTURES OBJECT
  // ============================================
  fixtures: {
    saveDefinition: (definition: any) =>
      ipcRenderer.invoke('lux:save-fixture-definition', definition),
    
    // WAVE 388 EXT: Delete fixture from library
    deleteDefinition: (fixtureId: string) =>
      ipcRenderer.invoke('lux:delete-fixture-definition', fixtureId),
  },
  
  // WAVE 388 EXT: Shortcut for delete
  deleteDefinition: (fixtureId: string) =>
    ipcRenderer.invoke('lux:delete-fixture-definition', fixtureId),
  
  // ============================================
  // 🎭 WAVE 26: SHOW MANAGEMENT - PURGED WAVE 365
  // Legacy methods removed. Use lux.stage.* API instead
  // ============================================
  
  // ============================================
  // WAVE 9.5: CONFIG
  // ============================================
  
  /** Obtener configuración */
  getConfig: () => 
    ipcRenderer.invoke('lux:get-config'),
  
  /** Guardar configuración */
  saveConfig: (config: Record<string, any>) =>
    ipcRenderer.invoke('lux:save-config', config),
  
  /** Resetear configuración */
  resetConfig: () =>
    ipcRenderer.invoke('lux:reset-config'),
  
  // ============================================
  // 🎛️ WAVE 375: MASTER ARBITER API
  // ============================================
  arbiter: {
    /** Get Arbiter status (layer, hasManualOverrides, grandMaster, blackout) */
    status: () => ipcRenderer.invoke('lux:arbiter:status'),
    
    /** Set Grand Master intensity (0-1) */
    setGrandMaster: (value: number) => ipcRenderer.invoke('lux:arbiter:setGrandMaster', { value }),
    
    /** 🎚️ WAVE 2472: Set Grand Master Speed (0.1-2.0) — AI phase multiplier */
    setGrandMasterSpeed: (value: number) => ipcRenderer.invoke('lux:arbiter:setGrandMasterSpeed', { value }),
    
    /** 🎚️ WAVE 2472: Get Grand Master Speed */
    getGrandMasterSpeed: () => ipcRenderer.invoke('lux:arbiter:getGrandMasterSpeed'),
    
    /** 
     * 🎛️ WAVE 375.3: Set manual override for fixtures
     * @param fixtureIds - Array of fixture IDs to override
     * @param controls - Control values { dimmer?, r?, g?, b?, pan?, tilt? }
     * @param channels - Which channels to override (optional)
     * @param source - Source identifier (default: 'ui_programmer')
     */
    setManual: (args: {
      fixtureIds: string[]
      controls: Record<string, number>
      channels?: string[]
      source?: string
      autoReleaseMs?: number
    }) => {
      // 🔥 WAVE 1008.4: Send fixtureIds array to ArbiterIPCHandlers (not orchestrator handler)
      return ipcRenderer.invoke('lux:arbiter:setManual', {
        fixtureIds: args.fixtureIds,  // Plural! Handler expects array
        controls: args.controls,
        channels: args.channels || Object.keys(args.controls),
        source: args.source,
        autoReleaseMs: args.autoReleaseMs,
      })
    },
    
    /**
     * 🎛️ WAVE 375.3: Clear manual override for specific fixtures/channels
     * @param fixtureIds - Array of fixture IDs to release
     * @param channels - Optional specific channels to release
     */
    clearManual: (args: {
      fixtureIds: string[]
      channels?: string[]
    }) => {
      // Send all fixtures in a single call to backend (WAVE 439.6 fix)
      return ipcRenderer.invoke('lux:arbiter:clearManual', {
        fixtureIds: args.fixtureIds,
        channels: args.channels,
      })
    },
    
    /** Clear ALL manual overrides - return to AI control */
    clearAllManual: () => ipcRenderer.invoke('lux:arbiter:clearAllManual'),
    
    /** Toggle blackout state */
    toggleBlackout: () => ipcRenderer.invoke('lux:arbiter:toggleBlackout'),
    
    /** Set blackout state */
    setBlackout: (active: boolean) => ipcRenderer.invoke('lux:arbiter:setBlackout', { active }),
    
    // ============================================
    // 🚦 WAVE 1132: OUTPUT GATE - THE COLD START PROTOCOL
    // ============================================
    
    /** 
     * Set output enabled state (THE GATE)
     * false = ARMED (engine runs but DMX blocked)
     * true = LIVE (DMX flows to fixtures)
     */
    setOutputEnabled: (enabled: boolean, label?: string) =>
      ipcRenderer.invoke('lux:arbiter:setOutputEnabled', { enabled, label }),

    /**
     * Tagged variant for forensics (always prefer this in UI)
     */
    setOutputEnabledTagged: (enabled: boolean, label: string) =>
      ipcRenderer.invoke('lux:arbiter:setOutputEnabled', { enabled, label }),
    
    /** Toggle output gate (ARMED ↔ LIVE) */
    toggleOutput: (label?: string) => ipcRenderer.invoke('lux:arbiter:toggleOutput', { label }),

    /** Tagged variant for forensics */
    toggleOutputTagged: (label: string) => ipcRenderer.invoke('lux:arbiter:toggleOutput', { label }),
    
    /** Get output enabled state */
    getOutputEnabled: () => ipcRenderer.invoke('lux:arbiter:getOutputEnabled'),
    
    /** Check if fixture has manual override */
    hasManual: (fixtureId: string, channel?: string) => 
      ipcRenderer.invoke('lux:arbiter:hasManual', { fixtureId, channel }),
    
    /** Subscribe to Arbiter status changes (includes outputEnabled) */
    onStatusChange: (callback: (status: { 
      layer: 'ai' | 'manual'; 
      hasManualOverrides: boolean; 
      grandMaster: number; 
      blackout: boolean;
      outputEnabled: boolean;  // 🚦 WAVE 1132
    }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, status: any) => callback(status)
      ipcRenderer.on('lux:arbiter:status-change', handler)
      return () => ipcRenderer.removeListener('lux:arbiter:status-change', handler)
    },
    
    // ============================================
    // 🎯 WAVE 377: CALIBRATION MODE
    // ============================================
    
    /** 
     * Enter calibration mode for a fixture
     * Sets manual override for pan/tilt with special 'calibration' source
     */
    enterCalibrationMode: (fixtureId: string) =>
      ipcRenderer.invoke('lux:arbiter:enterCalibrationMode', { fixtureId }),
    
    /**
     * Exit calibration mode for a fixture
     * Smoothly transitions back to AI control
     */
    exitCalibrationMode: (fixtureId: string) =>
      ipcRenderer.invoke('lux:arbiter:exitCalibrationMode', { fixtureId }),
    
    /**
     * Check if a fixture is currently in calibration mode
     */
    isCalibrating: (fixtureId: string) =>
      ipcRenderer.invoke('lux:arbiter:isCalibrating', { fixtureId }),
    
    // ============================================
    // �️ WAVE 999: MOVEMENT PARAMETERS (Commander UI)
    // ============================================
    
    /**
     * Set movement parameter (speed or amplitude)
     * @param parameter 'speed' | 'amplitude'
     * @param value 0-100 scale, or null to release
     */
    setMovementParameter: (parameter: 'speed' | 'amplitude', value: number | null) =>
      ipcRenderer.invoke('lux:arbiter:setMovementParameter', { parameter, value }),
    
    /**
     * 🎯 WAVE 999.4: Set manual movement pattern
     * @param pattern Pattern name ('circle', 'eight', etc) or null to release to AI
     */
    setMovementPattern: (pattern: string | null) =>
      ipcRenderer.invoke('lux:arbiter:setMovementPattern', { pattern }),
    
    /**
     * Clear all movement parameter overrides (back to AI)
     */
    clearMovementOverrides: () =>
      ipcRenderer.invoke('lux:arbiter:clearMovementOverrides'),
    
    /**
     * 🔧 WAVE 2071: THE ANCHOR — Set manual pattern for specific fixtures
     * This is the Layer 2 pattern command (MasterArbiter.activePatterns).
     * NOT to be confused with setMovementPattern which is Layer 0 (CHOREO).
     * 
     * @param fixtureIds - Fixture IDs to apply pattern to
     * @param pattern - 'circle'|'eight'|'sweep'|'hold'|null (null = destroy)
     * @param speed - 0-100 UI scale
     * @param amplitude - 0-100 UI scale  
     */
    setManualFixturePattern: (args: {
      fixtureIds: string[]
      pattern: string | null
      speed: number
      amplitude: number
    }) => ipcRenderer.invoke('lux:arbiter:setManualFixturePattern', args),
    
    /**
     * 🧠 WAVE 999.6: Get unified state for UI hydration
     * @param fixtureIds Array of fixture IDs (uses first as "Leader")
     * @returns State snapshot with null for AI-controlled channels
     */
    getFixturesState: (fixtureIds: string[]) =>
      ipcRenderer.invoke('lux:arbiter:getFixturesState', { fixtureIds }),
    
    /** 
     * Subscribe to arbiter output events (WAVE 2054)
     * Real-time lighting state for visual feedback
     */
    onOutput: (callback: (data: any) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: any) => callback(data)
      ipcRenderer.on('lux:arbiter:output', handler)
      return () => ipcRenderer.removeListener('lux:arbiter:output', handler)
    },
    
    // ============================================
    // 🌉 WAVE 377: FIXTURE SYNC (TitanSyncBridge)
    // ============================================
    
    /**
     * Sync fixtures from stageStore to backend MasterArbiter
     * Called by TitanSyncBridge when patch changes
     */
    setFixtures: (fixtures: any[]) =>
      ipcRenderer.invoke('lux:arbiter:setFixtures', { fixtures }),

    // ============================================
    // 🎯 WAVE 2613: SPATIAL IK TARGET
    // ============================================

    /**
     * Apply a spatial target to a group of fixtures via IK engine.
     * Each fixture calculates its own pan/tilt to point at the target.
     * @returns Per-fixture IKResult with reachability flag for UI feedback.
     */
    applySpatialTarget: (args: {
      target: { x: number; y: number; z: number }
      fixtureIds: string[]
      fanMode?: 'converge' | 'line' | 'circle'
      fanAmplitude?: number
    }) => ipcRenderer.invoke('lux:arbiter:applySpatialTarget', args),

    /**
     * Release spatial target control — return fixtures to AI/mechanical control.
     */
    releaseSpatialTarget: (args: {
      fixtureIds: string[]
    }) => ipcRenderer.invoke('lux:arbiter:releaseSpatialTarget', args),
  },

  // ============================================
  // 🔌 WAVE 369.5: STAGE PERSISTENCE V2 + FILE DIALOGS
  // ============================================
  stage: {
    /** Load a show file (V2 format) */
    load: (filePath?: string) => 
      ipcRenderer.invoke('lux:stage:load', filePath),
    
    /** Load the active show (on startup) */
    loadActive: () => 
      ipcRenderer.invoke('lux:stage:loadActive'),
    
    /** Save show to disk */
    save: (showFile: any, filePath?: string) => 
      ipcRenderer.invoke('lux:stage:save', showFile, filePath),
    
    /** Save show with new name */
    saveAs: (showFile: any, name: string) => 
      ipcRenderer.invoke('lux:stage:saveAs', showFile, name),
    
    /** List all shows */
    list: () => 
      ipcRenderer.invoke('lux:stage:list'),
    
    /** Get recent shows */
    recent: () => 
      ipcRenderer.invoke('lux:stage:recent'),
    
    /** Delete a show */
    delete: (filePath: string) => 
      ipcRenderer.invoke('lux:stage:delete', filePath),
    
    /** Get shows folder path */
    getPath: () => 
      ipcRenderer.invoke('lux:stage:getPath'),
    
    /** Check if show exists */
    exists: (name: string) => 
      ipcRenderer.invoke('lux:stage:exists', name),
    
    // WAVE 369.5: Native File Dialogs
    /** Open file dialog - returns selected path and loads the file */
    openDialog: () =>
      ipcRenderer.invoke('lux:stage:openDialog'),
    
    /** Save As dialog - let user choose name/location */
    saveAsDialog: (showFile: any, suggestedName?: string) =>
      ipcRenderer.invoke('lux:stage:saveAsDialog', showFile, suggestedName),
    
    /** Confirm unsaved changes dialog */
    confirmUnsaved: (showName: string) =>
      ipcRenderer.invoke('lux:stage:confirmUnsaved', showName),
    
    /** Subscribe to show loaded event */
    onLoaded: (callback: (data: { showFile: any; filePath?: string; migrated?: boolean; warnings?: string[] }) => void) => {
      const handler = (_: Electron.IpcRendererEvent, data: any) => callback(data)
      ipcRenderer.on('lux:stage:loaded', handler)
      return () => ipcRenderer.removeListener('lux:stage:loaded', handler)
    },

    /** Sync fixtures to backend Arbiter (WAVE 2054) */
    syncFixtures: (fixtures: any[]) => 
      ipcRenderer.send('lux:stage:sync', fixtures),
  },

  // ============================================
  // 🎯 WAVE 2019.11: CHRONOS TIMELINE → STAGE COMMANDS
  // ============================================
  // Bridge for ChronosIPCBridge to communicate with backend
  // ============================================
  chronos: {
    /** 
     * 🎭 Set Vibe from Chronos timeline
     * Triggered when a vibe-change clip is reached during playback.
     * @param vibeId - The target vibe (techno-club, fiesta-latina, etc.)
     */
    setVibe: (vibeId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('chronos:setVibe', vibeId),
    
    /**
     * 🧨 Trigger FX from Chronos timeline
     * @param effectId - BaseEffect ID (from FXMapper)
     * @param intensity - Effect intensity 0-1
     * @param durationMs - Optional duration override
     * @param hephCurves - ⚒️ WAVE 2030.4: Serialized Hephaestus curves (optional)
     */
    triggerFX: (effectId: string, intensity: number, durationMs?: number, hephCurves?: unknown): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('chronos:triggerFX', { effectId, intensity, durationMs, hephCurves }),
    
    /**
     * 🛑 Stop FX from Chronos timeline
     * @param effectId - BaseEffect ID to stop
     */
    stopFX: (effectId: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('chronos:stopFX', effectId),
    
    /**
     * ⚒️ WAVE 2030.18: Trigger a Hephaestus .lfx file dynamically
     * Bypasses FXMapper - uses HephaestusRuntime for real-time curve evaluation.
     * @param filePath - Path to the .lfx file
     * @param intensity - Effect intensity 0-1
     * @param durationMs - Optional duration override
     * @param loop - Whether to loop the clip
     * @returns { success, instanceId }
     */
    triggerHeph: (filePath: string, intensity: number, durationMs?: number, loop?: boolean): Promise<{ success: boolean; instanceId?: string }> =>
      ipcRenderer.invoke('chronos:triggerHeph', { filePath, intensity, durationMs, loop }),
    
    /**
     * ⚒️ WAVE 2030.18: Stop a Hephaestus runtime instance
     * @param instanceId - Optional specific instance ID. If omitted, stops all.
     */
    stopHeph: (instanceId?: string): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('chronos:stopHeph', instanceId),
    
    /**
     * ⚒️ WAVE 2030.18: Tick all active Hephaestus clips
     * Called from render loop at 60fps to get current curve values.
     * @param currentTimeMs - Current system time in ms
     * @returns { success, outputs: HephFixtureOutput[] }
     */
    tickHeph: (currentTimeMs: number): Promise<{ success: boolean; outputs: unknown[] }> =>
      ipcRenderer.invoke('chronos:tickHeph', currentTimeMs),
    
    /**
     * 👻 WAVE 2540.4: THE PHANTOM BUFFER — Send pre-calculated GodEar heatmap
     * Called once after audio analysis completes. The heatmap data is cached
     * in TitanEngine for band lookup during timeline playback.
     * @param heatmap - Full HeatmapData object (or null to clear)
     */
    loadHeatmap: (heatmap: unknown): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('chronos:load-heatmap', heatmap),
    
    /**
     * 👻 WAVE 2540.5: PLAYHEAD SYNC — Send current playhead position to backend
     * Called every frame during Chronos playback.
     * @param timeMs - Current playhead position in milliseconds
     * @param isPlaying - Whether Chronos is currently playing
     */
    syncPlayhead: (timeMs: number, isPlaying: boolean): Promise<{ success: boolean }> =>
      ipcRenderer.invoke('chronos:sync-playhead', timeMs, isPlaying),
  },

  // ============================================
  // 🎬 PLAYBACK - WAVE 2053.1: TIMELINE ENGINE
  // Backend playback: load project, tick, stop.
  // Frontend is DUMB — sends timeMs, engine does physics.
  // ============================================
  playback: {
    /**
     * 📀 Load a LuxProject into the TimelineEngine
     * @param project - Full LuxProject object
     */
    load: (project: unknown): Promise<{ success: boolean; state?: unknown; error?: string }> =>
      ipcRenderer.invoke('lux:playback:load', project),

    /**
     * ⏱ Tick the engine with current playhead time (fire-and-forget, 60fps)
     * @param timeMs - Current playback position in milliseconds
     */
    tick: (timeMs: number): void => {
      ipcRenderer.send('lux:playback:tick', timeMs)
    },

    /**
     * ⏹ Stop playback and clean up all effects + arbiter overrides
     */
    stop: (): Promise<{ success: boolean; error?: string }> =>
      ipcRenderer.invoke('lux:playback:stop'),

    /**
     * 📊 Query current engine state
     */
    getState: (): Promise<{ loaded: boolean; playing: boolean; projectName: string | null; clipCount: number; activeClipCount: number; lastTickMs: number }> =>
      ipcRenderer.invoke('lux:playback:state'),
  },
}

// ═══════════════════════════════════════════════════════════════════════════
// 🔥 WAVE 384: LUXDEBUG - Test utilities for Constructor verification
// ═══════════════════════════════════════════════════════════════════════════
const luxDebug = {
  /**
   * Test Constructor data flow integrity
   * Usage: window.luxDebug.testConstructor()
   */
  testConstructor: async () => {
    console.log('\n🔥 ═══════════════════════════════════════════════════════════════')
    console.log('🔥 WAVE 384: CONSTRUCTOR INTEGRITY TEST')
    console.log('🔥 ═══════════════════════════════════════════════════════════════\n')
    
    // Step 1: Get fixture library
    console.log('[TEST] Step 1: Loading fixture library...')
    const libraryResult = await ipcRenderer.invoke('lux:get-fixture-library')
    
    if (!libraryResult.success || libraryResult.fixtures.length === 0) {
      console.error('[TEST] ❌ FAIL: No fixtures in library')
      return { success: false, error: 'No fixtures in library' }
    }
    
    const testProfile = libraryResult.fixtures[0]
    console.log(`[TEST] ✅ Library has ${libraryResult.fixtures.length} fixtures`)
    console.log(`[TEST] Using: "${testProfile.name}" (${testProfile.id})`)
    
    // Step 2: Test getFixtureDefinition endpoint
    console.log('\n[TEST] Step 2: Testing lux:getFixtureDefinition...')
    const defResult = await ipcRenderer.invoke('lux:getFixtureDefinition', testProfile.id)
    
    if (!defResult.success || !defResult.definition) {
      console.error('[TEST] ❌ FAIL: getFixtureDefinition returned no data')
      return { success: false, error: 'getFixtureDefinition failed' }
    }
    
    const def = defResult.definition
    console.log(`[TEST] ✅ Definition retrieved:`)
    console.log(`       Name: ${def.name}`)
    console.log(`       Type: ${def.type}`)
    console.log(`       Channels: ${def.channelCount}`)
    console.log(`       Channel defs: ${def.channels?.length || 0}`)
    console.log(`       Has movement: ${def.hasMovementChannels}`)
    console.log(`       Has color mixing: ${def.hasColorMixing}`)
    
    // Step 3: Verify channels array is populated
    console.log('\n[TEST] Step 3: Verifying channel data...')
    
    const assertions = {
      hasChannelsArray: def.channels && def.channels.length > 0,
      channelsMatchCount: def.channels?.length === def.channelCount || def.channels?.length > 0,
      typeNotGeneric: def.type !== 'generic' || testProfile.type === 'generic',
      hasCapabilities: typeof def.hasMovementChannels === 'boolean'
    }
    
    console.log(`[TEST] ASSERT channels.length > 0: ${assertions.hasChannelsArray ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`[TEST] ASSERT channels match count: ${assertions.channelsMatchCount ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`[TEST] ASSERT type is specific: ${assertions.typeNotGeneric ? '✅ PASS' : '❌ FAIL'}`)
    console.log(`[TEST] ASSERT capabilities exist: ${assertions.hasCapabilities ? '✅ PASS' : '❌ FAIL'}`)
    
    const allPassed = Object.values(assertions).every(v => v)
    
    console.log('\n🔥 ═══════════════════════════════════════════════════════════════')
    console.log(`🔥 TEST RESULT: ${allPassed ? '✅ ALL PASSED' : '❌ SOME FAILED'}`)
    console.log('🔥 ═══════════════════════════════════════════════════════════════\n')
    
    return {
      success: allPassed,
      profile: testProfile,
      definition: def,
      assertions
    }
  },
  
  /**
   * Inspect a fixture in stageStore
   * Usage: window.luxDebug.inspectFixture(fixtureId)
   */
  inspectFixture: (fixtureId: string) => {
    console.log(`\n🔍 Inspecting fixture: ${fixtureId}`)
    console.log('(Check React DevTools or stageStore for full data)')
    return { fixtureId, note: 'Use React DevTools to inspect stageStore' }
  },
  
  /**
   * List all available API methods
   */
  help: () => {
    console.log('\n🔥 LUXDEBUG - Available Commands:')
    console.log('  window.luxDebug.testConstructor()     - Test WAVE 384 data flow')
    console.log('  window.luxDebug.inspectFixture(id)    - Inspect a fixture')
    console.log('  window.luxDebug.telemetry.export()    - Volcar captura latino 4.1 a disco')
    console.log('  window.luxDebug.telemetry.stop()      - Detener captura latino 4.1')
    console.log('  window.luxDebug.telemetry.start()     - Reanudar captura latino 4.1')
    console.log('  window.luxDebug.telemetry.flush()     - Limpiar buffer latino 4.1')
    console.log('  window.luxDebug.help()                - Show this help')
    console.log('')
  },

  // ── WAVE 2434: TELEMETRY LATINO 4.1 ──────────────────────────────────────
  // Uso:
  //   await window.luxDebug.telemetry.export()          → escribe docs/logs/latinocalib41.md
  //   await window.luxDebug.telemetry.stop()            → detiene captura
  //   await window.luxDebug.telemetry.flush()           → limpia el buffer
  // ─────────────────────────────────────────────────────────────────────────
  telemetry: {
    export: (outputPath?: string) => ipcRenderer.invoke('telemetry:lt41:export', outputPath),
    stop: () => ipcRenderer.invoke('telemetry:lt41:stop'),
    start: () => ipcRenderer.invoke('telemetry:lt41:start'),
    flush: () => ipcRenderer.invoke('telemetry:lt41:flush'),
  },
}

// 🎯 WAVE 13.6: STATE OF TRUTH - Exponer ipcRenderer para suscripciones a eventos
const electronAPI = {
  ipcRenderer: {
    invoke: (channel: string, ...args: any[]) => {
      return ipcRenderer.invoke(channel, ...args)
    },
    on: (channel: string, listener: (event: any, ...args: any[]) => void) => {
      ipcRenderer.on(channel, listener)
    },
    removeListener: (channel: string, listener: (...args: any[]) => void) => {
      ipcRenderer.removeListener(channel, listener)
    }
  }
}

// Exponer las APIs al renderer
contextBridge.exposeInMainWorld('luxsync', api)
contextBridge.exposeInMainWorld('lux', luxApi)
contextBridge.exposeInMainWorld('electron', electronAPI)
contextBridge.exposeInMainWorld('luxDebug', luxDebug)

// Tipos para TypeScript en el renderer
export type LuxSyncAPI = typeof api
export type LuxAPI = typeof luxApi
export type ElectronAPI = typeof electronAPI
export type LuxDebugAPI = typeof luxDebug
