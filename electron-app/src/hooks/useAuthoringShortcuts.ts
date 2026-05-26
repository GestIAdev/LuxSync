/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⌨️ USE AUTHORING SHORTCUTS — WAVE 4910.7
 * Atajos de teclado activos solo cuando editorMode === 'author'.
 *
 * Space         → Play / Pause del vídeo
 * C             → Añadir cuepoint en la posición actual del playhead
 * S             → Dividir el cuepoint seleccionado en el playhead
 * Delete / ⌫   → Borrar el cuepoint seleccionado
 *
 * Ignora eventos cuando el foco está en INPUT / TEXTAREA / SELECT o en
 * un contentEditable, para no interferir con campos de texto.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { useEffect } from 'react'
import { useTheiaEditorStore } from '../stores/useTheiaEditorStore'
import { getThetaOrchestrator } from '../theia'

export function useAuthoringShortcuts(): void {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      // ── Guard: solo activo en modo AUTHOR ────────────────────────────────
      const {
        editorMode,
        selectedCueId,
        draftAsset,
        addCuePoint,
        deleteCuePoint,
        splitCuePoint,
      } = useTheiaEditorStore.getState()

      if (editorMode !== 'author') return

      // ── Guard: ignorar cuando el foco está en un campo de texto ──────────
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) return

      const vid = getThetaOrchestrator().getVideoElement()

      switch (e.code) {
        // ── [Space] — Play / Pause ────────────────────────────────────────
        case 'Space': {
          if (!vid) return
          e.preventDefault()
          if (vid.paused) {
            vid.play().catch(() => { /* Chrome puede rechazar .play() si el usuario no ha interactuado */ })
          } else {
            vid.pause()
          }
          break
        }

        // ── [C] — Añadir cuepoint en el playhead ──────────────────────────
        case 'KeyC': {
          if (!draftAsset || !vid) return
          e.preventDefault()
          const currentMs = vid.currentTime * 1000
          const totalMs   = isFinite(vid.duration) ? vid.duration * 1000 : 0
          const endMs     = totalMs > 0
            ? Math.min(currentMs + 2_000, totalMs)
            : currentMs + 2_000
          addCuePoint({
            name:         `cue-${Math.floor(currentMs / 1000)}s`,
            startMs:      currentMs,
            endMs,
            dna:          { aggression: 0.5, chaos: 0.5, organicity: 0.5 },
            energyZone:   { min: 'silence', max: 'peak' },
            validSections: [],
            default:      false,
          })
          break
        }

        // ── [S] — Split cuepoint seleccionado en el playhead ─────────────
        case 'KeyS': {
          if (!selectedCueId || !vid) return
          e.preventDefault()
          splitCuePoint(selectedCueId, vid.currentTime * 1000)
          break
        }

        // ── [Delete / Backspace] — Borrar cue seleccionado ────────────────
        case 'Delete':
        case 'Backspace': {
          if (!selectedCueId) return
          e.preventDefault()
          deleteCuePoint(selectedCueId)
          break
        }

        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => { window.removeEventListener('keydown', handleKeyDown) }
  }, []) // El handler lee el store via getState() — sin closures sobre estado obsoleto
}
