/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🧠 SESSION STORE - WAVE 2017: THE SESSION KEEPER
 * 
 * Zustand store que preserva el estado de Chronos durante navegación.
 * Cuando el usuario sale de Chronos y vuelve, todo está exactamente donde 
 * lo dejó: audio, clips, playhead, zoom, scroll.
 * 
 * CLAVE: Este store es GLOBAL - sobrevive al unmount de ChronosLayout.
 * 
 * FLUJO:
 * 1. ChronosLayout unmount → saveSession() guarda todo
 * 2. Usuario navega a Dashboard/Builder
 * 3. Usuario vuelve a Chronos
 * 4. ChronosLayout mount → hasSession() true → restoreSession() restaura todo
 * 5. Audio se carga automáticamente desde realPath (sin diálogo)
 * 
 * @module chronos/stores/sessionStore
 * @version WAVE 2017
 */

import { create } from 'zustand'
import type { TimelineClip } from '../core/TimelineClip'
import type { AnalysisData } from '../core/types'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Estado de sesión persistido entre navegaciones
 */
export interface ChronosSessionState {
  // ═══════════════════════════════════════════════════════════════════════
  // AUDIO DATA
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Real filesystem path (para reload) */
  audioRealPath: string | null
  
  /** Nombre del archivo para display */
  audioFileName: string | null
  
  /** Duración del audio en ms */
  audioDurationMs: number
  
  /** Analysis data (waveform, beats, etc) */
  analysisData: AnalysisData | null
  
  // ═══════════════════════════════════════════════════════════════════════
  // TIMELINE STATE
  // ═══════════════════════════════════════════════════════════════════════
  
  /** Todos los clips en el timeline */
  clips: TimelineClip[]
  
  /** Posición del playhead en ms */
  playheadMs: number
  
  /** Zoom level (pixelsPerSecond) */
  pixelsPerSecond: number
  
  /** Scroll position (viewport startTime in ms) */
  viewportStartMs: number
  
  /** BPM del proyecto */
  bpm: number
  
  // ═══════════════════════════════════════════════════════════════════════
  // META
  // ═══════════════════════════════════════════════════════════════════════
  
  /** ¿Hay cambios sin guardar? */
  isDirty: boolean
  
  /** Timestamp de última sesión guardada */
  savedAt: number | null
  
  /** IDs de clips seleccionados */
  selectedClipIds: string[]
  
  /** ¿Stage visible? */
  stageVisible: boolean
}

/**
 * Acciones del store
 */
export interface ChronosSessionActions {
  /**
   * Guarda el estado completo de la sesión
   */
  saveSession: (session: Partial<ChronosSessionState>) => void
  
  /**
   * ¿Hay una sesión guardada con audio?
   */
  hasSession: () => boolean
  
  /**
   * Limpia la sesión (reset total)
   */
  clearSession: () => void
  
  /**
   * Marca la sesión como dirty (cambios sin guardar)
   */
  markDirty: () => void
  
  /**
   * Marca la sesión como clean (guardado)
   */
  markClean: () => void
  
  /**
   * Actualiza solo los clips
   */
  updateClips: (clips: TimelineClip[]) => void
  
  /**
   * Actualiza solo el playhead
   */
  updatePlayhead: (ms: number) => void
  
  /**
   * Actualiza solo el viewport (zoom/scroll)
   */
  updateViewport: (pixelsPerSecond: number, startMs: number) => void
}

export type ChronosSessionStore = ChronosSessionState & ChronosSessionActions

// ═══════════════════════════════════════════════════════════════════════════
// INITIAL STATE
// ═══════════════════════════════════════════════════════════════════════════

const INITIAL_STATE: ChronosSessionState = {
  // Audio
  audioRealPath: null,
  audioFileName: null,
  audioDurationMs: 60000, // Default 1 minute
  analysisData: null,
  
  // Timeline
  clips: [],
  playheadMs: 0,
  pixelsPerSecond: 50, // Default zoom
  viewportStartMs: 0,
  bpm: 120,
  
  // Meta
  isDirty: false,
  savedAt: null,
  selectedClipIds: [],
  stageVisible: true,
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * 🧠 THE SESSION KEEPER
 * 
 * Store global que sobrevive a la navegación entre vistas.
 */
export const useChronosSession = create<ChronosSessionStore>((set, get) => ({
  // Initial state
  ...INITIAL_STATE,
  
  // ═══════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════
  
  saveSession: (session) => {
    console.log('[SessionStore] 💾 Saving session', {
      audioPath: session.audioRealPath || get().audioRealPath,
      clipCount: session.clips?.length ?? get().clips.length,
      playhead: session.playheadMs ?? get().playheadMs,
    })
    
    set({
      ...session,
      savedAt: Date.now(),
    })
  },
  
  hasSession: () => {
    const state = get()
    // Consideramos que hay sesión si hay audio cargado
    return state.audioRealPath !== null && state.audioRealPath.length > 0
  },
  
  clearSession: () => {
    console.log('[SessionStore] 🗑️ Clearing session')
    set(INITIAL_STATE)
  },
  
  markDirty: () => {
    if (!get().isDirty) {
      set({ isDirty: true })
    }
  },
  
  markClean: () => {
    set({ isDirty: false })
  },
  
  updateClips: (clips) => {
    set({ clips, isDirty: true })
  },
  
  updatePlayhead: (ms) => {
    set({ playheadMs: ms })
  },
  
  updateViewport: (pixelsPerSecond, startMs) => {
    set({ pixelsPerSecond, viewportStartMs: startMs })
  },
}))

// ═══════════════════════════════════════════════════════════════════════════
// SELECTORS (for performance)
// ═══════════════════════════════════════════════════════════════════════════

export const selectHasSession = (state: ChronosSessionStore) => 
  state.audioRealPath !== null && state.audioRealPath.length > 0

export const selectAudioPath = (state: ChronosSessionStore) => state.audioRealPath

export const selectClips = (state: ChronosSessionStore) => state.clips

export const selectViewport = (state: ChronosSessionStore) => ({
  pixelsPerSecond: state.pixelsPerSecond,
  startMs: state.viewportStartMs,
})

export const selectIsDirty = (state: ChronosSessionStore) => state.isDirty

// ═══════════════════════════════════════════════════════════════════════════
// SINGLETON ACCESS (for non-React contexts)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Get session store state from anywhere (no React required)
 */
export function getSessionState(): ChronosSessionState {
  return useChronosSession.getState()
}

/**
 * Get session store actions from anywhere
 */
export function getSessionActions(): ChronosSessionActions {
  const store = useChronosSession.getState()
  return {
    saveSession: store.saveSession,
    hasSession: store.hasSession,
    clearSession: store.clearSession,
    markDirty: store.markDirty,
    markClean: store.markClean,
    updateClips: store.updateClips,
    updatePlayhead: store.updatePlayhead,
    updateViewport: store.updateViewport,
  }
}

export default useChronosSession
