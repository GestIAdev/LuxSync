/**
 * ═══════════════════════════════════════════════════════════════════════════
 * 🛰 OrbitVault.tsx — Grid de 22 patrones con DnD + thumbnails animados
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Grid de los 22 patrones del scheduler. Cada celda muestra un OrbitThumbnail
 * animado. Soporta:
 *   - Multi-select (click para toggle)
 *   - Drag-and-drop reorden del scheduler (@dnd-kit/sortable)
 *
 * @module components/vibeLab/panels/OrbitVault
 * @version FASE 3.2
 */

import React, { memo, useState, useCallback } from 'react'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'
import { PATTERN_IDS } from './patternMath'
import { OrbitThumbnail } from './OrbitThumbnail'
import './orbit-vault.css'

// ═══════════════════════════════════════════════════════════════════════════
// SORTABLE ITEM
// ═══════════════════════════════════════════════════════════════════════════

interface SortablePatternProps {
  patternId: string
  index: number
  isSelected: boolean
  isScheduled: boolean
  onSelect: (patternId: string) => void
}

const SortablePattern: React.FC<SortablePatternProps> = ({
  patternId,
  index,
  isSelected,
  isScheduled,
  onSelect,
}) => {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: patternId,
  })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 'auto' as never,
  }

  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      onSelect(patternId)
    },
    [onSelect, patternId],
  )

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`orbit-vault-item ${isSelected ? 'selected' : ''} ${isScheduled ? 'scheduled' : ''}`}
      data-pattern={patternId}
    >
      <button
        className="orbit-vault-drag-handle"
        {...attributes}
        {...listeners}
        type="button"
        title="Drag to reorder scheduler"
      >
        <GripVertical size={10} />
      </button>
      <div className="orbit-vault-thumb" onClick={handleClick}>
        <OrbitThumbnail
          patternId={patternId}
          size={72}
          accent={isSelected ? '#ffb020' : 'rgba(255,255,255,0.4)'}
          isSelected={isSelected}
          animated={isSelected || isScheduled}
        />
      </div>
      <span className="orbit-vault-label" onClick={handleClick}>
        {patternId.replace(/_/g, ' ')}
      </span>
      {isScheduled && (
        <span className="orbit-vault-order">{index + 1}</span>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
// ORBIT VAULT
// ═══════════════════════════════════════════════════════════════════════════

interface OrbitVaultProps {
  /** Patrones en el orden del scheduler (los que rotan). */
  scheduledPatterns?: string[]
  /** Patrones seleccionados para edición. */
  selectedPatterns?: string[]
  /** Callback al reordenar. */
  onReorder?: (newOrder: string[]) => void
  /** Callback al seleccionar/deseleccionar un patrón. */
  onSelect?: (patternId: string) => void
}

export const OrbitVault: React.FC<OrbitVaultProps> = memo(
  ({ scheduledPatterns: scheduledProp, selectedPatterns: selectedProp, onReorder, onSelect }) => {
    // Por defecto, todos los patrones en orden canónico
    const [order, setOrder] = useState<string[]>(scheduledProp ?? [...PATTERN_IDS])
    const [selected, setSelected] = useState<Set<string>>(
      new Set(selectedProp ?? []),
    )

    const sensors = useSensors(
      useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
      useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
    )

    const scheduledSet = new Set(order)

    const handleDragEnd = useCallback(
      (event: DragEndEvent) => {
        const { active, over } = event
        if (!over || active.id === over.id) return
        const oldIndex = order.indexOf(active.id as string)
        const newIndex = order.indexOf(over.id as string)
        const newOrder = arrayMove(order, oldIndex, newIndex)
        setOrder(newOrder)
        onReorder?.(newOrder)
      },
      [order, onReorder],
    )

    const handleSelect = useCallback(
      (patternId: string) => {
        setSelected((prev) => {
          const next = new Set(prev)
          if (next.has(patternId)) next.delete(patternId)
          else next.add(patternId)
          return next
        })
        onSelect?.(patternId)
      },
      [onSelect],
    )

    return (
      <div className="orbit-vault">
        <div className="orbit-vault-header">
          <span className="orbit-vault-title">THE ORBIT VAULT</span>
          <span className="orbit-vault-count">{order.length} patterns</span>
        </div>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={order} strategy={rectSortingStrategy}>
            <div className="orbit-vault-grid">
              {order.map((patternId, idx) => (
                <SortablePattern
                  key={patternId}
                  patternId={patternId}
                  index={idx}
                  isSelected={selected.has(patternId)}
                  isScheduled={scheduledSet.has(patternId)}
                  onSelect={handleSelect}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    )
  },
)

OrbitVault.displayName = 'OrbitVault'
