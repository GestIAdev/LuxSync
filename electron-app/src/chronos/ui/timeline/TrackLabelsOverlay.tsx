/**
 * TRACK LABELS OVERLAY — WAVE 2552
 *
 * HTML overlay posicionado sobre la columna de labels del SVG del timeline.
 * Renderiza controles interactivos por cada TimelineTrackV2:
 *   - Rename (doble-click en el label)
 *   - Mute (M), Solo (S), Lock (L) toggles
 *   - Delete (X)
 *   - Reorder via drag (handle de 3 rayas)
 *
 * Todos los eventos disparan metodos del ChronosStoreV2, sin logica de negocio local.
 *
 * @module chronos/ui/timeline/TrackLabelsOverlay
 */

import React, { useRef, useState, useCallback, useEffect, memo } from 'react'
import type { TimelineTrackV2 } from '../../core/types'
import { getChronosStoreV2 } from '../../core/ChronosStore'
import './TrackLabelsOverlay.css'

// ─────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────

interface TrackLabelRowProps {
  track: TimelineTrackV2
  yOffset: number
  height: number
  totalTracks: number
}

interface TrackLabelsOverlayProps {
  tracks: readonly TimelineTrackV2[]
  /** Y offsets pre-calculados por el canvas (incluye tracks estructurales) */
  trackYOffsets: number[]
  trackHeights: number[]
  width: number
}

// ─────────────────────────────────────────────────────────────────────────────
// TRACK LABEL ROW
// ─────────────────────────────────────────────────────────────────────────────

const TrackLabelRow: React.FC<TrackLabelRowProps> = memo(({ track, yOffset, height, totalTracks }) => {
  const store = getChronosStoreV2()

  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(track.visualLabel)
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync label when store changes it externally
  useEffect(() => {
    if (!isRenaming) setRenameValue(track.visualLabel)
  }, [track.visualLabel, isRenaming])

  const startRename = useCallback(() => {
    setRenameValue(track.visualLabel)
    setIsRenaming(true)
  }, [track.visualLabel])

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.select()
    }
  }, [isRenaming])

  const commitRename = useCallback(() => {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== track.visualLabel) {
      store.renameTrack(track.id, trimmed)
    }
    setIsRenaming(false)
  }, [renameValue, track.visualLabel, track.id, store])

  const cancelRename = useCallback(() => {
    setRenameValue(track.visualLabel)
    setIsRenaming(false)
  }, [track.visualLabel])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') commitRename()
    if (e.key === 'Escape') cancelRename()
  }, [commitRename, cancelRename])

  const handleToggleEnabled = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    store.setTrackEnabled(track.id, !track.enabled)
  }, [track.id, track.enabled, store])

  const handleToggleSolo = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    store.setTrackSolo(track.id, !track.solo)
  }, [track.id, track.solo, store])

  const handleToggleLocked = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    store.setTrackLocked(track.id, !track.locked)
  }, [track.id, track.locked, store])

  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    store.removeTrack(track.id)
  }, [track.id, store])

  // Drag handle — reorder by dragging
  const handleDragHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    let lastY = e.clientY

    const handleMouseMove = (ev: MouseEvent) => {
      const deltaY = ev.clientY - lastY
      const deltaOrder = Math.round(deltaY / Math.max(height, 20))
      if (deltaOrder !== 0) {
        const newOrder = Math.max(0, Math.min(totalTracks - 1, track.order + deltaOrder))
        store.reorderTrack(track.id, newOrder)
        lastY = ev.clientY
      }
    }

    const handleMouseUp = () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }

    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
  }, [track.id, track.order, height, totalTracks, store])

  const isMuted = !track.enabled

  return (
    <div
      className="track-label-row"
      style={{
        top: yOffset,
        height,
        borderLeftColor: track.color,
        opacity: isMuted ? 0.5 : 1,
      }}
    >
      {/* Drag reorder handle */}
      <div
        className="track-drag-handle"
        title="Drag to reorder"
        onMouseDown={handleDragHandleMouseDown}
      >
        <span /><span /><span />
      </div>

      {/* Label: double-click to rename */}
      <div className="track-label-area" onDoubleClick={startRename} title="Double-click to rename">
        {isRenaming ? (
          <input
            ref={inputRef}
            className="track-rename-input"
            value={renameValue}
            onChange={e => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={handleKeyDown}
            maxLength={32}
            autoComplete="off"
            spellCheck={false}
          />
        ) : (
          <span className="track-label-text" style={{ color: track.color }}>
            {track.visualLabel}
          </span>
        )}
      </div>

      {/* Controls */}
      <div className="track-controls">
        <button
          className={`track-btn track-btn--mute ${isMuted ? 'active' : ''}`}
          title={isMuted ? 'Unmute track' : 'Mute track'}
          onClick={handleToggleEnabled}
        >
          M
        </button>
        <button
          className={`track-btn track-btn--solo ${track.solo ? 'active' : ''}`}
          title={track.solo ? 'Unsolo' : 'Solo'}
          onClick={handleToggleSolo}
        >
          S
        </button>
        <button
          className={`track-btn track-btn--lock ${track.locked ? 'active' : ''}`}
          title={track.locked ? 'Unlock track' : 'Lock track'}
          onClick={handleToggleLocked}
        >
          L
        </button>
        <button
          className="track-btn track-btn--delete"
          title="Delete track"
          onClick={handleDelete}
        >
          X
        </button>
      </div>
    </div>
  )
})

TrackLabelRow.displayName = 'TrackLabelRow'

// ─────────────────────────────────────────────────────────────────────────────
// OVERLAY PRINCIPAL
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Overlay HTML sobre la columna de labels del timeline.
 * Se renderiza encima del SVG usando position:absolute, left:0.
 * Los tracks estructurales (ruler, waveform, vibe) NO se muestran aqui
 * — el SVG ya los maneja. Solo las FX tracks V2 tienen controles.
 */
export const TrackLabelsOverlay: React.FC<TrackLabelsOverlayProps> = memo(({
  tracks,
  trackYOffsets,
  trackHeights,
  width,
}) => {
  if (tracks.length === 0 || trackYOffsets.length === 0) return null

  return (
    <div
      className="track-labels-overlay"
      style={{ width }}
    >
      {tracks.map((track, i) => {
        const yOffset = trackYOffsets[i] ?? 0
        const height = trackHeights[i] ?? track.height

        return (
          <TrackLabelRow
            key={track.id}
            track={track}
            yOffset={yOffset}
            height={height}
            totalTracks={tracks.length}
          />
        )
      })}
    </div>
  )
})

TrackLabelsOverlay.displayName = 'TrackLabelsOverlay'
