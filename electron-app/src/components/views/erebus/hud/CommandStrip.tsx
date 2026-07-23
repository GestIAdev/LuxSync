import React, { useState, useRef, useEffect, useCallback } from 'react'
import type { ToolMode, ViewMode } from '../ErebusShell'
import { useSnapStore, type SnapSize } from '../../../../stores/snapStore'
import { useStageStore } from '../../../../stores/stageStore'

// ═══════════════════════════════════════════════════════════════════════════
// CommandStrip — Satélite Superior
// Cápsula flotante centrada en la parte superior (40px).
// backdrop-filter: blur(12px), fondo var(--obs-surface) al 75%.
// Contenido temporal: botones mock para 2D/3D, Select, Move, Calibrate.
// ═══════════════════════════════════════════════════════════════════════════

interface CommandStripProps {
  toolMode: ToolMode
  setToolMode: (mode: ToolMode) => void
  viewMode: ViewMode
  setViewMode: (mode: ViewMode) => void
}

const TOOLS: { mode: ToolMode; label: string }[] = [
  { mode: 'select', label: 'Select' },
  { mode: 'move', label: 'Move' },
  { mode: 'rig', label: 'Rig' },
  { mode: 'calibrate', label: 'Calibrate' },
  { mode: 'measure', label: 'Measure' },
]

const SNAP_SIZES: SnapSize[] = [0.1, 0.25, 0.5, 1.0]

export const CommandStrip: React.FC<CommandStripProps> = ({
  toolMode,
  setToolMode,
  viewMode,
  setViewMode,
}) => {
  const [snapOpen, setSnapOpen] = useState(false)
  const snapRef = useRef<HTMLDivElement>(null)
  const snapEnabled = useSnapStore(s => s.snapEnabled)
  const snapSize = useSnapStore(s => s.snapSize)
  const toggleSnap = useSnapStore(s => s.toggleSnap)
  const setSnapSize = useSnapStore(s => s.setSnapSize)

  // ── I/O: stage store ──────────────────────────────────────────────────────
  const showFile = useStageStore(s => s.showFile)
  const showFilePath = useStageStore(s => s.showFilePath)
  const isDirty = useStageStore(s => s.isDirty)
  const newShow = useStageStore(s => s.newShow)
  const saveShow = useStageStore(s => s.saveShow)

  useEffect(() => {
    if (!snapOpen) return
    const handler = (e: MouseEvent) => {
      if (snapRef.current && !snapRef.current.contains(e.target as Node)) {
        setSnapOpen(false)
      }
    }
    window.addEventListener('mousedown', handler)
    return () => window.removeEventListener('mousedown', handler)
  }, [snapOpen])

  // ── I/O handlers ──────────────────────────────────────────────────────────
  const handleSave = useCallback(async () => {
    try {
      if (showFilePath && showFilePath !== 'active') {
        await saveShow()
      } else {
        const lux = (window as any).lux
        if (lux?.stage?.saveAsDialog && showFile) {
          const result = await lux.stage.saveAsDialog(showFile, showFile.name)
          if (result?.success && result?.path) {
            useStageStore.setState({ showFilePath: result.path, isDirty: false })
          }
        }
      }
    } catch (err) {
      console.error('[CommandStrip] Save failed:', err)
    }
  }, [showFilePath, showFile, saveShow])

  const confirmDiscard = useCallback(async (): Promise<boolean> => {
    if (!isDirty) return true
    const lux = (window as any).lux
    if (!lux?.stage?.confirmUnsaved) return true
    try {
      const result = await lux.stage.confirmUnsaved(showFile?.name ?? 'Untitled')
      if (result === 'cancel') return false
      if (result === 'save') {
        await handleSave()
      }
      return true
    } catch {
      return false
    }
  }, [isDirty, showFile, handleSave])

  const handleOpen = useCallback(async () => {
    const ok = await confirmDiscard()
    if (!ok) return
    const lux = (window as any).lux
    if (lux?.stage?.openDialog) {
      try {
        await lux.stage.openDialog()
      } catch (err) {
        console.error('[CommandStrip] Open failed:', err)
      }
    }
  }, [confirmDiscard])

  const handleNew = useCallback(async () => {
    const ok = await confirmDiscard()
    if (!ok) return
    newShow('Untitled Show')
  }, [confirmDiscard, newShow])

  return (
    <div className="erebus-command-strip">
      {/* I/O group — New / Open / Save */}
      <div className="erebus-cmd-group">
        <button
          className="erebus-cmd-btn"
          title="New show"
          onClick={handleNew}
        >
          New
        </button>
        <button
          className="erebus-cmd-btn"
          title="Open show"
          onClick={handleOpen}
        >
          Open
        </button>
        <button
          className={`erebus-cmd-btn ${isDirty ? 'erebus-cmd-btn--dirty' : ''}`}
          title={isDirty ? 'Unsaved changes — click to save' : 'Save show'}
          onClick={handleSave}
        >
          Save{isDirty ? ' *' : ''}
        </button>
      </div>

      {/* View toggle */}
      <div className="erebus-cmd-group">
        <button
          className={`erebus-cmd-btn ${viewMode === '2d' ? 'erebus-cmd-btn--active' : ''}`}
          onClick={() => setViewMode('2d')}
        >
          2D
        </button>
        <button
          className={`erebus-cmd-btn ${viewMode === '3d' ? 'erebus-cmd-btn--active' : ''}`}
          onClick={() => setViewMode('3d')}
        >
          3D
        </button>
      </div>

      {/* Tool modes */}
      <div className="erebus-cmd-group">
        {TOOLS.map(t => (
          <button
            key={t.mode}
            className={`erebus-cmd-btn ${toolMode === t.mode ? 'erebus-cmd-btn--active' : ''}`}
            onClick={() => setToolMode(t.mode)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Snap settings popover */}
      <div className="erebus-cmd-group" ref={snapRef} style={{ position: 'relative' }}>
        <button
          className={`erebus-cmd-btn ${snapEnabled ? 'erebus-cmd-btn--active' : ''}`}
          title="Snap settings"
          onClick={() => setSnapOpen(o => !o)}
        >
          Snap {snapEnabled ? `${snapSize}m` : 'Off'}
        </button>

        {snapOpen && (
          <div className="erebus-snap-popover">
            <div className="erebus-snap-popover-row">
              <label className="erebus-snap-toggle">
                <input
                  type="checkbox"
                  checked={snapEnabled}
                  onChange={toggleSnap}
                />
                <span>Enable snap</span>
              </label>
            </div>

            <div className="erebus-snap-popover-row">
              <span className="erebus-snap-popover-label">Grid size</span>
              <div className="erebus-snap-size-grid">
                {SNAP_SIZES.map(size => (
                  <button
                    key={size}
                    className={`erebus-snap-size-btn ${
                      snapSize === size ? 'erebus-snap-size-btn--active' : ''
                    }`}
                    onClick={() => setSnapSize(size)}
                    disabled={!snapEnabled}
                  >
                    {size}m
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default CommandStrip
