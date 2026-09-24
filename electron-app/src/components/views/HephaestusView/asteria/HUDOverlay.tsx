/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🜨 ASTERIA HUD OVERLAY — WAVE 8202: TELEMETRÍA FLOTANTE
 *
 * Badge terminal cyberpunk translúcido anclado top-left sobre el canvas 2D.
 * Hereda la telemetría que los bloques estáticos NODE ATLAS / SELECCIÓN
 * ocupaban en el rail: `300 nodes · 0 selected`. pointer-events: none —
 * jamás roba un gesto del lienzo táctico.
 *
 * Estados:
 *   - loading sin atlas previo → "SYNC ATLAS…"
 *   - error sin atlas          → "ATLAS OFFLINE" (variante ámbar)
 *   - reload silencioso        → mantiene el atlas anterior (doctrina
 *                                useNodeAtlas: nunca parpadea)
 *
 * @module HephaestusView/asteria/HUDOverlay
 * ═══════════════════════════════════════════════════════════════════════════
 */

import React from 'react'
import { useAsteriaStore } from './store/useAsteriaStore'

export const HUDOverlay: React.FC<{
  /** Carga inicial / refresh manual del Node Atlas. */
  loading: boolean
  /** Error del último fetch (endpoint ausente / fallo IPC). */
  error: string | null
}> = ({ loading, error }) => {
  const atlas = useAsteriaStore((s) => s.nodeAtlas)
  const selectionCount = useAsteriaStore((s) => s.selectionNodeIds.size)
  const mapped = atlas?.entries.filter((e) => e.position).length ?? 0

  return (
    <div
      className={`asteria-hud${error && !atlas ? ' asteria-hud--warn' : ''}`}
      title={error ?? (atlas ? `${mapped} mapped nodes` : undefined)}
    >
      {loading && !atlas ? (
        <span>SYNC ATLAS…</span>
      ) : error && !atlas ? (
        <span>ATLAS OFFLINE</span>
      ) : (
        <>
          <span>{atlas?.entries.length ?? 0} NODES</span>
          <span className="asteria-hud__sep">·</span>
          <span className={selectionCount > 0 ? 'asteria-hud__hot' : undefined}>
            {selectionCount} SELECTED
          </span>
        </>
      )}
    </div>
  )
}

export default HUDOverlay
