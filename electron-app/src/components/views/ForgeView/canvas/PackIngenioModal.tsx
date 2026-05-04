/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 📦  PACK AS INGENIO MODAL — WAVE 4548.10
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Modal cyberpunk para empaquetar la selección activa del canvas como
 * un Ingenio reutilizable (.luxingenio) en la librería del usuario.
 *
 * Flujo:
 *  1. Usuario selecciona ≥1 nodo en el canvas y pulsa "Pack as Ingenio"
 *  2. Este modal pide: name, author, category, tags
 *  3. Al confirmar:
 *     - IngenioFactory.fromSubGraph() construye el IIngenioDefinition
 *     - window.lux.ingenio.saveUser() guarda a disco
 *     - assetLibraryStore.ingestIngenios() se actualiza con la lista nueva
 *
 * @module components/views/ForgeView/canvas/PackIngenioModal
 * @version WAVE 4548.10
 */
import React, { useState, useCallback } from 'react'
import { useForgeGraphStore } from '../../../../stores/forgeGraphStore'
import { useAssetLibraryStore } from '../../../../stores/assetLibraryStore'
import { IngenioFactory } from '../../../../core/forge/ingenio/IngenioFactory'
import type { IngenioCategory } from '../../../../core/forge/ingenio/types'
import type { IForgeNodeGraph } from '../../../../core/forge/types'
import './PackIngenioModal.css'

// ── Categorías disponibles ───────────────────────────────────────────────

const CATEGORY_OPTIONS: { value: IngenioCategory; label: string }[] = [
  { value: 'modulation',  label: '〜 Modulation — LFOs, waves, oscillators' },
  { value: 'dynamics',    label: '▲ Dynamics — Smooth, envelope, compressor' },
  { value: 'audio',       label: '🎵 Audio — Audio-reactive patterns' },
  { value: 'sequencer',   label: '⏩ Sequencer — Chase, step sequencer' },
  { value: 'logic',       label: '⚡ Logic — Gating, switching' },
  { value: 'utility',     label: '⚙ Utility — Math, merge, split' },
  { value: 'effect',      label: '✨ Effect — Strobe, flicker' },
]

// ── Props ────────────────────────────────────────────────────────────────

interface PackIngenioModalProps {
  onClose: () => void
}

// ── Component ────────────────────────────────────────────────────────────

export const PackIngenioModal: React.FC<PackIngenioModalProps> = ({ onClose }) => {
  const graph         = useForgeGraphStore((s) => s.graph)
  const selectedIds   = useForgeGraphStore((s) => s.selectedNodeIds)
  const ingestIngenios = useAssetLibraryStore((s) => s.ingestIngenios)

  const [name,     setName]     = useState('')
  const [author,   setAuthor]   = useState('User')
  const [category, setCategory] = useState<IngenioCategory>('utility')
  const [tagsRaw,  setTagsRaw]  = useState('')
  const [status,   setStatus]   = useState<'idle' | 'saving' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // Nodos seleccionados
  const selectedNodes = graph?.nodes.filter((n) => selectedIds.has(n.id)) ?? []
  const selectedEdges = (graph?.edges ?? []).filter(
    (e) => selectedIds.has(e.sourceNode) && selectedIds.has(e.targetNode)
  )

  const canSave = name.trim().length > 0 && selectedNodes.length > 0

  const handleSave = useCallback(async () => {
    if (!canSave) return
    setStatus('saving')
    setErrorMsg('')

    const tags = tagsRaw
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter((t) => t.length > 0)

    // Construir el sub-grafo con los nodos/edges seleccionados
    const subGraph: IForgeNodeGraph = {
      version: '1.0.0',
      nodes: selectedNodes,
      edges: selectedEdges,
      meta: {
        createdAt: new Date().toISOString(),
        generatorWave: 'WAVE-4548.10',
        autoMigrated: false,
        dmxFootprint: 0,
      },
    }

    const ingenio = IngenioFactory.fromSubGraph(
      name.trim(),
      category,
      subGraph,
      [],           // exposedPorts: usuario los define en el editor — vacío es válido
      { inputs: [], outputs: [] },
      { author: author.trim() || 'User', tags, description: '' },
    )

    try {
      const result = await window.lux.ingenio.saveUser(ingenio)
      if (!result.success) {
        setStatus('error')
        setErrorMsg(result.error ?? 'Save failed')
        return
      }

      // Recargar lista de ingenios al store para que aparezca en la paleta
      const listResult = await window.lux.ingenio.listAll()
      if (listResult.success) {
        ingestIngenios(listResult.systemIngenios ?? [], listResult.userIngenios ?? [])
      }

      onClose()
    } catch (err: unknown) {
      setStatus('error')
      setErrorMsg(err instanceof Error ? err.message : String(err))
    }
  }, [canSave, name, author, category, tagsRaw, selectedNodes, selectedEdges, ingestIngenios, onClose])

  return (
    <div className="pack-modal-overlay" onClick={onClose}>
      <div className="pack-modal" onClick={(e) => e.stopPropagation()}>

        {/* Header */}
        <div className="pack-modal__header">
          <span className="pack-modal__icon">📦</span>
          <h2 className="pack-modal__title">Pack as Ingenio</h2>
          <button className="pack-modal__close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Selection summary */}
        <div className="pack-modal__summary">
          <span className="pack-modal__summary-stat">
            {selectedNodes.length} node{selectedNodes.length !== 1 ? 's' : ''}
          </span>
          <span className="pack-modal__summary-sep">·</span>
          <span className="pack-modal__summary-stat">
            {selectedEdges.length} edge{selectedEdges.length !== 1 ? 's' : ''}
          </span>
          {selectedNodes.length === 0 && (
            <span className="pack-modal__warning"> ⚠ No nodes selected</span>
          )}
        </div>

        {/* Form */}
        <div className="pack-modal__form">

          <label className="pack-modal__label">
            Name <span className="pack-modal__required">*</span>
          </label>
          <input
            className="pack-modal__input"
            type="text"
            placeholder="My Ingenio"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />

          <label className="pack-modal__label">Author</label>
          <input
            className="pack-modal__input"
            type="text"
            placeholder="User"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />

          <label className="pack-modal__label">Category</label>
          <select
            className="pack-modal__select"
            value={category}
            onChange={(e) => setCategory(e.target.value as IngenioCategory)}
          >
            {CATEGORY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>

          <label className="pack-modal__label">Tags <span className="pack-modal__hint">(comma-separated)</span></label>
          <input
            className="pack-modal__input"
            type="text"
            placeholder="audio, gate, smooth"
            value={tagsRaw}
            onChange={(e) => setTagsRaw(e.target.value)}
          />
        </div>

        {/* Error */}
        {status === 'error' && (
          <div className="pack-modal__error">⚠ {errorMsg}</div>
        )}

        {/* Actions */}
        <div className="pack-modal__actions">
          <button className="pack-modal__btn pack-modal__btn--cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            className="pack-modal__btn pack-modal__btn--save"
            onClick={handleSave}
            disabled={!canSave || status === 'saving'}
          >
            {status === 'saving' ? 'Saving…' : '💾 Save Ingenio'}
          </button>
        </div>

      </div>
    </div>
  )
}
