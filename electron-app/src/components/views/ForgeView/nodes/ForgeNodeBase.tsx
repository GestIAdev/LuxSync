/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚛️  FORGE NODE BASE — WAVE 4548.8c
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Componente base compartido para todos los custom node types del canvas.
 * Aplica la estética Cyberpunk Industrial: barra de categoría, handles
 * tipados por dataType, preview de config y glow al seleccionar.
 *
 * Anatomía:
 *   ┌── CATEGORY BAR (4px, color sólido) ─────────────┐
 *   │  [icon]  Label                    [ports count]  │  ← Header
 *   │  ─────────────────────────────────────────────── │
 *   │  ● port_in                        port_out ●     │  ← Ports
 *   │  ┌──────────────────────────────────────────┐    │
 *   │  │  config preview (1 línea)                │    │  ← Preview
 *   │  └──────────────────────────────────────────┘    │
 *   └────────────────────────────────────────────────── ┘
 *
 * @module components/views/ForgeView/nodes/ForgeNodeBase
 * @version WAVE 4548.8c
 */

import React, { memo } from 'react'
import { Handle, Position, type NodeProps, type Node } from '@xyflow/react'
import type { ForgeNodeCategory, ForgeDataType } from '../../../../core/forge/types'
import { getCategoryColor, getCategoryGlow, getDataTypeColor } from './nodeColors'
import { getNodeIcon } from './nodeIcons'
import './ForgeNodeBase.css'

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export interface ForgePortDescriptor {
  id: string
  label: string
  dataType: ForgeDataType
  direction: 'in' | 'out'
}

export interface ForgeNodeBaseData extends Record<string, unknown> {
  /** Tipo (para el icono) */
  forgeType: string
  /** Categoría (para colores) */
  forgeCategory: ForgeNodeCategory
  /** Label visible */
  label: string
  /** Puertos de entrada */
  inputs: ForgePortDescriptor[]
  /** Puertos de salida */
  outputs: ForgePortDescriptor[]
  /** Texto de preview de config (máx. 1 línea) */
  configPreview?: string
  /** Si el nodo está seleccionado (XYFlow pasa selected como prop del nodo) */
  isSelected?: boolean
}

/** Tipo de nodo completo para XYFlow (@xyflow/react v12 pattern) */
export type ForgeNode = Node<ForgeNodeBaseData>

// ═══════════════════════════════════════════════════════════════════════════
// SUBCOMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

const PortHandle: React.FC<{
  port: ForgePortDescriptor
  index: number
  total: number
}> = ({ port, index, total }) => {
  const color = getDataTypeColor(port.dataType)
  const isInput = port.direction === 'in'
  const topPercent = total === 1 ? 50 : 20 + (index / (total - 1)) * 60

  return (
    <div
      className={`fn-port fn-port--${isInput ? 'in' : 'out'}`}
      style={{ top: `${topPercent}%` }}
      title={`${port.label} (${port.dataType})`}
    >
      <Handle
        type={isInput ? 'target' : 'source'}
        position={isInput ? Position.Left : Position.Right}
        id={port.id}
        style={{
          background: color,
          border: `1.5px solid ${color}`,
          width: 10,
          height: 10,
          borderRadius: port.dataType === 'boolean' ? '2px' : '50%',
        }}
      />
      <span className="fn-port__label" style={{ color }}>
        {port.label}
      </span>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// FORGE NODE BASE
// ═══════════════════════════════════════════════════════════════════════════

export const ForgeNodeBase: React.FC<NodeProps<ForgeNode>> = memo(
  ({ data, selected }) => {
    const {
      forgeType,
      forgeCategory,
      label,
      inputs,
      outputs,
      configPreview,
    } = data as ForgeNodeBaseData
    const catColor = getCategoryColor(forgeCategory)
    const catGlow = getCategoryGlow(forgeCategory)
    const icon = getNodeIcon(forgeType as never)

    const maxPorts = Math.max(inputs.length, outputs.length, 1)
    // Altura mínima del área de ports: 32px por puerto
    const portsAreaHeight = Math.max(maxPorts * 28, 40)

    return (
      <div
        className={`forge-node${selected ? ' forge-node--selected' : ''}`}
        style={
          {
            '--cat-color': catColor,
            '--cat-glow': catGlow,
            '--ports-height': `${portsAreaHeight}px`,
          } as React.CSSProperties
        }
      >
        {/* Category Bar */}
        <div className="forge-node__cat-bar" />

        {/* Header */}
        <div className="forge-node__header">
          <span className="forge-node__icon">{icon}</span>
          <span className="forge-node__label">{label}</span>
        </div>

        {/* Ports Area */}
        <div className="forge-node__ports" style={{ height: portsAreaHeight }}>
          {inputs.map((port, i) => (
            <PortHandle key={port.id} port={port} index={i} total={inputs.length} />
          ))}
          {outputs.map((port, i) => (
            <PortHandle key={port.id} port={port} index={i} total={outputs.length} />
          ))}
        </div>

        {/* Config Preview */}
        {configPreview && (
          <div className="forge-node__preview" style={{ borderColor: `${catColor}30` }}>
            <span className="forge-node__preview-text">{configPreview}</span>
          </div>
        )}
      </div>
    )
  }
)

ForgeNodeBase.displayName = 'ForgeNodeBase'
