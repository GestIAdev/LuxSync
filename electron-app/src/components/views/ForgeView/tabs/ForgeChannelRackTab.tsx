import React, { useState, DragEvent, Suspense } from 'react'
import {
  ChevronDownIcon,
  ChevronUpIcon,
  TrashIcon,
  ShieldIcon,
} from '../../../icons/LuxIcons'
import { FixturePreview3D } from '../../../shared/PhysicsTuner/FixturePreview3D'
import { SimpleModeLockBanner, isSimpleCompatible } from '../canvas/ForgeModeSwitcher'
import type { FixtureChannel, ChannelType, FixtureType, IDMXGovernor, IGovernorRule, GovernorIntentType } from '../../../../types/FixtureDefinition'
import type { ForgeAction } from '../../../../core/forge/forgeBuilderState'
import { FUNCTION_PALETTE, getChannelCategory, getCategoryColor, getSmartDefaultValue } from '../FixtureForgeEmbedded'

// ────────────────────────────────────────────────────────────────────────────────
// GOVERNOR INTENT OPTIONS — mirrors DMXGovernorEvaluator.CHANNEL_TO_INTENT.
// `when.intentType` only ever fires if it matches the channel's mapped intent
// (or 'fallback', which matches anything). New rules default to the channel's
// own intent so they can actually trigger.
// ────────────────────────────────────────────────────────────────────────────────

const INTENT_OPTIONS: readonly GovernorIntentType[] = [
  'intensity', 'strobe', 'shutter', 'prism', 'prism-rotation', 'gobo',
  'frost', 'zoom', 'focus', 'emission', 'fire', 'smoke', 'fallback',
]

const CHANNEL_INTENT_DEFAULT: Record<string, GovernorIntentType> = {
  dimmer: 'intensity',
  strobe: 'strobe',
  shutter: 'shutter',
  prism: 'prism',
  'prism-rotation': 'prism-rotation',
  gobo: 'gobo',
  'gobo-rotation': 'gobo',
  frost: 'frost',
  zoom: 'zoom',
  focus: 'focus',
  emission_gate: 'emission',
  fire_valve: 'fire',
  fire_ignite: 'fire',
  smoke_pump: 'smoke',
  smoke_density: 'smoke',
}

const intentForChannel = (channelType: string): GovernorIntentType =>
  CHANNEL_INTENT_DEFAULT[channelType] ?? 'fallback'

// ────────────────────────────────────────────────────────────────────────────────
// GOVERNOR SUMMARY — compact display of multi-rule governors
// ────────────────────────────────────────────────────────────────────────────────

function formatGovernorRule(rule: IGovernorRule): string {
  const intent = rule.when.intentType
  const lo = rule.when.min !== undefined ? `≥${rule.when.min}` : ''
  const hi = rule.when.max !== undefined ? `<${rule.when.max}` : ''
  const condition = lo + (lo && hi ? ' ' : '') + hi
  const action = rule.then.forceByte !== undefined
    ? `=${rule.then.forceByte}`
    : rule.then.clampMin !== undefined
      ? `≥${rule.then.clampMin}`
      : rule.then.mapToRange !== undefined
        ? `→[${rule.then.mapToRange[0]}-${rule.then.mapToRange[1]}]`
        : '?'
  return `${intent}${condition ? `(${condition})` : ''}${action}`
}

function formatGovernorSummary(gov: IDMXGovernor): string {
  if (gov.rules.length === 0) return 'empty'
  if (gov.rules.length === 1) return formatGovernorRule(gov.rules[0])
  return gov.rules.map(formatGovernorRule).join(' | ')
}

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
  dmxGovernors: readonly IDMXGovernor[]
}

// ────────────────────────────────────────────────────────────────────────────────
// COMPONENT
// ────────────────────────────────────────────────────────────────────────────────

const ForgeChannelRackTab: React.FC<ForgeChannelRackTabProps> = ({
  channels,
  dispatch,
  fixtureType,
  forgeGraph,
  isStressTesting,
  onNavigateToNodeGraph,
  dmxGovernors,
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
  const [editingGovIdx, setEditingGovIdx] = useState<number | null>(null)

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
              {expandedFoundry === category ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
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
          <span>Default</span>
          <span>Governor</span>
          <span></span>
        </div>
        {channels.map((channel, idx) => {
          const category = getChannelCategory(channel.type)
          const categoryColor = getCategoryColor(category)
          const activeGov = dmxGovernors.find(g => g.channelIndex === idx)
          return (
            <div key={idx} className="channel-slot-wrapper">
              <div
                className={`channel-row ${channel.type !== 'unknown' ? 'assigned' : ''} ${dragOverSlot === idx ? 'drag-over' : ''} ${category ? `category-${category}` : ''}`}
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
                      className={`btn-governor-inline ${activeGov ? 'governor-active' : ''}`}
                      onClick={() => setEditingGovIdx(editingGovIdx === idx ? null : idx)}
                      title={activeGov ? formatGovernorSummary(activeGov) : 'Governor OFF'}
                      style={{
                        background: activeGov ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
                        border: `1px solid ${activeGov ? 'rgba(245, 158, 11, 0.8)' : 'rgba(255,255,255,0.12)'}`,
                        color: activeGov ? '#fbbf24' : 'rgba(255,255,255,0.5)',
                        borderRadius: '4px',
                        padding: '4px 8px',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '10px',
                        fontWeight: 600,
                        fontFamily: 'inherit',
                        opacity: activeGov ? 1 : 0.6,
                      }}
                    >
                      <ShieldIcon size={12} color={activeGov ? '#fbbf24' : 'rgba(255,255,255,0.5)'} />
                      <span>{activeGov ? 'Governor ON' : 'Governor OFF'}</span>
                    </button>
                    <button
                      className="channel-clear"
                      onClick={() => clearChannel(idx)}
                      title="Clear channel"
                    >
                      <TrashIcon size={14} />
                    </button>
                  </>
                )}
              </div>

              {editingGovIdx === idx && (
                <div className="governor-inline-drawer">
                  <span className="drawer-arrow">└──►</span>
                  <span className="drawer-hint">
                    <b>{channel.type.toUpperCase()}</b> governor — {activeGov ? `${activeGov.rules.length} rule(s)` : 'no rules'}
                  </span>
                  {activeGov && (
                    <div className="governor-rules-list" style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1 }}>
                      {activeGov.rules.map((rule, ri) => {
                        const gov = activeGov
                        const setRules = (newRules: IGovernorRule[]) =>
                          dispatch({ type: 'GOVERNOR_SET_FOR_CHANNEL', channelIndex: idx, governor: { ...gov, rules: newRules } })
                        const patchRule = (updater: (r: IGovernorRule) => IGovernorRule) =>
                          setRules(gov.rules.map((r, i) => (i === ri ? updater(r) : r)))
                        const numStyle: React.CSSProperties = { width: '46px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(245,158,11,0.4)', color: '#fbbf24', borderRadius: '3px', padding: '2px 4px', fontSize: '10px' }
                        const selStyle: React.CSSProperties = { background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(245,158,11,0.4)', color: '#fbbf24', borderRadius: '3px', padding: '2px 2px', fontSize: '10px', fontFamily: 'inherit' }
                        const parseNorm = (raw: string): number | undefined => {
                          const v = parseFloat(raw)
                          return Number.isNaN(v) ? undefined : Math.min(1, Math.max(0, v))
                        }
                        const parseByte = (raw: string): number =>
                          Math.min(255, Math.max(0, parseInt(raw) || 0))
                        return (
                          <div key={ri} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', flexWrap: 'wrap' }}>
                            <span style={{ color: 'rgba(255,255,255,0.35)', minWidth: '14px' }}>{ri + 1}.</span>
                            <select
                              className="gov-rule-select"
                              value={rule.when.intentType}
                              title="Intent type this rule intercepts ('fallback' = any)"
                              onChange={(e) => patchRule(r => ({ ...r, when: { ...r.when, intentType: e.target.value as GovernorIntentType } }))}
                            >
                              {INTENT_OPTIONS.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                            <input
                              type="number" min="0" max="1" step="0.05"
                              defaultValue={rule.when.min ?? ''}
                              placeholder="min"
                              title="when.min — normalized lower bound, inclusive (empty = none)"
                              style={numStyle}
                              onChange={(e) => patchRule(r => ({ ...r, when: { ...r.when, min: parseNorm(e.target.value) } }))}
                            />
                            <span style={{ color: 'rgba(255,255,255,0.35)' }}>–</span>
                            <input
                              type="number" min="0" max="1" step="0.05"
                              defaultValue={rule.when.max ?? ''}
                              placeholder="max"
                              title="when.max — normalized upper bound, exclusive (empty = none)"
                              style={numStyle}
                              onChange={(e) => patchRule(r => ({ ...r, when: { ...r.when, max: parseNorm(e.target.value) } }))}
                            />
                            <span style={{ color: 'rgba(255,255,255,0.4)' }}>→</span>
                            <select
                              className="gov-rule-select"
                              value={rule.then.forceByte !== undefined ? 'forceByte' : rule.then.mapToRange !== undefined ? 'mapToRange' : 'clampMin'}
                              title="Action applied on match"
                              onChange={(e) => {
                                const kind = e.target.value
                                patchRule(r => ({
                                  ...r,
                                  then: kind === 'forceByte'
                                    ? { forceByte: r.then.forceByte ?? 255 }
                                    : kind === 'mapToRange'
                                      ? { mapToRange: r.then.mapToRange ?? ([0, 255] as [number, number]) }
                                      : { clampMin: r.then.clampMin ?? 64 },
                                }))
                              }}
                            >
                              <option value="forceByte">forceByte</option>
                              <option value="mapToRange">mapToRange</option>
                              <option value="clampMin">clampMin</option>
                            </select>
                            {rule.then.forceByte !== undefined && (
                              <input
                                type="number" min="0" max="255"
                                defaultValue={rule.then.forceByte}
                                style={numStyle}
                                onChange={(e) => patchRule(r => ({ ...r, then: { ...r.then, forceByte: parseByte(e.target.value) } }))}
                              />
                            )}
                            {rule.then.clampMin !== undefined && (
                              <input
                                type="number" min="0" max="255"
                                defaultValue={rule.then.clampMin}
                                style={numStyle}
                                onChange={(e) => patchRule(r => ({ ...r, then: { ...r.then, clampMin: parseByte(e.target.value) } }))}
                              />
                            )}
                            {rule.then.mapToRange !== undefined && (
                              <>
                                <input
                                  type="number" min="0" max="255"
                                  defaultValue={rule.then.mapToRange[0]}
                                  title="mapToRange low byte"
                                  style={numStyle}
                                  onChange={(e) => patchRule(r => ({ ...r, then: { ...r.then, mapToRange: [parseByte(e.target.value), r.then.mapToRange![1]] as [number, number] } }))}
                                />
                                <span style={{ color: 'rgba(255,255,255,0.35)' }}>–</span>
                                <input
                                  type="number" min="0" max="255"
                                  defaultValue={rule.then.mapToRange[1]}
                                  title="mapToRange high byte"
                                  style={numStyle}
                                  onChange={(e) => patchRule(r => ({ ...r, then: { ...r.then, mapToRange: [r.then.mapToRange![0], parseByte(e.target.value)] as [number, number] } }))}
                                />
                              </>
                            )}
                            <button
                              title="Move rule up (evaluated earlier)"
                              disabled={ri === 0}
                              style={{ ...selStyle, cursor: 'pointer', opacity: ri === 0 ? 0.3 : 1 }}
                              onClick={() => {
                                const next = [...gov.rules]
                                ;[next[ri - 1], next[ri]] = [next[ri], next[ri - 1]]
                                setRules(next)
                              }}
                            >↑</button>
                            <button
                              title="Move rule down (evaluated later)"
                              disabled={ri === gov.rules.length - 1}
                              style={{ ...selStyle, cursor: 'pointer', opacity: ri === gov.rules.length - 1 ? 0.3 : 1 }}
                              onClick={() => {
                                const next = [...gov.rules]
                                ;[next[ri], next[ri + 1]] = [next[ri + 1], next[ri]]
                                setRules(next)
                              }}
                            >↓</button>
                            <button
                              title="Delete this rule"
                              style={{ ...selStyle, cursor: 'pointer', color: '#f87171', border: '1px solid rgba(248,113,113,0.4)' }}
                              onClick={() => {
                                const next = gov.rules.filter((_, i) => i !== ri)
                                dispatch({
                                  type: 'GOVERNOR_SET_FOR_CHANNEL',
                                  channelIndex: idx,
                                  governor: next.length > 0 ? { ...gov, rules: next } : null,
                                })
                              }}
                            >✕</button>
                          </div>
                        )
                      })}
                      <button
                        className="btn-governor-add-rule"
                        title="Append a new rule (evaluated top-to-bottom, first match wins)"
                        style={{ alignSelf: 'flex-start', background: 'rgba(245,158,11,0.12)', border: '1px dashed rgba(245,158,11,0.5)', color: '#fbbf24', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer', fontSize: '10px', fontFamily: 'inherit' }}
                        onClick={() => {
                          const newRule: IGovernorRule = {
                            when: { intentType: intentForChannel(channel.type), min: 0.85 },
                            then: { forceByte: 255 },
                          }
                          dispatch({
                            type: 'GOVERNOR_SET_FOR_CHANNEL',
                            channelIndex: idx,
                            governor: { ...activeGov, rules: [...activeGov.rules, newRule] },
                          })
                        }}
                      >
                        + Add rule
                      </button>
                    </div>
                  )}
                  {!activeGov && (
                    <input
                      type="number"
                      min="0"
                      max="255"
                      autoFocus
                      defaultValue={255}
                      onChange={(e) => {
                        const safeByte = Math.min(255, Math.max(0, parseInt(e.target.value) || 0))
                        dispatch({
                          type: 'GOVERNOR_SET_FOR_CHANNEL',
                          channelIndex: idx,
                          governor: {
                            channelIndex: idx,
                            description: `${channel.type.toUpperCase()} safety limit`,
                            rules: [{
                              when: { intentType: intentForChannel(channel.type), min: 0.85 },
                              then: { forceByte: safeByte }
                            }]
                          }
                        })
                      }}
                    />
                  )}
                  <button
                    className="btn-drawer-kill"
                    onClick={() => {
                      dispatch({ type: 'GOVERNOR_SET_FOR_CHANNEL', channelIndex: idx, governor: null })
                      setEditingGovIdx(null)
                    }}
                  >
                    ✕ Remove
                  </button>
                </div>
              )}
            </div>
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
