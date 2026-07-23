import React, { useEffect, useRef, useState } from 'react'
import { useStageStore } from '../../../../stores/stageStore'
import { VOXEL_SIZE } from '../../../../core/stage/ShowFileV2'

// ═══════════════════════════════════════════════════════════════════════════
// StatusRibbon — Satélite Inferior
// PROYECTO EREBUS FASE 8
//
// Línea flotante inferior, sin fondo de caja, texto alineado a la izquierda.
// Tipografía: monoespaciada, color var(--obs-ink).
//
// Telemetría en vivo:
//   - Coordenadas del cursor (X, Y, Z) interpoladas desde el lienzo activo
//   - Recuento de fixtures
//   - Estado del snap (0.25m)
//
// Actualiza a 60 FPS sin causar re-renderizados del layout principal.
// ═══════════════════════════════════════════════════════════════════════════

export const StatusRibbon: React.FC = () => {
  const fixtureCount = useStageStore(s => s.fixtures.length)
  const showName = useStageStore(s => s.showFile?.name ?? '—')

  // ── Live cursor coords (updated via rAF, no React re-render) ───────────────
  const coordsRef = useRef<HTMLSpanElement>(null)
  const [snapActive] = useState(true)

  useEffect(() => {
    let rafId: number
    let currentX = 0
    let currentY = 0
    let currentZ = 0

    const updateCoords = () => {
      // Read from global cursor state (set by DragDropController2D/3D via CustomEvent)
      if (coordsRef.current) {
        coordsRef.current.textContent =
          `x:${currentX.toFixed(2)} y:${currentY.toFixed(2)} z:${currentZ.toFixed(2)}`
      }
      rafId = requestAnimationFrame(updateCoords)
    }

    const handleCursorUpdate = (e: Event) => {
      const detail = (e as CustomEvent).detail
      if (detail?.x !== undefined) currentX = detail.x
      if (detail?.y !== undefined) currentY = detail.y
      if (detail?.z !== undefined) currentZ = detail.z
    }

    window.addEventListener('erebus:cursor-coords', handleCursorUpdate)
    rafId = requestAnimationFrame(updateCoords)

    return () => {
      window.removeEventListener('erebus:cursor-coords', handleCursorUpdate)
      cancelAnimationFrame(rafId)
    }
  }, [])

  return (
    <div className="erebus-status-ribbon">
      <span className="erebus-status-show-name">{showName}</span>
      <span className="erebus-status-sep">│</span>
      <span ref={coordsRef}>x:0.00 y:0.00 z:0.00</span>
      <span className="erebus-status-sep">│</span>
      <span>{fixtureCount} fixtures</span>
      <span className="erebus-status-sep">│</span>
      <span className="erebus-status-accent">
        Snap {VOXEL_SIZE}m {snapActive ? 'ON' : 'OFF'}
      </span>
      <span className="erebus-status-sep">│</span>
      <span className="erebus-status-accent">Erebus Engine Ready</span>
    </div>
  )
}

export default StatusRibbon
