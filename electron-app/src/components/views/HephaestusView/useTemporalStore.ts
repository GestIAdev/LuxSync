/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚒️ WAVE 2043: OPERATION VULCAN — TEMPORAL STORE
 * Undo/Redo Engine for Hephaestus Curve Editor
 * ═══════════════════════════════════════════════════════════════════════════
 * 
 * ARQUITECTURA:
 *   Cada acción destructiva (add, delete, move_end, interpolation, bezier,
 *   template, audio-bind, param add/remove, name/duration change)
 *   captura un snapshot COMPLETO del clip antes de mutar.
 *   
 *   El stack es un array circular con límite de 50 pasos.
 *   Redo se invalida al pushear un nuevo estado (rama muerta).
 *
 * DISEÑO:
 *   NO es Zustand middleware — es un hook standalone que wrappea
 *   el estado del clip y expone setClip + undo + redo.
 *   Esto respeta el principio de single source of truth sin
 *   forzar migración del state management entero.
 *
 * INVARIANTES:
 *   - El snapshot es un deep clone serializado (structuredClone)
 *   - Los Map<> se clonan correctamente via structuredClone
 *   - Máximo STACK_LIMIT snapshots en memoria
 *   - Push en drag continuo NO genera snapshots (solo en mouseUp)
 *   - Ctrl+Z / Ctrl+Shift+Z se mapean en el componente padre
 *
 * @module views/HephaestusView/useTemporalStore
 * @version WAVE 2043
 */

import { useState, useCallback, useRef } from 'react'
import type { HephAutomationClip } from '../../../core/hephaestus/types'

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

/** Máximo de snapshots en el undo stack */
const STACK_LIMIT = 50

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ViewportState {
  /** Nivel de zoom del canvas (1.0 = 100%) */
  zoom: number

  /** Posición horizontal de scroll en px */
  scrollX: number
}

export interface TemporalState {
  /** Estado actual del clip */
  clip: HephAutomationClip

  /** ¿Se puede hacer undo? */
  canUndo: boolean

  /** ¿Se puede hacer redo? */
  canRedo: boolean

  /** Profundidad actual del undo stack (para UI) */
  undoDepth: number

  /** Profundidad actual del redo stack (para UI) */
  redoDepth: number

  /** Estado de viewport (NO se guarda en undo/redo) */
  viewport: ViewportState
}

export interface TemporalActions {
  /**
   * Actualiza el clip SIN capturar snapshot.
   * Para operaciones continuas (drag en progreso).
   * El snapshot se captura ANTES con `snapshot()`.
   */
  setClip: React.Dispatch<React.SetStateAction<HephAutomationClip>>

  /**
   * Captura un snapshot del estado ACTUAL antes de una mutación.
   * Llamar ANTES de la acción destructiva.
   * Invalida la rama de redo.
   */
  snapshot: () => void

  /**
   * Deshace la última acción destructiva.
   * Restaura el clip al snapshot anterior.
   * El estado actual se pushea al redo stack.
   */
  undo: () => void

  /**
   * Rehace la última acción deshecha.
   * Restaura el clip desde el redo stack.
   * El estado actual se pushea al undo stack.
   */
  redo: () => void

  /**
   * Limpia todo el historial temporal.
   * Útil al cargar un clip nuevo o hacer reset.
   */
  clearHistory: () => void

  /**
   * Reemplaza el clip Y limpia el historial.
   * Para operaciones de carga que establecen un nuevo baseline.
   */
  resetWithClip: (clip: HephAutomationClip) => void

  /**
   * Actualiza el estado de viewport (zoom + scrollX).
   * NO afecta undo/redo history.
   */
  setViewport: (viewport: Partial<ViewportState>) => void
}

// ═══════════════════════════════════════════════════════════════════════════
// DEEP CLONE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Deep clone de HephAutomationClip.
 * 
 * structuredClone soporta Map nativamente en todos los navegadores
 * modernos y en Electron ≥ 17. No necesitamos serializar/deserializar.
 */
function cloneClip(clip: HephAutomationClip): HephAutomationClip {
  return structuredClone(clip)
}

// ═══════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⚒️ useTemporalStore
 * 
 * Hook que wrappea un HephAutomationClip con undo/redo.
 * 
 * USO:
 * ```tsx
 * const { state, actions } = useTemporalStore(initialClip)
 * 
 * // Antes de una acción destructiva:
 * actions.snapshot()
 * actions.setClip(prev => mutate(prev))
 * 
 * // Undo/Redo:
 * actions.undo()
 * actions.redo()
 * 
 * // Operación continua (drag):
 * // snapshot() al mouseDown, setClip en cada mouseMove
 * // NO se captura snapshot en mouseMove
 * ```
 */
export function useTemporalStore(
  initialClip: HephAutomationClip | (() => HephAutomationClip)
): { state: TemporalState; actions: TemporalActions } {
  // ── Core state ──
  const [clip, setClipInternal] = useState<HephAutomationClip>(initialClip)

  // ── Viewport state (NO se guarda en undo/redo) ──
  const [viewport, setViewportInternal] = useState<ViewportState>({
    zoom: 1.0,
    scrollX: 0,
  })

  // ── History stacks (refs para evitar re-renders en cada push) ──
  const undoStackRef = useRef<HephAutomationClip[]>([])
  const redoStackRef = useRef<HephAutomationClip[]>([])

  // ── Force re-render counter (para actualizar canUndo/canRedo) ──
  const [, forceRender] = useState(0)
  const triggerRender = useCallback(() => forceRender(c => c + 1), [])

  // ── Snapshot: captura estado actual antes de mutación ──
  const snapshot = useCallback(() => {
    const currentClip = clip
    const undoStack = undoStackRef.current

    // Push clone al undo stack
    undoStack.push(cloneClip(currentClip))

    // Enforce límite
    if (undoStack.length > STACK_LIMIT) {
      undoStack.shift() // Drop oldest
    }

    // Invalidar rama de redo (nueva acción = muerte de la rama futura)
    redoStackRef.current = []

    triggerRender()
  }, [clip, triggerRender])

  // ── setClip: wrapper directo (sin snapshot automático) ──
  const setClip: React.Dispatch<React.SetStateAction<HephAutomationClip>> = useCallback(
    (action) => {
      setClipInternal(action)
    },
    []
  )

  // ── Undo ──
  const undo = useCallback(() => {
    const undoStack = undoStackRef.current
    const redoStack = redoStackRef.current

    if (undoStack.length === 0) return

    // Pop del undo stack
    const previousClip = undoStack.pop()!

    // Push estado actual al redo stack
    setClipInternal(currentClip => {
      redoStack.push(cloneClip(currentClip))
      return previousClip
    })

    triggerRender()
  }, [triggerRender])

  // ── Redo ──
  const redo = useCallback(() => {
    const undoStack = undoStackRef.current
    const redoStack = redoStackRef.current

    if (redoStack.length === 0) return

    // Pop del redo stack
    const nextClip = redoStack.pop()!

    // Push estado actual al undo stack
    setClipInternal(currentClip => {
      undoStack.push(cloneClip(currentClip))
      // Enforce límite
      if (undoStack.length > STACK_LIMIT) {
        undoStack.shift()
      }
      return nextClip
    })

    triggerRender()
  }, [triggerRender])

  // ── Clear History ──
  const clearHistory = useCallback(() => {
    undoStackRef.current = []
    redoStackRef.current = []
    triggerRender()
  }, [triggerRender])

  // ── Reset with new clip ──
  const resetWithClip = useCallback((newClip: HephAutomationClip) => {
    setClipInternal(newClip)
    undoStackRef.current = []
    redoStackRef.current = []
    triggerRender()
  }, [triggerRender])

  // ── setViewport: actualiza zoom/scrollX ──
  const setViewport = useCallback((partial: Partial<ViewportState>) => {
    setViewportInternal(prev => ({ ...prev, ...partial }))
  }, [])

  // ── Derived state ──
  const state: TemporalState = {
    clip,
    canUndo: undoStackRef.current.length > 0,
    canRedo: redoStackRef.current.length > 0,
    undoDepth: undoStackRef.current.length,
    redoDepth: redoStackRef.current.length,
    viewport,
  }

  const actions: TemporalActions = {
    setClip,
    snapshot,
    undo,
    redo,
    clearHistory,
    resetWithClip,
    setViewport,
  }

  return { state, actions }
}
