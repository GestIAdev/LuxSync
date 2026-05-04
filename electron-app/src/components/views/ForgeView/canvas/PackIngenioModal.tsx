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
import type { IngenioCategory, IExposedPort, IIngenioPortMapping } from '../../../../core/forge/ingenio/types'
import type { IForgeNodeGraph, IForgeEdge, IForgeNode, ForgeDataType } from '../../../../core/forge/types'
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

interface ExposurePreview {
  exposedPorts: IExposedPort[]
  portMapping: IIngenioPortMapping
  inputLabels: string[]
  outputLabels: string[]
}

function sanitizePortId(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_\-]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'port'
}

/**
 * Detecta puertos expuestos por cruces de frontera selección↔exterior.
 * Esta misma data se usa tanto para preview visual como para fromSubGraph.
 */
function deriveExposurePreview(
  selectedNodes: readonly IForgeNode[],
  allEdges: readonly IForgeEdge[],
  selectedIds: Set<string>,
): ExposurePreview {
  const nodeMap = new Map(selectedNodes.map((n) => [n.id, n]))

  const exposedPorts: IExposedPort[] = []
  const inputLabels: string[] = []
  const outputLabels: string[] = []

  const portMappingInputs: Array<{
    exposedPortId: string
    internalNodeId: string
    internalPortId: string
  }> = []
  const portMappingOutputs: Array<{
    exposedPortId: string
    internalNodeId: string
    internalPortId: string
  }> = []

  const dedupeIn = new Set<string>()
  const dedupeOut = new Set<string>()
  const usedPortIds = new Set<string>()

  const ensureUniqueExposedPortId = (base: string): string => {
    if (!usedPortIds.has(base)) {
      usedPortIds.add(base)
      return base
    }
    let i = 2
    while (usedPortIds.has(`${base}_${i}`)) i++
    const candidate = `${base}_${i}`
    usedPortIds.add(candidate)
    return candidate
  }

  for (const edge of allEdges) {
    const sourceInside = selectedIds.has(edge.sourceNode)
    const targetInside = selectedIds.has(edge.targetNode)
    if (sourceInside === targetInside) continue

    // Exterior -> interior: input expuesto del Ingenio
    if (!sourceInside && targetInside) {
      const internalNode = nodeMap.get(edge.targetNode)
      if (!internalNode) continue

      const dedupeKey = `${edge.targetNode}:${edge.targetPort}`
      if (dedupeIn.has(dedupeKey)) continue
      dedupeIn.add(dedupeKey)

      const internalPort = internalNode.inputs.find((p) => p.id === edge.targetPort)
      const label = internalPort?.label ?? String(edge.targetPort)
      const exposedPortId = ensureUniqueExposedPortId(`in_${sanitizePortId(label)}`)

      const dataType: ForgeDataType = internalPort?.dataType ?? 'normalized'
      exposedPorts.push({
        id: exposedPortId,
        direction: 'in',
        dataType,
        label,
        description: `Auto-exposed input: ${label}`,
        defaultValue: internalPort?.defaultValue ?? 0,
      })
      inputLabels.push(label)

      portMappingInputs.push({
        exposedPortId,
        internalNodeId: edge.targetNode,
        internalPortId: edge.targetPort,
      })
    }

    // Interior -> exterior: output expuesto del Ingenio
    if (sourceInside && !targetInside) {
      const internalNode = nodeMap.get(edge.sourceNode)
      if (!internalNode) continue

      const dedupeKey = `${edge.sourceNode}:${edge.sourcePort}`
      if (dedupeOut.has(dedupeKey)) continue
      dedupeOut.add(dedupeKey)

      const internalPort = internalNode.outputs.find((p) => p.id === edge.sourcePort)
      const label = internalPort?.label ?? String(edge.sourcePort)
      const exposedPortId = ensureUniqueExposedPortId(`out_${sanitizePortId(label)}`)

      const dataType: ForgeDataType = internalPort?.dataType ?? 'normalized'
      exposedPorts.push({
        id: exposedPortId,
        direction: 'out',
        dataType,
        label,
        description: `Auto-exposed output: ${label}`,
        defaultValue: 0,
      })
      outputLabels.push(label)

      portMappingOutputs.push({
        exposedPortId,
        internalNodeId: edge.sourceNode,
        internalPortId: edge.sourcePort,
      })
    }
  }

  return {
    exposedPorts,
    portMapping: {
      inputs: portMappingInputs,
      outputs: portMappingOutputs,
    },
    inputLabels,
    outputLabels,
  }
}

// ── Component ────────────────────────────────────────────────────────────

export const PackIngenioModal: React.FC<PackIngenioModalProps> = ({ onClose }) => {
  const graph         = useForgeGraphStore((s) => s.graph)
  const selectedIds   = useForgeGraphStore((s) => s.selectedNodeIds)
  const ingestIngenios = useAssetLibraryStore((s) => s.ingestIngenios)

  const [name,     setName]     = useState('')
  const [author,   setAuthor]   = useState('User')
  const [category, setCategory] = useState<IngenioCategory>('utility')
  const [isCategoryOpen, setIsCategoryOpen] = useState(false)
  const [tagsRaw,  setTagsRaw]  = useState('')
  const [status,   setStatus]   = useState<'idle' | 'saving' | 'error'>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  // Nodos seleccionados
  const selectedNodes = graph?.nodes.filter((n) => selectedIds.has(n.id)) ?? []
  const selectedEdges = (graph?.edges ?? []).filter(
    (e) => selectedIds.has(e.sourceNode) && selectedIds.has(e.targetNode)
  )
  const exposurePreview = deriveExposurePreview(selectedNodes, graph?.edges ?? [], selectedIds)
  const selectedCategoryLabel =
    CATEGORY_OPTIONS.find((opt) => opt.value === category)?.label ?? category

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
      exposurePreview.exposedPorts,
      exposurePreview.portMapping,
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
  }, [
    canSave,
    name,
    author,
    category,
    tagsRaw,
    selectedNodes,
    selectedEdges,
    exposurePreview.exposedPorts,
    exposurePreview.portMapping,
    ingestIngenios,
    onClose,
  ])

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

        <div className="pack-modal__exposure">
          <div className="pack-modal__exposure-title">Auto-detected exposed ports</div>
          <div className="pack-modal__exposure-line">
            Se detectaron {exposurePreview.inputLabels.length} Inputs
            {exposurePreview.inputLabels.length > 0
              ? ` (${exposurePreview.inputLabels.join(', ')})`
              : ''}
            {' '}y {exposurePreview.outputLabels.length} Outputs
            {exposurePreview.outputLabels.length > 0
              ? ` (${exposurePreview.outputLabels.join(', ')})`
              : ''}
            .
          </div>
          {exposurePreview.inputLabels.length === 0 && exposurePreview.outputLabels.length === 0 && (
            <div className="pack-modal__exposure-warning">
              Aviso: Tu seleccion no tiene conexiones con el exterior. El Ingenio se guardara sin puertos.
            </div>
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
          <div className="pack-modal__select-wrap">
            <button
              type="button"
              className="pack-modal__category-trigger"
              aria-haspopup="listbox"
              aria-expanded={isCategoryOpen}
              onClick={() => setIsCategoryOpen((prev) => !prev)}
            >
              <span className="pack-modal__category-label">{selectedCategoryLabel}</span>
              <span className="pack-modal__category-caret">▾</span>
            </button>

            {isCategoryOpen && (
              <div className="pack-modal__category-list" role="listbox" aria-label="Category">
                {CATEGORY_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="option"
                    aria-selected={opt.value === category}
                    className={[
                      'pack-modal__category-item',
                      opt.value === category ? 'pack-modal__category-item--active' : '',
                    ].join(' ').trim()}
                    onClick={() => {
                      setCategory(opt.value)
                      setIsCategoryOpen(false)
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

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
