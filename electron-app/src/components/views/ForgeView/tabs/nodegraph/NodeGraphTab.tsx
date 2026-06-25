/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🎛️  NODE GRAPH TAB 2.0 — "The Cockpit"
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Envoltura del canvas de nodos. Command Bar ciberpunk con:
 *  - Selector "Cuyo Arsenal" (presets de modulación)
 *  - Telemetría viva (nodos / cables / dirty)
 *  - Botón de Pánico (limpiar lienzo)
 *  - Pack as Ingenio (contextual)
 *
 * DOGMA: NO toca NodeCanvas ni reductores. Carga presets vía store.loadGraph.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useForgeGraphStore } from '../../../../../stores/forgeGraphStore'
import { CUYO_ARSENAL, type NodeGraphPreset } from './palette/nodeGraphPresets'
import ForgeCanvasLayout from '../../canvas/ForgeCanvasLayout'
import NodePalette from '../../canvas/NodePalette'
import NodeCanvas from '../../canvas/NodeCanvas'
import { NodeInspector } from '../../inspector/NodeInspector'
import { PackIngenioModal } from '../../canvas/PackIngenioModal'
import './NodeGraphTab.css'

const NodeGraphTab: React.FC = () => {
  // ── Store (selección granular, sin re-render innecesario) ──────────────
  const { fixtureId, nodeCount, edgeCount, isDirty, selectedCount } =
    useForgeGraphStore(
      useShallow((s) => ({
        fixtureId: s.fixtureId,
        nodeCount: s.graph?.nodes.length ?? 0,
        edgeCount: s.graph?.edges.length ?? 0,
        isDirty: s.isDirty,
        selectedCount: s.selectedNodeIds.size,
      }))
    )
  const loadGraph = useForgeGraphStore((s) => s.loadGraph)
  const clearGraph = useForgeGraphStore((s) => s.clearGraph)

  const [arsenalOpen, setArsenalOpen] = useState(false)
  const [showPackModal, setShowPackModal] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  // ── Cargar preset (reemplaza lienzo, preserva fixtureId) ───────────────
  const loadPreset = useCallback(
    (preset: NodeGraphPreset) => {
      const hasContent = nodeCount > 0
      if (hasContent && !window.confirm(
        `Cargar "${preset.name}"? Esto reemplaza el grafo actual.`
      )) return

      loadGraph(preset.build(), fixtureId ?? 'preset-scratch', false)
      setArsenalOpen(false)
      setToast(`⚡ ${preset.name} cargado`)
    },
    [loadGraph, fixtureId, nodeCount]
  )

  // ── Pánico: limpiar lienzo ─────────────────────────────────────────────
  const handlePanic = useCallback(() => {
    if (nodeCount === 0) return
    if (window.confirm('PÁNICO: vaciar el lienzo completo?')) clearGraph()
  }, [clearGraph, nodeCount])

  // ── Toast auto-dismiss ─────────────────────────────────────────────────
  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 2200)
    return () => window.clearTimeout(t)
  }, [toast])

  // ── F3: Atajos de teclado (Time-to-First-Flash) ───────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return // no robar foco de campos

      // Ctrl+1..5 → cargar preset N del arsenal
      if (e.ctrlKey && !e.shiftKey && e.key >= '1' && e.key <= '5') {
        const idx = Number(e.key) - 1
        if (CUYO_ARSENAL[idx]) {
          e.preventDefault()
          loadPreset(CUYO_ARSENAL[idx])
        }
      }
      // Ctrl+Shift+K → pánico
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        handlePanic()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [loadPreset, handlePanic])

  const arsenalLabel = useMemo(
    () => (arsenalOpen ? 'CUYO ARSENAL ▲' : 'CUYO ARSENAL ▼'),
    [arsenalOpen]
  )

  return (
    <div className="ng-cockpit">
      {/* ═══ COMMAND BAR ═══ */}
      <div className="ng-commandbar">
        {/* Arsenal selector */}
        <div className="ng-arsenal">
          <button
            className="ng-arsenal__trigger"
            onClick={() => setArsenalOpen((o) => !o)}
            title="Cargar un preset de modulación (Ctrl+1..5)"
          >
            <span className="ng-arsenal__bolt">⚡</span> {arsenalLabel}
          </button>

          {arsenalOpen && (
            <div className="ng-arsenal__menu" role="menu">
              {CUYO_ARSENAL.map((p, i) => (
                <button
                  key={p.id}
                  className="ng-arsenal__item"
                  style={{ ['--accent' as string]: p.accent }}
                  onClick={() => loadPreset(p)}
                  role="menuitem"
                >
                  <span className="ng-arsenal__icon">{p.icon}</span>
                  <span className="ng-arsenal__text">
                    <span className="ng-arsenal__name">{p.name}</span>
                    <span className="ng-arsenal__desc">{p.description}</span>
                  </span>
                  <span className="ng-arsenal__hotkey">Ctrl+{i + 1}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Telemetría viva */}
        <div className="ng-telemetry">
          <span className="ng-stat" title="Nodos en el grafo">
            ◉ {nodeCount} <em>nodes</em>
          </span>
          <span className="ng-stat" title="Conexiones activas">
            ⌥ {edgeCount} <em>wires</em>
          </span>
          {isDirty && (
            <span className="ng-stat ng-stat--dirty" title="Cambios sin guardar">
              ● DIRTY
            </span>
          )}
        </div>

        {/* Acciones */}
        <div className="ng-actions">
          {selectedCount > 0 && (
            <button
              className="ng-btn ng-btn--pack"
              onClick={() => setShowPackModal(true)}
              title="Empaquetar selección como Ingenio reusable"
            >
              📦 Pack ({selectedCount})
            </button>
          )}
          <button
            className="ng-btn ng-btn--panic"
            onClick={handlePanic}
            title="Vaciar el lienzo (Ctrl+Shift+K)"
          >
            🧹 PANIC
          </button>
        </div>
      </div>

      {/* ═══ CANVAS ═══ */}
      <React.Suspense fallback={<div className="ng-loading">Loading canvas…</div>}>
        <ForgeCanvasLayout
          palette={<NodePalette />}
          canvas={<NodeCanvas />}
          inspector={<NodeInspector />}
        />
      </React.Suspense>

      {/* ═══ TOAST ═══ */}
      {toast && <div className="ng-toast">{toast}</div>}

      {showPackModal && <PackIngenioModal onClose={() => setShowPackModal(false)} />}
    </div>
  )
}

export default NodeGraphTab
