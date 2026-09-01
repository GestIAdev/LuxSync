import React, { useState, useCallback } from 'react'
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  MouseSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Plus, X as XIcon } from 'lucide-react'
import { type ForgeAction, type IForgeCellBuilder } from '../../../../core/forge/forgeBuilderState'
import { NodeFamily } from '../../../../core/aether/types'
import { canAdmit } from '../../../../core/forge/cellTypeAdmittance'
import { type FixtureChannel, type ChannelType } from '../../../../types/FixtureDefinition'
import { HARD_SAFETY_CHANNEL_TYPES } from '../../../../core/aether/ingestion/NodeExtractionPipeline'

export interface ForgeAetherCellsTabProps {
  cells: readonly IForgeCellBuilder[]
  channels: readonly FixtureChannel[]
  dispatch: React.Dispatch<ForgeAction>
}

// ═══════════════════════════════════════════════════════════════════════════════
// WAVE 4732-D: AETHER MODULES PANEL — DnD COMPLETO
// ═══════════════════════════════════════════════════════════════════════════════

const FAMILY_COLORS: Record<string, string> = {
  COLOR:      '#ef4444',
  IMPACT:     '#f59e0b',
  KINETIC:    '#22d3ee',
  BEAM:       '#a855f7',
  ATMOSPHERE: '#6b7280',
}

interface DragData {
  channelIdx:  number
  channelType: string
  fromCellId?: string
}

// ── Sub-componente: Canal arrastrable ─────────────────────────────────────────

interface DraggableChannelChipProps {
  channelIdx:  number
  channelType: string
  label:       string
  fromCellId?: string
}

function DraggableChannelChip({ channelIdx, channelType, label, fromCellId }: DraggableChannelChipProps) {
  const dragData: DragData = { channelIdx, channelType, fromCellId }
  const draggableId = `ch-${channelIdx}-${fromCellId ?? 'unassigned'}`

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id:   draggableId,
    data: dragData,
  })

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      style={{
        display:     'flex',
        alignItems:  'center',
        gap:         '6px',
        padding:     '5px 8px',
        marginBottom: '3px',
        background:  isDragging ? '#1e293b' : '#0f172a',
        border:      '1px solid #1e293b',
        borderRadius: '4px',
        cursor:      isDragging ? 'grabbing' : 'grab',
        opacity:     isDragging ? 0.4 : 1,
        transform:   CSS.Translate.toString(transform),
        userSelect:  'none',
        touchAction: 'none',
      }}
    >
      <GripVertical size={10} style={{ color: '#334155', flexShrink: 0 }} />
      <span style={{ color: '#475569', fontFamily: 'monospace', fontSize: '10px', width: '28px', flexShrink: 0 }}>
        CH{channelIdx + 1}
      </span>
      <span style={{ color: '#e2e8f0', fontSize: '12px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <span style={{
        fontSize: '10px',
        color: '#7dd3fc',
        fontFamily: 'monospace',
        background: '#0a1628',
        border: '1px solid #1e3a5f',
        borderRadius: '3px',
        padding: '1px 4px',
        flexShrink: 0,
      }}>
        {channelType}
      </span>
    </div>
  )
}

// ── Sub-componente: Célula droppable ──────────────────────────────────────────

interface DroppableCellBoxProps {
  cell:          IForgeCellBuilder
  channels:      readonly FixtureChannel[]
  dispatch:      React.Dispatch<ForgeAction>
  unassigned:    readonly FixtureChannel[]
  isCompatible:  boolean | null  // null = nada arrastrándose
  isShaking:     boolean
}

function DroppableCellBox({
  cell, channels, dispatch, unassigned, isCompatible, isShaking,
}: DroppableCellBoxProps) {
  const { setNodeRef, isOver } = useDroppable({ id: `cell-${cell.cellId}` })

  const neon     = FAMILY_COLORS[String(cell.family)] ?? '#334155'
  const canDrop  = isCompatible === true
  const cantDrop = isCompatible === false

  // Borde dinámico durante el drag
  let borderColor = `${neon}66`
  if (isOver && canDrop)  borderColor = neon
  if (isOver && cantDrop) borderColor = '#ef4444'
  if (!isOver && canDrop) borderColor = `${neon}aa`

  return (
    <div
      ref={setNodeRef}
      style={{
        width:     '220px',
        background: isOver && canDrop ? `${neon}08` : '#0f172a',
        border:    `1px solid ${borderColor}`,
        borderRadius: '6px',
        overflow:  'hidden',
        transition: 'border-color 0.12s, background 0.12s',
        animation: isShaking ? 'forge-shake 0.25s ease-in-out' : 'none',
        opacity:   isCompatible === false && !isOver ? 0.45 : 1,
      }}
    >
      {/* Cabecera */}
      <div style={{
        background:   `${neon}18`,
        borderBottom: `1px solid ${neon}44`,
        padding:      '7px 10px',
        display:      'flex',
        alignItems:   'center',
        gap:          '6px',
      }}>
        <span style={{ fontSize: '10px', fontWeight: 700, color: neon, letterSpacing: '0.1em', flexShrink: 0 }}>
          {String(cell.family)}
        </span>
        {/* WAVE 4732.3 PASO 1: Label editable por el operador */}
        <input
          type="text"
          value={cell.label}
          onChange={e => dispatch({ type: 'CELL_RENAME_LABEL', cellId: cell.cellId, label: e.target.value })}
          title="Rename cell"
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            borderBottom: '1px solid transparent',
            color: '#e2e8f0',
            fontSize: '12px',
            fontWeight: 600,
            outline: 'none',
            minWidth: 0,
            fontFamily: 'inherit',
            cursor: 'text',
            padding: '0 2px',
            transition: 'border-color 0.15s',
          }}
          onFocus={e => { e.currentTarget.style.borderBottomColor = neon }}
          onBlur={e => { e.currentTarget.style.borderBottomColor = 'transparent' }}
        />
        <button
          onClick={() => dispatch({ type: 'CELL_DELETE', cellId: cell.cellId })}
          title="Delete cell"
          style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', flexShrink: 0 }}
        >
          <XIcon size={12} />
        </button>
      </div>

      {/* WAVE 7737 PHASE 6: Safety quarantine badge for ATMOSPHERE cells
          containing hard-safety channels (emission_gate / fire_valve / fire_ignite).
          Warns the operator that these channels are never AI-driven — manual/cue only. */}
      {String(cell.family) === 'ATMOSPHERE' &&
        cell.channelIndices.some(idx => {
          const ch = channels[idx]
          return !!ch && HARD_SAFETY_CHANNEL_TYPES.has(ch.type)
        }) && (
        <div style={{
          background:   '#1a0a0a',
          borderBottom: '1px solid #ef4444',
          padding:      '4px 8px',
          display:      'flex',
          alignItems:   'center',
          gap:          '4px',
        }}>
          <span style={{ fontSize: '10px', color: '#fca5a5', fontWeight: 700 }}>
            ⚠️ Quarantined — Manual/Cue Only, Never AI-Driven
          </span>
        </div>
      )}

      {/* WAVE 4732.3 PASO 2: ID + selector de zona canónica */}
      <div style={{ padding: '4px 8px 4px 10px', borderBottom: '1px solid #1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ color: '#334155', fontFamily: 'monospace', fontSize: '10px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80px' }}>
          {cell.cellId}
        </span>
        <select
          value={cell.aetherZone ?? ''}
          onChange={e => dispatch({ type: 'CELL_SET_ZONE', cellId: cell.cellId, zone: e.target.value || undefined })}
          title="Canonical Aether zone"
          style={{
            flex: 1,
            background: '#0a0f1a',
            border: `1px solid ${cell.aetherZone ? neon + '55' : '#1e293b'}`,
            color: cell.aetherZone ? '#7dd3fc' : '#475569',
            borderRadius: '3px',
            padding: '2px 4px',
            fontSize: '10px',
            cursor: 'pointer',
            fontFamily: 'monospace',
          }}
        >
          <option value="">— zone —</option>
          <option value="ambient">ambient</option>
          <option value="air">air</option>
          <option value="floor">floor</option>
          <option value="strobe">strobe</option>
          <option value="front">front</option>
          <option value="back">back</option>
          <option value="movement">movement</option>
          <option value="dimmer">dimmer</option>
          <option value="unassigned">unassigned</option>
        </select>
      </div>

      {/* Canales asignados (también arrastrables entre células) */}
      <div style={{ padding: '6px 8px 4px', minHeight: '36px' }}>
        {cell.channelIndices.length === 0 ? (
          <span style={{
            display: 'block',
            padding: '8px 4px',
            color:   isOver && canDrop ? neon : '#334155',
            fontSize: '11px',
            fontStyle: 'italic',
            textAlign: 'center',
            transition: 'color 0.12s',
          }}>
            {isOver && canDrop ? 'Drop here' : 'Drag channels here'}
          </span>
        ) : (
          cell.channelIndices.map((idx: number) => {
            const ch = channels[idx]
            return (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
                <DraggableChannelChip
                  channelIdx={idx}
                  channelType={ch?.type ?? 'unknown'}
                  label={ch?.name || ch?.type || '?'}
                  fromCellId={cell.cellId}
                />
                <button
                  onClick={() => dispatch({ type: 'CELL_DETACH_CHANNEL', cellId: cell.cellId, channelIdx: idx })}
                  title="Detach"
                  style={{ background: 'none', border: 'none', color: '#334155', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
                >
                  <XIcon size={9} />
                </button>
              </div>
            )
          })
        )}
      </div>

      {/* Selector de canal como fallback de accesibilidad */}
      {unassigned.length > 0 && (
        <div style={{ padding: '0 8px 8px' }}>
          <select
            value=""
            onChange={e => {
              const idx = parseInt(e.target.value)
              if (!isNaN(idx)) dispatch({ type: 'CELL_ATTACH_CHANNEL', cellId: cell.cellId, channelIdx: idx })
            }}
            style={{
              width: '100%',
              background: '#0a0f1a',
              border: '1px dashed #334155',
              color: '#64748b',
              borderRadius: '3px',
              padding: '3px 6px',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            <option value="">+ Channel...</option>
            {unassigned
              .filter(ch => canAdmit(ch.type, cell.family).ok)
              .map(ch => (
                <option key={ch.index} value={ch.index}>
                  [CH{ch.index + 1}] {ch.name || ch.type}
                </option>
              ))}
          </select>
        </div>
      )}
    </div>
  )
}

// ── Componente principal: ForgeAetherCellsTab ─────────────────────────────────

export default function ForgeAetherCellsTab({ cells, channels, dispatch }: ForgeAetherCellsTabProps) {
  const [activeDrag, setActiveDrag]     = useState<DragData | null>(null)
  const [rejectShake, setRejectShake]   = useState<string | null>(null)
  const [rejectMsg, setRejectMsg]       = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
  )

  const assignedIndices = new Set(cells.flatMap(c => [...c.channelIndices]))
  const unassigned = channels.filter(ch => !assignedIndices.has(ch.index) && ch.type !== 'unknown')

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveDrag(event.active.data.current as DragData)
    setRejectMsg(null)
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const drag = event.active.data.current as DragData | undefined
    setActiveDrag(null)
    if (!drag || !event.over) return

    const overId = String(event.over.id)
    if (!overId.startsWith('cell-')) return

    const cellId = overId.slice(5)
    const cell   = cells.find(c => c.cellId === cellId)
    if (!cell) return

    // Same origin cell → no-op
    if (drag.fromCellId === cellId) return

    const result = canAdmit(drag.channelType as ChannelType, cell.family)
    if (!result.ok) {
      setRejectShake(cellId)
      setRejectMsg(`'${drag.channelType}' incompatible with ${String(cell.family)}: ${result.reason}`)
      setTimeout(() => setRejectShake(null), 260)
      setTimeout(() => setRejectMsg(null), 3500)
      return
    }

    if (drag.fromCellId) {
      dispatch({ type: 'CELL_MOVE_CHANNEL', fromCellId: drag.fromCellId, toCellId: cellId, channelIdx: drag.channelIdx })
    } else {
      dispatch({ type: 'CELL_ATTACH_CHANNEL', cellId, channelIdx: drag.channelIdx })
    }
  }, [cells, dispatch])

  const cellFamilyOptions: { label: string; family: NodeFamily }[] = [
    { label: 'IMPACT',     family: NodeFamily.IMPACT },
    { label: 'COLOR',      family: NodeFamily.COLOR },
    { label: 'KINETIC',    family: NodeFamily.KINETIC },
    { label: 'BEAM',       family: NodeFamily.BEAM },
    { label: 'ATMOSPHERE', family: NodeFamily.ATMOSPHERE },
  ]

  // Canal actualmente en vuelo — para render del overlay
  const activeChannel = activeDrag !== null
    ? channels[activeDrag.channelIdx]
    : null

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div style={{ display: 'flex', height: '100%', fontSize: '13px', position: 'relative' }}>

        {/* ── PANEL IZQUIERDO: Canales no asignados ───────────────────────────── */}
        <div style={{
          width: '250px',
          flexShrink: 0,
          borderRight: '1px solid #1e293b',
          display: 'flex',
          flexDirection: 'column',
          background: '#080d18',
        }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #1e293b' }}>
            <span style={{ color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', fontSize: '11px' }}>
              UNASSIGNED
            </span>
            <span style={{ color: '#334155', marginLeft: '6px', fontSize: '11px' }}>({unassigned.length})</span>
          </div>
          <div style={{ overflowY: 'auto', flex: 1, padding: '8px' }}>
            {unassigned.length === 0 && (
              <div style={{ color: '#334155', padding: '16px 8px', textAlign: 'center', fontSize: '11px' }}>
                {channels.length === 0 ? 'Load a fixture in the DMX Layout tab' : 'All assigned'}
              </div>
            )}
            {unassigned.map(ch => (
              <DraggableChannelChip
                key={ch.index}
                channelIdx={ch.index}
                channelType={ch.type}
                label={ch.name || ch.type}
              />
            ))}
          </div>
        </div>

        {/* ── PANEL DERECHO: Células Aether ───────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#060a14' }}>

          {/* Toolbar de creación */}
          <div style={{
            padding: '8px 14px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            flexWrap: 'wrap',
          }}>
            <span style={{ color: '#64748b', fontWeight: 700, letterSpacing: '0.08em', fontSize: '11px', marginRight: '4px' }}>
              + NEW CELL:
            </span>
            {cellFamilyOptions.map(opt => {
              const neon = FAMILY_COLORS[opt.family] ?? '#334155'
              return (
                <button
                  key={opt.family}
                  onClick={() => dispatch({ type: 'CELL_CREATE', family: opt.family })}
                  style={{
                    background: '#0f172a',
                    border: `1px solid ${neon}`,
                    color: neon,
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                >
                  <Plus size={9} /> {opt.label}
                </button>
              )
            })}
            <span style={{ color: '#334155', fontSize: '11px', marginLeft: 'auto' }}>
              {cells.length} cells
            </span>
          </div>

          {/* Grid de células */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '12px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '12px',
            alignContent: 'flex-start',
          }}>
            {cells.length === 0 && (
              <div style={{ width: '100%', padding: '48px', textAlign: 'center', color: '#334155' }}>
                Create Aether modules using the buttons above,
                then drag channels onto them.
              </div>
            )}
            {cells.map(cell => {
              const isCompatible = activeDrag
                ? canAdmit(activeDrag.channelType as ChannelType, cell.family).ok
                : null
              return (
                <DroppableCellBox
                  key={cell.cellId}
                  cell={cell}
                  channels={channels}
                  dispatch={dispatch}
                  unassigned={unassigned}
                  isCompatible={isCompatible}
                  isShaking={rejectShake === cell.cellId}
                />
              )
            })}
          </div>
        </div>

        {/* ── Toast de rechazo de aduana ──────────────────────────────────────── */}
        {rejectMsg && (
          <div style={{
            position:   'absolute',
            bottom:     '16px',
            left:       '50%',
            transform:  'translateX(-50%)',
            background: '#1a0a0a',
            border:     '1px solid #ef4444',
            color:      '#fca5a5',
            padding:    '8px 16px',
            borderRadius: '6px',
            fontSize:   '12px',
            zIndex:     1000,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}>
            ⛔ {rejectMsg}
          </div>
        )}
      </div>

      {/* ── Overlay flotante durante el drag ──────────────────────────────────── */}
      <DragOverlay dropAnimation={null}>
        {activeChannel && (
          <div style={{
            display:     'flex',
            alignItems:  'center',
            gap:         '6px',
            padding:     '5px 10px',
            background:  '#1e293b',
            border:      '1px solid #7dd3fc',
            borderRadius: '4px',
            boxShadow:   '0 4px 20px rgba(0,0,0,0.6)',
            fontSize:    '12px',
            cursor:      'grabbing',
            whiteSpace:  'nowrap',
          }}>
            <span style={{ color: '#475569', fontFamily: 'monospace', fontSize: '10px' }}>
              CH{activeChannel.index + 1}
            </span>
            <span style={{ color: '#e2e8f0' }}>
              {activeChannel.name || activeChannel.type}
            </span>
            <span style={{
              fontSize: '10px',
              color: '#7dd3fc',
              fontFamily: 'monospace',
              background: '#0a1628',
              border: '1px solid #1e3a5f',
              borderRadius: '3px',
              padding: '1px 4px',
            }}>
              {activeChannel.type}
            </span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}
