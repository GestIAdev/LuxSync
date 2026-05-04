/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🖼️  FORGE CANVAS LAYOUT — WAVE 4548.8b
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Layout de 3 columnas para el tab NODE GRAPH:
 *   [NodePalette] | [NodeCanvas] | [Inspector placeholder]
 *
 * Usa CSS grid puro. No añade lógica de estado — es solo estructura.
 *
 * @module components/views/ForgeView/canvas/ForgeCanvasLayout
 * @version WAVE 4548.8b
 */

import React from 'react'
import './ForgeCanvasLayout.css'

interface ForgeCanvasLayoutProps {
  palette: React.ReactNode
  canvas: React.ReactNode
  inspector: React.ReactNode
}

const ForgeCanvasLayout: React.FC<ForgeCanvasLayoutProps> = ({
  palette,
  canvas,
  inspector,
}) => {
  return (
    <div className="forge-canvas-layout">
      <aside className="forge-canvas-layout__palette">{palette}</aside>
      <main className="forge-canvas-layout__canvas">{canvas}</main>
      <aside className="forge-canvas-layout__inspector">{inspector}</aside>
    </div>
  )
}

export default ForgeCanvasLayout
