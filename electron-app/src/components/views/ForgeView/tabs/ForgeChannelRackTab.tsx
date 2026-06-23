import React, { useState, useCallback, DragEvent, Suspense } from 'react'
import {
  ChevronDown,
  ChevronUp,
  Zap,
  Trash2,
  Plus,
  X as XIcon,
} from 'lucide-react'
import { FixturePreview3D } from '../../../shared/PhysicsTuner/FixturePreview3D'
import { SimpleModeLockBanner, isSimpleCompatible, type ForgeEditMode } from '../canvas/ForgeModeSwitcher'
import type { FixtureChannel, ChannelType, IgnitionDependency, FixtureType } from '../../../../types/FixtureDefinition'
import type { ForgeAction } from '../../../../core/forge/forgeBuilderState'
import { FUNCTION_PALETTE, getChannelCategory, getCategoryColor, getSmartDefaultValue } from '../FixtureForgeEmbedded'

// ────────────────────────────────────────────────────────────────────────────────
// PROPS
// ────────────────────────────────────────────────────────────────────────────────

export interface ForgeChannelRackTabProps {
  channels: FixtureChannel[]
  capabilities: Record<string, any>
  dispatch: React.Dispatch<ForgeAction>
  fixtureType: FixtureType
  forgeGraph: any
  isStressTesting: boolean
  onNavigateToNodeGraph: () => void
}

// ────────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ────────────────────────────────────────────────────────────────────────────────

const ForgeChannelRackTab: React.FC<ForgeChannelRackTabProps> = ({
  channels,
  capabilities,
  dispatch,
  fixtureType,
  forgeGraph,
  isStressTesting,
  onNavigateToNodeGraph,
}) => {
  // ── Preview controls ──────────────────────────────────────────────────────
  const [showPreview, setShowPreview] = useState(true)
  const [previewPan, setPreviewPan] = useState(127)
  const [previewTilt, setPreviewTilt] = useState(127)
  const [previewDimmer, setPreviewDimmer] = useState(200)
  const [previewColor, setPreviewColor] = useState({ r: 255, g: 255, b: 255 })

  // ── UI state ───────────────────────────────────────────────────────────────
  const [dragOverSlot, setDragOverSlot] = useState<number | null>(null)
  const [expandedFoundry, setExpandedFoundry] = useState<string | null>('POSITION')
  const [expandedIgnitionIdx, setExpandedIgnitionIdx] = useState<number | null>(null)

  // ── Drag handlers ─────────────────────────────────────────────────────────
  const handleDragStart = (e: DragEvent<HTMLDivElement>, funcType: ChannelType, funcLabel: string) => {
    e.dataTransfer.setData('channelType', funcType)
    e.dataTransfer.setData('channelLabel', funcLabel)
    e.dataTransfer.effectAllowed = 'copy'
  }

  const handleDragOver = (e: DragEvent<HTMLDivElement>, slotIndex: number) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
    setDragOverSlot(slotIndex)
  }

  const handleDragLeave = () => {
    setDragOverSlot(null)
  }

  const handleDrop = (e: DragEvent<HTMLDivElement>, slotIndex: number) => {
    e.preventDefault()
    const channelType = e.dataTransfer.getData('channelType') as ChannelType
    const channelLabel = e.dataTransfer.getData('channelLabel')
    dispatch({
      type: 'CHANNEL_REPLACE',
      idx: slotIndex,
      channel: {
        ...channels[slotIndex],
        index: slotIndex,
        type: channelType,
        name: channelLabel,
        defaultValue: getSmartDefaultValue(channelType),
        is16bit: channelType.includes('fine'),
      },
    })
    dispatch({ type: 'SYNC_RACK_TO_CELLS', channelIdx: slotIndex })
    setDragOverSlot(null)
  }

  const clearChannel = (index: number) => {
    dispatch({ type: 'CHANNEL_CLEAR', idx: index })
  }

  // ── Ignition deps handlers ────────────────────────────────────────────────
  const addIgnitionDep = useCallback((idx: number, dep: IgnitionDependency) => {
    dispatch({ type: 'IGNITION_ADD', idx, dep })
  }, [dispatch])

  const removeIgnitionDep = useCallback((idx: number, depIndex: number) => {
    dispatch({ type: 'IGNITION_REMOVE', idx, depIdx: depIndex })
  }, [dispatch])

  const updateIgnitionDep = useCallback((idx: number, depIndex: number, patch: Partial<IgnitionDependency>) => {
    dispatch({ type: 'IGNITION_UPDATE', idx, depIdx: depIndex, patch })
  }, [dispatch])

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className="forge-channels-layout">
      {/* Function Palette - Left Sidebar */}
      <aside className="function-foundry">
        <h3>Drag Functions</h3>
        {Object.entries(FUNCTION_PALETTE).map(([category, functions]) => (
          <div key={category} className="function-category">
            <div
              className="category-header"
              onClick={() => setExpandedFoundry(expandedFoundry === category ? null : category)}
            >
              <span>{category}</span>
              {expandedFoundry === category ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </div>
            {expandedFoundry === category && (
              <div className="function-list">
                {functions.map(func => (
                  <div
                    key={func.type}
                    className="function-chip"
                    draggable
                    onDragStart={(e) => handleDragStart(e, func.type, func.label)}
                    style={{ '--func-color': func.color } as React.CSSProperties}
                  >
                    <span className="func-icon">{func.icon}</span>
                    <span className="func-label">{func.label}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </aside>

      {/* Channel Rack - Center */}
      <div className="channel-rack">
        <div className="rack-header">
          <span>Channel</span>
          <span>Function</span>
          <span style={{ fontSize: '10px', color: '#22d3ee', textAlign: 'center' }}>MIN</span>
          <span>Default</span>
          <span></span>
        </div>
        {channels.map((channel, idx) => {
          const category = getChannelCategory(channel.type)
          const categoryColor = getCategoryColor(category)
          const availableTargetTypes = channels
            .filter(ch => ch.type !== 'unknown' && ch.type !== channel.type)
            .map(ch => ch.type)
            .filter((t, i, arr) => arr.indexOf(t) === i)
          const depsCount = channel.ignitionDeps?.length ?? 0
          const isIgnitionExpanded = expandedIgnitionIdx === idx
          return (
            <React.Fragment key={idx}>
            <div
              className={`channel-slot ${channel.type !== 'unknown' ? 'assigned' : ''} ${dragOverSlot === idx ? 'drag-over' : ''} ${category ? `category-${category}` : ''}`}
              style={categoryColor ? {
                '--slot-category-color': categoryColor
              } as React.CSSProperties : undefined}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, idx)}
            >
              <span className="channel-number">{idx + 1}</span>
              <div className="channel-function">
                {channel.type !== 'unknown' ? (
                  (() => {
                    const isEditable = ['custom', 'macro', 'rotation', 'speed', 'control'].includes(channel.type)
                    return isEditable ? (
                      <input
                        type="text"
                        className="channel-name-input"
                        placeholder={channel.type.toUpperCase()}
                        value={channel.name || ''}
                        onChange={(e) => dispatch({ type: 'CHANNEL_REPLACE', idx, channel: { ...channels[idx], name: e.target.value } })}
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          background: 'rgba(0,0,0,0.2)',
                          border: `1px solid ${categoryColor ? categoryColor + '55' : 'rgba(255,255,255,0.12)'}`,
                          color: categoryColor || 'inherit',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          width: '120px',
                          fontFamily: 'inherit',
                          fontSize: '11px',
                          outline: 'none',
                        }}
                      />
                    ) : (
                      <span className="channel-name">{channel.name || channel.type}</span>
                    )
                  })()
                ) : (
                  <span className="channel-empty">Drop function here</span>
                )}
              </div>
              {channel.type === 'dimmer' ? (
                <input
                  type="number"
                  className="channel-default"
                  min={0}
                  max={255}
                  title="Dead Zone: Minimum activation value"
                  value={(capabilities.dimmerMin as number) ?? 0}
                  onChange={(e) => dispatch({ type: 'CAPABILITY_SET', key: 'dimmerMin', value: Math.max(0, Math.min(255, parseInt(e.target.value) || 0)) })}
                />
              ) : (
                <div className="channel-min-placeholder"></div>
              )}

              <input
                type="number"
                className="channel-default"
                min={0}
                max={255}
                value={channel.defaultValue || 0}
                onChange={(e) => dispatch({ type: 'CHANNEL_REPLACE', idx, channel: { ...channels[idx], defaultValue: Math.max(0, Math.min(255, parseInt(e.target.value) || 0)) } })}
              />
              {channel.type !== 'unknown' && (
                <>
                  <button
                    className={`channel-ignition-btn ${depsCount > 0 ? 'has-deps' : ''} ${isIgnitionExpanded ? 'expanded' : ''}`}
                    onClick={() => setExpandedIgnitionIdx(isIgnitionExpanded ? null : idx)}
                    title={depsCount > 0
                      ? `Ignition Dependencies (${depsCount})`
                      : 'Add Ignition Dependency'}
                    style={{
                      background: depsCount > 0 ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                      border: `1px solid ${depsCount > 0 ? 'rgba(245, 158, 11, 0.6)' : 'rgba(255,255,255,0.12)'}`,
                      color: depsCount > 0 ? '#f59e0b' : 'rgba(255,255,255,0.5)',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '10px',
                      fontFamily: 'inherit',
                    }}
                  >
                    <Zap size={12} />
                    {depsCount > 0 && <span>{depsCount}</span>}
                  </button>
                  <button
                    className="channel-clear"
                    onClick={() => clearChannel(idx)}
                    title="Clear channel"
                  >
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>

            {/* Ignition Deps panel (full-width row beneath the slot) */}
            {isIgnitionExpanded && channel.type !== 'unknown' && (
              <div
                className="ignition-deps-panel"
                style={{
                  gridColumn: '1 / -1',
                  background: 'rgba(245, 158, 11, 0.05)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  borderRadius: '6px',
                  padding: '10px 12px',
                  margin: '2px 0 6px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                }}
              >
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  color: '#f59e0b',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                }}>
                  <Zap size={12} />
                  <span>IGNITION DEPENDENCIES</span>
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontWeight: 400, fontSize: '10px' }}>
                    — channel "{channel.name || channel.type}" requires:
                  </span>
                </div>

                {(channel.ignitionDeps ?? []).length === 0 && (
                  <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px', fontStyle: 'italic' }}>
                    No dependencies yet. This channel emits with no prerequisites.
                  </div>
                )}

                {(channel.ignitionDeps ?? []).map((dep, depIdx) => (
                  <div
                    key={depIdx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'rgba(0,0,0,0.25)',
                      border: '1px solid rgba(245, 158, 11, 0.2)',
                      borderRadius: '4px',
                      padding: '6px 8px',
                    }}
                  >
                    <span style={{ color: '#f59e0b', fontSize: '11px', fontFamily: "'JetBrains Mono', monospace" }}>
                      ⚡
                    </span>
                    <select
                      value={dep.channelType}
                      onChange={(e) => updateIgnitionDep(idx, depIdx, { channelType: e.target.value as ChannelType })}
                      style={{
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#fff',
                        padding: '4px 6px',
                        borderRadius: '3px',
                        fontFamily: 'inherit',
                        fontSize: '11px',
                        minWidth: '120px',
                      }}
                    >
                      {!availableTargetTypes.includes(dep.channelType) && (
                        <option value={dep.channelType}>{dep.channelType} (missing)</option>
                      )}
                      {availableTargetTypes.map(t => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                    <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '11px' }}>→</span>
                    <input
                      type="number"
                      min={0}
                      max={255}
                      value={dep.requiredValue}
                      onChange={(e) => {
                        const val = Math.max(0, Math.min(255, parseInt(e.target.value) || 0))
                        updateIgnitionDep(idx, depIdx, { requiredValue: val })
                      }}
                      style={{
                        background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.15)',
                        color: '#fff',
                        padding: '4px 6px',
                        borderRadius: '3px',
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '11px',
                        width: '60px',
                        textAlign: 'center',
                      }}
                    />
                    <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px' }}>DMX</span>
                    <button
                      onClick={() => removeIgnitionDep(idx, depIdx)}
                      title="Remove dependency"
                      style={{
                        marginLeft: 'auto',
                        background: 'transparent',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        color: '#ef4444',
                        borderRadius: '3px',
                        padding: '3px 5px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                      }}
                    >
                      <XIcon size={12} />
                    </button>
                  </div>
                ))}

                <button
                  onClick={() => {
                    const used = new Set((channel.ignitionDeps ?? []).map(d => d.channelType))
                    const firstFree = availableTargetTypes.find(t => !used.has(t)) ?? availableTargetTypes[0]
                    if (!firstFree) return
                    const requiredValue = firstFree === 'shutter' ? 255 : 255
                    addIgnitionDep(idx, { channelType: firstFree, requiredValue })
                  }}
                  disabled={availableTargetTypes.length === 0}
                  title={availableTargetTypes.length === 0
                    ? 'No other channels to depend on'
                    : 'Add a new ignition dependency'}
                  style={{
                    alignSelf: 'flex-start',
                    background: 'rgba(245, 158, 11, 0.15)',
                    border: '1px solid rgba(245, 158, 11, 0.4)',
                    color: '#f59e0b',
                    borderRadius: '4px',
                    padding: '6px 10px',
                    cursor: availableTargetTypes.length === 0 ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '11px',
                    fontWeight: 600,
                    opacity: availableTargetTypes.length === 0 ? 0.4 : 1,
                  }}
                >
                  <Plus size={12} />
                  <span>Add Dependency</span>
                </button>
              </div>
            )}
            </React.Fragment>
          )
        })}
      </div>

      {/* Preview - Right */}
      {showPreview && (
        <div className="rack-preview">
          <Suspense fallback={<div className="preview-loading">Loading...</div>}>
            <FixturePreview3D
              fixtureType={fixtureType || 'Moving Head'}
              pan={previewPan}
              tilt={previewTilt}
              dimmer={previewDimmer}
              color={previewColor}
              strobeActive={false}
              showBeam={true}
              isStressTesting={isStressTesting}
            />
          </Suspense>
        </div>
      )}

      {/* Read-only overlay (outside grid flow) */}
      {!isSimpleCompatible(forgeGraph) && (
        <div className="forge-channels-overlay" role="alert" aria-live="polite">
          <SimpleModeLockBanner
            onJumpToCanvas={onNavigateToNodeGraph}
          />
        </div>
      )}
    </div>
  )
}

export default ForgeChannelRackTab
