/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⌨️ USE AUTHORING SHORTCUTS — WAVE 4921 (Atomic Paradigm)
 *
 * Atajos globales del modo WORKSHOP. Los atajos específicos del Trimmer
 * (I / O / Space) ya viven dentro de `<TheiaTrimmer/>` con su propio guard
 * de focus, así que este hook se reserva para futuros atajos globales que
 * NO dependan del trimmer (ej. ⌘S export, ⌘Z undo, etc.).
 *
 * Por ahora es deliberadamente vacío: actúa como noop hasta que se definan
 * los atajos de la fase 3. Se conserva el export para no romper imports.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useEffect } from 'react'
import { useKeyMapStore } from '../stores/keyMapStore'
import { useTheiaEditorStore } from '../stores/useTheiaEditorStore'
import { getThetaOrchestrator } from '../theia'

export function useAuthoringShortcuts(): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      const { editorMode, draftAtom } = useTheiaEditorStore.getState()
      if (editorMode !== 'workshop' || !draftAtom) return

      // Ignorar cuando el foco está en un campo de texto.
      const target = e.target as HTMLElement | null
      if (
        target && (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable
        )
      ) return

      // Defer Space to KeyForge when armed.
      if (useKeyMapStore.getState().isArmed) return

      // [Space] — Play / Pause global, redundante pero útil cuando el
      // trimmer no está montado o no tiene foco.
      if (e.code === 'Space') {
        const vid = getThetaOrchestrator().getVideoElement()
        if (!vid) return
        e.preventDefault()
        if (vid.paused) {
          vid.play().catch(() => { /* Chrome puede rechazar play() pre-gesture */ })
        } else {
          vid.pause()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => { window.removeEventListener('keydown', handleKeyDown) }
  }, [])
}
